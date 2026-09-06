# XE ÔM CHAOS · SAIGON

**Hook:** You know a shortcut. Your passenger wishes you didn't.

Fantasy: read the traffic, slip through a hẻm, somehow get your passenger there. A small, learnable city is the skill surface.

## Nền tảng game design — Elements of Game Design · Robert Zubek

**Tài liệu nền tảng:** Robert Zubek, _Elements of Game Design_ (MIT Press, 2020). Dùng cách nhìn liên hệ giữa **cơ chế, cách chơi và trải nghiệm người chơi** để thiết kế và đánh giá game. Phần dưới là diễn giải áp dụng riêng cho Xe Ôm Chaos Saigon, không phải trích nguyên văn hay bộ quy tắc do tác giả đặt ra cho dự án.

### Từ luật chơi đến trải nghiệm

- **Cơ chế (mechanics):** những gì hệ thống thực sự cho phép và tính toán: ga, phanh, lái, boost, còi; va chạm; đón/trả khách; thời gian; thưởng và phạt. Đây là tầng có thể kiểm tra trực tiếp bằng code và test.
- **Cách chơi (gameplay):** cách người chơi sử dụng các cơ chế trong hoàn cảnh cụ thể: đọc khe xe, chọn đại lộ hay hẻm, giảm tốc để trả khách, đổi cách lái theo hành khách. Có cơ chế không đồng nghĩa người chơi sẽ nhận ra hoặc sử dụng nó như dự định.
- **Trải nghiệm (player experience):** cảm giác mong muốn: mình là tài xế rành đường, vừa xử lý được một tình huống căng thẳng, rồi bật cười vì phản ứng của khách. Đây là mục tiêu cần kiểm chứng bằng người chơi, không phải kết quả suy ra từ test PASS.

Thiết kế bắt đầu từ trải nghiệm mong muốn, chọn tình huống và cơ chế hỗ trợ nó; đánh giá đi chiều ngược lại bằng cách quan sát người chơi thực sự làm gì và cảm thấy thế nào.

| Cơ chế đang có / nguồn mã                                                                                                                                            | Quyết định và cách chơi kỳ vọng                                                                           | Trải nghiệm cần kiểm chứng                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Đại lộ rộng có xe; Hẻm 26 là đường gấp khúc dài 48 đơn vị so với 72 theo đường cũ (`src/world/map.js`)                                                               | Chọn đường rộng dễ điều khiển hoặc lối tắt hẹp phải phanh và canh góc; ngắn hơn không mặc nhiên nhanh hơn | “Mình biết đường này!” thay vì chỉ chạy theo mũi tên                  |
| Near miss chỉ ghi điểm sau khi thoát an toàn; LÁCH KÉP cần hai xe khác nhau ở hai phía đối diện trong cửa sổ 0,6 giây, thưởng thêm điểm và boost (`src/game/Run.js`) | Cân nhắc luồn qua khe xe để kiếm thưởng hay giữ khoảng cách để bảo toàn chuyến đi                         | Căng thẳng có chủ đích, tự hào vì kỹ năng, không phải va chạm may rủi |
| Khách văn phòng thưởng thời gian, Cô Tư thưởng chạy êm, sinh viên thưởng hẻm, khách mê tốc độ thưởng near miss (`src/game/Missions.js`)                              | Đổi tốc độ hoặc tuyến đường theo khách thay vì luôn giữ ga tối đa                                         | Chở một người có sở thích, không chỉ vận chuyển một marker            |
| Chaos có lịch theo seed, thông báo trước 3 giây; mưa giảm độ bám, chướng ngại thay đổi đường đi (`src/game/ChaosDirector.js`)                                        | Đọc cảnh báo, nhả ga hoặc đổi tuyến                                                                       | Thành phố bất ngờ nhưng có thể học cách ứng phó                       |
| Va chạm reset FLOW, hồi phục ngắn và miễn va chạm tạm thời (`src/game/Run.js`, `src/game/config.js`)                                                                 | Chấp nhận mất chuỗi thưởng rồi thử lại, không bị khóa trong chuỗi tai nạn                                 | Hài hước và muốn tiếp tục thay vì bất lực                             |

### Mục tiêu, nguồn lực và đánh đổi

