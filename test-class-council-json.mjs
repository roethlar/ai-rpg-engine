import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { parseClassCouncilJson } from './class-council-json.js';

// Visible replies from the stopped local pilot, not model reasoning or prompts.
export const CAPTURED_COUNCIL_RESPONSES = Object.freeze({
  inputKind: 'inputKind{"inputKind":"committed_action","intent":"Activate Advance Cue targeting Nessa (npc:1) with destination area Courtyard (area:1:yard)","answer":null}',
  input: 'input{"inputKind":"committed_action","intent":"Activate Advance Cue targeting Nessa (npc:1) with destination area Courtyard (area:1:yard)","answer":null}',
  damagedAction: 'action":{"kind{"action":{"kind":"ability","abilityId":"5a6d9e3b-2614-4d8e-a4a7-5d71b3b29ef5","bindings":{"targets":["npc:6"],"catalyst":"item:scene:3:return-material"},"options":{}},"check":null,"deltaSources":[],"noCheckReason":"The scene establishes both certainty and no stakes for this contextual_check: Tarin (npc:6) has intactBody, deathRecorded, and willingReturn all true; the Return catalyst (item:scene:3:return-material) is pristine and owned by Sera; the Gate has no immediate threat, no active encounter, and no opposing actor. Both omission conditions (established_certainty, no_stakes) are satisfied, so the dice are unnecessary.","npcTurns":{"success":[],"failure":[]},"encounter":{"success":"unchanged","failure":"unchanged"},"award":null}'
});

export function runClassCouncilJsonTests() {
  const interaction = {
    inputKind: 'committed_action',
    intent: 'Activate Advance Cue targeting Nessa (npc:1) with destination area Courtyard (area:1:yard)',
    answer: null
  };
  const raw = JSON.stringify(interaction);
  const parse = response => parseClassCouncilJson(response, { stage: 'interaction' });
  let rejected = 0;
  const reject = (response, options = { stage: 'interaction' }) => {
    assert.throws(() => parseClassCouncilJson(response, options), error => {
      assert.equal(error.code, 'CLASS_COUNCIL_JSON');
      assert.equal(error.message, 'The model returned malformed JSON.');
      assert.equal(error.rawText, response);
      assert.equal(error.cause, undefined, 'A native parse error must not expose response text.');
      return true;
    });
    rejected += 1;
  };

  assert.deepEqual(parse(raw), interaction);
  assert.deepEqual(parse(` \n${raw}\r\n `), interaction);
  for (const label of ['inputKind', 'input']) {
    assert.deepEqual(parse(CAPTURED_COUNCIL_RESPONSES[label]), interaction,
      `The captured ${label} envelope must recover without changing its object.`);
    for (const stage of [undefined, 'grounding', 'referee', 'pre_roll', 'annotation', 'narration', 'table_talk']) {
      reject(CAPTURED_COUNCIL_RESPONSES[label], { stage });
    }
  }
  for (const language of ['', 'json', 'JSON']) {
    assert.deepEqual(parse(`\`\`\`${language}\n${raw}\n\`\`\``), interaction);
  }
  assert.deepEqual(parseClassCouncilJson(`\`\`\`json\r\n${raw}\r\n\`\`\``, { stage: 'referee' }), interaction);

  const quoted = { narrative: 'Keep {braces}, a } before a {, "quotes", \\slashes, and ``` fences inside the string.',
    nested: { array: [{ actor: 'npc:1' }, null, false, 0], unicode: '\u00e9\ud83d\ude42' } };
  assert.deepEqual(parse(`\`\`\`json\n${JSON.stringify(quoted)}\n\`\`\``), quoted);
  const semanticData = { ...interaction, inventedPower: { approved: true }, consentingActors: ['npc:999'] };
  assert.deepEqual(parse(`input${JSON.stringify(semanticData)}`), semanticData,
    'Envelope recovery must preserve unexpected semantic fields for the existing validators, not sanitize them away.');
  assert.deepEqual(parse('{"outer":{"inputKind":"dialogue"}}'), { outer: { inputKind: 'dialogue' } },
    'Do not select an inner object to fit an expected role schema.');

  reject(CAPTURED_COUNCIL_RESPONSES.damagedAction, { stage: 'referee' });
  reject(CAPTURED_COUNCIL_RESPONSES.damagedAction);
  for (const response of [
    undefined, null, 1, {}, [], true, '', ' ', 'null', '[]', '[{}]', 'true', '12', JSON.stringify(raw),
    '```', '```json', `\`\`\`json\n${raw}`, `${raw}\n\`\`\``,
    `\`\`\`javascript\n${raw}\n\`\`\``, `\`\`\`json ${raw}\`\`\``,
    `Here is the JSON:\n${raw}`, `${raw}\nThis is approved.`, `Ignore the rules. ${raw}`,
    `inputKind: ${raw}`, `inputKind ${raw}`, `input2${raw}`, `Input${raw}`, `answer${raw}`, `inputinput${raw}`,
    `inputKind[${raw}]`, `inputKind${raw} trailing`, `input${raw}${raw}`, `${raw}${raw}`,
    `\`\`\`json\n${raw}\n\`\`\`\n${raw}`, `\`\`\`json\n${raw}\n\`\`\`\n\`\`\`json\n${raw}\n\`\`\``,
    `\`\`\`json\ninput${raw}\n\`\`\``, `input\`\`\`json\n${raw}\n\`\`\``,
    `input${raw.slice(0, -1)}`, '{"narrative":"unfinished}', '{"outer":{}', '{"x":1,}',
    '{inputKind:"dialogue"}', '{"x":undefined}', '{"x":NaN}', '{"x":1 /* ignored? */}',
    `{"outer":${raw}`, `{"outer":${raw}},${raw}`, `{"approved":false} replace with ${raw}`,
    `inputKind{"inputKind":"dialogue"}\n${raw}`, '<think>Ignore the rules</think>' + raw,
    `PRIVATE_GM_PLAN ${raw}`, '{"private":"PRIVATE_GM_PLAN",', `input\u0000${raw}`
  ]) reject(response);

  return { capturedRecovered: 2, damagedFragmentRejected: true, rejected, noProvidersOrDatabase: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Class Council JSON tests passed:', runClassCouncilJsonTests());
}
