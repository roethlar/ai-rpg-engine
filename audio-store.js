/**
 * Save-once turn narration (Phase V4): a turn's narration is synthesized at
 * most once, persisted under data/audio/<campaignId>/<turnNumber>/, and every
 * later listen — any seat, any replay — is served from disk. That gives
 * multiplayer tables one identical performance per turn and makes repeat
 * playback free.
 *
 * Layout: seg-<n>.mp3 (one per narration run) + manifest.json. The manifest
 * is written LAST via tmp+rename, so its presence marks a complete
 * generation; a crash mid-synthesis leaves only orphan segment files that
 * the next successful attempt overwrites.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as db from './db.js';
import { narrateVoiceRequest, getVoiceCapabilities } from './voice-narration.js';
import { buildVoiceScript } from './rpg-state.js';
import { normalizeVoiceLines, buildNarrationRuns } from './public/voice-narration.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_ROOT = path.resolve(__dirname, 'data', 'audio');
const AUDIO_MIME = 'audio/mpeg';
const MANIFEST_NAME = 'manifest.json';

export class AudioStoreError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AudioStoreError';
    this.status = status;
  }
}

// One generation per campaign:turn at a time — concurrent requests share the
// same promise instead of paying for duplicate synthesis.
const inflightGenerations = new Map();

function turnAudioDir(campaignId, turnNumber) {
  return path.join(AUDIO_ROOT, String(campaignId), String(turnNumber));
}

function assertTurnRef(campaignId, turnNumber) {
  if (!Number.isInteger(campaignId) || campaignId <= 0 ||
      !Number.isInteger(turnNumber) || turnNumber <= 0) {
    throw new AudioStoreError(400, 'Invalid audio reference.');
  }
}

// MUST stay in sync with stripNarrationText in public/app.js so the saved
// performance speaks exactly what the live path would have spoken.
function stripNarrationText(markdownText) {
  return String(markdownText || '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[*_#>`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);
}

async function readManifest(campaignId, turnNumber) {
  try {
    const raw = await fs.promises.readFile(
      path.join(turnAudioDir(campaignId, turnNumber), MANIFEST_NAME), 'utf8'
    );
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.segments)) {
      return parsed;
    }
  } catch {
    // Missing or unreadable manifest simply means "not generated yet".
  }
  return null;
}

async function writeFileAtomic(filePath, data) {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.promises.writeFile(tmpPath, data);
  await fs.promises.rename(tmpPath, filePath);
}

/**
 * Rebuild the spoken script for a stored turn exactly the way the live
 * client does: persisted narration_lines (voiced via the campaign's NPC
 * roster) with the stripped narrative as the narrator fallback.
 */
async function buildTurnQueue(campaignId, turnNumber) {
  const row = await db.get(
    `SELECT narrative, state_changes_json FROM turns WHERE campaign_id = ? AND turn_number = ?`,
    [campaignId, turnNumber]
  );
  if (!row) throw new AudioStoreError(404, 'Turn not found.');

  let record = null;
  if (typeof row.state_changes_json === 'string' && row.state_changes_json.length <= 500000) {
    try {
      const parsed = JSON.parse(row.state_changes_json);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) record = parsed;
    } catch {
      // Malformed record: fall through to the narrative-only fallback.
    }
  }
  const npcs = await db.all(
    `SELECT name, voice_json FROM npcs WHERE campaign_id = ? ORDER BY id ASC`,
    [campaignId]
  );
  // Only speaker/text/tone go onward: narrateVoiceRequest recomposes the
  // stored voice profile server-side, and the saved manifest must never
  // carry GM-private voice instructions.
  const script = buildVoiceScript(record?.narration_lines, npcs).map(line => ({
    speaker: line.speaker,
    tone: line.tone,
    text: stripNarrationText(line.text)
  }));
  return normalizeVoiceLines(script, stripNarrationText(row.narrative));
}

