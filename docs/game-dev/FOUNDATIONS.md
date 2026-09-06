# Xe Ôm Chaos — Foundations

## Purpose
Build a browser-native arcade motorbike game that is fun to control, readable under pressure, replayable, and recognisably Saigon because of how the world and traffic behave—not only because Vietnamese text is painted on top.

## Design model
Use this chain for every gameplay change:

`MECHANIC → DYNAMIC → PLAYER BEHAVIOR → EXPERIENCE`

A mechanic that does not create a useful dynamic is not justified by implementation effort alone.

## Current player fantasy
Be a skilled xe ôm rider threading through Saigon traffic, making route choices under time pressure, taking calculated risks, and recovering from readable chaos.

## Core verbs
Accelerate · brake · steer · read traffic · overtake · thread gaps · choose route · stop accurately · recover.

## Core loop
Read road/traffic → commit to a line → react/brake/steer → gain or lose time/style → pick up/drop off → repeat under changing road conditions.

## Intended experience
Speed, tension, mastery, local character, near-miss satisfaction, and funny but understandable failures.

## Current weaknesses
- Traffic has recently felt synthetic and sometimes disorderly rather than like coherent flow.
- Collision truth has not always matched visible geometry.
- The driving toy still needs stronger empirical validation before more systems are added.
- HUD/world guidance balance has not been audited deeply enough.

## Development rule
`PLAY → OBSERVE → IDENTIFY PROBLEM → FORM HYPOTHESIS → PROTOTYPE CHANGE → PLAYTEST → COMPARE → KEEP / CHANGE / REMOVE → REPEAT`

No gameplay change survives only because it compiles or has tests. Tests protect rules and regressions; player behaviour validates experience.

## Research tiers
### CORE
Game design; development/playtest process; UX/perception; vehicle feel; camera; level design/guidance; art direction; Saigon/culture/world building; environmental storytelling; audio; animation; VFX; UI/graphic language; writing/localization; accessibility; game programming; web/Three.js engineering.

### REFERENCE
Only open when a concrete build problem requires it: traffic AI, difficulty tuning, camera, UI, art identity, audio, guidance, culture, performance, etc.

### LATER
Do not spend project attention on realtime multiplayer, MMO scaling, large backend/live service systems, monetization, advanced progression, huge procedural worlds, anti-cheat, esports, UGC, VR, ray tracing, AAA cinematics, large narrative systems, generative NPCs, or international marketing until the core game warrants them.

## Current decision rule
Dream big, validate small. Fix the highest-impact weakness in the current playable build before expanding content or architecture.
