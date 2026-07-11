# SRD-Compatible Content Strategy Research

Date: 2026-07-11

## Question

What is the SRD-compatible rules/content strategy for V1 (issue #5, part of #1)? Specifically: what SRD 5.2.1 content can be used, what attribution is required, what non-SRD content must be avoided or renamed, and how should original content be stored separately from SRD-derived content.

This note is legal/content-boundary research, not a data-model design document. It gives the engineering team (ticket #4, "Model campaigns sessions and rules data") the facts needed to implement the boundary without further legal research.

## Recommendation

**(a) SRD content V1 should draw from.** Build V1's starting rules content entirely from **SRD 5.2.1** (the current, corrected 2024-ruleset SRD), which covers: core rules and glossary, all six ability scores/checks/saves, the full turn/combat/damage/conditions system, character creation and leveling, 4 backgrounds (Acolyte, Criminal, Sage, Soldier), 9 species (Dragonborn, Dwarf, Elf, Gnome, Goliath, Halfling, Human, Orc, Tiefling), 12 classes each with exactly 1 subclass (Barbarian/Path of the Berserker, Bard/College of Lore, Cleric/Life Domain, Druid/Circle of the Land, Fighter/Champion, Monk/Warrior of the Open Hand, Paladin/Oath of Devotion, Ranger/Hunter, Rogue/Thief, Sorcerer/Draconic Sorcery, Warlock/Fiend Patron, Wizard/Evoker), feats (origin/general/fighting-style/epic boon), equipment, spells, magic items, monsters, and animals. Do not use the free "D&D Beyond Basic Rules" web page as a source — it is explicitly *not* SRD content and is not open-licensed. Do not source content from any 2014-era SRD 5.1 material that SRD 5.2.1 has since revised/superseded, to avoid mixing rules versions.

**(b) Attribution notice text and placement.** Use the exact notice Wizards specifies for SRD 5.2.1 (quoted in full below), verbatim and unmodified, and do not add any other reference to Wizards or its parent/affiliates. Recommended placement: an "About / Legal" or "Licenses" screen reachable from app settings/footer, shown at least once per campaign creation or in a persistent About page — not required on every screen. Optionally add the WotC-sanctioned compatibility phrase ("compatible with fifth edition" or "5E compatible") in marketing/README copy, but nowhere else in Wizards-related wording.

**(c) Data-model separation rule.** Every rules-bearing content record (spell, class, subclass, species, feat, background, item, monster, condition, rule-glossary entry, etc.) should carry a required `source` field, e.g. an enum:

```
source: "srd-5.2.1" | "homebrew"
```

- `srd-5.2.1` records are seeded/read-only reference data ingested directly from the SRD 5.2.1 text, tagged with the SRD section/page they came from for traceability, and must not be renamed away from their SRD names (renaming is only needed for the small set of items WotC itself renamed between 5.1 and 5.2 — see Conversion Guide below — and for the handful of monsters/species/classes the SRD excludes entirely, e.g. Beholder, Aasimar, Artificer, which must not be reproduced under those names at all, not just renamed).
- `homebrew` records are original content (campaign-specific or shared) per the existing `Homebrew Content` glossary term, and must never reuse WotC Product-Identity-style names (setting-specific proper nouns, deity/plane names, or the excluded monster/species/class names) even as flavor text.
- Any record derived by modifying/extending an SRD record (e.g., a reflavored spell) should keep `source: "srd-5.2.1"` plus a `derivedFrom`/`basedOn` pointer if DM-edited, or be forked to `homebrew` if it diverges enough that it's no longer recognizably the SRD entry — this mirrors CC-BY-4.0's own requirement to indicate what was changed in Adapted Material.
- Never store WotC illustrations/art as app assets; the SRD's own art (if any beyond decorative typography) should not be assumed to be needed or safely reusable — commission or generate original art instead.
- The app's own name/branding must not use "Dungeons & Dragons," "D&D," or WotC logos/trademarks; use the "5E compatible" phrasing WotC explicitly permits instead.

## Findings

### What SRD 5.2.1 is

The System Reference Document 5.2.1 ("SRD 5.2.1") is Wizards of the Coast's official free rules-reference document built on the 2024 revision of the D&D ruleset (marketed as "D&D 2024" / "One D&D"). It is distributed as a PDF from D&D Beyond and is the current, corrected version of the SRD line that began with SRD 5.2 (published to accompany the 2024 core rulebooks) — v5.2.1 (published May 1, 2025) fixed an omission of 15 magic items that had been accidentally left out of 5.2, and WotC states future errata will continue to bump the version number (5.2.2, etc.) [SRD download/legal page](https://www.dndbeyond.com/srd), [SRD 5.2.1 PDF](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf).

Its table of contents (read directly from the PDF) is: Playing the Game, Character Creation, Classes (12 classes, 1 subclass each), Character Origins (backgrounds), Character Species, Feats, Equipment, Spells, Rules Glossary, Gameplay Toolbox (travel, curses, environmental effects, fear/stress, poison, traps, combat encounters), Magic Items, Monsters (a full stat-block bestiary), and Animals [SRD 5.2.1 PDF, pp. 2–3](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf).

### License: exact name, and how it differs from SRD 5.1 / OGL 1.0a

SRD 5.2.1's own "Legal Information" page states, verbatim:

> "The System Reference Document 5.2.1 ("SRD 5.2.1") is provided to you free of charge by Wizards of the Coast LLC ("Wizards") under the terms of the Creative Commons Attribution 4.0 International License ("CC-BY-4.0")."

[SRD 5.2.1 PDF, p. 1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)

The precise license is **Creative Commons Attribution 4.0 International**, legal code at <https://creativecommons.org/licenses/by/4.0/legalcode>. It is not a share-alike or non-commercial variant — plain CC BY 4.0.

This differs from the older material as follows:

- **SRD 5.1** (the 2014-ruleset SRD) was originally released only under the **Open Game License 1.0a (OGL 1.0a)**, a game-industry-specific license from 2000 that works via a "Product Identity" carve-out rather than general copyright terms [SRD-OGL v5.1 PDF, p. 1–2](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD-OGL_V5.1.pdf). In January 2023, after backlash to a proposed OGL 1.1/1.2 that would have added royalties and revocation rights, Wizards published a statement committing to leave OGL 1.0a in place *and* additionally release SRD 5.1 under CC-BY-4.0 as a parallel, irrevocable option [Jan 18, 2023 statement](https://www.dndbeyond.com/posts/1428-a-working-conversation-about-the-open-game-license-ogl), [Jan 27, 2023 statement](https://www.dndbeyond.com/posts/1439-ogl-1-0a-creative-commons). The SRD 5.1 CC-BY-4.0 legal page and its attribution text mirror the 5.2.1 language almost exactly [SRD_CC_v5.1 PDF, p. 1](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf).
- **SRD 5.2 / 5.2.1** (the 2024-ruleset SRD) was released **exclusively under CC-BY-4.0** from the start — there is no OGL option for it, and Wizards has stated all future SRD versions will be CC-BY-4.0 only [2024 Core Rulebooks to Expand the SRD](https://www.dndbeyond.com/posts/1717-2024-core-rulebooks-to-expand-the-srd).
- Practically, OGL 1.0a's "Product Identity" mechanism (a license-specific carve-out defined in Section 1(e) and enforced by Section 7 of that license) is what CC-BY-4.0 no longer needs: WotC now simply omits proprietary material from the document rather than licensing it and marking it off-limits. The OGL's Product Identity list for SRD 5.1 is instructive because it names the exact category of things still excluded from SRD 5.2.1 by omission: "Dungeons & Dragons, D&D, Player's Handbook, Dungeon Master, Monster Manual, d20 System, Wizards of the Coast, d20 (when used as a trademark), Forgotten Realms, Faerûn, proper names (including those used in the names of spells or items), places, [set­ting-specific planes such as] Underdark... Sigil, Lady of Pain, Book of Exalted Deeds, Book of Vile Darkness, beholder, gauth, carrion crawler, tanar'ri, baatezu, displacer beast, githyanki, githzerai, mind flayer, illithid, umber hulk, yuan-ti" [SRD-OGL v5.1 PDF, p. 1](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD-OGL_V5.1.pdf). SRD 5.2.1 continues this pattern by omitting the Artificer class, the Aasimar species, and the Beholder (and similar) monsters "for brand protection purposes," and by excluding all setting/lore references (directing publishers who want Forgotten Realms-style lore to the separate DMsGuild program instead) [SRD download/legal page](https://www.dndbeyond.com/srd), [2024 Core Rulebooks to Expand the SRD](https://www.dndbeyond.com/posts/1717-2024-core-rulebooks-to-expand-the-srd).

### What content categories the SRD contains vs. what remains proprietary

**In SRD 5.2.1** (open, CC-BY-4.0): core rules/mechanics, character creation and advancement, the 12 core classes (one subclass each), 9 species, 4 backgrounds, feats, equipment, the full spell list, a rules glossary, gameplay toolbox rules (travel, environment, fear, poison, traps, encounters), magic items, and a large monster/animal stat-block bestiary [SRD 5.2.1 PDF, pp. 2–3](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf).

**Excluded / proprietary** (must be avoided or renamed in this project): the D&D trademark, logo, and trade dress; the Artificer class; the Aasimar species; brand-flagship monsters such as the Beholder; any Forgotten Realms or other campaign-setting lore, named deities, planes, or NPCs; and, per the older OGL Product Identity list (still a useful proxy for "what WotC treats as off-limits" even though 5.2.1 doesn't use OGL machinery), other setting-tied proper nouns and iconic monsters like mind flayer/illithid, githyanki/githzerai, displacer beast, umber hulk, yuan-ti, tanar'ri/baatezu-flavored named devils/demons, etc. [SRD download/legal page](https://www.dndbeyond.com/srd), [SRD-OGL v5.1 PDF, p. 1](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD-OGL_V5.1.pdf). A dedicated conversion guide documents renames and mechanical changes between 5.1 and 5.2.1 in detail [Converting to SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/guide/converting-to-srd-5.2.1.pdf).

Note: this project already treats the excluded material as out of scope by standing decision ("avoid non-SRD proprietary DnD content," GitHub issue #1), so the practical rule is simply: **only build from what SRD 5.2.1 actually contains**, and treat anything else DnD-flavored (Beholders, Mind Flayers, Forgotten Realms places, etc.) as homebrew reinventions under different names if wanted at all.

### Exact attribution requirements

The SRD 5.2.1 "Legal Information" page specifies the required notice verbatim:

> "You are free to use the content in this document in any manner permitted under CC-BY-4.0, provided that you include the following attribution statement in any of your work:
>
> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.
>
> Please do not include any other attribution to Wizards or its parent or affiliates other than that provided above. You may, however, include a statement on your work indicating that it is "compatible with fifth edition" or "5E compatible."
>
> Section 5 of CC-BY-4.0 includes a Disclaimer of Warranties and Limitation of Liability that limits our liability to you."

[SRD 5.2.1 PDF, p. 1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)

Two operative rules beyond the notice text itself: (1) do not add any *other* Wizards-related credit/mention beyond this exact statement, and (2) the only WotC-sanctioned compatibility phrasing is "compatible with fifth edition" / "5E compatible" — not "D&D compatible," not use of the D&D name/logo. The underlying CC-BY-4.0 legal code (Section 3) additionally requires, in general form, retaining a copyright notice, a link to the license, a link to a disclaimer of warranties, and an indication of any modifications made to the material, in any reasonable manner given the medium [CC BY 4.0 legal code, §3](https://creativecommons.org/licenses/by/4.0/legalcode).

### Commercial use, modification, sublicensing, and restrictions

Per the CC-BY-4.0 legal code: the license grants a "worldwide, royalty-free, non-exclusive, irrevocable license" to reproduce and create Adapted Material, and explicitly covers commercial use — there is no non-commercial restriction and no royalty owed to Wizards [CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode), corroborated by Wizards' own Jan 27, 2023 statement that the CC release is a one-way, irrevocable grant they cannot alter or revoke [Jan 27, 2023 statement](https://www.dndbeyond.com/posts/1439-ogl-1-0a-creative-commons). Modification/adaptation is permitted. Re-licensing derivative ("Adapted") material under different terms that would prevent downstream recipients from also getting CC-BY-4.0 rights is not permitted — any redistribution of the SRD text itself (as opposed to a transformed product built using its rules) must stay compatible with CC-BY-4.0's own terms [CC BY 4.0 legal code, §3(a)(1)(B)](https://creativecommons.org/licenses/by/4.0/legalcode).

The license carries a standard no-endorsement clause: nothing in it may be construed as permission to assert or imply the licensee is "connected with, or sponsored, endorsed, or granted official status by" Wizards [CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode) — consistent with the SRD 5.2.1 legal page's instruction not to add attribution beyond the specified notice, and its permission to only use "5E compatible" phrasing rather than implying an official D&D product.

This project's use is non-commercial (a friends' VTT), so the CC-BY-4.0 commercial permissions are more permission than is currently needed, but they remove any future risk if the project were ever monetized while staying within SRD 5.2.1 content.

### A separate, non-commercial channel: the Fan Content Policy

Wizards also runs a separate **Fan Content Policy** governing free fan works that use WotC's broader IP/trademarks (not just SRD content), which explicitly requires marking such work "not endorsed or sponsored by Wizards," forbids incorporating WotC logos/trademarks or non-SRD game mechanics without written permission, and does not cover "verbatim copying and reposting of Wizards' IP (e.g., freely distributing D&D rules content or books)" [Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). This is a distinct, narrower channel than the SRD's CC-BY-4.0 grant and is not needed if the project sticks to SRD 5.2.1 content plus original homebrew, per this project's standing decision — but it reinforces that the project must not reproduce non-SRD official book text (e.g., quoting a Monster Manual stat block outside the SRD) even for free, non-commercial use.

### Guidance on marking/distinguishing SRD-derived content from original content

Neither the CC-BY-4.0 legalcode, the SRD 5.2.1 legal page, nor the D&D Beyond Creator FAQ gives a prescriptive technical format for separating "SRD-derived" from "your own" content beyond the attribution-statement requirement described above; the FAQ explicitly says "anything you create using SRD 5.2.1 or SRD 5.1 is yours," with no additional bookkeeping mandate [Creator FAQ](https://www.dndbeyond.com/creator-faq). The closest thing to a technical requirement is CC-BY-4.0 §3(a)(1)(A)(ii)'s requirement to "indicate if You modified the Material and retain an indication of any previous modifications" when sharing Adapted Material [CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode) — this is the legal hook behind the `source`/`derivedFrom` data-model recommendation above; it is an engineering choice made to satisfy that clause cleanly, not a WotC-mandated schema.

## References

- [SRD v5.2.1 — System Reference Document, D&D Beyond](https://www.dndbeyond.com/srd)
- [SRD 5.2.1 PDF (primary legal/content source, incl. Legal Information page and table of contents)](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)
- [Converting to System Reference Document 5.2.1 (guide)](https://media.dndbeyond.com/compendium-images/srd/guide/converting-to-srd-5.2.1.pdf)
- [SRD 5.1 legal page under CC-BY-4.0 PDF](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD_CC_v5.1.pdf)
- [SRD 5.1 under OGL 1.0a, incl. full Product Identity list and license text](https://media.dndbeyond.com/compendium-images/srd/5.1/SRD-OGL_V5.1.pdf)
- [Creative Commons Attribution 4.0 International — legal code](https://creativecommons.org/licenses/by/4.0/legalcode)
- [D&D Beyond: "A Working Conversation About the Open Game License (OGL)" (Jan 18, 2023)](https://www.dndbeyond.com/posts/1428-a-working-conversation-about-the-open-game-license-ogl)
- [D&D Beyond: "OGL 1.0a / Creative Commons" statement (Jan 27, 2023)](https://www.dndbeyond.com/posts/1439-ogl-1-0a-creative-commons)
- [D&D Beyond: "2024 Core Rulebooks to Expand the SRD"](https://www.dndbeyond.com/posts/1717-2024-core-rulebooks-to-expand-the-srd)
- [D&D Beyond: "You Can Now Publish Your Own Creations Using the New Core Rules"](https://www.dndbeyond.com/posts/1949-you-can-now-publish-your-own-creations-using-the)
- [D&D Beyond Creator FAQ](https://www.dndbeyond.com/creator-faq)
- [Wizards of the Coast Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy)
- [D&D Beyond SRD resource page (redirect target of dnd.wizards.com/resources/systems-reference-document)](https://www.dndbeyond.com/resources/1781-systems-reference-document-srd)
