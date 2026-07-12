# Production 3D Character Sources for Taleforge

Date: 2026-07-12

## Question

Which character-model sources and asset pipeline fit Taleforge's top-down 2.5D
Battle Map?

The target is colorful, low-poly Japanese JRPG/anime fantasy with readable
silhouettes: an original hero-versus-demon-lord setting, not semi-realism and
not proprietary D&D characters or monster likenesses. The renderer is
Three.js/R3F on WebGL 2, with GLB/glTF as the runtime format, desktop/tablet
support, and five initial clips: `idle`, `move`, `attack`, `hit`, and `death`.

## Recommendation

Use a three-stage sourcing strategy:

1. **Build the first vertical slice with KayKit CC0 assets.** Use the Knight as
   a player character, Mage as an NPC, and Skeleton as a monster. This is the
   strongest combination of the requested sources for Taleforge's colorful
   low-poly JRPG direction, and it already has coherent rigs, shared atlas
   thinking, glTF/FBX files, and more animation coverage than V1 needs.
2. **Run an art-direction bake-off before buying a production library.** Test
   one Meshtint Cute/Toon character and one Synty POLYGON MINI character from
   the actual orthographic camera, at token size, against the intended terrain
   and lighting. Meshtint is the closer JRPG/chibi fit; Synty is the broader
   miniature roster. Both require written confirmation that delivering
   converted GLB files to browser clients is permitted under the applicable
   licence before purchase or release. Synty also requires confirmation that
   Taleforge is not prohibited "Game Creation Software" under its current EULA.
3. **Commission the signature cast after the pipeline is proven.** Commission
   the hero, demon lord, and a small set of faction-defining enemies with an
   assignment or sufficiently broad exclusive licence covering source files,
   modification, web delivery, marketing, sequels, and contractor access. Use
   purchased or CC0 packs for secondary NPCs and monsters. This gives Taleforge
   an ownable visual identity without paying for a full custom roster before
   token readability and device performance are known.

Do not use Reallusion/Character Creator as the default V1 pipeline. It is a
credible current modular system but is optimized toward detailed digital
humans, carries more complex per-component/output licensing, and is a poor fit
for the chosen low-poly anime direction. Use Mixamo only as an offline fallback
for humanoid animation/retargeting, not as the character catalogue or a runtime
dependency.

## Source Comparison