Một ca dài **180 giây mô phỏng**; mục tiêu là giao khách và nâng điểm tổng. Hạn chuyến quyết định thưởng thời gian: hết hạn vẫn có thể trả khách, không tự động thất bại. Thời gian ca là nguồn lực hữu hạn; boost hồi phục và có thể tiêu để tăng tốc; FLOW là chuỗi thưởng có nguy cơ mất. Tiền cước và điểm là kết quả, chưa phải tiền để mua nâng cấp.

Vòng thưởng near miss → FLOW → điểm, cùng LÁCH KÉP → hồi boost, có thể khuyến khích tiếp tục mạo hiểm. Va chạm làm mất FLOW và giảm cước chuyến; dừng gần mục tiêu không bị tính như đứng yên vô ích. Cần quan sát xem hệ thống có vô tình khiến việc kiếm điểm luồn lách lấn át việc chở khách, hoặc khiến một tuyến đường luôn tốt hơn mọi tuyến khác. Đây là rủi ro thiết kế cần đo, chưa phải lỗi đã được xác nhận.

### Vòng lặp kiểm chứng thiết kế

1. **Nêu giả thuyết:** ví dụ, người chơi tự nhận ra Hẻm 26 và cân nhắc dùng nó, thay vì chỉ thấy đó là cảnh trang trí.
2. **Làm thay đổi nhỏ:** mỗi lượt thử ưu tiên một yếu tố như độ rõ cửa hẻm hoặc phản hồi khi khám phá; chưa thêm bản đồ lớn hay hệ thống nâng cấp để che vấn đề của chuyến đi.
3. **Kiểm tra cơ chế:** dùng `tests/run.test.js` để kiểm tra đường đi, điều kiện thưởng, hồi phục, giao khách và tái lập cùng seed/input. Mô phỏng giữ bước 60 Hz; thay đổi luật ảnh hưởng kết quả phải quản lý phiên bản, không để chất lượng render thay đổi điểm.
4. **Quan sát người chơi mới:** không chỉ đường; ghi thời điểm bắt đầu lái, lần đón/trả đầu tiên, lựa chọn tuyến, lý do mất FLOW và việc tự nguyện chơi lại. Hỏi sau lượt chơi để tránh hướng dẫn câu trả lời.
5. **Đối chiếu và lặp:** nếu không thấy hẻm, xem lại tín hiệu không gian; nếu thấy nhưng không muốn dùng, xem lại đánh đổi; nếu dùng mà không thấy thú vị, xem lại tình huống và phản hồi. Giữ kết luận ở mức giả thuyết cho tới khi có bằng chứng.

Các tiêu chí như lái được trong 10 giây, hiểu đón khách, nhận ra bản sắc Sài Gòn và muốn chia sẻ nằm ở cổng playtest bên dưới. Tự động hóa chứng minh tính đúng và ổn định của cơ chế; không chứng minh niềm vui hay khả năng lan truyền. Mục này chỉ xác lập nền tảng thiết kế, không thay đổi luật hay thông số hiện hành.

### Phạm vi tài liệu đã đọc

