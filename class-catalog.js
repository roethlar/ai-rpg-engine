import { randomUUID } from 'node:crypto';

export const CATALOG_VERSION = 'expert-development-1';
export const CATALOG_RULES_VERSION = 'house-d100-1';
export const CATALOG_RESOLUTION_VERSION = 'aetheria-d100-1';
export const CATALOG_EFFECT_VERSION = 'effects-class-runtime-1';
export const CATALOG_OPTION_SET = 'expert';
export const CATALOG_LEVEL_CAP = 10;

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

const clone = value => structuredClone(value);
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const self = '$self';
const target = '$target';
const area = '$area';
const harm = (grade = 'wound', who = target) => ({ op: 'harm', who, grade });
const heal = (grade = 'patch', who = target) => ({ op: 'heal', who, grade });
const boon = (condition, who = self) => ({ op: 'boon_apply', who, condition, duration: 'scene', detail: 'Authored class capability.' });
const hinder = condition => ({ op: 'hindrance_apply', who: target, condition, duration: 'scene', detail: 'Authored class capability.' });
const clear = (condition, who = target) => ({ op: 'condition_clear', who, condition, optional: true });
const step = (who = self, quality = 'favorable') => ({ op: 'reposition', who, area, quality });
const feature = (kind, name, worksAgainst = 'opposition') => ({ op: 'scene_feature_place', area, kind, name, duration: 'scene', works_against: worksAgainst });
const reveal = (scope, maximum = 1) => ({ op: 'reveal', subject: target, scope, maximum });
const teleport = (who = self, mode = 'blink') => ({ op: 'teleport', who, area, mode, maximumAreas: 1 });
const scene = (uses = 1) => ({ kind: 'scene_use', uses });
const recovery = (uses = 1) => ({ kind: 'recovery_use', uses });
const ordinary = { kind: 'none' };
const commit = { kind: 'commitment' };

function action(name, description, options = {}) {
  return {
    name, description, activation: 'main', targeting: { kind: 'enemy', range: 'engaged', maximum: 1 },
    cadence: ordinary, cost: { resource: null, amount: 0 },
    check: { mode: 'contextual', skill: 'melee', defaultTier: 'standard' },
    requirements: [], onSuccess: [], onFailure: [], mechanic: { kind: 'none' },
    ...options
  };
}

function passive(name, description, modifiers) {
  return action(name, description, {
    activation: 'passive', targeting: { kind: 'self', range: 'self', maximum: 1 }, check: null,
    mechanic: { kind: 'passive', modifiers }
  });
}

const enemy = (range = 'near', maximum = 1) => ({ kind: 'enemy', range, maximum });
const ally = (range = 'near', maximum = 1) => ({ kind: 'ally', range, maximum });
const own = { kind: 'self', range: 'self', maximum: 1 };
const place = (range = 'near', maximum = 1) => ({ kind: 'area', range, maximum });
const object = { kind: 'object', range: 'near', maximum: 1 };
const skill = name => ({ mode: 'contextual', skill: name, defaultTier: 'standard' });
const ritual = (steps, requirements) => ({ kind: 'ritual', steps, requirements, interruptedBy: ['harm', 'forced_movement', 'scene_change'], progressPersists: false });

