# DnD Browser Tabletop

This context defines the language for a browser-based tabletop game for friends playing DnD-style sessions remotely.

## Language

**Remote-first Virtual Tabletop**:
A shared browser-based play space designed for players who are not physically together.
_Avoid_: Video game, meeting room

**Live Session**:
A scheduled play session where the group is online at the same time and interacts in realtime.
_Avoid_: Async session, play-by-post

**Persistent Campaign**:
A continuing game whose room, characters, maps, notes, and play state can be saved and resumed across live sessions.
_Avoid_: Temporary room, one-shot save

**Campaign**:
The long-running adventure shared by a group, containing the ongoing world, characters, maps, notes, and history.
_Avoid_: Session, room

**Session**:
One scheduled live play gathering within a campaign, with its own resumable state and record of what happened during that gathering.
_Avoid_: Campaign, room

**Session Save**:
A saved state for a specific session, allowing that live gathering to be paused, resumed, or reviewed later.
_Avoid_: Autosave only, campaign save

**Automatic Campaign Commit**:
The rule that meaningful session changes are saved back into the campaign without requiring a manual DM confirmation step.
_Avoid_: Manual commit, end-session approval

**DM**:
The player role that owns the campaign truth, manages hidden information, controls non-player entities, and can override the shared play state.
_Avoid_: Admin, host

**DM View**:
The private tabletop view where the DM can see hidden monsters, unrevealed map details, traps, secret notes, and controls not visible to players.
_Avoid_: Admin panel, spectator view

**Player View**:
The shared tabletop view for non-DM players, limited to information their characters or the DM have revealed.
_Avoid_: Public mode, guest view

**Battle Map**:
A square-grid tactical play space presented top-down in 2.5D, with elevation,
dimensional terrain and tokens, lighting, shadows, and animation while
remaining one map coordinate space rather than a freely navigable 3D world.
_Avoid_: Whiteboard, canvas, full-3D world

**Grid Cell**:
One square on a battle map, representing the unit of tactical positioning and movement.
_Avoid_: Tile, pixel

**Token**:
A movable marker on the battle map representing a player character, monster, NPC, or relevant object.
_Avoid_: Avatar, icon

**Tabletop Assistant**:
A play aid that supports DnD sessions with shared state, dice, maps, tokens, notes, and tracking while leaving final rules judgment to the DM and players.
_Avoid_: Rules engine, automated game master

**Light Automation**:
Automation that speeds up play without enforcing the full DnD ruleset, such as dice rolling, turn order, manual HP/status tracking, and logs.
_Avoid_: Full rules automation, rules enforcement

**Rules Automation**:
System behavior that interprets character, combat, spell, movement, damage, status, and progression rules instead of leaving them entirely to manual table judgment.
_Avoid_: Dice helper, manual tracking

**Advanced Character Sheet**:
A character model that supports detailed stats, progression, class/species/background choices, abilities, spells, inventory, conditions, and derived values.
_Avoid_: Token profile, simple HP card

**Generated Special Ability**:
A searchable ability produced from character option combinations or original content rules, intended to create variety beyond fixed SRD entries.
_Avoid_: Official-only feature, static trait

**SRD-compatible Ruleset**:
A rules foundation based on Creative Commons SRD material, extended with original content rather than non-SRD official D&D content.
_Avoid_: Full official D&D clone, proprietary D&D content

**Playable MVP**:
A first version that supports a real campaign end-to-end with limited content, while proving the full platform shape can expand later.
_Avoid_: Prototype, content-complete v1

**Story Seed**:
User-provided story material used as input for generating a campaign, such as premise, theme, setting, villain, party tone, or desired adventure length.
_Avoid_: Prompt, lore dump

**AI Campaign Generator**:
A feature that turns a story seed into campaign material such as arcs, locations, NPCs, encounters, quests, rewards, and DM-facing notes.
_Avoid_: Random table, manual campaign template

**Campaign Draft**:
AI-generated campaign material that the DM can review and edit before importing into a campaign.
_Avoid_: Imported campaign, campaign truth

**Campaign Import**:
The DM-approved action that converts a campaign draft into saved campaign content.
_Avoid_: Auto-import, generation

**Character Build Combination**:
The selected species, class, background, level, and optional story/personality inputs that determine available traits, abilities, recommendations, and derived values.
_Avoid_: Random profile, freeform character

**Tactical Rules Automation**:
Rules automation that accounts for grid movement, range, targeting, area effects, line of sight, conditions, concentration, resources, resistance, vulnerability, and combat timing.
_Avoid_: Flow-only combat, manual combat tracker

**DM-configurable Enforcement**:
The rule behavior where each campaign can decide which rules are hard-blocked, warned with override, or treated as advisory.
_Avoid_: Soft-only enforcement, one-size-fits-all rules

**Content Editor**:
A DM-facing tool for creating and editing campaign content such as monsters, items, spells, abilities, encounters, and reusable rules objects.
_Avoid_: Admin database, developer-only content

**Homebrew Content**:
Campaign-specific or shared original content created outside the base SRD-compatible ruleset.
_Avoid_: Official content, imported D&D book content

**Rules Content Editor**:
A content editor scope that lets DMs create rules-bearing content such as spells, abilities, conditions, traits, resources, damage types, monsters, items, and encounters.
_Avoid_: Notes-only editor, full system builder

**Procedural Ability Template**:
A structured ability pattern with tags, costs, scaling, targeting, action timing, and balance constraints used to generate special abilities.
_Avoid_: Freeform AI text, unbounded random ability

**AI-assisted Ability Generation**:
A generation flow where AI suggests flavor, names, descriptions, or variants for abilities built around procedural templates, with DM approval before use.
_Avoid_: Automatic ability publishing, AI-only mechanics

**Account-bound Player**:
A user who must sign in before joining campaigns, owning characters, editing content, or participating in saved sessions.
_Avoid_: Guest player, anonymous participant

**Discord Login**:
The required authentication method where users sign in with Discord before accessing campaigns and sessions.
_Avoid_: Guest access, email-password login

**External Voice**:
The decision to use Discord for live voice communication instead of building voice chat into the web app.
_Avoid_: In-app voice, WebRTC voice

**Session Log**:
The in-app record of chat, dice rolls, combat events, rule warnings, overrides, and important state changes during a session.
_Avoid_: Voice transcript, temporary chat

**Table Scale**:
The realtime performance target of one live campaign session with 4-6 signed-in players, while allowing multiple saved campaigns over time.
_Avoid_: Public VTT scale, massive multiplayer
