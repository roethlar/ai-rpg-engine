const DEFAULT_CAPABILITIES = Object.freeze({ provider: null, maxSegmentsPerRequest: 1 });
const MAX_SEGMENTS_PER_REQUEST = 40;
const MAX_SEGMENT_LENGTH = 2000;
const MAX_REQUEST_TEXT = 15000;
const VOICE_PROVIDERS = new Set(['openai', 'grok']);

function boundedPositiveInteger(value, fallback = 1) {
  return Number.isInteger(value) && value > 0
    ? Math.min(value, MAX_SEGMENTS_PER_REQUEST)
    : fallback;
}

function splitText(value) {
  let remaining = String(value || '').replace(/\s+/g, ' ').trim();
  const chunks = [];
  while (remaining) {
    if (remaining.length <= MAX_SEGMENT_LENGTH) {
      chunks.push(remaining);
      break;
    }
    const window = remaining.slice(0, MAX_SEGMENT_LENGTH + 1);
    const whitespace = window.lastIndexOf(' ');
    const cut = whitespace >= Math.floor(MAX_SEGMENT_LENGTH * 0.6)
      ? whitespace
      : MAX_SEGMENT_LENGTH;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  return chunks;
}

/** Normalize and bound the exact lines the production queue will send. */
export function normalizeVoiceLines(lines, fallbackText = '') {
  const source = Array.isArray(lines) && lines.length > 0
    ? lines
    : [{ speaker: 'narrator', tone: 'neutral', text: fallbackText }];
  return source.flatMap(line => {
    const speaker = typeof line?.speaker === 'string' && line.speaker.trim()
      ? line.speaker.trim()
      : 'narrator';
    const tone = typeof line?.tone === 'string' && line.tone.trim()
      ? line.tone.trim()
      : 'neutral';
    return splitText(line?.text).map(text => ({ speaker, tone, text }));
  });
}

/**
 * Grok can synthesize adjacent lines from one speaker while retaining a tag
 * per segment. OpenAI advertises a limit of one, producing singleton runs.
 */
export function buildNarrationRuns(lines, maxSegmentsPerRequest = 1) {
  const limit = boundedPositiveInteger(maxSegmentsPerRequest);
  const runs = [];
  for (const line of lines || []) {
    if (!line?.text) continue;
    const previous = runs.at(-1);
    const previousLength = previous
      ? previous.segments.reduce((total, segment) => total + segment.text.length, 0)
      : 0;
    if (previous
      && previous.speaker === line.speaker
      && previous.segments.length < limit
      && previousLength + line.text.length <= MAX_REQUEST_TEXT) {
      previous.segments.push({ text: line.text, tone: line.tone });
    } else {
      runs.push({
        speaker: line.speaker || 'narrator',
        segments: [{ text: line.text, tone: line.tone || 'neutral' }]
      });
    }
  }
  return runs;
}

function normalizeCapabilities(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_CAPABILITIES;
  const provider = typeof value.provider === 'string' ? value.provider.trim() : '';
  if (!VOICE_PROVIDERS.has(provider)) return DEFAULT_CAPABILITIES;
  if (!Number.isInteger(value.maxSegmentsPerRequest)
    || value.maxSegmentsPerRequest < 1
    || value.maxSegmentsPerRequest > MAX_SEGMENTS_PER_REQUEST) {
    return DEFAULT_CAPABILITIES;
  }
  if (provider === 'openai' && value.maxSegmentsPerRequest !== 1) return DEFAULT_CAPABILITIES;
  return {
    provider,
    maxSegmentsPerRequest: boundedPositiveInteger(value.maxSegmentsPerRequest)
  };
}

async function capabilitiesOrSingleton(loadCapabilities) {
  try {
    return normalizeCapabilities(await loadCapabilities());
  } catch {
    return DEFAULT_CAPABILITIES;
  }
}

function flattenRuns(runs) {
  return runs.flatMap(run => run.segments.map(segment => ({
    speaker: run.speaker,
    text: segment.text,
    tone: segment.tone
  })));
}

/**
 * Dependency-injected production queue policy. Failed runs are skipped; one
 * provider refresh is allowed, then repeated races degrade to provider-agnostic
 * singletons so an admin flipping providers cannot create a retry loop.
 */
export async function runVoiceNarration(lines, {
  loadCapabilities,
  synthesize,
  play,
  onError = () => {},
  isCancelled = () => false
}) {
  if (!Array.isArray(lines) || lines.length === 0) return { hadError: false };

  let capabilities = await capabilitiesOrSingleton(loadCapabilities);
  let queue = buildNarrationRuns(lines, capabilities.maxSegmentsPerRequest);
  let providerRefreshes = 0;
  let errorReported = false;
  let hadError = false;

  while (queue.length > 0) {
    if (isCancelled()) return { hadError, cancelled: true };
    const run = queue.shift();
    try {
      const audio = await synthesize(run, capabilities.provider);
      if (isCancelled()) return { hadError, cancelled: true };
      await play(audio);
    } catch (error) {
      if (error?.code === 'VOICE_PROVIDER_CHANGED' && capabilities.provider) {
        const remaining = flattenRuns([run, ...queue]);
        if (providerRefreshes === 0) {
          providerRefreshes += 1;
          capabilities = await capabilitiesOrSingleton(loadCapabilities);
        } else {
          capabilities = DEFAULT_CAPABILITIES;
        }
        queue = buildNarrationRuns(remaining, capabilities.maxSegmentsPerRequest);
        continue;
      }

      hadError = true;
      if (!errorReported) {
        errorReported = true;
        onError(error);
      }
    }
  }

  return { hadError, cancelled: false };
}