// These are explicit authored packages. Shared constructors only supply schema defaults.
const branchSpecs = [
  {
    family: 'armsmaster', id: 'discipline', name: 'Discipline', fantasy: 'Fighter', complexity: 'low', primary: 'melee', secondary: 'endure', health: 32,
    description: 'Direct weapon maneuvers trade damage for position or a specific disruption; no Form selection is required for an ordinary attack.',
    grants: [
      action('Driving Strike', 'Strike one engaged foe for graze harm and move them to an adjacent legal area on success. The destination must be clear; this does not grant another attack.', { onSuccess: [harm('graze'), step(target, 'unfavorable')], mechanic: { kind: 'maneuver', mode: 'push', maximumDistance: 1 } }),
      action('Disarming Cut', 'Once per scene, strike an engaged foe for wound harm and disarm one recorded held weapon on success. Natural weapons and fixed emplacements cannot be disarmed.', { cadence: scene(), onSuccess: [harm(), { op: 'disarm', who: target, item: '$item' }] }),
      passive('Weapon Discipline', 'Gain 4 maximum health and +3 to trained melee checks. Ordinary attacks remain available without invoking a maneuver.', { maxHealth: 4, skills: { melee: 3 } }),
      action('Brace', 'Commit to your present area. Reduce the next incoming wound or grievous harm by one grade while you can act; moving or making another Main ends the brace.', { targeting: own, cadence: commit, check: null, mechanic: { kind: 'maneuver', mode: 'brace', reductions: 1, endsOn: ['move', 'main', 'incapacitated'] } }),
      action('Break the Guard', 'Once per scene, deal wound harm and clear one active concealed or steadied boon from an engaged foe on success. Choose the boon explicitly.', { cadence: scene(), onSuccess: [harm(), { op: 'condition_clear', who: target, condition: '$condition' }], requirements: [{ kind: 'target_condition', tokens: ['concealed', 'steadied'] }] }),
      action('Sweep the Approach', 'Once per scene, attack up to two enemies engaged with you in one check. Each successful target takes graze harm; allies are not struck.', { targeting: enemy('engaged', 2), cadence: scene(), onSuccess: [harm('graze')] }),
      action('Perfect Intervention', 'Once per recovery, move to an adjacent threatened ally and clear pinned from them while striking one foe engaged with that ally for wound harm on success. This is your Main, not automatic protection.', { targeting: { kind: 'enemy_and_ally', range: 'near', maximum: 1 }, cadence: recovery(), onSuccess: [step(), clear('pinned', '$ally'), harm()], mechanic: { kind: 'maneuver', mode: 'intervene', maximumDistance: 1 } })
    ]
  },
  {
    family: 'armsmaster', id: 'pursuit', name: 'Pursuit', fantasy: 'Ranger', complexity: 'low', primary: 'ranged', secondary: 'survival', health: 28,
    description: 'Mobile attacks and a deliberately selected quarry support pursuit without automatic free attacks or movement through hazards.',
    grants: [
      action('Skirmishing Shot', 'Move to an adjacent legal area and attack one near enemy for graze harm on success. A pinned character cannot use the movement.', { targeting: enemy('near'), check: skill('ranged'), onSuccess: [step(), harm('graze')], mechanic: { kind: 'maneuver', mode: 'skirmish', maximumDistance: 1 } }),
      action('Mark Quarry', 'Choose one visible enemy as your quarry until the scene ends. Learn its recorded trail when it leaves; this does not stop escape or grant an attack.', { targeting: enemy('far'), check: null, mechanic: { kind: 'quarry', mode: 'mark', maximum: 1, duration: 'scene' } }),
      passive('Trailcraft', 'Gain +3 Survival and +3 Notice. A quarry does not need to be marked for ordinary tracking or ranged attacks.', { skills: { survival: 3, notice: 3 } }),
      action('Pinning Shot', 'Once per scene, deal graze harm and pin one near enemy on success. The pin must be removed before ordinary repositioning.', { targeting: enemy(), check: skill('ranged'), cadence: scene(), onSuccess: [harm('graze'), hinder('pinned')] }),
      action('Close the Distance', 'Follow your marked quarry into one recorded adjacent area without a new tracking check. Hazards still apply, and the movement grants no attack.', { targeting: own, check: null, mechanic: { kind: 'quarry', mode: 'follow', maximumDistance: 1, ignoresHazards: false }, onSuccess: [step()], requirements: [{ kind: 'quarry_route' }] }),
      action('Distant Interdiction', 'Once per scene, attack your visible quarry at far range for wound harm and hinder it on success. Cover and other grounded difficulty still apply.', { targeting: enemy('far'), cadence: scene(), check: skill('ranged'), requirements: [{ kind: 'target_is_quarry' }], onSuccess: [harm(), hinder('hindered')] }),
      action('Relentless Hunt', 'Once per recovery, reveal the recorded route to your quarry and move along up to two connected legal areas. Stop before a blocking hazard; no attack is included.', { targeting: own, cadence: recovery(), check: null, mechanic: { kind: 'quarry', mode: 'hunt', maximumDistance: 2, ignoresHazards: false }, onSuccess: [reveal('quarry_route', 2)] })
    ]
  },
  {
    family: 'berserker', id: 'fury', name: 'Fury', fantasy: 'Barbarian', complexity: 'moderate', primary: 'melee', secondary: 'endure', health: 36,
    description: 'Dangerous attacks raise visible Exposure; stronger output makes the next incoming harm worse until you regain control.',
    grants: [
      action('Reckless Blow', 'Raise Exposure by one before attacking for grievous harm. At positive Exposure the next incoming harm rises one grade and consumes one Exposure. A miss still raises Exposure.', { onSuccess: [harm('grievous')], mechanic: { kind: 'exposure', mode: 'raise', amount: 1, maximum: 3, incomingGradeIncrease: 1 } }),
      action('Regain Control', 'Spend your Main to lower Exposure by two, to a minimum of zero. This provides no attack, healing, or protection for allies.', { targeting: own, check: null, mechanic: { kind: 'exposure', mode: 'lower', amount: 2 } }),
      passive('Hardy', 'Gain 6 maximum health and +3 Endure. At zero Exposure you can always make an ordinary attack without accepting additional danger.', { maxHealth: 6, skills: { endure: 3 } }),
      action('Ruinous Charge', 'Raise Exposure by one, move one adjacent area, and deal wound harm to an enemy you reach on success. Hazards and pinned still constrain the movement.', { targeting: enemy('near'), onSuccess: [step(), harm()], mechanic: { kind: 'exposure', mode: 'raise', amount: 1, maximum: 3, incomingGradeIncrease: 1 } }),
      action('Terrifying Roar', 'Once per scene, expose up to two near enemies on a successful Endure check. Raise Exposure by one whether the check succeeds or fails.', { targeting: enemy('near', 2), check: skill('endure'), cadence: scene(), onSuccess: [hinder('exposed')], mechanic: { kind: 'exposure', mode: 'raise', amount: 1, maximum: 3, incomingGradeIncrease: 1 } }),
      action('Shatter the Obstacle', 'At Exposure two or higher, smash one recorded breakable obstruction in reach. This cannot destroy indestructible features or permanent scene topology.', { targeting: object, check: skill('melee'), requirements: [{ kind: 'exposure_minimum', value: 2 }], onSuccess: [{ op: 'scene_feature_clear', feature: '$feature' }] }),
      action('Devastating Onslaught', 'Once per recovery, attack up to three engaged foes for wound harm each in one check. Set Exposure to three even on a miss; it retains its full incoming-harm risk.', { targeting: enemy('engaged', 3), cadence: recovery(), onSuccess: [harm()], mechanic: { kind: 'exposure', mode: 'set', value: 3, maximum: 3, incomingGradeIncrease: 1 } })
    ]
  },
  {
    family: 'berserker', id: 'endurance', name: 'Endurance', fantasy: 'Stoneblood', complexity: 'moderate', primary: 'endure', secondary: 'melee', health: 36,
    description: 'Endure real harm and decide when to spend the recorded reprisal; it never grants credit for imaginary damage or permits infinite self-healing.',
    grants: [
      action('Endure the Blow', 'Commit until your next Main. Reduce the next wound or grievous harm by one grade, and record one Reprisal only if actual harm remains. Movement does not protect another actor.', { targeting: own, check: null, cadence: commit, mechanic: { kind: 'exposure', mode: 'endure', reductions: 1, reprisalMaximum: 1, expires: 'next_main' } }),
      action('Reprisal', 'Consume your recorded Reprisal to deal grievous harm to one engaged enemy on success. A miss consumes it. Reprisal requires actual harm since your last use.', { onSuccess: [harm('grievous')], requirements: [{ kind: 'reprisal_available' }], mechanic: { kind: 'exposure', mode: 'consume_reprisal' } }),
      passive('Unbowed', 'Gain 8 maximum health and +3 Endure. Reprisal is optional; ordinary attacks never need it.', { maxHealth: 8, skills: { endure: 3 } }),
      action('Plant Your Feet', 'Once per scene, clear pinned or winded from yourself. Choose the condition explicitly; this action does not also attack.', { targeting: own, check: null, cadence: scene(), onSuccess: [{ op: 'condition_clear', who: self, condition: '$condition' }], requirements: [{ kind: 'self_condition', tokens: ['pinned', 'winded'] }] }),
      action('Pain into Purpose', 'Once per scene, consume one Reprisal to mend yourself. The Reprisal is spent on use; no healing is available without recorded incoming harm.', { targeting: own, check: null, cadence: scene(), requirements: [{ kind: 'reprisal_available' }], mechanic: { kind: 'exposure', mode: 'consume_reprisal' }, onSuccess: [heal('mend', self)] }),
      action('Unyielding Advance', 'Once per scene, move one adjacent area through a hindering feature and strike for wound harm on success. You still take hazard harm and cannot pass a solid blockage.', { targeting: enemy('near'), cadence: scene(), onSuccess: [step(), harm()], mechanic: { kind: 'maneuver', mode: 'advance', maximumDistance: 1, ignoresHindrance: true, ignoresHazards: false } }),
      action('Refuse Defeat', 'Once per recovery, when a committed Endure the Blow would leave you at zero health, remain at one instead and become winded. The commitment must precede the incoming harm.', { targeting: own, check: null, cadence: recovery(), mechanic: { kind: 'exposure', mode: 'last_stand', minimumHealth: 1, condition: 'winded', requiresEndure: true } })
    ]
  },
  {
    family: 'adept', id: 'flow', name: 'Flow', fantasy: 'Monk', complexity: 'high', primary: 'melee', secondary: 'move', health: 28,
    description: 'Useful openers stand alone; optional visible transitions earn movement and finishers without making normal attacks depend on a sequence.',
    grants: [
      action('Flowing Palm', 'Deal wound harm to one engaged foe on success and enter Flow whether the attack hits or misses. This opener is always available.', { onSuccess: [harm()], mechanic: { kind: 'sequence', mode: 'enter', stance: 'flow', from: ['any'] } }),
      action('Turning Step', 'Move one adjacent legal area and become steadied. If used from Flow, also clear hindered from yourself; otherwise the movement and boon still work.', { targeting: own, check: null, onSuccess: [step(), boon('steadied')], mechanic: { kind: 'sequence', mode: 'transition', from: ['any'], stance: 'turn', bonusFrom: 'flow', bonus: [clear('hindered', self)] } }),
      passive('Unarmed Discipline', 'Your empty hands qualify for authored melee techniques. Gain +3 Move and +3 Melee; no weapon item is required for the branch.', { unarmed: true, skills: { move: 3, melee: 3 } }),
      action('Sweeping Finish', 'Once per scene, deal wound harm and hinder an engaged enemy on success. From Turn, also move yourself one adjacent area. This finisher resets your stance.', { cadence: scene(), onSuccess: [harm(), hinder('hindered')], mechanic: { kind: 'sequence', mode: 'finish', bonusFrom: 'turn', bonus: [step()], stance: 'ready' } }),
      action('Wall Step', 'Cross one adjacent recorded area using walls or a narrow support and become concealed if the destination has cover. Solid barriers and unsupported flight remain impossible.', { targeting: own, check: skill('move'), onSuccess: [step()], mechanic: { kind: 'sequence', mode: 'terrain_step', requiresSurface: true, coverBoon: 'concealed', stance: 'flow' } }),
      action('Twin Current', 'Once per scene, strike up to two engaged enemies for graze harm each. From Flow, each instead takes wound harm. The attack resets your stance.', { targeting: enemy('engaged', 2), cadence: scene(), onSuccess: [harm('graze')], mechanic: { kind: 'sequence', mode: 'finish', bonusFrom: 'flow', replaceGrade: 'wound', stance: 'ready' } }),
      action('Unbroken Motion', 'Once per recovery, move through up to two legal adjacent areas and strike one reached enemy for grievous harm. Crossing hazards still has consequences; the move resets your stance.', { targeting: enemy('far'), cadence: recovery(), onSuccess: [harm('grievous')], mechanic: { kind: 'sequence', mode: 'traverse', maximumDistance: 2, ignoresHazards: false, stance: 'ready' } })
    ]
  },
  {
    family: 'adept', id: 'stillness', name: 'Stillness', fantasy: 'Ascetic', complexity: 'high', primary: 'melee', secondary: 'notice', health: 28,
    description: 'A calm stance improves precise control, while direct techniques remain useful before a stance is established.',
    grants: [
      action('Settling Strike', 'Deal wound harm to an engaged enemy on success and enter Stillness whether the attack hits or misses. It needs no prior technique.', { onSuccess: [harm()], mechanic: { kind: 'sequence', mode: 'enter', stance: 'still', from: ['any'] } }),
      action('Open Hand', 'Deal graze harm and move an engaged enemy to an adjacent legal area on success. From Stillness, also hinder it, then reset your stance.', { onSuccess: [harm('graze'), step(target, 'unfavorable')], mechanic: { kind: 'sequence', mode: 'finish', bonusFrom: 'still', bonus: [hinder('hindered')], stance: 'ready' } }),
      passive('Centered Mind', 'Gain +3 Notice and +3 Endure. Your empty hands qualify for the branch melee techniques.', { unarmed: true, skills: { notice: 3, endure: 3 } }),
      action('Read the Motion', 'Study one visible enemy to reveal one recorded attack or movement trait and become steadied. Enter Stillness without requiring an attack.', { targeting: enemy(), check: skill('notice'), onSuccess: [reveal('combat_trait'), boon('steadied')], mechanic: { kind: 'sequence', mode: 'enter', stance: 'still', from: ['any'] } }),
      action('Rooting Touch', 'Once per scene, pin an engaged enemy and deal graze harm on success. From Stillness, deal wound harm instead; the technique resets your stance.', { cadence: scene(), onSuccess: [hinder('pinned'), harm('graze')], mechanic: { kind: 'sequence', mode: 'finish', bonusFrom: 'still', replaceGrade: 'wound', stance: 'ready' } }),
      action('Quiet Passage', 'Once per scene, clear dazed from yourself and move one adjacent legal area while concealed. The concealment ends under its normal exposure rules, not as permanent invisibility.', { targeting: own, cadence: scene(), check: null, onSuccess: [clear('dazed', self), step(), boon('concealed')], mechanic: { kind: 'sequence', mode: 'enter', stance: 'still', from: ['any'] } }),
      action('Perfect Stillness', 'Once per recovery, expose and pin one engaged enemy on success. From Stillness, also deal grievous harm. Reset your stance after use even on a miss.', { cadence: recovery(), onSuccess: [hinder('exposed'), hinder('pinned')], mechanic: { kind: 'sequence', mode: 'finish', bonusFrom: 'still', bonus: [harm('grievous')], stance: 'ready' } })
    ]
  },
  {
    family: 'opportunist', id: 'opening', name: 'Opening', fantasy: 'Rogue', complexity: 'moderate', primary: 'melee', secondary: 'move', health: 26,
    description: 'Create one target-bound Opening with a useful feint, then choose when to cash it in. No ally or special terrain is required.',
    grants: [
      action('Deceptive Strike', 'Deal graze harm and create an Opening on one engaged foe on success. You can hold only one Opening; a new one replaces the old target.', { onSuccess: [harm('graze')], mechanic: { kind: 'opening', mode: 'create', maximum: 1, duration: 'scene' } }),
      action('Exploit Opening', 'Consume your Opening on the chosen foe to deal grievous harm on success. A miss still consumes it; this cannot be used on an unmarked target.', { requirements: [{ kind: 'target_has_opening' }], onSuccess: [harm('grievous')], mechanic: { kind: 'opening', mode: 'consume' } }),
      passive('Light Footwork', 'Gain +3 Move and +3 Notice. Concealment is still a recorded condition, not a claim supplied by this trait.', { skills: { move: 3, notice: 3 } }),
      action('Slip the Net', 'Consume your Opening to clear pinned from yourself and move one adjacent legal area. The foe is distracted, not prevented from acting later.', { targeting: own, check: null, requirements: [{ kind: 'opening_available' }], onSuccess: [clear('pinned', self), step()], mechanic: { kind: 'opening', mode: 'consume' } }),
      action('Expose a Weakness', 'Once per scene, reveal one recorded defense trait and create an Opening on a visible enemy on success. This creates no new weakness.', { targeting: enemy(), check: skill('notice'), cadence: scene(), onSuccess: [reveal('defense_trait')], mechanic: { kind: 'opening', mode: 'create', maximum: 1, duration: 'scene' } }),
      action('Surgical Disarm', 'Consume an Opening to disarm one recorded held weapon and deal wound harm on success. Natural weapons and fixed emplacements are ineligible.', { requirements: [{ kind: 'target_has_opening' }], onSuccess: [harm(), { op: 'disarm', who: target, item: '$item' }], mechanic: { kind: 'opening', mode: 'consume' } }),
      action('Perfect Ambush', 'Once per recovery, consume an Opening to deal grievous harm and daze its target on success, then become concealed if recorded cover permits it.', { cadence: recovery(), requirements: [{ kind: 'target_has_opening' }], onSuccess: [harm('grievous'), hinder('dazed')], mechanic: { kind: 'opening', mode: 'consume', coverBoon: 'concealed' } })
    ]
  },
  {
    family: 'opportunist', id: 'mastery', name: 'Mastery', fantasy: 'Savant', complexity: 'moderate', primary: 'notice', secondary: 'influence', health: 26,
    description: 'Turn concrete observations into bounded leverage, with mastered tools that make ordinary obstacles reliable without inventing facts.',
    grants: [
      action('Find Leverage', 'Reveal one recorded motive, access weakness, or defense trait on success and establish one Opening on that actor or obstacle. Choose the information category explicitly.', { targeting: { kind: 'actor_or_object', range: 'near', maximum: 1 }, check: skill('notice'), onSuccess: [reveal('leverage')], mechanic: { kind: 'opening', mode: 'create', maximum: 1, duration: 'scene' } }),
      action('Calculated Escape', 'Consume an Opening to clear hindered or pinned from yourself and move one adjacent legal area. Choose the condition; this provides no attack.', { targeting: own, check: null, requirements: [{ kind: 'opening_available' }], onSuccess: [{ op: 'condition_clear', who: self, condition: '$condition' }, step()], mechanic: { kind: 'opening', mode: 'consume', clearTokens: ['hindered', 'pinned'] } }),
      passive('Professional Tools', 'Gain +3 Notice and +3 Systems. Carry a reusable mundane tool kit; it grants no automatic permission to operate a protected system.', { skills: { notice: 3, systems: 3 }, equipment: ['tool-kit'] }),
      action('Mastered Entry', 'Once per scene, open a recorded ordinary mechanical lock in reach without a check when it has no active opposition or extraordinary seal. Other locks remain ordinary checks.', { targeting: object, cadence: scene(), check: null, requirements: [{ kind: 'ordinary_unopposed_lock' }], onSuccess: [{ op: 'object_unlock', object: '$object', maximumSecurity: 'ordinary' }] }),
      action('Decisive Evidence', 'Consume an Opening on an actor to reveal one additional recorded motive or contradiction and expose them on success. This does not dictate agreement or consent.', { targeting: { kind: 'actor', range: 'near', maximum: 1 }, check: skill('influence'), requirements: [{ kind: 'target_has_opening' }], onSuccess: [reveal('motive'), hinder('exposed')], mechanic: { kind: 'opening', mode: 'consume' } }),
      action('Contingency Route', 'Once per scene, reveal one recorded exit or access route and move one adjacent legal area. No new route is invented and hazards remain active.', { targeting: own, cadence: scene(), check: skill('notice'), onSuccess: [reveal('route'), step()] }),
      action('Masterstroke', 'Once per recovery, consume an Opening to disable one recorded ordinary mechanism without a check. Protected systems still require their shared access rules; this cannot disable a living actor or natural weapon.', { targeting: object, cadence: recovery(), check: null, requirements: [{ kind: 'target_has_opening' }, { kind: 'ordinary_mechanism' }], onSuccess: [{ op: 'object_disable', object: '$object', maximumSecurity: 'ordinary', duration: 'scene' }], mechanic: { kind: 'opening', mode: 'consume' } })
    ]
  },
  {
    family: 'arcanist', id: 'formula', name: 'Formula', fantasy: 'Wizard', complexity: 'moderate', primary: 'lore', secondary: 'notice', health: 24,
    description: 'Prepare a limited spell loadout outside danger. Each prepared spell is a direct authored action, not a keyword recipe or mandatory combo.',
    grants: [
      action('Magic Missile', 'Cast a seeking bolt at one visible near enemy for wound harm on success, without a weapon or ammunition. Mundane aiming and cover do not hinder it; magical wards still can. No prior spell or setup is required.', { targeting: enemy(), check: skill('lore'), onSuccess: [harm()], mechanic: { kind: 'preparation', mode: 'cast', requiresPrepared: true, basic: true, requiresWeapon: false, requiresAmmunition: false, ignoredDeltaSources: ['mundane_aim', 'mundane_cover'], retainedDeltaSources: ['magical_ward'] } }),
      action('Fireball', 'Twice per recovery, cast a burst at one visible near area. Every actor there takes wound harm on success, including allies. Choose the area directly; no preparatory combo is required.', { targeting: { kind: 'area_all_actors', range: 'near', maximum: 6 }, cadence: recovery(2), check: skill('lore'), onSuccess: [harm()], mechanic: { kind: 'preparation', mode: 'cast', requiresPrepared: true, friendlyFire: true, basic: true } }),
      passive('Spellbook', 'Maintain an authored learned spellbook and three prepared slots at level one. Change preparation only outside an active encounter; gain +3 Lore.', { skills: { lore: 3 }, preparation: true }),
      action('Force Bridge', 'Once per scene, place a temporary passage feature in one near area. It supports crossing within that recorded area but creates no new area, exit, or permanent topology.', { targeting: place(), cadence: scene(), check: skill('lore'), onSuccess: [feature('passage', 'Force bridge')], mechanic: { kind: 'preparation', mode: 'cast', requiresPrepared: true } }),
      action('Blink', 'Twice per scene, teleport yourself to a visible recorded near area without crossing intervening terrain. A recorded teleport ward blocks it; the destination must be safe to occupy.', { targeting: place(), cadence: scene(2), check: null, onSuccess: [teleport()], mechanic: { kind: 'preparation', mode: 'cast', requiresPrepared: true } }),
      action('Prismatic Prison', 'Once per recovery, pin and daze one near enemy on success with a visible magical restraint. The conditions follow their normal clear and scene rules.', { targeting: enemy(), cadence: recovery(), check: skill('lore'), onSuccess: [hinder('pinned'), hinder('dazed')], mechanic: { kind: 'preparation', mode: 'cast', requiresPrepared: true } }),
      action('Meteor Crown', 'Once per recovery, cast an overwhelming burst at one visible far area. All actors there take grievous harm on success; allies are not exempt and existing cover still matters.', { targeting: { kind: 'area_all_actors', range: 'far', maximum: 6 }, cadence: recovery(), check: skill('lore'), onSuccess: [harm('grievous')], mechanic: { kind: 'preparation', mode: 'cast', requiresPrepared: true, friendlyFire: true } })
    ]
  },
  {
    family: 'arcanist', id: 'ritual', name: 'Ritual', fantasy: 'Ritualist', complexity: 'high', primary: 'lore', secondary: 'craft', health: 24,
    description: 'Direct spells remain useful in immediate play; exceptional workings earn deliberate destination, material and interruption choices.',
    grants: [
      action('Arcane Lance', 'Cast a focused ray at one visible near enemy for wound harm. This immediate spell requires no ritual, preparatory sequence, or expendable component.', { targeting: enemy(), check: skill('lore'), onSuccess: [harm()], mechanic: { kind: 'preparation', mode: 'cast', requiresPrepared: true, basic: true } }),
      action('Warding Seal', 'Once per scene, create cover against opposition in one near area. The seal is an established defensive feature, not immunity or automatic interception of attacks on allies.', { targeting: place(), cadence: scene(), check: skill('lore'), onSuccess: [feature('cover', 'Warding seal')], mechanic: { kind: 'preparation', mode: 'cast', requiresPrepared: true, basic: true } }),
      passive('Working Circle', 'Gain +3 Lore and +3 Craft. Prepared immediate spells and learned rituals are distinct lists; an unprepared immediate spell cannot be improvised through prose.', { skills: { lore: 3, craft: 3 }, preparation: true }),
      action('Far Sight', 'Once per recovery, complete two uninterrupted workings at a recorded focus to reveal up to two recorded features of a previously visited area. It cannot discover an invented location.', { activation: 'ritual', targeting: { kind: 'known_area', range: 'known', maximum: 1 }, cadence: recovery(), check: skill('lore'), onSuccess: [reveal('area_features', 2)], mechanic: ritual(2, ['recorded_focus', 'visited_area']) }),
      action('Transit Circle', 'Once per recovery, complete two uninterrupted workings to teleport yourself and up to two willing nearby allies to a previously visited recorded area. The destination and travelers are explicit.', { activation: 'ritual', targeting: { kind: 'willing_allies_and_area', range: 'known', maximum: 3 }, cadence: recovery(), check: skill('lore'), onSuccess: [teleport('$travelers', 'circle')], mechanic: ritual(2, ['recorded_focus', 'visited_area', 'willing_travelers']) }),
      action('Sanctuary Working', 'Once per recovery, complete two uninterrupted workings to place cover and an alarm in your area until the scene ends. It neither heals nor blocks every enemy from entry.', { activation: 'ritual', targeting: own, cadence: recovery(), check: skill('lore'), onSuccess: [feature('cover', 'Sanctuary barrier'), feature('alarm', 'Sanctuary alarm')], mechanic: ritual(2, ['recorded_focus']) }),
      action('Recall the Departed', 'Once per recovery, complete three uninterrupted workings beside a willing fallen ally whose intact body and death within ten ledger turns are recorded. Consume a revival catalyst to restore them at one health with persistent winded.', { activation: 'ritual', targeting: { kind: 'fallen_ally', range: 'engaged', maximum: 1 }, cadence: recovery(), check: skill('lore'), onSuccess: [{ op: 'revive', who: target, health: 1, maximumElapsedTurns: 10, condition: 'winded', duration: 'persistent' }, { op: 'item_consume', owner: self, item: '$catalyst', quantity: 1 }], mechanic: ritual(3, ['intact_body', 'willing_return', 'revival_catalyst']) })
    ]
  },
  {
    family: 'channeler', id: 'restoration', name: 'Restoration', fantasy: 'Cleric', complexity: 'moderate', primary: 'lore', secondary: 'endure', health: 28,
    description: 'Use a narrow known repertoire without preparation. Printed overreach gives stronger recovery at visible Strain, never arbitrary point spending.',
    grants: [
      action('Radiant Rebuke', 'Directly channel light at one visible near enemy for wound harm. No preparation or prior spell is required.', { targeting: enemy(), check: skill('lore'), onSuccess: [harm()], mechanic: { kind: 'channel', mode: 'base' } }),
      action('Mending Light', 'Twice per scene, patch yourself or one nearby ally. Optional overreach mends instead and adds one Strain; at three Strain you become winded until recovery.', { targeting: ally(), cadence: scene(2), check: null, onSuccess: [heal()], mechanic: { kind: 'channel', mode: 'overreach', optional: true, strain: 1, maximum: 3, replaceGrade: 'mend', thresholdCondition: 'winded' } }),
      passive('Steady Vessel', 'Gain 4 maximum health and +3 Endure. Known channeling never requires choosing a prepared loadout.', { maxHealth: 4, skills: { endure: 3 } }),
      action('Purifying Touch', 'Twice per scene, clear one named hindered, dazed, or winded condition from yourself or a nearby ally. Persistent conditions require the level-seven deeper rite.', { targeting: ally(), cadence: scene(2), check: null, requirements: [{ kind: 'target_condition', tokens: ['hindered', 'dazed', 'winded'], duration: 'scene' }], onSuccess: [{ op: 'condition_clear', who: target, condition: '$condition' }], mechanic: { kind: 'channel', mode: 'base' } }),
      action('Restoring Wave', 'Once per recovery, mend up to three nearby willing allies in one action. Optional overreach restores instead and adds two Strain, retaining the threshold consequence.', { targeting: ally('near', 3), cadence: recovery(), check: null, onSuccess: [heal('mend')], mechanic: { kind: 'channel', mode: 'overreach', optional: true, strain: 2, maximum: 3, replaceGrade: 'restore', thresholdCondition: 'winded' } }),
      action('Deep Cleansing', 'Once per recovery, clear one named persistent hindered, dazed, or winded condition from a nearby ally and patch them. This cannot revive the dead or erase an unrecorded injury.', { targeting: ally(), cadence: recovery(), check: null, requirements: [{ kind: 'target_condition', tokens: ['hindered', 'dazed', 'winded'] }], onSuccess: [{ op: 'condition_clear', who: target, condition: '$condition' }, heal()], mechanic: { kind: 'channel', mode: 'base' } }),
      action('Breath of Return', 'Once per recovery, restore one willing fallen ally at one health if their intact body is in reach and death occurred within two ledger turns. Gain three Strain and persistent winded; this is not unrestricted resurrection.', { targeting: { kind: 'fallen_ally', range: 'engaged', maximum: 1 }, cadence: recovery(), check: skill('lore'), onSuccess: [{ op: 'revive', who: target, health: 1, maximumElapsedTurns: 2, condition: 'winded', duration: 'scene' }], mechanic: { kind: 'channel', mode: 'strain', strain: 3, maximum: 3, thresholdCondition: 'winded', duration: 'persistent' } })
    ]
  },
  {
    family: 'channeler', id: 'manifestation', name: 'Manifestation', fantasy: 'Sorcerer', complexity: 'moderate', primary: 'lore', secondary: 'influence', health: 26,
    description: 'Direct force and phenomena work immediately. Optional overreach changes a printed result while Strain makes repeated escalation consequential.',
    grants: [
      action('Force Bolt', 'Directly strike one visible near enemy for wound harm. Optional overreach adds a one-area push and one Strain; three Strain causes winded until recovery.', { targeting: enemy(), check: skill('lore'), onSuccess: [harm()], mechanic: { kind: 'channel', mode: 'overreach', optional: true, strain: 1, maximum: 3, bonus: [step(target, 'unfavorable')], thresholdCondition: 'winded' } }),
      action('Veil of Mist', 'Once per scene, fill one near area with smoke affecting both sides. Optional overreach also conceals you and adds one Strain. The smoke is not selective immunity.', { targeting: place(), cadence: scene(), check: null, onSuccess: [feature('smoke', 'Manifested mist', 'both')], mechanic: { kind: 'channel', mode: 'overreach', optional: true, strain: 1, maximum: 3, bonus: [boon('concealed')], thresholdCondition: 'winded' } }),
      passive('Resonant Presence', 'Gain +3 Lore and +3 Influence. These skills do not compel agreement, emotion, or player consent.', { skills: { lore: 3, influence: 3 } }),
      action('Thunderclap', 'Once per scene, deal graze harm and daze up to two engaged enemies on success. Optional overreach extends to near range and adds one Strain.', { targeting: enemy('engaged', 2), cadence: scene(), check: skill('lore'), onSuccess: [harm('graze'), hinder('dazed')], mechanic: { kind: 'channel', mode: 'overreach', optional: true, strain: 1, maximum: 3, range: 'near', thresholdCondition: 'winded' } }),
      action('Weightless Passage', 'Twice per scene, lift yourself across one recorded adjacent area without a ground route. The destination must support you; this is one crossing, not indefinite flight.', { targeting: place(), cadence: scene(2), check: null, onSuccess: [{ op: 'traverse', who: self, area, mode: 'flight', maximumDistance: 1 }], mechanic: { kind: 'channel', mode: 'base' } }),
      action('Storm Cage', 'Once per recovery, create a hazard affecting both sides in one near area and pin one enemy there on success. The hazard is recorded, not repeated automatic damage without a trigger.', { targeting: { kind: 'enemy_and_area', range: 'near', maximum: 1 }, cadence: recovery(), check: skill('lore'), onSuccess: [feature('hazard', 'Storm cage', 'both'), hinder('pinned')], mechanic: { kind: 'channel', mode: 'base' } }),
      action('Living Tempest', 'Once per recovery, strike up to three visible near enemies for grievous harm in one check. Gain two Strain on use even on a miss; the normal winded threshold remains.', { targeting: enemy('near', 3), cadence: recovery(), check: skill('lore'), onSuccess: [harm('grievous')], mechanic: { kind: 'channel', mode: 'strain', strain: 2, maximum: 3, thresholdCondition: 'winded' } })
    ]
  },
  {
    family: 'oathbound', id: 'aegis', name: 'Aegis', fantasy: 'Paladin', complexity: 'moderate', primary: 'melee', secondary: 'leadership', health: 32,
    description: 'Choose one exact ward and actively defend it. Binding does not redirect every attack or let an unrelated attack protect the whole party.',
    grants: [
      action('Declare Ward', 'Bind yourself or one nearby ally as your single ward and make them steadied. Rebinding spends your Main. The declaration ends if they leave near range or you cannot act.', { targeting: ally(), check: null, onSuccess: [boon('steadied', target)], mechanic: { kind: 'declaration', mode: 'bind', binding: 'ward', maximum: 1, range: 'near', endsOn: ['out_of_range', 'incapacitated', 'scene_end'] } }),
      action('Aegis Strike', 'Deal wound harm to an enemy engaged with your bound ward on success. Once per scene, also clear exposed from the ward. This is an active attack, not universal interception.', { targeting: enemy('near'), cadence: scene(), requirements: [{ kind: 'enemy_engaged_with_ward' }], onSuccess: [harm(), clear('exposed', '$ward')], mechanic: { kind: 'declaration', mode: 'act', binding: 'ward' } }),
      passive('Oath Armor', 'Gain 6 maximum health and +3 Leadership. A ward does not grant extra actions, immunity, or forced target selection to enemies.', { maxHealth: 6, skills: { leadership: 3 } }),
      action('Shelter the Ward', 'Once per scene, move your willing bound ward to an adjacent legal area and clear pinned from them. You spend your Main and deal no harm.', { targeting: ally(), cadence: scene(), check: null, requirements: [{ kind: 'target_is_ward' }, { kind: 'willing_target' }], onSuccess: [clear('pinned'), step(target)], mechanic: { kind: 'declaration', mode: 'act', binding: 'ward' } }),
      action('Consecrated Ground', 'Once per scene, bind your current area as the ward and establish cover there against opposition. Leaving the area ends the declaration, not the normal scene feature lifecycle.', { targeting: own, cadence: scene(), check: null, onSuccess: [feature('cover', 'Consecrated ground')], mechanic: { kind: 'declaration', mode: 'bind', binding: 'area', maximum: 1, endsOn: ['leave_area', 'incapacitated', 'scene_end'] } }),
      action('Break the Affliction', 'Once per recovery, clear one named hindrance from your bound ward and mend them. A specific active condition and a living ward are required.', { targeting: ally(), cadence: recovery(), check: null, requirements: [{ kind: 'target_is_ward' }, { kind: 'target_condition', tokens: ['hindered', 'exposed', 'dazed', 'pinned', 'winded'] }], onSuccess: [{ op: 'condition_clear', who: target, condition: '$condition' }, heal('mend')], mechanic: { kind: 'declaration', mode: 'act', binding: 'ward' } }),
      action('Sanctuary Stand', 'Once per recovery, restore your living bound ward and move yourself to their area. Until your next Main, reduce one incoming harm to that ward by one grade only while you remain engaged with them and can act.', { targeting: ally(), cadence: recovery(), check: null, requirements: [{ kind: 'target_is_ward' }], onSuccess: [heal('restore'), step()], mechanic: { kind: 'declaration', mode: 'limited_guard', binding: 'ward', range: 'engaged', reductions: 1, expires: 'next_main', endsOn: ['move', 'incapacitated'] } })
    ]
  },
  {
    family: 'oathbound', id: 'judgment', name: 'Judgment', fantasy: 'Avenger', complexity: 'moderate', primary: 'melee', secondary: 'notice', health: 30,
    description: 'Commit to one visible foe. Exact target restrictions make judgment potent without rewarding attacks on unrelated enemies.',
    grants: [
      action('Name the Foe', 'Bind one visible near enemy as your judged foe and reveal one recorded combat trait. Changing the binding spends your Main; the declaration lasts until scene end.', { targeting: enemy(), check: skill('notice'), onSuccess: [reveal('combat_trait')], mechanic: { kind: 'declaration', mode: 'bind', binding: 'foe', maximum: 1, endsOn: ['scene_end', 'target_defeated'] } }),
      action('Judgment Strike', 'Twice per scene, strike your bound foe for grievous harm on success. It cannot target a different enemy, and a miss spends the use.', { cadence: scene(2), requirements: [{ kind: 'target_is_judged' }], onSuccess: [harm('grievous')], mechanic: { kind: 'declaration', mode: 'act', binding: 'foe' } }),
      passive('Keen Conviction', 'Gain +3 Notice and +3 Endure. A declaration never reveals unrecorded guilt or determines moral truth.', { skills: { notice: 3, endure: 3 } }),
      action('No Hiding Place', 'Once per scene, clear concealed from your bound foe if its recorded area is near. This does not locate an enemy whose current area is unknown.', { targeting: enemy(), cadence: scene(), check: skill('notice'), requirements: [{ kind: 'target_is_judged' }, { kind: 'known_target_area' }], onSuccess: [clear('concealed')], mechanic: { kind: 'declaration', mode: 'act', binding: 'foe' } }),
      action('Pursue Judgment', 'Move one adjacent legal area toward your bound foe and deal wound harm if the movement brings it into reach, on success. No obstacle or hazard is ignored.', { targeting: enemy('near'), requirements: [{ kind: 'target_is_judged' }], onSuccess: [step(), harm()], mechanic: { kind: 'declaration', mode: 'pursue', binding: 'foe', maximumDistance: 1 } }),
      action('Sentence of Restraint', 'Once per scene, pin and expose your bound foe on success. This limits movement through the condition rules, not its right to take another action.', { targeting: enemy(), cadence: scene(), check: skill('lore'), requirements: [{ kind: 'target_is_judged' }], onSuccess: [hinder('pinned'), hinder('exposed')], mechanic: { kind: 'declaration', mode: 'act', binding: 'foe' } }),
      action('Final Reckoning', 'Once per recovery, strike your bound foe for grievous harm and clear one named active boon from it on success. This deals numerical harm; it never kills by declaration.', { targeting: enemy(), cadence: recovery(), requirements: [{ kind: 'target_is_judged' }, { kind: 'target_condition', tokens: ['steadied', 'inspired', 'concealed'] }], onSuccess: [harm('grievous'), { op: 'condition_clear', who: target, condition: '$condition' }], mechanic: { kind: 'declaration', mode: 'act', binding: 'foe' } })
    ]
  },
  {
    family: 'shifter', id: 'predator', name: 'Predator', fantasy: 'Skinchanger', complexity: 'moderate', primary: 'melee', secondary: 'survival', health: 30,
    description: 'Replace your complete active profile to gain claws, pursuit or resilience. Profiles never stack selected parts of different forms.',
    grants: [
      action('Predator Form', 'Replace your base profile with Predator: natural melee weapons, keen scent, and +3 Melee, but a slight hindrance to Influence checks. Changing form spends your Main and replaces the prior profile.', { targeting: own, check: null, mechanic: { kind: 'profile', mode: 'replace', profile: 'predator' } }),
      action('Rending Leap', 'Move one adjacent legal area and strike a reached enemy for graze harm. In Predator form deal wound harm instead; the base action remains usable without transforming.', { targeting: enemy('near'), onSuccess: [step(), harm('graze')], mechanic: { kind: 'profile', mode: 'action', bonusProfile: 'predator', replaceGrade: 'wound' } }),
      passive('Changing Nature', 'You may return to your complete base profile as a Main action. Gain +3 Survival; no form grants a free second health pool.', { skills: { survival: 3 }, returnToBase: true }),
      action('Stalking Form', 'Replace your profile with Stalker: climb movement and +3 Notice, but a slight hindrance to Endure checks. Your prior form, powers and modifiers end together.', { targeting: own, check: null, mechanic: { kind: 'profile', mode: 'replace', profile: 'stalker' } }),
      action('Savage Grapple', 'Once per scene, deal wound harm and pin an engaged enemy on success. In Predator form also expose it. It does not prevent all nonmovement actions.', { cadence: scene(), onSuccess: [harm(), hinder('pinned')], mechanic: { kind: 'profile', mode: 'action', bonusProfile: 'predator', bonus: [hinder('exposed')] } }),
      action('Ironhide Form', 'Replace your profile with Ironhide: reduce each incoming harm by one grade to a minimum of graze, gain +3 Endure, and lose free movement. Changing profile removes all these effects.', { targeting: own, check: null, mechanic: { kind: 'profile', mode: 'replace', profile: 'ironhide' } }),
      action('Apex Pounce', 'Once per recovery, move up to two legal adjacent areas and attack one reached enemy for grievous harm. In Predator form also hinder it; hazards still apply.', { targeting: enemy('far'), cadence: recovery(), onSuccess: [harm('grievous')], mechanic: { kind: 'profile', mode: 'traverse', maximumDistance: 2, bonusProfile: 'predator', bonus: [hinder('hindered')], ignoresHazards: false } })
    ]
  },
  {
    family: 'shifter', id: 'adaptive', name: 'Adaptive', fantasy: 'Druid', complexity: 'high', primary: 'survival', secondary: 'lore', health: 28,
    description: 'Broader authored movement and sense profiles solve different environments, with one complete profile active at a time.',
    grants: [
      action('Climber Form', 'Replace your profile with Climber: climb recorded surfaces and +3 Move, but a slight hindrance to Influence checks. This does not create walls, flight, or another health pool.', { targeting: own, check: null, mechanic: { kind: 'profile', mode: 'replace', profile: 'climber' } }),
      action('Nature Lash', 'Directly lash a visible near foe for wound harm. In Climber form you may instead deal graze harm and move yourself to an adjacent area; choose the alternate explicitly.', { targeting: enemy(), check: skill('lore'), onSuccess: [harm()], mechanic: { kind: 'profile', mode: 'alternate', profile: 'climber', optional: true, alternate: [harm('graze'), step()] } }),
      passive('Adaptable Nature', 'Gain +3 Survival and +3 Lore. Returning to the complete base profile is a Main action; parts of separate profiles cannot be combined.', { skills: { survival: 3, lore: 3 }, returnToBase: true }),
      action('Aquatic Form', 'Replace your profile with Aquatic: breathe and move underwater and gain +3 Survival there, but a slight hindrance to Move checks on dry ground. The whole prior profile ends.', { targeting: own, check: null, mechanic: { kind: 'profile', mode: 'replace', profile: 'aquatic' } }),
      action('Borrowed Senses', 'Once per scene, reveal one recorded concealed actor or environmental hazard within the scope of your current profile senses. It cannot invent facts or see through every barrier.', { targeting: own, cadence: scene(), check: skill('notice'), onSuccess: [reveal('profile_senses')], mechanic: { kind: 'profile', mode: 'sense' } }),
      action('Winged Form', 'Replace your profile with Winged: fly between supported destinations in connected recorded areas and gain +3 Notice, but a slight hindrance to Melee checks. Enclosed spaces can prevent wing use.', { targeting: own, check: null, mechanic: { kind: 'profile', mode: 'replace', profile: 'winged' } }),
      action('Fluid Adaptation', 'Twice per recovery, replace your active profile with any learned profile and use one of its movement permissions for a one-area crossing in the same Main. No attack is included.', { targeting: own, cadence: recovery(2), check: null, mechanic: { kind: 'profile', mode: 'switch_and_move', profile: '$profile', maximumDistance: 1 } })
    ]
  },
  {
    family: 'maker', id: 'kit', name: 'Kit', fantasy: 'Alchemist', complexity: 'moderate', primary: 'craft', secondary: 'systems', health: 26,
    description: 'Prepared portable devices create concrete effects. A reusable field tool remains available when limited devices are spent.',
    grants: [
      action('Arc Projector', 'Use your reusable projector to deal wound harm to one visible near enemy. It is an authored device, not a new invention supplied by prose.', { targeting: enemy(), check: skill('craft'), onSuccess: [harm()], mechanic: { kind: 'device', mode: 'use', portable: true, reusable: true } }),
      action('Smoke Capsule', 'Twice per recovery, deploy smoke in one near area affecting both sides. It establishes concealment opportunities without automatically hiding every actor.', { targeting: place(), cadence: recovery(2), check: null, onSuccess: [feature('smoke', 'Smoke capsule', 'both')], mechanic: { kind: 'device', mode: 'use', portable: true, reusable: false } }),
      passive('Field Kit', 'Gain +3 Craft and +3 Systems and carry a reusable tool kit. Prepare three authored device designs outside encounters; ordinary crafting cannot mint class devices.', { skills: { craft: 3, systems: 3 }, equipment: ['tool-kit'], preparation: true }),
      action('Binding Foam', 'Twice per recovery, pin one visible near enemy on success. The foam is a recorded scene condition, not permanent imprisonment.', { targeting: enemy(), cadence: recovery(2), check: skill('craft'), onSuccess: [hinder('pinned')], mechanic: { kind: 'device', mode: 'use', portable: true, reusable: false } }),
      action('Emergency Patch', 'Twice per recovery, mend a living nearby ally with a prepared medical device. It cannot revive a dead actor or replace an intact-body requirement.', { targeting: ally(), cadence: recovery(2), check: null, onSuccess: [heal('mend')], mechanic: { kind: 'device', mode: 'use', portable: true, reusable: false } }),
      action('Grapnel Line', 'Once per scene, cross one connected area to a recorded anchor within near range. The destination must hold you; this is not teleportation through barriers.', { targeting: place(), cadence: scene(), check: skill('craft'), onSuccess: [{ op: 'traverse', who: self, area, mode: 'grapple', maximumDistance: 1 }], mechanic: { kind: 'device', mode: 'use', portable: true, reusable: true } }),
      action('Disruption Charge', 'Once per recovery, disable one recorded ordinary mechanism and clear one active scene feature in its area. Protected-system nodes require their own earned access and cannot be bypassed by this device.', { targeting: object, cadence: recovery(), check: skill('craft'), requirements: [{ kind: 'ordinary_mechanism' }], onSuccess: [{ op: 'object_disable', object: '$object', maximumSecurity: 'ordinary', duration: 'scene' }, { op: 'scene_feature_clear', feature: '$feature' }], mechanic: { kind: 'device', mode: 'use', portable: true, reusable: false } })
    ]
  },
  {
    family: 'maker', id: 'forge', name: 'Forge', fantasy: 'Artificer', complexity: 'high', primary: 'craft', secondary: 'endure', health: 28,
    description: 'Deploy bounded installations that have explicit persistence and no independent turns. Retire a named installation before exceeding capacity.',
    grants: [
      action('Forge Driver', 'Use a reusable powered tool to deal wound harm to one engaged enemy. It remains usable when limited devices are spent; ordinary repair is a separate Craft action.', { check: skill('craft'), onSuccess: [harm()], mechanic: { kind: 'device', mode: 'use', portable: true, reusable: true } }),
      action('Deploy Bulwark', 'Deploy cover in your area against opposition. It occupies one installation slot and remains until retired or scene end; at capacity you must name an installation to retire.', { targeting: own, check: null, onSuccess: [feature('cover', 'Deployable bulwark')], mechanic: { kind: 'device', mode: 'deploy', installation: 'bulwark', duration: 'scene', autonomousActions: 0 } }),
      passive('Workshop Practice', 'Gain +3 Craft and 4 maximum health. Installations share your actions and have no autonomous attacks; capacity starts at one and grows by authored level.', { skills: { craft: 3 }, maxHealth: 4, installations: true }),
      action('Deploy Snare', 'Deploy a visible snare in one near area. The first opposing actor entering triggers hindered and retires the installation; it does not grant a second attack.', { targeting: place(), check: null, mechanic: { kind: 'device', mode: 'deploy', installation: 'snare', trigger: 'opposition_enters', payload: [hinder('hindered')], maximumTriggers: 1, duration: 'scene', autonomousActions: 0 } }),
      action('Relay Emplacement', 'Deploy a relay in your area, or explicitly fire one you already own at a near enemy for wound harm on success. Each use spends your Main; the installation never attacks on its own.', { targeting: { kind: 'self_or_enemy', range: 'near', maximum: 1 }, check: skill('craft'), mechanic: { kind: 'device', mode: 'deploy_or_fire', installation: 'relay', payload: [harm()], duration: 'scene', autonomousActions: 0 } }),
      action('Mobile Bastion', 'Once per scene, move one of your active installations and its features to an adjacent legal area. It retains its identity and consumes your Main.', { targeting: { kind: 'installation', range: 'near', maximum: 1 }, cadence: scene(), check: null, mechanic: { kind: 'device', mode: 'relocate', maximumDistance: 1 } }),
      action('Citadel Array', 'Once per recovery, deploy one Citadel installation that supplies cover and a scene-duration alarm in your area. It occupies two slots; insufficient capacity requires explicit retirement before deployment.', { targeting: own, cadence: recovery(), check: null, onSuccess: [feature('cover', 'Citadel cover'), feature('alarm', 'Citadel alarm')], mechanic: { kind: 'device', mode: 'deploy', installation: 'citadel', slots: 2, duration: 'scene', autonomousActions: 0 } })
    ]
  },
  {
    family: 'bonded', id: 'partner', name: 'Partner', fantasy: 'Beastmaster', complexity: 'moderate', primary: 'survival', secondary: 'melee', health: 28,
    description: 'One persistent companion has its own position and conditions while sharing your Main. Coordination gives benefits instead of a free second turn.',
    grants: [
      action('Partner Strike', 'Command your active companion to attack one enemy engaged with it for wound harm. This consumes the shared Main; your character does not also attack.', { check: skill('survival'), onSuccess: [harm()], mechanic: { kind: 'companion', mode: 'attack', sharedMain: true, origin: 'companion' } }),
      action('Coordinated Pressure', 'Once per scene, when you and your companion are both engaged with the same enemy, deal wound harm and expose it on success. Both bodies spend their shared Main.', { cadence: scene(), requirements: [{ kind: 'companion_and_self_engaged' }], onSuccess: [harm(), hinder('exposed')], mechanic: { kind: 'companion', mode: 'coordinate', sharedMain: true } }),
      passive('Lasting Bond', 'Start with one persistent partner, its own health and position, and one shared Main. Gain +3 Survival. A defeated companion can recover under the same defeat rules as its owner.', { skills: { survival: 3 }, companion: 'partner' }),
      action('Partner Scout', 'Send your companion through one adjacent legal area to reveal one recorded route or threat in its sensory reach. Your character stays put and no attack is included.', { targeting: place(), check: skill('survival'), onSuccess: [reveal('companion_scout')], mechanic: { kind: 'companion', mode: 'scout', maximumDistance: 1, sharedMain: true } }),
      action('Pull to Safety', 'Your companion moves one willing ally engaged with it to an adjacent legal area and clears pinned from that ally. This consumes your shared Main and requires a capable active companion.', { targeting: ally(), check: null, requirements: [{ kind: 'companion_engaged_with_target' }, { kind: 'willing_target' }], onSuccess: [clear('pinned'), step(target)], mechanic: { kind: 'companion', mode: 'rescue', sharedMain: true } }),
      action('Bonded Recovery', 'Once per recovery, mend yourself and your living companion in the same Main. It does not revive a dead partner or reset spent scene abilities.', { targeting: own, cadence: recovery(), check: null, onSuccess: [heal('mend', self), heal('mend', '$companion')], mechanic: { kind: 'companion', mode: 'recover', sharedMain: true } }),
      action('Twin Assault', 'Once per recovery, coordinate with your companion against one enemy both of you engage. Deal grievous harm and pin it on success; this is still one shared Main and one check.', { cadence: recovery(), requirements: [{ kind: 'companion_and_self_engaged' }], onSuccess: [harm('grievous'), hinder('pinned')], mechanic: { kind: 'companion', mode: 'coordinate', sharedMain: true } })
    ]
  },
  {
    family: 'bonded', id: 'caller', name: 'Caller', fantasy: 'Summoner', complexity: 'high', primary: 'lore', secondary: 'survival', health: 26,
    description: 'Choose one active companion from a bounded learned roster. Replacing it changes the complete profile, never adding an uncontrolled army.',
    grants: [
      action('Called Strike', 'Command your active companion to attack using its complete profile: Guardian and Scout deal wound harm engaged, Wisp deals graze harm near. Only one companion is active, and it shares your Main.', { targeting: enemy(), check: skill('lore'), onSuccess: [harm()], mechanic: { kind: 'companion', mode: 'attack', sharedMain: true, origin: 'companion', useProfileAttack: true } }),
      action('Call Scout', 'Replace your active companion with a Scout profile in your area. It can climb and reveal nearby recorded routes but loses the Guardian profile defense; replacement spends your Main.', { targeting: own, check: null, mechanic: { kind: 'companion', mode: 'replace', profile: 'scout', maximum: 1, sharedMain: true } }),
      passive('Bounded Calling', 'Start with Guardian and Scout companion profiles and one active Guardian. Gain +3 Lore. All profiles share a single persistent health fraction; switching cannot heal or erase conditions.', { skills: { lore: 3 }, companion: 'caller' }),
      action('Call Guardian', 'Replace the active companion with Guardian in your area. It gains 4 maximum durability and +3 Endure but no Scout climbing; health fraction and conditions carry across the replacement.', { targeting: own, check: null, mechanic: { kind: 'companion', mode: 'replace', profile: 'guardian', maximum: 1, sharedMain: true } }),
      action('Call Wisp', 'Replace your companion with Wisp in your area. It can cross one open gap and attack at near range for graze harm, but cannot carry allies or handle physical objects.', { targeting: own, check: null, mechanic: { kind: 'companion', mode: 'replace', profile: 'wisp', maximum: 1, sharedMain: true } }),
      action('Convergent Command', 'Once per scene, your companion moves one adjacent legal area and attacks a reached enemy for wound harm on success. The action consumes your shared Main.', { targeting: enemy('near'), cadence: scene(), check: skill('lore'), onSuccess: [harm()], mechanic: { kind: 'companion', mode: 'advance_attack', maximumDistance: 1, sharedMain: true } }),
      action('Greater Calling', 'Once per recovery, replace the active companion with a learned profile and command an immediate wound-harm attack in the same shared Main. Health and conditions carry across; only one body remains active.', { targeting: enemy('near'), cadence: recovery(), check: skill('lore'), onSuccess: [harm()], mechanic: { kind: 'companion', mode: 'replace_attack', profile: '$profile', maximum: 1, sharedMain: true } })
    ]
  },
  {
    family: 'catalyst', id: 'tactics', name: 'Tactics', fantasy: 'Warlord', complexity: 'moderate', primary: 'leadership', secondary: 'notice', health: 28,
    description: 'One visible cue rewards an ally taking its own action. It never adds a bonus Main or asks another player for a blocking reaction.',
    grants: [
      action('Advance Cue', 'Choose a nearby willing ally and one adjacent destination. If that ally next makes a successful attack this scene, it may take the preselected safe step; hazards are not ignored. One cue replaces the prior cue.', { targeting: ally(), check: null, mechanic: { kind: 'cue', mode: 'set', trigger: 'ally_attack_success', payload: [step('$ally')], maximum: 1, expires: 'scene_end', consent: 'preselected_destination' } }),
      action('Tactical Strike', 'Strike an engaged enemy for wound harm on success and make one nearby willing ally steadied. This is your own Main, not an extra ally action.', { targeting: { kind: 'enemy_and_ally', range: 'engaged', maximum: 1 }, onSuccess: [harm(), boon('steadied', '$ally')] }),
      passive('Read the Field', 'Gain +3 Leadership and +3 Notice. Catalyst is selectable only when ordinary campaign play guarantees an allied actor; it does not supply one by itself.', { skills: { leadership: 3, notice: 3 } }),
      action('Cover Cue', 'Choose one nearby willing ally. After its next reposition this scene, it becomes concealed only if its destination has recorded cover. The cue is then consumed; it grants no extra movement.', { targeting: ally(), check: null, mechanic: { kind: 'cue', mode: 'set', trigger: 'ally_reposition', payload: [boon('concealed', '$ally')], requiresCover: true, maximum: 1, expires: 'scene_end' } }),
      action('Rallying Route', 'Once per scene, move up to two nearby willing allies one adjacent legal area each using explicit destinations. They deal no damage and do not receive extra Main actions.', { targeting: ally('near', 2), cadence: scene(), check: skill('leadership'), onSuccess: [step(target)], requirements: [{ kind: 'willing_targets' }] }),
      action('Exploit Cue', 'Once per scene, cue a willing ally against one named enemy. On that ally next successful attack against the target, the enemy becomes exposed; the cue then expires.', { targeting: { kind: 'enemy_and_ally', range: 'near', maximum: 1 }, cadence: scene(), check: null, mechanic: { kind: 'cue', mode: 'set', trigger: 'ally_attack_named_target_success', payload: [hinder('exposed')], maximum: 1, expires: 'scene_end' } }),
      action('Decisive Coordination', 'Once per recovery, clear pinned and dazed from up to three nearby willing allies and make them steadied. No one gains a bonus attack or interrupts another player turn.', { targeting: ally('near', 3), cadence: recovery(), check: null, onSuccess: [clear('pinned'), clear('dazed'), boon('steadied', target)] })
    ]
  },
  {
    family: 'catalyst', id: 'resonance', name: 'Resonance', fantasy: 'Bard', complexity: 'moderate', primary: 'influence', secondary: 'leadership', health: 26,
    description: 'Morale and recovery cues pay off through an ally actual choices. Inspiration does not compel another character or invent shared intent.',
    grants: [
      action('Resonant Note', 'Strike one visible near enemy with disorienting force for graze harm and expose it on success. This direct action requires no cue first.', { targeting: enemy(), check: skill('influence'), onSuccess: [harm('graze'), hinder('exposed')] }),
      action('Courage Cue', 'Choose a nearby willing ally. After its next consequential check, or an NPC ally completes its next authored Main this scene, clear dazed from it and make it inspired. Waiting does not trigger it. One cue replaces the previous cue; no extra roll or action is granted.', { targeting: ally(), check: null, mechanic: { kind: 'cue', mode: 'set', trigger: 'ally_check_completed', payload: [clear('dazed', '$ally'), boon('inspired', '$ally')], maximum: 1, expires: 'scene_end' } }),
      passive('Listening Ear', 'Gain +3 Influence and +3 Notice. Inspiration changes a recorded condition, not an NPC decision or another player consent.', { skills: { influence: 3, notice: 3 } }),
      action('Restorative Refrain', 'Twice per scene, patch one nearby willing ally and clear scene-duration winded from them. It neither revives the dead nor restores limited ability uses.', { targeting: ally(), cadence: scene(2), check: null, onSuccess: [heal(), clear('winded')] }),
      action('Harmony Cue', 'Once per scene, cue a nearby willing ally. After its next successful help or protect action, mend that ally and consume the cue. Ordinary attacks do not satisfy the trigger.', { targeting: ally(), cadence: scene(), check: null, mechanic: { kind: 'cue', mode: 'set', trigger: 'ally_help_success', payload: [heal('mend', '$ally')], maximum: 1, expires: 'scene_end' } }),
      action('Dissonant Chorus', 'Once per recovery, daze and expose up to three visible near enemies on success. It does not charm them or select their next action.', { targeting: enemy('near', 3), cadence: recovery(), check: skill('influence'), onSuccess: [hinder('dazed'), hinder('exposed')] }),
      action('Unbroken Chorus', 'Once per recovery, mend up to three nearby willing allies and clear one named hindrance from each. Each target and condition are explicit; no extra actions or rerolls are granted.', { targeting: ally('near', 3), cadence: recovery(), check: null, onSuccess: [heal('mend'), { op: 'condition_clear', who: target, condition: '$condition' }], requirements: [{ kind: 'target_condition', tokens: ['hindered', 'exposed', 'dazed', 'pinned', 'winded'] }] })
    ]
  },
  {
    family: 'rider', id: 'ace', name: 'Ace', fantasy: 'Dragon Rider', complexity: 'high', primary: 'pilot', secondary: 'ranged', health: 28,
    description: 'Use a guaranteed mount or vehicle with recorded scale, hull, occupants and a shared Main. The whole campaign must support vehicle scenes and replacement after loss.',
    grants: [
      action('Strafing Pass', 'Move your vehicle one connected vehicle-scale area and attack one reached near enemy for graze harm on success. Pilot and vehicle share this Main; passengers gain no bonus attack.', { targeting: enemy(), check: skill('pilot'), onSuccess: [harm('graze')], mechanic: { kind: 'vehicle', mode: 'move_attack', maximumDistance: 1, sharedMain: true } }),
      action('Evasive Course', 'Once per scene, move the vehicle one connected area and make it steadied. The boon can ground a defensive delta but is not guaranteed avoidance of the next attack.', { targeting: own, cadence: scene(), check: skill('pilot'), onSuccess: [{ op: 'vehicle_condition_apply', who: '$vehicle', condition: 'steadied', duration: 'scene', detail: 'Evasive course.' }], mechanic: { kind: 'vehicle', mode: 'move', maximumDistance: 1, sharedMain: true } }),
      passive('Assigned Craft', 'Start with one assigned vehicle or mount with recorded hull and one shared Main. Gain +3 Pilot. Campaign support must provide a replacement after loss, not make the current craft invulnerable.', { skills: { pilot: 3 }, vehicle: 'ace' }),
      action('Break Pursuit', 'Once per scene, move your vehicle up to two connected areas away from one pursuing enemy on success. Hazards remain active, and the pursuer is not guaranteed unable to follow.', { targeting: own, cadence: scene(), check: skill('pilot'), mechanic: { kind: 'vehicle', mode: 'move', maximumDistance: 2, sharedMain: true, ignoresHazards: false } }),
      action('Targeted Run', 'Once per scene, attack one visible vehicle-scale enemy at far range for wound harm and hinder it on success. This consumes the pilot and vehicle shared Main.', { targeting: enemy('far'), cadence: scene(), check: skill('ranged'), onSuccess: [harm(), hinder('hindered')], mechanic: { kind: 'vehicle', mode: 'attack', targetScale: 'vehicle', sharedMain: true } }),
      action('Field Damage Control', 'Twice per recovery, repair eight hull on your active vehicle, to its maximum. The vehicle cannot also move or attack during this Main.', { targeting: own, cadence: recovery(2), check: null, onSuccess: [{ op: 'vehicle_repair', who: '$vehicle', amount: 8 }], mechanic: { kind: 'vehicle', mode: 'repair', sharedMain: true } }),
      action('Impossible Approach', 'Once per recovery, cross up to two connected vehicle areas, ignoring one recorded movement hindrance but not solid barriers or hazard damage, and deal grievous harm to one reached foe on success.', { targeting: enemy('far'), cadence: recovery(), check: skill('pilot'), onSuccess: [harm('grievous')], mechanic: { kind: 'vehicle', mode: 'move_attack', maximumDistance: 2, ignoreHindranceCount: 1, ignoresHazards: false, sharedMain: true } })
    ]
  },
  {
    family: 'rider', id: 'cavalier', name: 'Cavalier', fantasy: 'Cavalier', complexity: 'high', primary: 'pilot', secondary: 'melee', health: 32,
    description: 'Control close vehicle approaches and actively extract passengers. Passenger protection is bounded by actual occupancy, position and the shared action budget.',
    grants: [
      action('Mounted Charge', 'Move your mount or vehicle one connected area and strike a reached enemy for wound harm on success. Both share this Main, and hazards still apply.', { targeting: enemy(), check: skill('pilot'), onSuccess: [harm()], mechanic: { kind: 'vehicle', mode: 'move_attack', maximumDistance: 1, sharedMain: true } }),
      action('Shielded Pickup', 'Once per scene, board one willing ally engaged with your vehicle and move one connected area. Capacity and legal boarding are checked; this grants no attack or immunity.', { targeting: ally('engaged'), cadence: scene(), check: skill('pilot'), mechanic: { kind: 'vehicle', mode: 'board_move', maximumPassengers: 1, maximumDistance: 1, sharedMain: true } }),
      passive('Guardian Mount', 'Start with one sturdy assigned mount or vehicle, passenger capacity two and one shared Main. Gain +3 Pilot and 4 maximum health; other players retain control of their actions.', { skills: { pilot: 3 }, maxHealth: 4, vehicle: 'cavalier' }),
      action('Hold the Approach', 'Once per scene, create a visible obstruction against opposition in your vehicle area. It ends when the vehicle leaves and cannot stop attacks from every direction.', { targeting: own, cadence: scene(), check: skill('pilot'), onSuccess: [feature('obstruction', 'Guarded approach')], mechanic: { kind: 'vehicle', mode: 'hold', sharedMain: true, endsOn: ['move', 'incapacitated'] } }),
      action('Driving Impact', 'Once per scene, deal wound harm to an engaged vehicle-scale foe and move it one connected legal area on success. It cannot push a larger immovable actor or erase collision hazards.', { cadence: scene(), check: skill('pilot'), onSuccess: [harm(), step(target, 'unfavorable')], mechanic: { kind: 'vehicle', mode: 'impact', maximumDistance: 1, maximumScaleDifference: 0, sharedMain: true } }),
      action('Passenger Rescue', 'Once per recovery, clear pinned from up to two willing actors engaged with your vehicle, board them within capacity, and move one connected area. No attack is included.', { targeting: ally('engaged', 2), cadence: recovery(), check: skill('pilot'), onSuccess: [clear('pinned')], mechanic: { kind: 'vehicle', mode: 'board_move', maximumPassengers: 2, maximumDistance: 1, sharedMain: true } }),
      action('Bastion Charge', 'Once per recovery, move one connected vehicle area, deal grievous harm to one reached foe, and make current willing passengers steadied on success. It does not redirect all attacks onto the rider.', { targeting: enemy(), cadence: recovery(), check: skill('pilot'), onSuccess: [harm('grievous'), boon('steadied', '$passengers')], mechanic: { kind: 'vehicle', mode: 'move_attack', maximumDistance: 1, sharedMain: true } })
    ]
  }
];

