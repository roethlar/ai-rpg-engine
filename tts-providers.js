/**
 * TTS provider seam (Phase 2 groundwork, provider-strategy topic in plan.md):
 * speech synthesis goes through a provider registry so the engine never
 * hard-codes a vendor. OpenAI is the baseline/fallback implementation; new
 * providers (e.g. voice-cloning services for unique NPC voices) register here
 * with the same signature and become selectable in /admin.
 */

export const TTS_MODELS = new Set(['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15', 'tts-1', 'tts-1-hd']);
export const TTS_VOICES = new Set(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'marin', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'cedar']);
const MAX_INSTRUCTIONS_LENGTH = 600;

/**
 * A voice profile is the stored voice identity of a speaker (the GM narrator
 * or an NPC): the audio analog of canon commitment. Persisted in campaign
 * state (campaigns.narrator_voice_json / npcs.voice_json) so a speaker sounds
 * the same across turns. Consumed once structured narration carries per-line
 * speakers (Phase 2); the plumbing exists now so profiles can be recorded.
 */
export function validateVoiceProfile(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    provider: typeof data.provider === 'string' && data.provider.trim() !== '' ? data.provider.trim() : 'openai',
    voice: TTS_VOICES.has(data.voice) ? data.voice : 'marin',
    instructions: typeof data.instructions === 'string' ? data.instructions.trim().slice(0, MAX_INSTRUCTIONS_LENGTH) : ''
  };
}

async function synthesizeOpenAI({ apiKey, model, voice, instructions, text }) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required for voice narration.');
  }

  const resolvedModel = TTS_MODELS.has(model) ? model : 'gpt-4o-mini-tts';
  const resolvedVoice = TTS_VOICES.has(voice) ? voice : 'marin';

  const requestBody = {
    model: resolvedModel,
    voice: resolvedVoice,
    input: text,
    response_format: 'mp3'
  };
  // Only the gpt-4o-mini-tts generation is instruction-steerable (accents,
  // emotion, pacing); tts-1 models have a fixed voice character.
  if (resolvedModel.startsWith('gpt-4o-mini-tts') && instructions) {
    requestBody.instructions = instructions;
  }

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`OpenAI speech error: ${response.statusText} - ${errorText}`);
    error.status = response.status;
    throw error;
  }

  return Buffer.from(await response.arrayBuffer());
}

const TTS_PROVIDERS = {
  openai: synthesizeOpenAI
};

export function listTtsProviders() {
  return Object.keys(TTS_PROVIDERS);
}

/**
 * Synthesizes speech through the configured provider. Returns an MP3 Buffer.
 */
export async function synthesizeSpeech({ provider = 'openai', ...args }) {
  const impl = TTS_PROVIDERS[provider];
  if (!impl) {
    throw new Error(`Unsupported TTS provider: "${provider}". Available: ${listTtsProviders().join(', ')}.`);
  }
  return impl(args);
}