| Source | Relevant content and formats | Rig, animation, customization | Licence and redistribution | Fit for Taleforge |
| --- | --- | --- | --- | --- |
| **KayKit (Kay Lousberg)** | Adventurers has 5 characters in the free tier and 3 more in EXTRA, plus 25+ accessories; Skeletons has 4 free and 2 EXTRA characters. Both provide FBX and glTF. | Characters are rigged and animated. The separate Character Animations pack has 133 humanoid clips across medium/large rigs, including idle, movement, melee, ranged, spellcasting, hit, and death. Current Unity packaging describes separable body/head/arms/legs for swapping, but verify the exact direct-download tier before relying on that modularity. | Each cited pack page states CC0, commercial use and no attribution required. CC0 permits copy, modification and distribution, including commercially; retain the pack's included licence anyway. This is an **asset-pack licence**, not a conclusion inferred from itch.io or Unity marketplace terms. | **Best first choice.** Strong style match, mobile-oriented geometry, a single 1024 atlas that the author says can be reduced to 128, and coherent hero/enemy animations. [Adventurers](https://kaylousberg.com/game-assets/characters-adventurers), [Skeletons](https://kaylousberg.com/game-assets/characters-skeletons), [Animations](https://kaylousberg.com/game-assets/character-animations), [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| **Quaternius** | RPG Character Pack has 6 rigged animated fantasy characters; Ultimate Monsters has 50 animated monsters. The newer Universal Base Characters has 6 bodies and 20 hairstyles, while Modular Fantasy Outfits has 12 outfits/62 parts. Packs provide glTF plus FBX and commonly OBJ/Blend; the universal animation library provides FBX/GLB/Blend. | The Universal Base/Outfit system uses a humanoid rig and is compatible with 120+ animations in Library 1 and 130+ complementary animations in Library 2. Base characters average about 13k triangles. Strongest open modular foundation in this comparison. | The **individual pack pages** mark the assets CC0; newer tiered pages state that free, extra, and source tiers remain usable commercially. CC0 removes the raw-redistribution concern, subject to its limitations for trademarks, publicity/privacy, and third-party rights. | **Excellent open fallback and customization base**, but the default visual language is western/cartoon low-poly rather than specifically JRPG/anime. Art direction would need new heads, hair, proportions, palettes, and possibly faces. [RPG characters](https://quaternius.com/packs/rpgcharacters.html), [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html), [Universal Base](https://quaternius.com/packs/universalbasecharacters.html), [Fantasy Outfits](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html), [Animation Library 1](https://quaternius.com/packs/universalanimationlibrary.html), [Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html) |
| **Kenney** | Mini Dungeon contains 25 files, character rigs, animation, weapons and shields; Mini Characters and Blocky Characters are animated but contemporary/generic rather than fantasy-specific. Kenney distributes glTF as GLB and generally also supports FBX/OBJ in its 3D asset workflow. | Kenney documents humanoid FBX character and separate-animation import/retargeting. The fantasy character roster and clip breadth are much smaller than KayKit/Quaternius. | Kenney's **site support policy** says all game assets on asset pages are CC0; the Mini Dungeon page also states CC0. Commercial use and no attribution are allowed. Save the per-pack licence because the site-wide statement only applies to assets on those pages. | **Good terrain/prop and emergency placeholder source**, not the production character identity. Miniatures read well top-down, but there is not enough coherent fantasy character/monster depth for Taleforge alone. [Mini Dungeon](https://kenney.nl/assets/mini-dungeon), [Support/licence](https://www.kenney.nl/support), [3D formats](https://kenney.nl/knowledge-base/game-assets-3d/importing-3d-models-into-game-engines), [character workflow](https://kenney.nl/knowledge-base/game-assets-3d/importing-characters-and-animations) |
| **Synty Studios / POLYGON** | POLYGON MINI Fantasy Characters has 60 mini characters and 28 props, including heroes, goblins, skeletons, a golem, mages and villagers. Simple Fantasy has 22 humans/knights, 6 goblins, 5 elves, 6 undead, props/environments and a broad built-in animation set. Modular Fantasy Hero has 720 parts and 120 Unity presets, but no animations. Store downloads are Unity/Unreal projects plus FBX source, not glTF. | Characters use Mecanim-compatible humanoid rigs. POLYGON MINI and Modular Hero need a separate animation source; Synty's current animation packs are separate products and some target standard POLYGON rigs/Unity, so compatibility must be tested rather than assumed. High modular breadth; conversion from FBX and shader/material cleanup are required for Three.js. | Buy the specific pack under the **One-Time Purchase EULA**, not SyntyPass unless a continuing subscription is intended. The current one-time licence is perpetual/royalty-free for incorporated video games but prohibits sharing source files/models for reuse and expressly prohibits "Game Creation Software." The subscription licence has materially different post-expiry and content-creation-system terms. Because Taleforge includes campaign/content creation and browsers download GLBs, obtain written approval for both product classification and transformed web delivery. | **Best broad paid miniature roster**, especially POLYGON MINI; colorful and readable but more western board-game miniature than anime/JRPG. The unresolved Game Creation Software clause is a release blocker, not a minor caveat. Simple Fantasy is mobile-oriented and unusually complete. Avoid buying the expensive modular pack before the camera bake-off. [POLYGON MINI](https://syntystore.com/products/polygon-mini-fantasy-characters-pack), [Simple Fantasy](https://syntystore.com/products/simple-fantasy-cartoon-assets), [Modular Hero](https://syntystore.com/products/polygon-modular-fantasy-hero-characters), [One-Time EULA](https://syntystore.com/pages/one-time-purchase-licence), [licence types](https://syntystore.com/pages/licences-overview) |
| **Adobe Mixamo** | A library of humanoid characters/animations and an online auto-rigger. It accepts FBX, OBJ or ZIP for unrigged uploads and FBX for an existing rig; downloads are an offline conversion step before Blender/glTF export. | Auto-rigging and animation are bipedal-humanoid only. Large appendages, wings, tails, disconnected parts, extreme proportions and asymmetry can fail. Useful for hero/NPC clips; not a monster solution. | Adobe's **Mixamo service FAQ** says its characters and animations are royalty-free for personal, commercial and nonprofit projects, including games. It does not expressly grant redistribution as a reusable animation/model library, so ship only clips baked into an eligible game character, keep downloads private, and do not expose a Mixamo catalogue to users. Record the Adobe ID/date and FAQ snapshot. | **Animation fallback only.** Free and practical for missing humanoid clips, but visual coherence, retarget cleanup, foot sliding, weapon alignment and the service's online dependency add production risk. [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html), [upload/rig workflow](https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html) |
| **Meshtint Cute/Toon** | Cute Series is a large stylized character/monster ecosystem, often with evolution stages. Modular Fantasy Characters Toon includes 8 samples, 100 female and 100 male bases, large hair/face/gear sets, FBX and PSD/PNG. Individual Cute Pro creatures commonly include idle, move, attack, take-damage and death clips; the cited Flower is 1,640 triangles and uses a 2048 gradient source texture reduced to 512 in Unity. | Humanoid products are Mecanim-ready and modular; creatures have generic rigs and separate FBX clips. Products are Unity-first and the store warns that non-Unity compatibility is not guaranteed, so a paid sample must pass Blender-to-GLB conversion before broader purchase. | Meshtint's **store-wide direct-store licence** allows commercial games, websites/electronic devices, modification, and compiled applications, but prohibits marketing, distributing, transferring or sublicensing products in other forms. A single-entity licence does not cover raw-file sharing across separate contractor entities. Ask for written browser-GLB and contractor confirmation. | **Closest paid art-direction match.** Chibi proportions, clean color, fantasy heroes and cute/evolving monsters suit old-school JRPG more directly than Synty. Main risks are Unity-first delivery, many separate materials/textures across modular combinations, style drift between Cute/Cute Pro/Toon, and browser licensing ambiguity. [Cute Series](https://www.meshtint.com/collections/cute-series), [Modular Fantasy Toon](https://www.meshtint.com/products/modular-fantasy-characters-toon-series), [sample creature specification](https://www.meshtint.com/products/modular-flower-chibi-series), [direct-store licence](https://www.meshtint.com/pages/terms-of-use-license) |
| **Reallusion Character Creator** | A current modular character-authoring alternative with FBX, OBJ and USD export, extensive body/clothing content, LOD tooling and Unity/Unreal-oriented export profiles. It can produce game-ready humans but starts from much higher-detail, semi-realistic assets. | Strong humanoid creation, rigging, skin/facial systems and motion ecosystem. A custom Blender reduction, atlas and toon-shading pass would be substantial; non-humanoid fantasy monsters remain a separate pipeline. | Reallusion's **content licence is per content/component**, not a blanket consequence of owning the software. Standard licences allow one output character per CC Component in commercial games; Extended licences cover unlimited character outputs. Building an in-app character creator from CC assets requires an Enterprise licence. Raw components cannot be republished. | **Reject for V1 style and complexity.** Credible for a later semi-realistic product, not for small colorful tabletop tokens. Licensing becomes especially poor for a user-facing modular character builder. [Character Creator game pipeline](https://www.reallusion.com/character-creator/game.html), [Content Licence Policy](https://www.reallusion.com/license/content.html), [Content EULA](https://www.reallusion.com/Content/EULA/EULA.htm) |

