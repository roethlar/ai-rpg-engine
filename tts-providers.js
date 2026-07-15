/**
 * TTS provider seam (Phase 2 groundwork, provider-strategy topic in plan.md):
 * speech synthesis goes through a provider registry so the engine never
 * hard-codes a vendor. OpenAI is the baseline/fallback implementation; new
 * providers (e.g. voice-cloning services for unique NPC voices) register here
 * with the same signature and become selectable in /admin.
 */

export const OPENAI_TTS_MODELS = Object.freeze(['gpt-4o-mini-tts', 'gpt-4o-mini-tts-2025-12-15', 'tts-1', 'tts-1-hd']);
export const OPENAI_TTS_VOICES = Object.freeze(['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'marin', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'cedar']);
export const GROK_TTS_VOICES = Object.freeze([
  'altair', 'atlas', 'castor', 'cosmo', 'helios', 'helix', 'kepler', 'leo', 'lumen', 'lux', 'naksh',
  'orion', 'perseus', 'rex', 'rigel', 'sal', 'sirius', 'zagan', 'zenith',
  'ara', 'carina', 'celeste', 'eve', 'iris', 'luna', 'ursa'
]);

export const TTS_MODELS = new Set(OPENAI_TTS_MODELS);
// Compatibility exports used by the current OpenAI-shaped audio route. v3
// replaces those gates together with the client request cutover.
export const TTS_VOICES = new Set(OPENAI_TTS_VOICES);
const MAX_INSTRUCTIONS_LENGTH = 600;

const OPENAI_NPC_POOL = Object.freeze(['cedar', 'ash', 'onyx', 'coral', 'sage', 'ballad', 'verse', 'nova', 'echo', 'shimmer', 'alloy', 'fable']);
const GROK_NPC_POOL = Object.freeze(GROK_TTS_VOICES.filter(voice => voice !== 'leo'));

const TTS_PROVIDER_REGISTRY = Object.freeze({
  openai: Object.freeze({
    voices: OPENAI_TTS_VOICES,
    voiceSet: new Set(OPENAI_TTS_VOICES),
    narratorVoice: 'marin',
    npcPool: OPENAI_NPC_POOL,
    models: OPENAI_TTS_MODELS,
    hasModel: true,
    maxSegmentsPerRequest: 1,
    synthesize: synthesizeOpenAI
  }),
  grok: Object.freeze({
    voices: GROK_TTS_VOICES,
    voiceSet: new Set(GROK_TTS_VOICES),
    narratorVoice: 'leo',
    npcPool: GROK_NPC_POOL,
    models: Object.freeze([]),
    hasModel: false,
    maxSegmentsPerRequest: 40,
    synthesize: synthesizeGrok
  })
});

function providerId(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return Object.hasOwn(TTS_PROVIDER_REGISTRY, normalized) ? normalized : 'openai';
}

export function getTtsProviderCatalog() {
  return Object.entries(TTS_PROVIDER_REGISTRY).map(([provider, config]) => ({
    provider,
    voices: [...config.voices],
    narratorVoice: config.narratorVoice,
    models: [...config.models],
    hasModel: config.hasModel,
    maxSegmentsPerRequest: config.maxSegmentsPerRequest
  }));
}

export function validateTtsVoice(voice, provider = 'openai') {
  const config = TTS_PROVIDER_REGISTRY[providerId(provider)];
  return config.voiceSet.has(voice) ? voice : config.narratorVoice;
}

/**
 * A voice profile is the stored voice identity of a speaker (the GM narrator
 * or an NPC): the audio analog of canon commitment. Persisted in campaign
 * state (campaigns.narrator_voice_json / npcs.voice_json) so a speaker sounds
 * the same across turns. Consumed once structured narration carries per-line
 * speakers (Phase 2); the plumbing exists now so profiles can be recorded.
 */
export function validateVoiceProfile(raw, activeProvider) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const provider = providerId(activeProvider || data.provider);
  return {
    provider,
    voice: validateTtsVoice(data.voice, provider),
    instructions: typeof data.instructions === 'string' ? data.instructions.trim().slice(0, MAX_INSTRUCTIONS_LENGTH) : ''
  };
}

/**
 * NPC voice assignment (Phase 2): deterministic pool pick + character
 * direction derived from the NPC's recorded personality/quirks. Assigned once
 * at NPC creation and stored in npcs.voice_json — sticky by construction.
 * 'marin' is excluded so NPCs are distinct from the default narrator voice.
 */
export const NPC_VOICE_POOL = [...OPENAI_NPC_POOL];

export function assignNpcVoiceProfile(npc, index) {
  const voice = NPC_VOICE_POOL[Math.abs(index) % NPC_VOICE_POOL.length];
  const parts = [`Character voice for ${npc.name}.`];
  if (npc.personality) parts.push(`Personality: ${npc.personality}.`);
  if (npc.quirks) parts.push(`Speech habits: ${npc.quirks}.`);
  return validateVoiceProfile({ provider: 'openai', voice, instructions: parts.join(' ') }, 'openai');
}

async function synthesizeOpenAI({ apiKey, model, voice, instructions, text }) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required for voice narration.');
  }

  const resolvedModel = TTS_MODELS.has(model) ? model : 'gpt-4o-mini-tts';
  const resolvedVoice = validateTtsVoice(voice, 'openai');

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

function isMp3(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 2) return false;
  const hasId3 = buffer.length >= 3 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
  const hasFrameSync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
  return hasId3 || hasFrameSync;
}

async function synthesizeGrok({ apiKey, voice, text, language = 'en', speed = 1 }) {
  if (!apiKey) {
    throw new Error('xAI API key is required for voice narration.');
  }

  const response = await fetch('https://api.x.ai/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      voice_id: validateTtsVoice(voice, 'grok'),
      language: typeof language === 'string' && language.trim() ? language.trim() : 'en',
      output_format: { codec: 'mp3' },
      speed: Number.isFinite(speed) ? speed : 1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`xAI speech error: ${response.statusText} - ${errorText}`);
    error.status = response.status;
    throw error;
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (!isMp3(audio)) {
    throw new Error('xAI speech response was not MP3 audio.');
  }
  return audio;
}

export function listTtsProviders() {
  return Object.keys(TTS_PROVIDER_REGISTRY);
}

/**
 * Synthesizes speech through the configured provider. Returns an MP3 Buffer.
 */
export async function synthesizeSpeech({ provider = 'openai', ...args }) {
  const config = TTS_PROVIDER_REGISTRY[provider];
  if (!config) {
    throw new Error(`Unsupported TTS provider: "${provider}". Available: ${listTtsProviders().join(', ')}.`);
  }
  return config.synthesize(args);
}