const familySpecs = [
  ['armsmaster', 'Armsmaster', 'universal', 'low', 'Authored weapon maneuvers and mobile pursuit without mandatory turn-by-turn Forms.'],
  ['berserker', 'Berserker', 'universal', 'moderate', 'Risk and endured harm create different choices from an ordinary high-health fighter.'],
  ['adept', 'Adept', 'universal', 'high', 'Useful direct techniques with optional stance transitions and finishers.'],
  ['opportunist', 'Opportunist', 'universal', 'moderate', 'One exact Opening connects setup, investigation, leverage and payoff.'],
  ['arcanist', 'Arcanist', 'universal', 'high', 'Prepared direct spells and bounded exceptional rituals from a learned catalog.'],
  ['channeler', 'Channeler', 'universal', 'moderate', 'A narrow known repertoire with optional printed overreach and real Strain.'],
  ['oathbound', 'Oathbound', 'universal', 'moderate', 'One exact declaration binds active protection or judgment to a named subject.'],
  ['shifter', 'Shifter', 'universal', 'high', 'One complete profile replaces another, granting concrete movement and senses.'],
  ['maker', 'Maker', 'universal', 'high', 'Portable devices or bounded installations with no autonomous second turns.'],
  ['bonded', 'Bonded', 'universal', 'high', 'A companion owns a position and conditions but shares its owner Main.'],
  ['catalyst', 'Catalyst', 'conditional', 'moderate', 'A willing allied actor earns the result of one visible, expiring cue.'],
  ['rider', 'Rider', 'module', 'high', 'A campaign-supported mount or vehicle changes movement scale and shares actions.']
];