## Art-Direction Assessment

None of the requested catalogues is a perfect Japanese-anime match. KayKit is
the best starting silhouette language; its compact proportions, bright atlas
palette, simplified faces and large class-defining equipment are legible from
above. Meshtint Cute/Toon is the strongest paid direction for overt JRPG/chibi
characters and creature progression. Synty POLYGON MINI is visually coherent
and roster-rich but signals western low-poly miniature. Quaternius is the best
open technical foundation, not the final visual identity. Kenney is more useful
for surrounding world assets. Reallusion is outside the chosen direction.

The production art bible should require:

- an unmistakable silhouette at the normal gameplay zoom, with weapons, hair,
  hats and shoulders designed to read from above;
- larger head/hands/equipment than realistic anatomy, restrained surface
  detail, saturated faction colors, and high value separation from terrain;
- original names, costumes, symbols and monster designs with no copying of
  non-SRD D&D characters, named monsters, trade dress, or distinctive likenesses;
- a circular token base/selection ring supplied by Taleforge, not baked into
  every model, so visibility and team color remain a UI concern;
- no facial rig for V1 unless a portrait/close-up use case is separately proven.

## Three-Model Vertical Slice

Use one coherent KayKit slice before purchasing or commissioning anything:

1. **Player Character: Knight** from Adventurers, with sword and shield.
2. **NPC: Mage** from Adventurers, with staff or wand and a spell attack.
3. **Monster: Skeleton** from Skeletons, with one-handed weapon.

