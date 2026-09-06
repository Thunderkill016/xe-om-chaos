# Playtest build QA — 6 September 2026

Status: playable local build; not a public release or a validated viral product. Browser automation can establish mechanics and stability. It cannot certify fun, cultural recognition or real-phone performance.

## Current iteration — saigon-v3

The first request now boards before Hẻm 26 and ends at its exit. This corrects a measured failure: the previous request made the authored hẻm a detour. The revised café sign, cart and waiting passenger match the pickup. Horizontal city surfaces no longer stretch the shared plaster texture into road-sized wood grain. Existing mission guidance now participates in the final tests: departure, braking, boarding progress, passenger preference and overdue delivery.

`npm run quality` passes typecheck, 27 tests and formatting. The added route tests drive from default spawn, compare matched traffic, complete both street approaches and the hẻm, and reproduce a full first-trip input tape. A rendering test preserves positions/colours while keeping plaster streaks off horizontal faces. `npm run evaluate:routes` completes all 30 combinations of three routes, five seeds and two paces; details and interpretive limits are in `GAME_DESIGN.md` and `output/route-evaluation-v3.json`.

Current browser evidence is under `output/playwright/iteration3/`:

| Execution                    | Functional result                                                                                                               | Performance and scope                                                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome, desktop X11/OpenGL   | Keyboard trip, PNG/JSON/share, touch/multitouch/cancel, responsive settings and WebGL loss/recovery pass; no console errors     | AMD Vega 8 observed; 57.9 FPS, 22.3ms p95 in the short route sample. Final packaged visuals.                                                                                                                                                        |
| Firefox, headless            | Full 180-second run: 3 deliveries, 6 near misses, 1 thread, FLOW ×5, all six warnings; 31 assertions, no console errors         | 54.7 FPS / 33.3ms p95 over the remaining 161.5-second segment; 59.3 FPS in the short route sample. Desktop page loaded before the final horizontal-texture-only change; later capture/other engines cover that change.                              |
| WebKit, Linux headless       | 28 assertions pass, including first delivery, downloads, sharing fallback and mobile layout; no console errors                  | 3.9 FPS / 325ms p95 in the route sample. Functionality passes; performance fails. This is not an iPhone/Safari-device result.                                                                                                                       |
| Chrome, headless SwiftShader | First-delivery assertion failed after the driver wall-time budget; original report retained as `chromium-software-failure.json` | GL capability probe confirmed CPU SwiftShader. Low mode still measured only 1.8 FPS at the stationary opening; disabling shadows alone did not establish a fix. A separate X11 probe confirmed actual AMD hardware before the successful run above. |

The Firefox run's 10,800 input masks were replayed in Node: integer scoring, fare, deliveries, crashes, near misses, threads, alley counts and all recorded events matched; distance matched within 0.000001m. This supports reproducibility across these two runtimes, not a universal floating-point guarantee.

An early soak failure came from the test navigator's old avenue-only graph: it could not connect a rider finishing inside the new hẻm. Adding the authored lane nodes to that test graph resolved the failure without moving the rider or skipping simulation time. The failed report is retained as `firefox-navigation-failure.json`. A separate coarse diagnostic-driver corner failure is documented in the design report rather than treated as evidence of player difficulty.

The final visual review also moved the alley sign onto its wall and cleared tree canopies beside the entrance; both had obscured the bike in a turning-camera capture. `saigon-v3-opening.webm`, `opening-cafe.png`, `hem26-playing.png` and `arrival-playing.png` show the resulting first trip driven through actual browser keys. `captured-opening.json` carries the input record and package hashes. The browser matrix above predates this final decoration-only placement; the new capture verifies its moving-camera result without claiming a new full-run FPS benchmark.

`output/build-manifest.json` hashes the final packaged files. Older v1/v2 reports and their internal product ratings below are historical. Human enjoyment, local cultural recognition, voluntary replay and physical-device performance remain unverified. Software-renderer performance remains an explicit open issue; the successful GPU run does not erase it.

## Owner feedback and iteration 2

The owner explicitly rejected the first build as a generic demo without compelling viral play or Vietnamese visual identity. The optimistic internal ratings below describe the earlier review and are **withdrawn as current product assessments**. Passing technical assertions did not close that feedback.

`saigon-v2` now has an authored dogleg hẻm, rebuilt scooter/rider silhouettes, shared blue galleries and shutters, actual sidewalk clearance for diners and carts, a waiting passenger, steam, cached building shadows, and a two-sided traffic manoeuvre that rewards safe skill with boost. Initial shadows and unbatched rider geometry cost about 69 draw calls / 72k triangles in an inspected scene; batching the vehicle and caching static shadow maps reduced a later route scene to 23 calls / 40.8k triangles at 59.3 FPS in Firefox. These are different scene samples on the Linux host, not a controlled cross-device benchmark.

