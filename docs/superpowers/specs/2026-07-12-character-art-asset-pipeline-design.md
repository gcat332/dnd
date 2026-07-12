# Character Art And Asset Pipeline Design

Date: 2026-07-12
Status: Approved for planning

## Objective

Define the V1 visual and technical contract for animated 3D characters on the
2.5D Battle Map. Characters must read clearly at tactical zoom throughout the
controlled orbit camera, retain an original colorful Japanese JRPG identity,
show equipped weapons in play, and remain affordable to render on desktop and
tablet.

This design covers player characters, humanoid NPCs, and representative
monsters. It does not select a permanent commercial asset catalogue or begin
mass character production.

## Visual Direction

Use stylized low-poly Japanese JRPG/anime fantasy with an original
hero-versus-demon-lord identity. The visual language is colorful and graphic,
not semi-realistic, voxel, western miniature, or super-deformed chibi.

Humanoid characters use these principles:

- approximately 5.5 to 6 heads tall;
- a slightly oversized head, hands, feet, hair, and class-defining equipment;
- clean shapes and restrained surface detail that remain legible from the
  supported 35-to-90-degree camera pitch range;
- saturated faction colors with strong value separation from terrain;
- distinctive silhouettes for role, faction, and threat level; and
- original costumes, symbols, weapons, names, and creature designs.

Faces do not require a facial rig in V1. Portraits or future dialogue close-ups
may use separate authored assets rather than increasing every tactical model's
runtime cost.

Taleforge supplies selection rings, team colors, health indicators, and other
tactical overlays. These must not be baked into character meshes or textures.
Labels and upright status presentation face the camera or render in screen
space; character models and their equipment remain oriented in the world.

## Sourcing Strategy

Use a hybrid sourcing strategy:

1. Prove the pipeline with CC0 KayKit characters: Knight, Mage, and Skeleton.
2. Evaluate the approved models in the real orthographic Battle Map before
   buying a production library.
3. Commission the signature Hero, Demon Lord, and faction-defining enemies
   after readability, animation, equipment, and performance are proven.
4. Use licensed or CC0 packs for secondary NPCs and monsters where their style
   can be normalized without compromising the art direction.

KayKit assets are technical slice assets, not the final visual identity.
Quaternius is an open modular fallback. Meshtint Cute/Toon may be useful for a
paid visual bake-off, but its proportions must be checked against the 5.5 to 6
head target. Synty assets remain blocked from production use until Taleforge
receives written confirmation covering browser-delivered GLB files and the
licence's game-creation-software restriction.

Do not use marketplace screenshots as the production art decision. Do not buy
a broad catalogue until a representative model has passed conversion, camera,
performance, and licence checks.

## Character Recipe

A runtime character is an approved, immutable Character Recipe assembled
offline and exported as one GLB. V1 supports Modular JRPG Lite:

- a small number of body archetypes;
- swappable hair and face variants;
- selectable skin tone;
- class base outfits with palette or material variants;
- equipment attached to standardized sockets; and
- one shared humanoid skeleton wherever proportions permit.

V1 does not include body sliders, free-form character sculpting, runtime mesh
assembly, or fully interchangeable armor pieces. Offline recipes keep draw
calls, licensing, loading, and visual QA predictable while still allowing
meaningful character variety.

Each recipe records stable identifiers for its body, appearance variants,
outfit, palette, equipment visuals, skeleton contract, animation set, and
source licence entries. Domain state refers to these identifiers and never to
Three.js objects or asset file paths directly.

## Skeleton And Equipment Contract

The shared humanoid skeleton must support the five V1 clips and these named
equipment sockets:

- `socket_main_hand` for swords, axes, staves, bows, and similar equipment;
- `socket_off_hand` for shields, a second weapon, or a focus;
- `socket_back` for a sheathed weapon, bow, or other stowed equipment; and
- `socket_head` for prominent hats, helmets, horns, and similar headgear.

Socket orientation, scale, and handedness are part of the asset contract and
must be validated in Blender and in the Battle Map. An equipped item's domain
identifier maps to an approved visual asset. Missing or unsupported visuals
fall back to a neutral placeholder without changing the authoritative item.

When equipment state changes, the renderer updates the relevant attachment.
The renderer does not infer inventory ownership, legality, attack damage, or
combat effects from the visible mesh. Important class outfit changes may load
a different approved Character Recipe rather than reconstructing armor at
runtime.

Non-humanoid monsters may use their own skeleton contract. They must still
follow the same runtime animation names, scale/origin rules, performance
budgets, and domain/presentation boundary.

## Animation Contract

Every V1 character provides these normalized clips:

- `idle`, looping;
- `move`, looping and in place;
- `attack`, one shot;
- `hit`, one shot; and
- `death`, one shot that holds or resolves to a stable final pose.

Clips are sampled at 30 frames per second with unused tracks removed. Root
motion never commits grid position. The authoritative Token position comes
from accepted Battle Map state; local animation only interpolates its visual
presentation.

Attack clips expose authored timing metadata for the contact, projectile
release, or spell release moment. Equipment remains attached throughout the
clip unless an explicit presentation event temporarily transfers it. Animation
completion must not decide whether an attack succeeds or deals damage.

## Skill And Combat VFX Contract

