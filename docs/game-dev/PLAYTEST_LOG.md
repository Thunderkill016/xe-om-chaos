# Playtest Log

Use one entry per meaningful experiment. Keep it short.

## 2026-09-06 — Camera pass 1
SOURCE
Current build screenshots + code.

PRINCIPLE
Camera must balance speed sensation with forward traffic readability.

HYPOTHESIS
Lower/closer camera with less speed pullback will strengthen bike presence and speed feel without removing forward information.

EXPERIMENT
Reduced camera distance/height growth with speed and retained/increased look-ahead.

RESULT
Screenshots showed a larger player bike and acceptable forward view. Subjective handling/camera feel was not directly validated by an interactive browser session.

DECISION
Keep provisionally; do not merge solely on screenshot evidence.

---

## 2026-09-06 — Traffic/collision stabilization
SOURCE
User playtest report, screenshots, simulation code, automated route test.

PRINCIPLE
Chaos must be readable/reactable; visible contact and collision truth must agree.

OBSERVED PROBLEM
User reported frequent object-collision problems and traffic that looked disordered, unnatural, and inconsistent. Screenshots showed vehicles forming implausible clusters/intersections.

HYPOTHESIS
Simpler coherent street streams with stable spacing and shaped vehicle collision will play better than denser scripted traffic with overlapping trajectories.

EXPERIMENT
- simplified traffic into stable avenue streams;
- corrected right-hand lane direction;
- reduced baseline traffic density;
- aligned car/bike/delivery collision footprint with vehicle kind;
- made large static building collision share deterministic world data;
- exposed an opening Hẻm 26 route diagnostic in CI.

RESULT
Automated opening Hẻm 26 route: completed, ~11.07 s ride, ~50.58 m, 0 ride crashes, alley discovered, delivery completed. Regression suite still required cleanup around legacy near-miss/collision fixtures during the pass.

DECISION
Continue stabilization before increasing density or adding new gameplay systems.

---

## Next experiment
Highest-impact question: does traffic now read as coherent moving flow at intersections, and does static collision match what the player can visually identify as solid versus traversable?

Do not add content until this is answered.