export const ABILITY_FAMILIES = freeze(familySpecs.map(([key, label]) => ({ key, label, cssToken: key })));
export const CATALOG_SKILLS = freeze(['melee', 'ranged', 'endure', 'move', 'notice', 'influence', 'lore', 'craft', 'systems', 'survival', 'leadership', 'pilot']);
export const CLASS_PROFILES = freeze({
  base: { id: 'base', skills: {}, movement: ['walk'], senses: [], naturalWeapon: false },
  predator: { id: 'predator', skills: { melee: 3 }, movement: ['walk'], senses: ['scent'], naturalWeapon: true, checkDeltas: [{ skill: 'influence', direction: 'hinders', magnitude: 'slight', reason: 'Predator speech and posture' }] },
  stalker: { id: 'stalker', skills: { notice: 3 }, movement: ['walk', 'climb'], senses: ['scent'], naturalWeapon: true, checkDeltas: [{ skill: 'endure', direction: 'hinders', magnitude: 'slight', reason: 'Light stalking frame' }] },
  ironhide: { id: 'ironhide', skills: { endure: 3 }, movement: ['walk'], senses: [], naturalWeapon: true, incomingGradeReduction: 1, minimumIncomingGrade: 'graze', movementRequiresMain: true },
  climber: { id: 'climber', skills: { move: 3 }, movement: ['walk', 'climb'], senses: ['vibration'], naturalWeapon: false, checkDeltas: [{ skill: 'influence', direction: 'hinders', magnitude: 'slight', reason: 'Climber shape and speech' }] },
  aquatic: { id: 'aquatic', skills: {}, movement: ['walk', 'swim'], senses: ['underwater'], naturalWeapon: false, underwaterBreathing: true, contextualSkills: [{ skill: 'survival', bonus: 3, context: 'underwater' }], checkDeltas: [{ skill: 'move', direction: 'hinders', magnitude: 'slight', reason: 'Aquatic profile on dry ground', context: 'dry_ground' }] },
  winged: { id: 'winged', skills: { notice: 3 }, movement: ['walk', 'fly'], senses: ['distant_sight'], naturalWeapon: false, movementRequirements: { fly: 'space_for_wings' }, checkDeltas: [{ skill: 'melee', direction: 'hinders', magnitude: 'slight', reason: 'Winged frame in melee' }] }
});
export const COMPANION_PROFILES = freeze({
  partner: { id: 'partner', healthBonus: 0, movement: ['walk'], senses: ['scent'], attackGrade: 'wound', attackRange: 'engaged', canCarry: true, canHandleObjects: true },
  guardian: { id: 'guardian', healthBonus: 4, movement: ['walk'], senses: [], attackGrade: 'wound', attackRange: 'engaged', skills: { endure: 3 }, canCarry: true, canHandleObjects: true },
  scout: { id: 'scout', healthBonus: 0, movement: ['walk', 'climb'], senses: ['route'], attackGrade: 'wound', attackRange: 'engaged', canCarry: true, canHandleObjects: true },
  wisp: { id: 'wisp', healthBonus: 0, movement: ['walk', 'gap_crossing'], senses: ['energy'], attackGrade: 'graze', attackRange: 'near', canCarry: false, canHandleObjects: false }
});
export const VEHICLE_PROFILES = freeze({
  ace: { id: 'ace', baseHull: 28, hullPerLevel: 4, passengerCapacity: 1, scale: 'vehicle', sharedMain: true },
  cavalier: { id: 'cavalier', baseHull: 36, hullPerLevel: 4, passengerCapacity: 2, scale: 'vehicle', sharedMain: true }
});

