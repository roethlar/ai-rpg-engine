import crypto from 'crypto';
import * as db from './db.js';
import { getServerAiConfig } from './server-config.js';
import {
  getTtsProviderCatalog,
  resolveNarratorVoiceProfile,
  resolveNpcVoiceProfile,
  synthesizeSpeech,
  validateVoiceDelivery
} from './tts-providers.js';
import { TtsCache } from './tts-cache.js';

const MAX_SEGMENTS = 40;
const MAX_SEGMENT_LENGTH = 2000;
const MAX_REQUEST_TEXT = 15000;
const MAX_SPEAKER_LENGTH = 80;

export class VoiceRequestError extends Error {
  constructor(status, message, code = null) {
    super(message);
    this.name = 'VoiceRequestError';
    this.status = status;
    this.code = code;
  }
}

export class SynthesisMissLimiter {
  constructor({ limit = 60, windowMs = 60000, now = Date.now } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.hits = new Map();
  }

  clear() {
    this.hits.clear();
  }

  take(key = 'unknown') {
    const now = this.now();
    const recent = (this.hits.get(key) || []).filter(timestamp => timestamp > now - this.windowMs);
    if (recent.length >= this.limit) {
      throw new VoiceRequestError(429, 'Voice synthesis rate limit exceeded.', 'VOICE_SYNTHESIS_RATE_LIMIT');
    }
    recent.push(now);
    this.hits.set(key, recent);
  }
}

export const voiceSynthesisCache = new TtsCache();
export const voiceSynthesisMissLimiter = new SynthesisMissLimiter();

export function resetVoiceNarrationState() {
  voiceSynthesisCache.clear();
  voiceSynthesisMissLimiter.clear();
}

/** Existing narration cleanup first, then remove every bracket directive. */
export function cleanSpokenText(value) {
  if (typeof value !== 'string') {
    throw new VoiceRequestError(400, 'Segment text must be a string.');
  }
  const cleaned = value
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_#>`~]/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) throw new VoiceRequestError(400, 'Segment text is required.');
  if (cleaned.length > MAX_SEGMENT_LENGTH) {
    throw new VoiceRequestError(400, `Segment text must be ${MAX_SEGMENT_LENGTH} characters or fewer.`);
  }
  return cleaned;
}

function cleanSpeaker(value) {
  if (value === undefined || value === null || value === '') return 'narrator';
  if (typeof value !== 'string') throw new VoiceRequestError(400, 'speaker must be a string.');
  const speaker = value.trim();
  if (!speaker) return 'narrator';
  if (speaker.length > MAX_SPEAKER_LENGTH) {
    throw new VoiceRequestError(400, `speaker must be ${MAX_SPEAKER_LENGTH} characters or fewer.`);
  }
  return speaker;
}

function parseHostCampaignId(value) {
  const parsed = typeof value === 'number'
    ? value
    : (typeof value === 'string' && /^[1-9]\d*$/.test(value.trim()) ? Number(value) : NaN);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new VoiceRequestError(400, 'Invalid campaignId.');
  }
  return parsed;
}

function validateSegments(raw, maxSegments) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_SEGMENTS) {
    throw new VoiceRequestError(400, `segments must contain between 1 and ${MAX_SEGMENTS} entries.`);
  }
  if (raw.length > maxSegments) {
    throw new VoiceRequestError(400, `The active voice provider accepts at most ${maxSegments} segment(s) per request.`);
  }
  const segments = raw.map(segment => {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) {
      throw new VoiceRequestError(400, 'Each segment must be an object.');
    }
    return { text: cleanSpokenText(segment.text), tone: validateVoiceDelivery(segment.tone) };
  });
  if (segments.reduce((total, segment) => total + segment.text.length, 0) > MAX_REQUEST_TEXT) {
    throw new VoiceRequestError(400, `Narration requests must be ${MAX_REQUEST_TEXT} characters or fewer.`);
  }
  return segments;
}