Iteration-2 evidence lives in `output/playwright/iteration2/`. A keyboard-driven capture through Hẻm 26 completed the first delivery in 35.9 simulation seconds, recorded discovery and two alley traversals, and had no browser errors or characters inside building footprints. `saigon-hem26-gameplay.webm` records that actual route; it is a QA recording, not an in-game video-export feature. Recording overhead reduced the observed end-frame FPS to about 40; do not conflate it with the non-recording sample.

The iteration-2 unit suite had 20 tests. Added coverage proved the new lane's continuous collision path, its 48m/72m distance comparison, opposite-side safe-pass scoring, and preservation of vertex colours when batching an already-batched scooter. Iteration-2 browser runs are in that folder's JSON files; older `output/playwright/*-qa.json` files are v1 evidence.

## Acceptance coverage

| Requirement                               | Evidence                                                                             | Result                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| Start without account                     | Browser start from menu                                                              | Pass                                       |
| Throttle, braking, steering, visible lean | Simulation tests + actual browser keys                                               | Pass; human control feel open              |
| Spring camera, speed FOV, reduced motion  | Implemented and screenshots inspected                                                | Functional; comfort needs players          |
| Traffic, pickup, dropoff and real fare    | Input-only route through live traffic and rain                                       | Pass                                       |
| FLOW / near miss / hẻm                    | Distinct encounter, cooldown, safe-exit, traversal and student-fare regression tests | Pass                                       |
| Crash and quick recovery                  | Collision, immunity and 1.2-second recovery tests                                    | Pass                                       |
| Horn                                      | Quick keyboard tap and deterministic NPC response tests                              | Pass                                       |
| Six chaos events                          | Rain grip, rush collision count, pothole impulse, barrier, moving bus, flood tests   | Pass                                       |
| Daily seed                                | UTC validation, same input tape reproduces state / events / traffic / record         | Pass within this simulation version        |
| Keyboard and touch                        | Browser input; Chromium native multi-touch, cancel release                           | Pass in emulation; physical device open    |
| Mobile layout                             | Portrait, landscape, 44px targets, handedness, overflow                              | Pass in emulation                          |
| Pause, settings, restart                  | Browser workflow, state reset, effect-clock reset                                    | Pass on final browser run only when logged |
| Low quality                               | Browser changes settings; collision traffic unchanged                                | Pass                                       |
| Share result                              | Downloaded PNG signature/dimensions and complete JSON parsed; link fallback          | Pass on final browser run only when logged |
| No blocking browser errors                | Console and pageerror capture                                                        | See exact run reports                      |
| Acceptable mid-range Android FPS          | Requires an actual representative phone                                              | Open                                       |

## Evidence locations and method

- `tests/run.test.js`: 27 current tests. Event fixtures place the rider or clock explicitly; the route tests use only controls with traffic and chaos active.
- `scripts/smoke.mjs`: actual browser keyboard driving for the first delivery, screenshots, UI workflows, downloads, touch and responsive checks. Default end-screen coverage advances remaining simulation ticks as an integration fixture; this is not a real-time play session.
- `XEOM_SOAK=1`: sustained keyboard driving through the remaining 180-second run without moving the player or advancing the clock artificially. This remains an automated driver, not human evidence.
- `output/playwright/*-qa.json`: browser version, timestamp, host, assertions, console errors and measured frame data. `*-desktop-drive.png`, `*-mobile-drive.png`, `*-mobile-landscape.png`, `*-result-card.png` and `*-run.json` are inspectable outputs.

Browser acceptance and final measured values are recorded after the packaged run below. Keep failed assertions as failures until a new recorded execution passes.

## Bugs found and changes made