export const VEHICLE_MOVEMENT_RULES = freeze({ version: 'vehicle-movement-1', hazardGrade: 'wound', replacement: 'recorded_safe_recovery' });
export const CLASS_RECOVERY_RULES = freeze({
  scene: { resets: ['sceneUses', 'exposure', 'reprisal', 'stance', 'opening', 'quarry', 'cue', 'brace', 'declaration'], retires: ['scene_installations'], interruptsRitual: true, doesNotReset: ['recoveryUses', 'strain', 'health', 'companionHealth', 'vehicleHull'] },
  safeRecovery: { requires: ['no_active_encounter', 'no_immediate_threat', 'recorded_safe_recovery'], resets: ['sceneUses', 'recoveryUses', 'exposure', 'reprisal', 'strain'], restoresHealth: true, restoresCompanionHealth: true, repairsVehicle: false, clearsSceneConditions: true, clearsPersistentConditions: false },
  advancement: { automaticGrants: true, preservesOwnedIds: true, heals: false, resetsCadence: false, grantsSecondClass: false }
});
const grantLevels = [1, 1, 1, 3, 5, 7, 10];

const definitions = branchSpecs.flatMap(branch => branch.grants.map((grant, index) => ({
  id: `ability.${branch.family}.${branch.id}.${slug(grant.name)}`,
  version: 1, familyId: branch.family, branchId: `${branch.family}.${branch.id}`,
  grantedAtLevel: grantLevels[index], ...grant
})));

