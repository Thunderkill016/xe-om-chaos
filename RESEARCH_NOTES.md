# Research log — 6 September 2026

## Revision after direct playtest feedback

The owner rejected the current build as a generic demo: neither its visuals nor its play situations establish Vietnamese identity or viral appeal. This is direct negative product evidence and overrides the earlier optimistic internal scores. The next iteration is an authored streetscape and a stronger traffic manoeuvre, not more menu features.

New references inspected:

- [Hào Sĩ Phường photo in Thanh Niên](https://thanhnien.vn/ten-phuong-xa-moi-sap-nhap-o-tphcm-phuong-cho-lon-in-dam-van-hoa-nguoi-hoa-185250526175021974.htm): the published courtyard photograph was downloaded and visually inspected. Common blue-railed galleries, louvered shutters, staggered awnings, bridge connections and plants shape the usable passage. Use spatial relationships, not a reproduction of homes or occupants.
- [Mackerel photography](https://mackerel-magazine.squarespace.com/hem/tag/Photography): a second courtyard photograph was visually inspected. Parked scooters and household objects sit along edges; the street width varies. Do not ship these copyrighted photos.
- [Saigoneer: railway hẻm life](https://www.saigoneer.com/society/20226-the-quotidian-h%C3%AAm-life-along-the-railway-track-in-district-3): search-index article text describes the shift from busy road to slower neighbourhood life. Full page access returned bot verification, so no claim of inspecting its complete photo series.
- [Vietnam Tourism: street food](https://vietnam.travel/things-to-do/ho-chi-minh-city-cuisine-street-eats-fine-dining): small food carts, low seats and shared sidewalk space guide the pickup environment.
- [Ali MC's Saigon photo essay](https://www.35mmc.com/01/05/2024/sigh-gone-shooting-in-ho-chi-minh-city/): article and captions inspected; image fetch failed. Do not claim the images were inspected.

Image search also returned unrelated Hanoi photographs. Those were rejected as Saigon references.

Implementation hypothesis: a visible food-cart pickup beside a blue-gallery dogleg hẻm should establish place and route choice within the opening minute. The new dogleg has 48 world metres between endpoints versus 72 using the existing street route. Compare actual collision-aware routes, then inspect a moving-camera sequence. A safe pass between vehicles on opposite sides should trigger a distinct "LÁCH KÉP" reward, restore some boost and produce passenger feedback.

Art changes must be visible in gameplay: richer motorcycle silhouette, shaded facades, outdoor galleries, irregular shop frontage, shutters, low stools with diners, steam and a waiting passenger. A generated concept frame was used only to explore composition; its near-photoreal detail is not a claim about the browser build or an acceptable mobile budget.

This is a source-informed design comparison, not a controlled playtest of competing games. No competitor FPS, retention, or virality statistics were measured. Live pages and image references were inspected before implementation.

## References and decisions

| Reference                                                                                                                                                        | Observation / useful pattern                                                                                                                | Decision for Xe Ôm                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| [Slow Roads](https://slowroads.io/)                                                                                                                              | Creator describes procedural browser driving and a long engine rewrite. Immediate, low-friction driving is the core proposition.            | Keep immediate driving, cheap custom handling, no login. Reject endless terrain: learnable urban routes matter here. |
| [Drive Mad — official distributor](https://poki.com/en/g/drive-mad)                                                                                              | Speed balancing creates physical comedy; browser and mobile controls are deliberately simple.                                               | Brake is an expressive action, recovery is short. Reject instant death and frustrating realistic balance.            |
| [Crossy Road — developer](https://www.crossyroad.com/)                                                                                                           | Readable traffic patterns and one clear traversal verb underpin the game.                                                                   | Traffic has paths and gaps; no homing enemies. Borrow readability, not assets or visual identity.                    |
| [Wordle](https://www.nytimes.com/games/wordle/index.html)                                                                                                        | Direct page fetch was unavailable. Shared daily problem and compact result are design references, not freshly verified engagement evidence. | UTC daily seed and a versioned challenge link; local results explicitly unverified. No backend at this stage.        |
| [Three.js game manual](https://threejs.org/manual/en/game.html)                                                                                                  | Rendering is not a game simulation; components and lifecycle require explicit ownership.                                                    | Pure fixed-step simulation separated from rendering, browser input and audio.                                        |
| [Three.js optimization](https://threejs.org/manual/en/optimize-lots-of-objects.html)                                                                             | Many separate meshes create draw overhead.                                                                                                  | Batch static geometry by material; reuse bike geometry; instance repeating structures.                               |
| [Three.js responsive rendering](https://threejs.org/manual/en/responsive.html)                                                                                   | Drawing-buffer size is a performance choice, separate from CSS dimensions.                                                                  | Cap pixel ratio; reduce it after measured slow frames; preserve aspect ratio.                                        |
| [Three.js repository](https://github.com/mrdoob/three.js/)                                                                                                       | Established MIT renderer with mobile/browser examples.                                                                                      | Pin Three.js 0.180.0 locally; no runtime CDN dependency.                                                             |
| [Starter Kit Racing](https://github.com/mrdoob/Starter-Kit-Racing) / [entry HTML](https://raw.githubusercontent.com/mrdoob/Starter-Kit-Racing/master/index.html) | Inspectable static import-map architecture; project uses a physics library and CC0 assets.                                                  | Reuse static module pattern. Do not copy game source or add physics dependencies before a measured need.             |

## Saigon reference study

- [Vietnam Tourism: HCMC](https://vietnam.travel/places-to-go/southern-vietnam/ho-chi-minh-city/): contemporary street-level motorcycles, reused apartment buildings, sidewalk eating. Translate into narrow frontage, café balconies, curb occupancy and pickup positions.
- [Vietnam Tourism: Chợ Lớn](https://beta-v2.vietnam.travel/things-to-do/best-ways-explore-cho-lon): Hào Sỹ Phường townhouses and lived-in alleys. Translate into adjoining homes and tight through routes, warm plaster, restrained red/gold commercial façades.
- [Vietnam Tourism: street food](https://www.vietnam.travel/things-to-do/ho-chi-minh-city-cuisine-street-eats-fine-dining): carts, stools and small alleys are working urban spaces. These determine street width and sightlines.
- Visual search references: [Nguyễn Thượng Hiền street photos](https://thanhnien.vn/kham-pha-pho-am-thuc-nguyen-thuong-hien-co-mon-gi-ngon-xe-co-di-lai-sao-1851533782.htm), [market frontage photos](https://silverlandhotels.com/markets-in-ho-chi-minh-city-district-1/), [Sài Gòn alley photos](https://1phutsaigon.vn/kham-pha-nhung-con-hem-bi-mat-cua-sai-gon/). Observed compressed shop frontage, layered signs, tarps, stools, scooters sharing limited space. Photos are references only; none are copied into the game.

The map is a fictional memory map, not a navigational map or a claim about current district boundaries. No real commercial branding. Vietnamese labels are authored correctly with diacritics. The humour targets the player's risky choices, never an ethnic group or vulnerable pedestrian.

## Design hypotheses to test

1. Tight optional hẻm and wide busy streets should create meaningful route decisions.
2. An immediate near-miss cue, visible multiplier and quick recovery should invite a retry.
3. A passenger who rewards smooth travel should make the same map feel different.
4. A fixed 180-second daily challenge and legible card should make friend comparisons easy.

These remain hypotheses until observed with independent players. No self-assigned score can prove fun or viral potential.

## Rejected scope

Large open world, external art packs, physical ragdolls, realistic motorcycle simulation, postprocessing stack, multiplayer, authentication, backend, paid economy, real brands. Web Audio synthesis is original; there is no licensed music. Logo choice: **XE ÔM CHAOS** with **SAIGON** as a place stamp; “Saigon Rush” loses the distinctive xe ôm identity.

## Zubek framework applied to the opening trip — 6 September 2026

Primary material read: [MIT Press public contents and introduction](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/12040/Zubek_TOC_intro.pdf?dl=1), especially introduction pages xv–xvii; [Robert Zubek's 2024 player-experience lecture](https://robert.zubek.net/docs/games-studio-2024/2-game-design-player-experience.pdf), especially slides 26–30 and 58–59. Access was to these public materials, not the full book. They distinguish what designers implement from the behaviour and experience that emerge when people play; the introduction also separates gameplay design from visual design and commercial product strategy.

Our design inference: “hẻm exists” is a mechanics claim, “players use it to improve this trip” is a gameplay hypothesis, and “players feel local mastery” needs people. The v2 trip failed the middle test despite a geometrically shorter lane segment. `scripts/evaluate-routes.mjs` now measures the complete first request across matched conditions; `GAME_DESIGN.md` records the change and a small human-playtest protocol. No claim that a book or a scripted benchmark establishes virality.

Evidence: `output/route-baseline-v2.json` retains the original coarse-driver probe. `output/route-baseline-v2-corrected-driver.json` reconstructs the previous opening configuration with the corrected driver; only the café coordinate, first destination, hẻm stop coordinate and version are restored. `output/route-evaluation-v3.json` is the current input-only comparison. Reports include controller parameters, exact routes and SHA-256 hashes of simulation sources. A bot corner-cutting artefact was identified and corrected before interpreting the final comparison. These are diagnostic measurements, not player-population estimates.
