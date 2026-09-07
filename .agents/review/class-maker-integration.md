# Maker Installation Follow-Through

The class-experience completion audit found an unsupported promise in Mobile
Bastion: it advertised repairing installation durability, but no live action
could damage an installation. Deployments always created a full unused health
pool, and component fixtures manually reduced that number.

The delegated design choice keeps Mobile Bastion's useful action: move one
active owned installation and its surviving features to an adjacent legal area,
preserving its identity, for one Main and one scene use. It removes the repair
claim and unused new-installation health fields rather than introducing another
durability subsystem solely to justify that claim. Existing historical fields
are not deleted from imported snapshots or changed by relocation.

`test-class-maker-turns.mjs` uses actual campaign creation, six earned milestone
turns, the resulting level-seven grant and binding, Deploy Bulwark, persisted
reload, Mobile Bastion and exact export. Only provider responses are stubbed.
The test verifies the owner stays put, the installation keeps its identity, old
cover clears and new cover occupies the destination, no unsupported health pool
is created, one Main/use is consumed, and rejected/retried requests preserve
state correctly. No synthetic installation or direct world rewrite supplies
the tested prerequisites.

The focused integration suite passes. The component deploy-to-relocate sequence
also passes. Restoring health/maxHealth initialization made its unsupported-pool
assertion fail; restoring the fix passed the complete active-action matrix.
This verifies mechanics and persistence, not player enjoyment. The parent plan
owns combined verification and completion status.