1. Hundreds of separate meshes caused approximately 783 draw calls in the early greybox. Static geometry was batched by material, then split spatially so culling still works.
2. Hidden zero-scale traffic instances still sent vertices to the GPU. Pack visible instances, set the actual count, and use a distant motorcycle silhouette. The measured scene dropped from roughly 57k NPC triangles to roughly 14–17k total visible triangles, depending on camera and traffic.
3. Pixel-ratio changes after rendering cleared the capture buffer. Resize happens before rendering now. FPS uses actual frame elapsed time, not the simulation's clamped delta.
4. A very short horn keypress could disappear between fixed ticks. Queue the pulse until a simulation tick consumes it.
5. Immediate spawn collisions interrupted learning. Seeded starting clearance and brief immunity now create a readable launch.
6. A student's alley dropoff settled fare before alley credit. Award a completed alley at the dropoff before settlement, once per traversal.
7. Restart retained an old particle-spawn clock. Reset visual cooldowns when simulation ticks restart.
8. Losing WebGL could consume mission time while the picture was unavailable. Pause on loss and resume after restoration through the pause UI.
9. Mobile first-run guidance contained keyboard letters. Coarse-pointer guidance now explains the touch buttons. Mirrored landscape hints were moved out of the controls.
10. WebKit network loads failed even for a plain CSS page due to VS Code Snap's GIO/GTK modules loading incompatible core20 `libpthread`. Clear only Snap-specific `GIO_MODULE_DIR` / `GTK_PATH` in the browser child environment. The standalone baseline and then the game passed; no host configuration changed.
11. Browser assertions could run before the queued dialog `close` event applied settings. Tests now wait for the observable applied state. This fixes the test synchronization, not an invented gameplay failure.

## Virality review

These are provisional internal design judgments, not measured user ratings. The brief's 8/10 bar is **not achieved** just because code or automation passes. Below-bar items remain release work; adding unrelated systems would not close them.

| Category                 | Internal score / 10 | Evidence, improvement and remaining gate                                                                                                                                                                   |
| ------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First 10-second hook     | 7                   | Immediate start, camera, nearby pickup, corrected touch hint. Need cold-start players to reach the first traffic interaction without explanation.                                                          |
| Game feel                | 7                   | Fixed-step input, short-tap fix, grip, lean, strong braking, quick recovery. Need human route control and actual-phone latency assessment.                                                                 |
| Fun per minute           | 6                   | Route choice, passenger preferences and interacting hazards work. An input bot cannot measure delight or boredom.                                                                                          |
| Failure comedy           | 7                   | Bike wobble, passenger bounce, impact, short recovery. Need unsolicited laughter or replay interest; no physical ragdoll claim.                                                                            |
| Clip potential           | 6                   | Bounded event/pose data, near-miss and deadline moments, result PNG. No in-game video export or replay viewer; real player moments needed.                                                                 |
| Spectator readability    | 8                   | Target ring, large FLOW, timer/fare, response text, hazard marks on minimap; reviewed in screenshots. Test a muted 10-second gameplay clip with unfamiliar viewers.                                        |
| One-more-run effect      | 7                   | Fixed three-minute run, local daily best, one-tap replay, reset fixes. Voluntary retry rate is unmeasured.                                                                                                 |
| Friend challenge value   | 7                   | Same versioned seed, original result card, visible fallback link. Needs public hosting and paired-player comparison; localhost links are local only.                                                       |
| Saigon identity          | 7                   | Narrow shophouses, wires, stools, food carts, Vietnamese signs, fare passengers and hẻm shortcuts. Local-player recognition remains open; street life and district differentiation need stronger evidence. |
| Global understandability | 8                   | English UI, Vietnamese phrases with context, coloured targets and universal controls. Needs a non-Vietnamese first-time playtest.                                                                          |

## Cultural review

The map is a fictional compressed district, not a geographic reconstruction. Correctly accented fictional signs, xe ôm trips, alley rewards, curbside food businesses, balconies, market and canal provide a specific starting point. Passengers are ordinary people with preferences; humour comes from player decisions. No real commercial branding, costume shorthand, combat or pedestrian injury is used.

The difficult question — could this simply be renamed Bangkok or Manila? — is not resolved by signage alone. Hẻm must be recognizable, useful and memorable to local players. The physical shortcuts and student reward move in that direction, but the uniformly gridded layout, simple traffic paths and limited crowd life remain weaknesses. A Vietnamese recognition test without the title is required before calling cultural authenticity passed.

## Release gates still open

- Human playtest: five unfamiliar players; time to first movement/pickup, missed cues, route choices, voluntary retry, reported memorable moment. Include Vietnamese and non-Vietnamese players. The sample is a formative check, not proof of virality.
- Mid-range Android: actual Chrome touch/rotation/audio, sustained 180-second ordinary and rainy gameplay, FPS/frame times and thermal behaviour. Target 50–60 FPS, not yet demonstrated.
- Physical Safari/iOS and Edge: native sharing, download behaviour, interruptions and touch. Linux WebKit does not establish Safari-device acceptance.
- Public friend challenge: host the reviewed static build, open a shared link on a second device, confirm the same version/seed and meaningful replay interest. No hosting or shared-state mutation was performed.
- Advanced traffic gap seeking/avoidance, deeper environmental life and progression are outside this playtest build. Ghost/video playback, leaderboard, multiplayer and cosmetics are deferred explicitly.