function renderDelivery(provider, profile, segments) {
  const mood = validateVoiceDelivery(profile.mood);
  if (provider === 'grok') {
    const text = segments.map(segment => {
      const tags = [mood, segment.tone].filter(value => value !== 'neutral');
      return `${tags.length ? `[${tags.join(', ')}] ` : ''}${segment.text}`;
    }).join(' ');
    return { text, instructions: '' };
  }
  const tone = segments[0].tone;
  return {
    text: segments[0].text,
    instructions: [
      mood !== 'neutral' ? `Mood: ${mood}.` : '',
      tone !== 'neutral' ? `Tone: ${tone}.` : ''
    ].filter(Boolean).join(' ')
  };
}

function canonicalCacheKey(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export async function getVoiceCapabilities() {
  const config = await getServerAiConfig();
  const capability = getTtsProviderCatalog().find(entry => entry.provider === config.voiceProvider);
  return { provider: capability.provider, maxSegmentsPerRequest: capability.maxSegmentsPerRequest };
}

export function getAdminVoiceCatalog() {
  return getTtsProviderCatalog().map(entry => ({
    provider: entry.provider,
    voices: entry.voices,
    narratorVoice: entry.narratorVoice,
    hasModel: entry.hasModel,
    maxSegmentsPerRequest: entry.maxSegmentsPerRequest
  }));
}

export async function narrateVoiceRequest({ auth, body, requester = 'unknown' }) {
  const request = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const preview = request.preview === true;
  const speaker = cleanSpeaker(request.speaker);

  if (preview) {
    if (Object.prototype.hasOwnProperty.call(request, 'campaignId') || speaker.toLowerCase() !== 'narrator') {
      throw new VoiceRequestError(400, 'Preview cannot include campaignId or a non-narrator speaker.');
    }
  }

  const config = await getServerAiConfig();
  const capability = getTtsProviderCatalog().find(entry => entry.provider === config.voiceProvider);
  if (!capability) throw new VoiceRequestError(500, 'The active voice provider is unavailable.');
  if (request.expectedProvider !== undefined) {
    if (typeof request.expectedProvider !== 'string') {
      throw new VoiceRequestError(400, 'expectedProvider must be a string.');
    }
    if (request.expectedProvider !== capability.provider) {
      throw new VoiceRequestError(409, 'Voice provider changed; refresh capabilities.', 'VOICE_PROVIDER_CHANGED');
    }
  }

  const segments = validateSegments(request.segments, capability.maxSegmentsPerRequest);
  if (preview && segments.length !== 1) {
    throw new VoiceRequestError(400, 'Preview requires exactly one segment.');
  }

  let campaignId = null;
  let profile;
  if (preview) {
    profile = resolveNarratorVoiceProfile(null, capability.provider);
  } else {
    campaignId = auth?.kind === 'seat'
      ? auth.campaignId
      : parseHostCampaignId(request.campaignId);
    const campaign = await db.get(
      `SELECT id, narrator_voice_json FROM campaigns WHERE id = ?`,
      [campaignId]
    );
    if (!campaign) throw new VoiceRequestError(404, 'Campaign not found.');

    const npcs = await db.all(
      `SELECT id, name, voice_json FROM npcs WHERE campaign_id = ? ORDER BY id ASC`,
      [campaignId]
    );
    const npcIndex = npcs.findIndex(npc => npc.name.toLowerCase() === speaker.toLowerCase());
    profile = npcIndex >= 0
      ? resolveNpcVoiceProfile(npcs[npcIndex].voice_json, capability.provider, npcIndex)
      : resolveNarratorVoiceProfile(campaign.narrator_voice_json, capability.provider);
  }

  const rendered = renderDelivery(capability.provider, profile, segments);
  const cacheKey = canonicalCacheKey({
    scope: preview ? 'preview' : campaignId,
    provider: capability.provider,
    model: capability.provider === 'openai' ? (config.voiceModel || '') : '',
    voice: profile.voice,
    instructions: rendered.instructions,
    text: rendered.text
  });
  const result = await voiceSynthesisCache.getOrCreate(cacheKey, async () => {
    voiceSynthesisMissLimiter.take(requester);
    return synthesizeSpeech({
      provider: capability.provider,
      apiKey: config.voiceApiKey,
      model: config.voiceModel,
      voice: profile.voice,
      instructions: rendered.instructions,
      text: rendered.text
    });
  });
  return { audio: result.buffer, cache: result.cache };
}