Map the library clips to exactly `idle`, `move`, `attack`, `hit`, and `death`.
Use in-place movement; the authoritative Token position continues to come from
the grid state, not animation root motion. This slice proves the same-rig happy
path, equipment attachment, a visibly non-human enemy, clip transitions,
top-down readability, and three simultaneously animated roles. A later fourth
spike should test a non-humanoid creature before committing the monster
pipeline; it need not block this first character slice.

### Proposed Runtime Budget

These are Taleforge acceptance targets, not claims about every source pack:

| Budget | Hero/NPC target | Common monster target |
| --- | ---: | ---: |
| Render triangles per LOD0 model | <= 12,000 | <= 8,000 |
| Skinned meshes | 1 preferred, 2 maximum | 1 preferred |
| Materials / draw calls | 1 preferred, 2 maximum | 1 preferred, 2 maximum |
| Deformation bones | <= 60 | <= 50 |
| Bone influences per vertex | <= 4 | <= 4 |
| Runtime texture set | one 512x512 atlas; 1024 only for a signature model that visibly benefits | one 512x512 atlas |
| Required clips | five, 30 fps sampled, no unused tracks | five, 30 fps sampled, no unused tracks |
| Compressed GLB target | <= 1.5 MB | <= 1.0 MB |

The three-model slice should total no more than 4 MB compressed on first load.
The Battle Map may support 200 interactive Tokens, but 200 unique skinned
characters should not animate at full frequency simultaneously. Profile a
near-camera budget of 32-40 active skeletal mixers; pause/throttle distant idle
animations and use lower-detail/static presentation when zoomed out. This is a
proposed performance policy to validate on the physical-tablet release gate,
not a measured guarantee.

## Production Asset Pipeline

1. **Acquire and quarantine sources.** Store original archives outside the
   public app bundle. Record vendor, pack, version, purchase account, invoice,
   download date, marketplace, exact licence, and a SHA-256 for every archive.