function costLabel(definition) {
  if (definition.activation === 'passive') return 'Passive';
  const timing = definition.activation === 'ritual' ? `${definition.mechanic.steps} workings` : 'Main';
  if (definition.cadence.kind === 'scene_use') return `${timing}; ${definition.cadence.uses}/scene`;
  if (definition.cadence.kind === 'recovery_use') return `${timing}; ${definition.cadence.uses}/recovery`;
  if (definition.cadence.kind === 'commitment') return `${timing}; commitment`;
  return timing;
}

function validateDefinitions() {
  const ids = new Set();
  const names = new Set();
  for (const definition of definitions) {
    if (ids.has(definition.id) || names.has(definition.name.toLowerCase())) throw new Error('Catalog definition identity or name is duplicate.');
    if (definition.name.length > 80 || definition.description.length > 500) throw new Error(`Catalog source exceeds invocation limits: ${definition.id}`);
    if (!CATALOG_SKILLS.includes(definition.check?.skill) && definition.check !== null) throw new Error('Catalog check has an unknown skill.');
    if (!['main', 'passive', 'ritual'].includes(definition.activation)) throw new Error('Catalog activation is invalid.');
    if (!['none', 'scene_use', 'recovery_use', 'commitment'].includes(definition.cadence.kind)) throw new Error('Catalog cadence is invalid.');
    if (definition.cadence.kind.endsWith('_use') && (!Number.isSafeInteger(definition.cadence.uses) || definition.cadence.uses < 1)) throw new Error('Catalog use capacity is invalid.');
    if (!Number.isSafeInteger(definition.grantedAtLevel) || definition.grantedAtLevel < 1 || definition.grantedAtLevel > CATALOG_LEVEL_CAP) throw new Error('Catalog grant level is invalid.');
    ids.add(definition.id);
    names.add(definition.name.toLowerCase());
  }
}