Tactical Rules Automation emits accepted presentation events after resolving
an action. A presentation event contains stable source and target identifiers,
an effect identifier, timing information, and any required positions or
directions. Examples include a sword slash, fire projectile, impact burst,
healing pulse, or status aura.

The renderer maps the event to animation and VFX assets, then plays them as
local presentation. It may reduce particles, lights, shadows, or secondary
effects for a device quality tier, but it must preserve timing and readable
combat feedback. VFX never decides hit chance, damage, saving throws, status,
visibility permission, or resource consumption.

Reconnect and replay behavior uses stable event IDs so a transient effect is
not duplicated accidentally. Persistent conditions are rendered from current
domain state rather than relying on an old transient event.

## Runtime Asset Budget

Use these initial acceptance targets for the vertical slice:

| Budget | Hero or NPC | Common monster |
| --- | ---: | ---: |
| Render triangles at LOD0 | at most 12,000 | at most 8,000 |
| Skinned meshes | 1 preferred, 2 maximum | 1 preferred, 2 maximum |
| Materials and draw calls | 1 preferred, 2 maximum | 1 preferred, 2 maximum |
| Deformation bones | at most 60 | at most 50 |
| Bone influences per vertex | at most 4 | at most 4 |
| Runtime texture set | one 512 by 512 atlas | one 512 by 512 atlas |
| Compressed GLB | at most 1.5 MB | at most 1.0 MB |

A signature model may use one 1024 by 1024 atlas only when the difference is
visible at the supported camera distances and the physical-device budget still
passes. The first three models must total no more than 4 MB compressed on
initial load.

The Battle Map supports up to 200 active interactive Tokens or props, but it
does not animate 200 unique skeletons at full frequency. The spike should
profile 32 to 40 nearby skeletal mixers, throttle or pause distant idle clips,
and use lower-detail or static presentation at overview zoom. These numbers
remain provisional until measured on representative physical devices.

## Production Pipeline

1. Acquire source archives and record vendor, pack, version, purchase channel,
   invoice, licence, download date, and archive hash.
2. Normalize sources in Blender: meters, ground-centered origin, transforms,
   weights, topology, skeleton, sockets, materials, and named clips.
3. Assemble approved Character Recipes offline and retain editable `.blend`
   sources outside the public runtime bundle.
4. Atlas compatible materials, remove unused content, enforce four weights per
   vertex, and create LODs only when measurements justify them.
5. Export one self-contained GLB per recipe, using Meshopt geometry compression
   and KTX2 textures when representative device tests justify their decoders.
6. Run glTF validation plus automated budget and contract checks.
7. Render turntable, default 55-degree, shallow 35-degree, and top-view
   reference snapshots for visual regression.
8. Test download, decode, GPU memory, mixer CPU time, draw calls, shadow cost,
   context restoration, disposal, and tactical readability in the real scene.

Paid raw archives must not enter a public repository or public application
bundle. An in-repo asset manifest maps every runtime file to its source,
licence proof, permitted transformations, and modification history.

## Three-Character Vertical Slice

Build one coherent technical slice before permanent art production:

1. Player Character: KayKit Knight with sword and shield.
2. NPC: KayKit Mage with staff or wand and a spell release event.
3. Monster: KayKit Skeleton with a one-handed weapon.

The slice must prove:

- all five normalized clips and reliable transitions;
- main-hand, off-hand, back, and head attachment behavior;
- an equipment change driven by accepted character state;
- melee contact, projectile or spell release, hit, and healing VFX events;
- original grid position remaining authoritative during animation;
- readable role and facing at normal and overview zoom across the supported
  camera pitch range and representative yaw angles;
- selection and status overlays remaining readable around the model;
- compliance with the GLB, texture, material, bone, and draw-call budgets; and
- desktop plus physical-tablet profiling in the supported Battle Map scene.

A later fourth spike tests a non-humanoid creature before committing the full
monster pipeline. It does not block the first three-character slice.

## Acceptance Gate

The character pipeline is ready for production planning only when the vertical
slice demonstrates:

- readable silhouettes and role recognition at supported zoom levels and
  controlled orbit angles;
- correct equipment attachments and state-driven swaps;
- deterministic animation and VFX integration without rules leakage;
- valid, reproducible asset and licence records;
- compliant optimized GLBs with no missing clips or unsupported extensions;
- acceptable loading, memory, draw-call, mixer, and shadow costs; and
- the Battle Map performance target on representative desktop and physical
  tablet hardware.

After this gate, compare at most one paid Meshtint sample and one legally
cleared Synty sample in the same camera scene. If neither meets the approved
JRPG direction without substantial rework, commission the signature cast
instead of accumulating incompatible packs.

## Out Of Scope For V1

- a marketplace for user-supplied character assets;
- an in-app mesh or body editor;
- body-proportion sliders;
- fully modular runtime armor construction;
- facial animation and cinematic dialogue rigs;
- cloth, hair, or ragdoll physics;
- gameplay determined by animation, collision, particles, or visible gear;
- a permanent paid catalogue choice before the vertical-slice gate; and
- mass production of custom characters before physical-device validation.

## Supporting Research

See
`docs/research/2026-07-12-character-3d-model-sources.md` for the current source,
format, licence, browser-delivery, animation, and asset-budget comparison.