2. **Normalize in Blender.** Import FBX/glTF, preserve a high-quality editable
   `.blend`, use meters and Y-up glTF output, place the origin at ground center,
   apply transforms, clean weights, remove hidden geometry, and standardize
   attachment bones. Blender's glTF exporter supports meshes, skinning and
   multiple named animation actions. [Blender glTF manual](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
3. **Standardize five clips.** Rename clips to the Taleforge contract, remove
   root translation from `move`, trim ranges, ensure loops are seamless, and
   test attack timing/weapon attachment. Keep source rigs; retarget offline only
   when necessary.
4. **Collapse runtime cost.** Join compatible skinned meshes, atlas colors,
   remove unused materials/bones/animations, cap four weights per vertex, and
   make LODs only where measured. Do not merge modular combinations at runtime
   for V1; export approved character recipes as immutable GLBs.
5. **Export and optimize GLB.** Export one self-contained GLB per approved
   character recipe, then deduplicate/prune and apply Meshopt geometry and
   KTX2/Basis texture compression where device testing supports the decode
   tradeoff. Three.js `GLTFLoader` supports Meshopt, Draco and KTX2/Basis
   extensions. [Three.js `GLTFLoader`](https://threejs.org/docs/pages/GLTFLoader.html)
6. **Validate and audit.** Run the Khronos glTF Validator/Auditor, enforce the
   table above in CI, render turntable and top-down snapshots, and reject files
   with missing clips, unsupported extensions, unexpected materials, NaNs or
   bounding-box/scale drift. Khronos lists the validator, auditor and compressor
   as official ecosystem tools. [Khronos glTF resources](https://www.khronos.org/gltf/)
7. **Test in the actual Battle Map.** Measure initial download, decode, GPU
   memory, mixer CPU time, draw calls, shadow cost, readability and selection
   hit area at desktop and tablet quality tiers. Validate context restore and
   clone/disposal behavior; `GLTFLoader` notes that image bitmaps require
   explicit disposal handling.

Prefer Meshopt over selecting both Meshopt and Draco before measurements: one
geometry codec and decoder path is easier to operate. KTX2 is more important
than geometry compression when texture payload dominates. These are pipeline
recommendations to verify on the representative three models rather than fixed
vendor requirements.

## Licence Verification Checklist

Complete this for every pack, animation library, marketplace purchase and
commission before an asset enters the production bundle:

- Identify the actual licensor and purchase channel; never apply a vendor's
  direct-store licence to the same asset bought under Unity, Fab, Humble or
  another marketplace licence.
- Save the individual asset page, exact EULA/version, included licence file,
  invoice/order ID, download date and archive hash. Re-check terms before release.
- Confirm commercial video-game/web-app use, modification, derivative output,
  marketing/trailer use, territory, term, royalties and seat/entity limits.
- Confirm whether contractors may receive raw files, whether they need seats,
  and whether they must delete copies when work ends.
- For a browser product, obtain explicit permission where the licence bars raw
  redistribution: runtime GLBs are downloadable by clients even when URLs are
  authenticated, obfuscated or CDN-signed. Technical access control does not
  create a missing licence right.
- Confirm that optimization, retargeting, texture atlasing and FBX-to-GLB
  conversion are permitted modifications and that transformed models may be
  distributed only as part of Taleforge.
- Keep Mixamo/source animation files private and ship only the approved baked
  character output. Do not expose a reusable asset or animation library.
- Verify every texture, font, logo, weapon, animation and third-party component
  inside a pack; a marketplace listing does not cure upstream rights problems.
- Avoid trademarked names, logos, distinctive characters and non-SRD D&D
  creature likenesses even when a generic fantasy mesh is licensed.
- For commissions, contract for originality, warranties, indemnity appropriate
  to budget, source files, rig/animation deliverables, modification rights,
  web/runtime delivery, marketing, sequels/DLC, contractor access and portfolio
  terms. Clarify whether copyright is assigned or exclusively licensed.
- Maintain an in-repo machine-readable asset manifest mapping runtime file to
  source archive, author, licence, proof and modification history; do not place
  paid raw archives in a public repository.

This research is an engineering and sourcing assessment, not legal advice.
Have counsel review paid-pack browser delivery and the final commission
agreement before commercial release.

## Decision Gate

Do not choose the permanent production catalogue from storefront screenshots.
The next asset decision should happen only after the KayKit three-model slice
has passed:

- readable silhouettes and class/role recognition at normal and overview zoom;
- all five clips and equipment attachments working in the R3F scene;
- the proposed model/file/draw-call budgets;
- Chrome/Safari desktop plus physical-tablet profiling; and
- a licence record complete enough to reproduce the source and terms.

Then buy only one Meshtint and one Synty sample/pack under the intended purchase
channel, secure browser-distribution confirmation, and compare them in the same
scene. If neither achieves the intended anime/JRPG identity without extensive
rework, proceed directly to the signature-character commission rather than
accumulating incompatible packs.