Đã đối chiếu [phần mở đầu do MIT Press công khai](https://mitp-content-server.mit.edu/books/content/sectbyfn/books_pres_0/12040/Zubek_TOC_intro.pdf?dl=1) và [bài giảng công khai của Robert Zubek](https://robert.zubek.net/docs/games-studio-2024/2-game-design-player-experience.pdf); chưa đọc toàn bộ sách. Khung này giúp nối luật chơi với hành vi và cảm giác, nhưng hình ảnh, bối cảnh và bản sắc vẫn cần đánh giá riêng. Nhịp chuyến đầu muốn tạo là **định hướng → chọn đường → xử lý cua hoặc dòng xe → đến nơi → hiểu vì sao lần này thành công**. Một nút chia sẻ chỉ phân phối kết quả; cần quan sát xem người chơi có tự tạo và nhớ một khoảnh khắc muốn kể hay không.

## Current iteration — make the opening route choice real

An input-driven comparison rejected the v2 opening trip: boarding beyond the hẻm entrance and travelling to Bến Gió made Hẻm 26 a detour. Measuring its isolated 48m path against 72m of surrounding streets had not established usefulness for the actual request.

`saigon-v3` moves the café pickup before the entrance and the first destination to the existing hẻm exit. The café sign, cart and waiting passenger follow that location. The road graph, controls, fare rules and vehicle density are unchanged by this iteration. The longer district rides remain after the first trip. Its generous existing office deadline is retained while learning the controls; deadline tension is not yet the opening's primary experience.

Run `npm run evaluate:routes -- output/route-evaluation-v3.json`. It compares three complete approaches, five fixed seeds and two cruise speeds. Every approach starts from the default spawn with the same passenger, initial traffic, event schedule and controller. Inputs alone advance the game. Speeds describe the diagnostic driver, not measured novice/expert players.

| Diagnostic cruise speed | Avenue approach, median ride seconds | Upper cross-street, median ride seconds | Hẻm 26, median ride seconds |
| ----------------------- | ------------------------------------ | --------------------------------------- | --------------------------- |
| 10                      | 16.12                                | 12.45                                   | 11.07                       |
| 16                      | 10.57                                | 11.10                                   | 10.43                       |

All 30 attempts delivered. In the faster set, a clean avenue trip took 9.22 seconds versus 10.43 through the hẻm; the upper cross-street had no crashes across the five seeds. This supports a small, observable tradeoff between distance, cornering and traffic exposure. It does not prove balance across all seeds or human skill. The corrected-driver v2 baseline had median hẻm times of 25.37/22.08 seconds versus avenue 19.08/14.02; those are different requests, not a claim that the same route became twice as fast.

An initial diagnostic driver cut a narrow corner early and scraped a wall for almost a minute. Its waypoint tolerance exceeded the usable lane clearance. The driver was corrected for **all** routes, and the earlier output was retained. Do not use that bot failure to claim a human route is inherently slow.

Exit criterion for this code iteration: all three approaches deliver through actual inputs; the hẻm is useful against both existing approaches in the fixed moderate-speed sample; input replay preserves the result; the visible café and collision path agree; packaged-browser driving still completes a full run. The first three are automated evidence. Human route recognition, enjoyment and cultural recognition remain open.

## Next human playtest — observe before adding systems

Use five unfamiliar players as a formative sample, including people familiar with Saigon and people who are not. Give them the game and “get your passenger there”; do not explain the hẻm first. Record movement and first pickup time, route selected, missed turns and help requests. After arrival ask what they chose and why. Offer a second attempt without prompting them to improve a metric; note voluntary replay, route changes and any moment they describe unprompted. Show a short title-free gameplay capture and ask what place it evokes and which visible details led them there.

Provisional next-iteration gates: at least four can board without explanation; at least three notice an alternative approach and explain an actual tradeoff; log every control or collision frustration. These are project decision thresholds, not research-established universal targets. If recognition fails, revise entrance visibility and the camera. If choice is clear but unrewarding, revise the trip and its consequences. If local recognition depends on text alone, revise architecture and street activity. If nobody recalls a moment, more sharing features are not the next experiment. Do not mark any of these gates passed using the bot.

## Previous iteration — identity and traffic play

The owner rejected the first build's generic visuals and lack of viral appeal. Its functional gate passed; its product gate did not. Simulation `saigon-v2` adds one authored Hẻm 26 dogleg, 48 metres between endpoints versus 72 along the prior streets. One building lot is replaced by unequal homes and shared galleries around that exact traversable path. A café pickup, waiting passenger, seated diners, carts, parked scooters, steam, shutters and blue galleries make the opening street legible at rider height. These are visible geometry and motion, not backdrop photographs.

The new manoeuvre is **LÁCH KÉP / thread the needle**: two completed close passes, different vehicles, opposite sides, within 0.6 seconds. It earns 350 base style points through the existing FLOW multiplier, restores 25% boost and has a distinct visual/audio response. A crash clears the pairing window. No reward merely for overlapping an obstacle or entering an unsafe gap.

Passenger feedback now appears in a short speech bubble; office, smooth-driving and student preferences react to actual ride conditions. The hidden hẻm reports discovery once when physically entered. Vehicle and map changes use a new simulation version so old local scores and challenge links are not silently reinterpreted.

The immediate exit test is an input-driven trip through the authored dogleg with no invisible geometry, actors standing outside solid buildings, preserved palette after geometry batching, and a readable moving-camera capture. This still does not establish the owner's fun/identity/virality bar. Larger world, cosmetics and backend remain poor substitutes for improving that trip.

## Gates

1. Greybox: immediate acceleration, controllable turning and braking, continuous camera, moving traffic, pickup/drop-off, near miss, recovery. Test before dressing the city.
2. Playground: one dense district combines boulevard loop, intersections, market, food street, residential alleys and canal edge. Six environmental identities are pockets within this district, not six large unlockable maps.
3. Chaos: rain, rush hour, pothole, blocked street, bus crossing, flood have real physical or navigation consequences.
4. Viral loop: 3-minute runs, deterministic daily challenge, score, fare, streak, local best, downloadable result, restart; bounded input/pose/event recording for future replay.
5. Polish and measured optimization; release QA with explicit browser/device limits.

External human gates remain: first-time player drives within 10 seconds; understands pickup and route choice without explanation; voluntarily retries; identifies the city without title; wants to share a self-created moment. Do not mark these passed from scripted automation.

## Loop and scoring

30 seconds: accept a request → ride to a yellow pickup → brake in the ring → carry passenger → choose boulevard or hẻm → dodge traffic → brake at turquoise drop-off → fare and next request.

3-minute loop: chain several rides, preserve FLOW, weather the same daily event schedule, finish with a personal title and result card, restart with one tap. The originally requested 5-minute loop is compressed to 3 minutes to make iteration cheap.

FLOW: a close pass at speed adds 100 × current multiplier points; distinct encounters only, with a per-vehicle cooldown and separation requirement. A completed alley traversal adds 200 × multiplier. Clean sustained speed contributes gradual FLOW. Combo advances every two scored actions up to ×8. Major collisions reset it; stationary driving decays it. Stopping for boarding/delivery preserves FLOW. Repeated bouncing into one object cannot score.

Fare: passenger base + remaining mission seconds × 120 + passenger preference bonus − crashes × 2,000; floored at 3,000. Final score = style points + floor(total fare / 100) + successful deliveries × 500. No currency conversion claim: this is an arcade score economy.

## Passengers and routes

Office worker: short deadline, time bonus. Grandma: smoothness bonus and lower preferred speed. Student: alley bonus. Chaos fan: near-miss bonus. Each has short Vietnamese reactions with English context. Daily sequence is seeded and fixed; route selection is physical steering, not a menu. A separate practice mode with passenger choice is deferred.

Road graph: three horizontal and three vertical boulevards at −72, 0, +72 world units. Narrow streets at ±36 cut through the four blocks. Boulevards are forgiving but carry traffic; hẻm reduce distance with narrow clearance. Destination marker shows direction, minimap shows connectivity; neither chooses the route for you.

## Chaos and fairness

Six seeded event windows over simulation time: rain lowers grip, rush hour activates preallocated traffic, potholes bounce/slow, barricades block part of a road, a bus crosses, flood slows canal-side travel. All hazards are visible before impact. A recent crash grants brief immunity and caps chain punishment. Input-dependent horn response is deterministic. Daily seed fixes base conditions; the same input tape at the same simulation version reproduces the run. Rendering quality must never change collision traffic or scores. Adaptive effects may change pixels only.

## Architecture and art

Vanilla ES modules, locally pinned Three.js, custom 60 Hz simulation, Web Audio. No bundler: npm is for dependencies and quality tools; export a static folder for any HTTP host. Pure simulation owns time and random streams, world map owns traversability, view owns meshes/camera/effects, platform owns input/audio/UI/storage. Seed, simulation version and mode travel with every result.

Warm ivory, charcoal, tangerine and electric mint; toy-like bikes, legible rider helmets, low-rise shop houses against a skyline. Overhead wires, balconies, street-food awnings, canal and curbside stools are composed around sightlines. Phrases such as “Trễ họp rồi!”, “Chậm thôi!”, “Đường này hả?” are passenger feedback. No combat or pedestrian injury.

Audio: speed-dependent engine, two-tone horn, NPC reply, tire skid, rain noise, impact thump and fare chime. Start after a user gesture. Reduced motion removes camera shake/FOV kicks; sound level and quality controls; large touch targets and mirrored layout. The bike still leans to communicate steering. There is no music track or inactive music control.

## Share and progression

Versioned UTC date seed, replay button, challenge URL, local daily best, PNG result card. Record inputs at 60 Hz and poses at 10 Hz with bounded arrays and notable moments. No video/replay player claim until implemented. Cosmetic jacket unlocks are deferred until playtest evidence warrants progression; any later cosmetics must have zero handling advantage. Leaderboard submission would need server validation: local scores are explicitly not verified global rankings.

## Ruthless review

Protect the space between two scooters, the decision to turn into a hẻm, the relieved passenger after a risky drop-off. Defer shops, inventories, district grinding, voice acting, video encoding and cosmetic menus that obscure those moments. Automated tests establish mechanics and stability; human playtests establish fun.