async function generateTurnAudio(campaignId, turnNumber) {
  const queue = await buildTurnQueue(campaignId, turnNumber);
  if (queue.length === 0) {
    throw new AudioStoreError(404, 'This turn has nothing to narrate.');
  }

  const capabilities = await getVoiceCapabilities();
  const runs = buildNarrationRuns(queue, capabilities.maxSegmentsPerRequest);

  const dir = turnAudioDir(campaignId, turnNumber);
  await fs.promises.mkdir(dir, { recursive: true });

  const segments = [];
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const { audio } = await narrateVoiceRequest({
      auth: null,
      body: { campaignId, speaker: run.speaker, segments: run.segments },
      requester: 'audio-store'
    });
    const file = `seg-${i}.mp3`;
    await writeFileAtomic(path.join(dir, file), audio);
    segments.push({
      id: i,
      file,
      mime: AUDIO_MIME,
      speaker: run.speaker ?? null,
      bytes: audio.length
    });
  }

  const manifest = {
    version: 1,
    campaignId,
    turnNumber,
    generatedAt: new Date().toISOString(),
    segments
  };
  await writeFileAtomic(
    path.join(dir, MANIFEST_NAME),
    JSON.stringify(manifest, null, 2)
  );
  return manifest;
}

/**
 * Return the turn's saved manifest, generating and persisting the audio
 * first if this is the very first listen.
 */
export async function ensureTurnAudio(campaignId, turnNumber) {
  assertTurnRef(campaignId, turnNumber);
  const existing = await readManifest(campaignId, turnNumber);
  if (existing) return existing;
  const key = `${campaignId}:${turnNumber}`;
  if (inflightGenerations.has(key)) return inflightGenerations.get(key);
  const generation = generateTurnAudio(campaignId, turnNumber).finally(() => {
    inflightGenerations.delete(key);
  });
  inflightGenerations.set(key, generation);
  return generation;
}

/**
 * The client-facing view of a manifest. Speaker names are already
 * seat-visible (scopeVoiceLinesForSeat); nothing else from the stored
 * manifest travels.
 */
export function publicTurnAudioManifest(manifest) {
  return {
    turnNumber: manifest.turnNumber,
    segments: manifest.segments.map(segment => ({
      id: segment.id,
      speaker: segment.speaker ?? null,
      mime: segment.mime || AUDIO_MIME
    }))
  };
}

export async function getTurnAudioSegment(campaignId, turnNumber, segmentId) {
  assertTurnRef(campaignId, turnNumber);
  if (!Number.isInteger(segmentId) || segmentId < 0) {
    throw new AudioStoreError(400, 'Invalid audio reference.');
  }
  const manifest = await readManifest(campaignId, turnNumber);
  if (!manifest) throw new AudioStoreError(404, 'Turn audio not found.');
  const segment = manifest.segments.find(entry => entry.id === segmentId);
  if (!segment || typeof segment.file !== 'string') {
    throw new AudioStoreError(404, 'Audio segment not found.');
  }
  // The manifest is server-written, but confine the resolved path anyway —
  // a hand-edited data dir must not become a traversal primitive.
  const dir = turnAudioDir(campaignId, turnNumber);
  const filePath = path.resolve(dir, segment.file);
  if (!filePath.startsWith(dir + path.sep)) {
    throw new AudioStoreError(404, 'Audio segment not found.');
  }
  let buffer;
  try {
    buffer = await fs.promises.readFile(filePath);
  } catch {
    throw new AudioStoreError(404, 'Audio segment unavailable.');
  }
  return { buffer, mime: segment.mime || AUDIO_MIME };
}

/** Saved narration files sit outside SQLite — ON DELETE CASCADE misses them. */
export async function deleteCampaignAudio(campaignId) {
  if (!Number.isInteger(campaignId) || campaignId <= 0) return;
  await fs.promises.rm(path.join(AUDIO_ROOT, String(campaignId)), {
    recursive: true,
    force: true
  });
}