validateDefinitions();
export const ABILITY_DEFINITIONS = freeze(definitions.map(definition => ({ ...definition, costLabel: costLabel(definition) })));
const definitionById = new Map(ABILITY_DEFINITIONS.map(definition => [definition.id, definition]));

function progressionFor(branch) {
  return Array.from({ length: CATALOG_LEVEL_CAP }, (_, index) => {
    const level = index + 1;
    return {
      level, xpRequired: index * 100, maxHealth: branch.health + index * 4,
      skillBonus: 10 + index * 3, secondarySkillBonus: 5 + index * 2,
      preparationCapacity: Math.min(7, 3 + Math.floor(index / 2)),
      installationCapacity: 1 + Math.floor(index / 3),
      companionMaxHealth: 18 + index * 3,
      vehicleMaxHull: (branch.id === 'cavalier' ? 36 : 28) + index * 4,
      grants: ABILITY_DEFINITIONS.filter(definition => definition.branchId === `${branch.family}.${branch.id}` && definition.grantedAtLevel === level).map(definition => definition.id)
    };
  });
}

export const CLASS_FAMILIES = freeze(familySpecs.map(([id, name, kind, complexity, description]) => ({
  id, name, kind, complexity, description,
  requirements: id === 'catalyst' ? ['alliedActors'] : id === 'rider' ? ['rider'] : [],
  branches: branchSpecs.filter(branch => branch.family === id).map(branch => ({
    id: `${id}.${branch.id}`, familyId: id, name: branch.name, classLabel: branch.fantasy,
    description: branch.description, summary: branch.description, complexity: branch.complexity,
    primarySkill: branch.primary, secondarySkill: branch.secondary,
    progression: progressionFor(branch),
    abilityDefinitionIds: ABILITY_DEFINITIONS.filter(definition => definition.branchId === `${id}.${branch.id}`).map(definition => definition.id)
  }))
})));
const branchById = new Map(CLASS_FAMILIES.flatMap(family => family.branches.map(branch => [branch.id, branch])));

const genreLabels = freeze({
  'historical': ['Weapon Master', 'Outrider', 'Berserker', 'Ironbound', 'Pugilist', 'Disciple', 'Scoundrel', 'Savant', 'Natural Philosopher', 'Ceremonialist', 'Saint', 'Oracle', 'Sworn Guardian', 'Zealot', 'Beast Warrior', 'Mask Adept', 'Apothecary', 'Mechanist', 'Falconer', 'Packmaster', 'Strategist', 'Orator', 'Helmsman', 'Heavy Cavalier'],
  'gothic': ['Slayer', 'Hunter', 'Cursed Brute', 'Revenant', 'Relic Fist', 'Penitent', 'Grave Rogue', 'Occult Sleuth', 'Occultist', 'Necromancer', 'Exorcist', 'Medium', 'Monster Warden', 'Witch Hunter', 'Werebeast', 'Doppelganger', 'Relic Tinker', 'Anatomist', 'Familiarist', 'Grave Caller', 'Hunt Tactician', 'Dirge Singer', 'Coachmaster', 'Beast Cavalier'],
  'western': ['Gunslinger', 'Trailblazer', 'Rager', 'Diehard', 'Brawler', 'Quiet Hand', 'Cardsharp', 'Maverick', 'Hexslinger', 'Relic Scholar', 'Faith Healer', 'Stormcaller', 'Lawbringer', 'Vindicator', 'War Shifter', 'Stance Gunner', 'Tinkerer', 'Gunsmith', 'Trail Companion', 'Companion Wrangler', 'Posse Tactician', 'Balladeer', 'Stagecoach Ace', 'Mounted Guardian'],
  'contemporary': ['Combat Specialist', 'Field Operative', 'Breacher', 'Juggernaut', 'Martial Artist', 'Close-Quarters Adept', 'Grifter', 'Specialist', 'Thaumaturge', 'Parapsychologist', 'Empath', 'Psychic', 'Sentinel', 'Vigilant', 'Combat Morph', 'Mimic', 'Inventor', 'Armorer', 'K-9 Handler', 'Drone Wrangler', 'Field Coordinator', 'Firebrand', 'Wheelman', 'Protection Driver'],
  'pulp': ['Martial Hero', 'Vigilante', 'Powerhouse', 'Invulnerable', 'Speedster', 'Mystic Fist', 'Trickster', 'Pulp Ace', 'Super-Scientist', 'Mystic', 'Radiant', 'Elemental', 'Guardian', 'Avenger', 'Beast Hero', 'Shapeshifter', 'Gadgeteer', 'Battlesuit Engineer', 'Sidekick Hero', 'Swarm Hero', 'Team Tactician', 'Icon', 'Vehicle Ace', 'Mech Guardian'],
  'cyberpunk': ['Street Samurai', 'Bounty Hunter', 'Chrome Rager', 'Heavy', 'Reflex Dancer', 'Ghost Monk', 'Edgerunner', 'Operator', 'Protocol Mage', 'Simulationist', 'Biochanneler', 'Resonant', 'Aegis', 'Renegade', 'Warbody', 'Chassis Dancer', 'Techsmith', 'Augmenter', 'Dronebond', 'Swarmrunner', 'Tactician', 'Rockerboy', 'Rig Jockey', 'Combat Driver'],
  'science-fiction': ['War Adept', 'Blaster Scout', 'Warform', 'Heavyworlder', 'Kinetic Adept', 'Zero-G Disciple', 'Scoundrel', 'Specialist', 'Technomancer', 'Noetic Scholar', 'Xenomedic', 'Psion', 'Order Knight', 'Void Templar', 'War Morph', 'Adaptive Shell', 'Field Engineer', 'Fabricator', 'Droid Partner', 'Xenokeeper', 'Mission Tactician', 'Holo-Icon', 'Starfighter Ace', 'Mech Cavalier'],
  'post-apocalypse': ['Road Warrior', 'Wasteland Hunter', 'Mutant Ravager', 'Wasteland Juggernaut', 'Pit Dancer', 'Dust Ascetic', 'Scavenger', 'Fixer', 'Relic Adept', 'Ash Scholar', 'Mender', 'Mutant', 'Settlement Warden', 'Vindicator', 'War Mutant', 'Relic Shifter', 'Scrounger', 'Scrapwright', 'Beast Tamer', 'Drone Shepherd', 'Warband Tactician', 'Storykeeper', 'Road Ace', 'War-Rig Guardian'],
  'surreal': ['Pattern Blade', 'Horizon Hunter', 'Nightmare', 'Unbroken', 'Motion Saint', 'Still Mind', 'Fate Thief', 'Mnemonist', 'Reality Scribe', 'Dream Architect', 'Soulkeeper', 'Star Vessel', 'Reality Anchor', 'Doom Judge', 'Nightmare Form', 'Manyself', 'Impossibility Smith', 'Flesh Architect', 'Echo-Bond', 'Manycaller', 'Pattern Conductor', 'Muse', 'Realm Navigator', 'Leviathan Rider']
});

function genreKey(genre) {
  const normalized = typeof genre === 'string' ? genre.toLowerCase().trim() : '';
  if (/cyberpunk|tech.noir/.test(normalized)) return 'cyberpunk';
  if (/space|science.fiction|sci.fi/.test(normalized)) return 'science-fiction';
  if (/post.apocal|survival/.test(normalized)) return 'post-apocalypse';
  if (/gothic|occult/.test(normalized)) return 'gothic';
  if (/western|frontier/.test(normalized)) return 'western';
  if (/contemporary|crime/.test(normalized)) return 'contemporary';
  if (/pulp|superhero/.test(normalized)) return 'pulp';
  if (/historical|grounded/.test(normalized)) return 'historical';
  if (/surreal|cosmic/.test(normalized)) return 'surreal';
  return 'fantasy';
}

function classLabel(branch, genre) {
  const labels = genreLabels[genreKey(genre)];
  const index = branchSpecs.findIndex(spec => `${spec.family}.${spec.id}` === branch.id);
  return labels?.[index] || branch.classLabel;
}

export function getClassBranch(id, branchId) {
  if (typeof id !== 'string' || (branchId !== undefined && typeof branchId !== 'string')) return null;
  const key = branchId === undefined ? id : (branchId.includes('.') ? branchId : `${id}.${branchId}`);
  return branchById.get(key) || null;
}

export function getAbilityDefinition(id, version = 1) {
  if (version !== 1) return null;
  return definitionById.get(id) || null;
}

function assertLevel(level) {
  if (!Number.isSafeInteger(level) || level < 1 || level > CATALOG_LEVEL_CAP) throw new RangeError('Catalog level must be an integer from 1 to 10.');
}

function availability(family, capabilities) {
  const missing = family.requirements.filter(requirement => capabilities[requirement] !== true);
  return {
    available: missing.length === 0,
    unavailableReason: missing.includes('alliedActors')
      ? 'Requires an allied actor guaranteed throughout ordinary campaign play.'
      : missing.includes('rider') ? 'Requires vehicle-capable scenes and a replacement mount or vehicle after loss.' : null
  };
}

function initialClassState(branch, level, ownedDefinitions, idFactory) {
  const progression = branch.progression[level - 1];
  const activeIds = ownedDefinitions.filter(definition => definition.activation !== 'passive' && definition.activation !== 'ritual').map(definition => definition.id);
  const shared = { schemaVersion: 1, familyId: branch.familyId, branchId: branch.id, sceneUses: {}, recoveryUses: {}, commitments: {}, sceneId: null };
  switch (branch.familyId) {
    case 'armsmaster': return { ...shared, quarry: null, brace: null };
    case 'berserker': return { ...shared, exposure: 0, exposureMaximum: 3, reprisal: 0, reprisalMaximum: 1, endure: null };
    case 'adept': return { ...shared, stance: 'ready' };
    case 'opportunist': return { ...shared, opening: null };
    case 'arcanist': return { ...shared, learned: ownedDefinitions.filter(definition => definition.activation !== 'passive').map(definition => definition.id), prepared: activeIds.slice(0, progression.preparationCapacity), preparationCapacity: progression.preparationCapacity, ritual: null };
    case 'channeler': return { ...shared, strain: 0, strainMaximum: 3 };
    case 'oathbound': return { ...shared, declaration: null };
    case 'shifter': return { ...shared, profile: 'base', learnedProfiles: ['base', ...ownedDefinitions.filter(definition => definition.mechanic.kind === 'profile' && definition.mechanic.mode === 'replace').map(definition => definition.mechanic.profile)] };
    case 'maker': return { ...shared, prepared: activeIds.slice(0, progression.preparationCapacity), preparationCapacity: progression.preparationCapacity, installations: [], installationCapacity: progression.installationCapacity };
    case 'bonded': {
      const profile = branch.id.endsWith('.partner') ? 'partner' : 'guardian';
      const maxHealth = progression.companionMaxHealth + COMPANION_PROFILES[profile].healthBonus;
      return { ...shared, companion: { id: idFactory(), profile, health: maxHealth, maxHealth, area: null, conditions: [], status: 'active', sharedMain: true }, learnedProfiles: branch.id.endsWith('.partner') ? ['partner'] : ['guardian', 'scout', ...(level >= 5 ? ['wisp'] : [])] };
    }
    case 'catalyst': return { ...shared, cue: null };
    case 'rider': return { ...shared, vehicle: { id: idFactory(), profile: branch.id.endsWith('.cavalier') ? 'cavalier' : 'ace', hull: progression.vehicleMaxHull, maxHull: progression.vehicleMaxHull, area: null, occupants: [], passengerCapacity: branch.id.endsWith('.cavalier') ? 2 : 1, scale: 'vehicle', status: 'active', sharedMain: true } };
    default: throw new Error('Unknown class family.');
  }
}

