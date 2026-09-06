# Audio Direction

## Principle
Audio is an interactive system, not a collection of static files. Important sounds should react to game state and support decisions, feedback, place, and feel.

## Core layers
- ENGINE
- TRAFFIC
- HORNS
- PASS-BY
- TIRE / BRAKE
- COLLISION
- RAIN / WATER
- STREET AMBIENCE
- PASSENGER
- GAMEPLAY SIGNALS
- MUSIC

## State-driven design
Examples of state inputs to consider:
- speed / acceleration / braking;
- boost;
- proximity and relative speed of traffic;
- surface/weather;
- impact severity;
- passenger state;
- danger / near miss / recovery.

An engine loop that never reacts to the bike state will not sell vehicle feel by itself.

## Readability rule
A sound should either reinforce place/atmosphere or communicate useful state. Do not let ambience, horns, music, and scoring stingers mask the cues the player needs to survive traffic.

## Accessibility
Critical information should not exist only in audio. Pair important warnings/feedback with readable visual or haptic-equivalent cues where available.

## Current status
Audio has not yet been audited deeply enough to justify a polish pass. Stabilise traffic/collision/core feel first, then evaluate the audio system against real gameplay states.
