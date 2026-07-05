/**
 * Image provider seam (Phase V1, decision 2026-07-03): scene/heroic image
 * generation goes through a provider registry so the engine never hard-codes
 * a vendor. OpenAI Images is the hosted implementation; sdwebui talks to any
 * local Stable-Diffusion-WebUI-compatible endpoint (the owner-hardware dev
 * path). New providers register here with the same signature and become
 * selectable in /admin.
 *
 * The interface carries an identity anchor from day one (owner direction
 * 2026-06-13): the same NPC/location must render as the same subject across
 * turns. Providers use whatever conditioning they support — sdwebui honors
 * the seed; every provider receives the identity descriptor folded into the
 * prompt — and callers record the returned seed as the anchor for reuse.
 */

const MAX_PROMPT_LENGTH = 4000;
const MAX_DESCRIPTOR_LENGTH = 800;
const IMAGE_TIMEOUT_MS = Number(process.env.IMAGE_TIMEOUT_MS || 240000);

/**
 * An identity anchor is the stored visual identity of a subject (an NPC, a
 * location, or a composition): the visual analog of canon commitment.
 * `descriptor` is the stable appearance description, `seed` the provider seed
 * that produced the first render. Persisted in campaign state, never in
 * server settings.
 */
export function validateIdentityAnchor(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const seed = Number(data.seed);
  return {
    descriptor: typeof data.descriptor === 'string'
      ? data.descriptor.trim().slice(0, MAX_DESCRIPTOR_LENGTH)
      : '',
    seed: Number.isFinite(seed) && seed >= 0 ? Math.floor(seed) : null
  };
}

function composePrompt(prompt, anchor) {
  const base = typeof prompt === 'string' ? prompt.trim().slice(0, MAX_PROMPT_LENGTH) : '';
  if (!anchor.descriptor) return base;
  return `${base}\n\nSubject identity (must stay visually consistent with prior renders): ${anchor.descriptor}`;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`Image generation timed out (limit: ${IMAGE_TIMEOUT_MS / 1000}s)`);
      timeoutError.transient = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

function providerApiError(label, response, errText) {
  const error = new Error(`${label} image error: ${response.status} ${response.statusText} - ${errText}`);
  error.status = response.status;
  return error;
}

/**
 * Maps a requested width/height to the fixed size strings the OpenAI Images
 * API accepts (which differ per model family): landscape, portrait, or square.
 */
function openAiSizeFor(model, width, height) {
  const aspect = width / height;
  const landscape = model.startsWith('dall-e') ? '1792x1024' : '1536x1024';
  const portrait = model.startsWith('dall-e') ? '1024x1792' : '1024x1536';
  if (aspect > 1.2) return landscape;
  if (aspect < 0.8) return portrait;
  return '1024x1024';
}

async function generateOpenAI({ apiKey, model, prompt, anchor, width, height }) {
  if (!apiKey) {
    throw new Error('OpenAI API key is missing for image generation.');
  }
  const resolvedModel = model || 'gpt-image-1';

  const requestBody = {
    model: resolvedModel,
    prompt: composePrompt(prompt, anchor),
    n: 1,
    size: openAiSizeFor(resolvedModel, width, height)
  };
  // gpt-image-* models always return base64 and reject response_format;
  // dall-e models default to short-lived URLs unless asked for base64.
  if (resolvedModel.startsWith('dall-e')) {
    requestBody.response_format = 'b64_json';
  }

  // Pinned to the official endpoint (same key-safety rule as the text
  // providers): a configurable endpoint must never receive this bearer key.
  const response = await fetchWithTimeout('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw providerApiError('OpenAI', response, await response.text());
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI image response contained no image data.');
  }
  return { image: Buffer.from(b64, 'base64'), mimeType: 'image/png', seed: null };
}

async function generateSdWebui({ endpoint, model, prompt, negativePrompt, anchor, width, height }) {
  if (!endpoint) {
    throw new Error('SD-WebUI endpoint is missing for image generation (set it in /admin or IMAGE_ENDPOINT_URL).');
  }
  let base;
  try {
    base = new URL(endpoint);
  } catch (e) {
    throw new Error(`SD-WebUI endpoint is not a valid URL: ${endpoint}`);
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new Error('SD-WebUI endpoint must be an HTTP(S) URL.');
  }

  const requestBody = {
    prompt: composePrompt(prompt, anchor),
    negative_prompt: typeof negativePrompt === 'string' ? negativePrompt.slice(0, MAX_PROMPT_LENGTH) : '',
    seed: anchor.seed ?? -1,
    // SD checkpoints want multiples of 8.
    width: Math.round(width / 8) * 8,
    height: Math.round(height / 8) * 8
  };
  if (model) {
    requestBody.override_settings = { sd_model_checkpoint: model };
  }

  // Deliberately no Authorization header: this is the sanctioned
  // configurable-endpoint provider, so no cloud API key may ever ride along.
  const response = await fetchWithTimeout(new URL('/sdapi/v1/txt2img', base).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    throw providerApiError('SD-WebUI', response, await response.text());
  }

  const data = await response.json();
  const b64 = Array.isArray(data?.images) ? data.images[0] : null;
  if (!b64) {
    throw new Error('SD-WebUI response contained no image data.');
  }

  // The actual seed used comes back in the stringified info blob; recording it
  // is what makes the first render's identity reproducible on later renders.
  let seed = anchor.seed;
  try {
    const info = JSON.parse(data.info || '{}');
    if (Number.isFinite(info.seed) && info.seed >= 0) seed = info.seed;
  } catch (e) {}

  return { image: Buffer.from(b64, 'base64'), mimeType: 'image/png', seed: seed ?? null };
}

const IMAGE_PROVIDERS = {
  openai: generateOpenAI,
  sdwebui: generateSdWebui
};

export function listImageProviders() {
  return Object.keys(IMAGE_PROVIDERS);
}

/**
 * Generates one image through the configured provider. Returns
 * { image: Buffer, mimeType, seed } — seed is the value to persist as the
 * subject's identity anchor (null when the provider cannot report one).
 */
export async function generateImage({ provider, identityAnchor, width, height, ...args }) {
  const impl = IMAGE_PROVIDERS[provider];
  if (!impl) {
    throw new Error(`Unsupported image provider: "${provider}". Available: ${listImageProviders().join(', ')}.`);
  }
  return impl({
    ...args,
    anchor: validateIdentityAnchor(identityAnchor),
    width: Number.isFinite(width) && width > 0 ? Math.min(2048, Math.max(256, Math.floor(width))) : 1024,
    height: Number.isFinite(height) && height > 0 ? Math.min(2048, Math.max(256, Math.floor(height))) : 768
  });
}