const starterEquipment = freeze({
  armsmaster: ['versatile-weapon', 'light-armor'], berserker: ['heavy-weapon', 'travel-gear'],
  adept: ['travel-gear'], opportunist: ['light-weapon', 'tool-kit'], arcanist: ['spellbook', 'ritual-focus'],
  channeler: ['channel-focus', 'travel-gear'], oathbound: ['versatile-weapon', 'heavy-armor'],
  shifter: ['travel-gear'], maker: ['tool-kit', 'field-projector'], bonded: ['light-weapon', 'companion-kit'],
  catalyst: ['light-weapon', 'signal-focus'], rider: ['sidearm', 'vehicle-tool-kit']
});

const equipmentData = [
  ['versatile-weapon', 'Versatile Weapon', 'weapon', 'melee', 'martial'],
  ['heavy-weapon', 'Heavy Weapon', 'weapon', 'melee', 'heavy'],
  ['light-weapon', 'Light Weapon', 'weapon', 'melee', 'simple'],
  ['ranged-weapon', 'Ranged Weapon', 'weapon', 'ranged', 'ranged'],
  ['sidearm', 'Sidearm', 'weapon', 'ranged', 'ranged'],
  ['light-armor', 'Light Armor', 'armor', null, 'light'],
  ['heavy-armor', 'Heavy Armor', 'armor', null, 'heavy'],
  ['travel-gear', 'Travel Gear', 'general', null, null],
  ['tool-kit', 'Tool Kit', 'tool', null, null],
  ['spellbook', 'Spellbook', 'focus', null, null],
  ['ritual-focus', 'Ritual Focus', 'focus', null, null],
  ['channel-focus', 'Channel Focus', 'focus', null, null],
  ['field-projector', 'Field Projector', 'tool', null, null],
  ['companion-kit', 'Companion Kit', 'tool', null, null],
  ['signal-focus', 'Signal Focus', 'focus', null, null],
  ['vehicle-tool-kit', 'Vehicle Tool Kit', 'tool', null, null]
];
export const CLASS_EQUIPMENT = freeze(Object.fromEntries(equipmentData.map(([key, name, type, weaponKind, category]) => [
  `equipment.${key}`, { id: `equipment.${key}`, name, type, description: `An authored ${name.toLowerCase()}.`,
    weapon: type === 'weapon', weaponKind: weaponKind ? `${weaponKind}_weapon` : null, weaponCategory: type === 'weapon' ? category : null,
    wielded: type === 'weapon', natural: false, fixed: false,
    armor: type === 'armor' ? category : null, tags: type === 'tool' ? ['tool', key] : type === 'focus' ? ['focus', key] : [],
    ...(type === 'weapon' ? { harmGrade: 'wound' } : {}) }
])));
export const CLASS_EQUIPMENT_PERMISSIONS = freeze({
  armsmaster: { weapons: ['unarmed', 'simple', 'martial', 'ranged'], armor: ['light'] },
  berserker: { weapons: ['unarmed', 'simple', 'heavy'], armor: ['light'] },
  adept: { weapons: ['unarmed', 'simple'], armor: [] },
  opportunist: { weapons: ['unarmed', 'simple', 'ranged'], armor: ['light'] },
  arcanist: { weapons: ['unarmed', 'simple'], armor: [] },
  channeler: { weapons: ['unarmed', 'simple'], armor: ['light'] },
  oathbound: { weapons: ['unarmed', 'simple', 'martial'], armor: ['light', 'heavy'] },
  shifter: { weapons: ['unarmed', 'simple'], armor: [] },
  maker: { weapons: ['unarmed', 'simple'], armor: ['light'] },
  bonded: { weapons: ['unarmed', 'simple'], armor: ['light'] },
  catalyst: { weapons: ['unarmed', 'simple'], armor: ['light'] },
  rider: { weapons: ['unarmed', 'simple', 'ranged'], armor: ['light'] }
});

export function buildClassLoadout({ familyId, branchId, level = 1, genre = '', capabilities = {}, modules = [], optionSet = CATALOG_OPTION_SET, catalogVersion = CATALOG_VERSION, idFactory = randomUUID } = {}) {
  if (catalogVersion !== CATALOG_VERSION) throw new Error('Unsupported class catalog version.');
  if (optionSet !== CATALOG_OPTION_SET) throw new Error('This development catalog is available only in Expert; Base and Advanced have no earned entries.');
  assertLevel(level);
  if (typeof idFactory !== 'function') throw new TypeError('idFactory must be a function.');
  const branch = getClassBranch(familyId, branchId || '');
  if (!branch || branch.familyId !== familyId) throw new Error('Unknown class family or branch.');
  if (!Array.isArray(modules) || modules.some(module => module !== 'rider')) throw new Error('Unknown campaign class module.');
  if (familyId === 'rider' && !modules.includes('rider')) throw new Error('Rider requires the enabled rider campaign module as well as its scene and replacement guarantees.');
  const family = CLASS_FAMILIES.find(entry => entry.id === familyId);
  const status = availability(family, capabilities);
  if (!status.available) throw new Error(status.unavailableReason);
  const issuedIds = new Set();
  const freshId = () => {
    const id = idFactory();
    if (typeof id !== 'string' || id.length === 0 || id.length > 128 || id.trim() !== id || issuedIds.has(id)) throw new Error('idFactory must return unique bounded opaque instance IDs.');
    issuedIds.add(id);
    return id;
  };
  const granted = branch.abilityDefinitionIds.map(id => getAbilityDefinition(id)).filter(definition => definition.grantedAtLevel <= level);
  const abilities = granted.map(definition => ({
    id: freshId(), definition_id: definition.id, definition_version: definition.version,
    name: definition.name, description: definition.description, tier: 'expert', source: branch.id,
    ...(definition.activation === 'passive' ? {} : { invocation: { schema_version: 1, family_key: familyId } })
  }));
  const bindings = abilities.filter(ability => ability.invocation).map(ability => ({ abilityId: ability.id, term: ability.name, aliases: [], prose: ability.description }));
  const progression = branch.progression[level - 1];
  const skills = Object.fromEntries(CATALOG_SKILLS.map(name => [name, name === branch.primarySkill ? progression.skillBonus : name === branch.secondarySkill ? progression.secondarySkillBonus : 0]));
  let maxHealth = progression.maxHealth;
  const equipment = new Set(starterEquipment[familyId]);
  if (branch.primarySkill === 'ranged') equipment.add('ranged-weapon');
  for (const definition of granted.filter(definition => definition.activation === 'passive')) {
    const modifiers = definition.mechanic.modifiers;
    maxHealth += modifiers.maxHealth || 0;
    for (const [name, bonus] of Object.entries(modifiers.skills || {})) skills[name] = Math.min(75, skills[name] + bonus);
    (modifiers.equipment || []).forEach(item => equipment.add(item));
  }
  const classState = initialClassState(branch, level, granted, freshId);
  const resources = {
    health: { current: maxHealth, maximum: maxHealth, recovery: 'safe_recovery' },
    ...(familyId === 'berserker' ? { exposure: { current: 0, maximum: 3, recovery: 'regain_control_or_scene_end', isRisk: true } } : {}),
    ...(familyId === 'channeler' ? { strain: { current: 0, maximum: 3, recovery: 'safe_recovery', isRisk: true } } : {})
  };
  return {
    archetype: family.name, archetypeId: familyId, familyId, branch: branch.name, branchId: branch.id,
    classLabel: classLabel(branch, genre), level, xp: progression.xpRequired, abilities, bindings,
    inventory: [...equipment].map(key => ({ id: `equipment.${key}`, name: CLASS_EQUIPMENT[`equipment.${key}`].name, description: CLASS_EQUIPMENT[`equipment.${key}`].description, quantity: 1, type: CLASS_EQUIPMENT[`equipment.${key}`].type })),
    equipmentPermissions: clone(CLASS_EQUIPMENT_PERMISSIONS[familyId]),
    attributes: { strength: familyId === 'berserker' ? 14 : 10, agility: ['adept', 'opportunist'].includes(familyId) ? 14 : 10, intellect: ['arcanist', 'maker'].includes(familyId) ? 14 : 10, willpower: ['channeler', 'oathbound'].includes(familyId) ? 14 : 10 },
    skills, health: maxHealth, maxHealth, mana: 0, maxMana: 0, classState, resources,
    pins: { catalogVersion: CATALOG_VERSION, rulesVersion: CATALOG_RULES_VERSION, resolutionVersion: CATALOG_RESOLUTION_VERSION, effectCatalogVersion: CATALOG_EFFECT_VERSION, optionSet: CATALOG_OPTION_SET },
    requiredOperations: [...REQUIRED_EFFECT_OPERATIONS], requiredHandlers: [...REQUIRED_MECHANIC_HANDLERS]
  };
}

function preview(definition) {
  return { definitionId: definition.id, definitionVersion: definition.version, name: definition.name, description: definition.description, activation: definition.activation, cadence: clone(definition.cadence), cost: clone(definition.cost), costLabel: definition.costLabel, targeting: clone(definition.targeting), grantedAtLevel: definition.grantedAtLevel };
}

export function getCatalogSummary({ genre = '', capabilities = {}, optionSet = CATALOG_OPTION_SET } = {}) {
  if (optionSet !== CATALOG_OPTION_SET) throw new Error('No Base or Advanced catalog membership has been earned.');
  return {
    catalogVersion: CATALOG_VERSION, rulesVersion: CATALOG_RULES_VERSION, resolutionVersion: CATALOG_RESOLUTION_VERSION, effectCatalogVersion: CATALOG_EFFECT_VERSION, optionSet: CATALOG_OPTION_SET,
    evidence: 'unverified', levelCap: CATALOG_LEVEL_CAP,
    optionSets: [{ id: 'expert', label: 'Expert (development)', evidence: 'unverified' }],
    modules: [{ id: 'rider', name: 'Rider', requires: ['vehicle_scenes', 'replacement_vehicle'], grantsSecondClass: false }],
    families: CLASS_FAMILIES.map(family => ({
      id: family.id, name: family.name, kind: family.kind, description: family.description,
      complexity: family.complexity, ...availability(family, capabilities),
      branches: family.branches.map(branch => {
        const starterAbilities = branch.abilityDefinitionIds.map(id => getAbilityDefinition(id)).filter(definition => definition.grantedAtLevel === 1).map(preview);
        return {
          id: branch.id, name: branch.name, classLabel: classLabel(branch, genre), description: branch.description,
          summary: branch.summary, complexity: branch.complexity, abilities: starterAbilities, starterAbilities,
          progression: branch.progression.map(level => ({ ...clone(level), grants: level.grants.map(id => preview(getAbilityDefinition(id))) }))
        };
      })
    }))
  };
}

function collectOperations(value, operations) {
  if (Array.isArray(value)) value.forEach(entry => collectOperations(entry, operations));
  else if (value && typeof value === 'object') {
    if (typeof value.op === 'string') operations.add(value.op);
    Object.values(value).forEach(entry => collectOperations(entry, operations));
  }
}
const operationSet = new Set();
ABILITY_DEFINITIONS.forEach(definition => collectOperations(definition, operationSet));
export const REQUIRED_EFFECT_OPERATIONS = freeze([...operationSet].sort());
export const REQUIRED_MECHANIC_HANDLERS = freeze([...new Set(ABILITY_DEFINITIONS.map(definition => definition.mechanic.kind).filter(kind => kind !== 'none'))].sort());

export function assertCatalogExecutorSupport({ operations = [], handlers = [] } = {}) {
  const operationSupport = new Set(operations);
  const handlerSupport = new Set(handlers);
  const missingOperations = REQUIRED_EFFECT_OPERATIONS.filter(operation => !operationSupport.has(operation));
  const missingHandlers = REQUIRED_MECHANIC_HANDLERS.filter(handler => !handlerSupport.has(handler));
  if (missingOperations.length || missingHandlers.length) {
    throw new Error(`Catalog executor is incomplete. Missing operations: ${missingOperations.join(', ') || 'none'}. Missing handlers: ${missingHandlers.join(', ') || 'none'}.`);
  }
  return true;
}
