# XE ÔM CHAOS: SAIGON

Game xe ôm arcade chạy trong trình duyệt: đón khách, chọn đường lớn hoặc hẻm, lách xe lấy FLOW, trả khách kiếm cước trong một ca 3 phút. Bản chơi thử cục bộ, dùng Three.js và JavaScript thuần.

Bản `saigon-v3` đặt chuyến đầu từ quán cà phê đến đầu ra Hẻm 26: đi tắt qua hẻm hoặc vòng theo đường hiện có. Hẻm gấp khúc có hành lang chung, cửa chớp, quán có người ngồi ăn, người chờ xe và hơi nước. “Lách kép” giữa hai xe ở hai phía, rồi thoát an toàn, được thưởng điểm và hồi boost. [Video chuyến mở đầu v3](output/playwright/iteration3/saigon-v3-opening.webm) được ghi bằng điều khiển bàn phím thật.

## Chạy ngay

Cần Node.js 22 trở lên và trình duyệt có WebGL 2.

```bash
cd /home/thunder/Code/xe-om-chaos
npm ci
npm start
```

Mở **http://localhost:4173**. Không cần tài khoản, API key hay dịch vụ backend. Sau khi cài thư viện, game không cần CDN hoặc kết nối ra ngoài. Không mở trực tiếp `index.html` bằng `file://`, vì trình duyệt cần HTTP để nạp ES modules.

## Cách chơi

| Thao tác | Bàn phím     | Điện thoại                |
| -------- | ------------ | ------------------------- |
| Ga       | W / ↑        | Giữ ↑                     |
| Phanh    | S / ↓        | Giữ ↓                     |
| Rẽ       | A/D hoặc ←/→ | Giữ ←/→, đồng thời với ga |
| Boost    | Shift + ga   | Giữ BOOST + ga            |
| Còi      | Space        | BÍP                       |
| Tạm dừng | P / Escape   | Nút Ⅱ                     |

Đến vòng **vàng** và phanh để đón khách. Đến vòng **xanh** và phanh để trả khách. Mũi tên chỉ hướng; bản đồ nhỏ cho thấy đường lớn và hẻm, để bạn tự chọn lộ trình. Lách qua xe ở tốc độ cao và đi xuyên hẻm tạo FLOW. Va chạm thường hồi phục sau 1,2 giây.

Dân văn phòng thưởng đến sớm; cô Tư thưởng chạy êm; sinh viên thưởng đi hẻm; khách mê tốc độ thưởng lách xe. Mưa làm trơn đường, giờ cao điểm thêm xe, ổ gà làm nảy xe, rào chắn và xe buýt đổi đường đi, nước ngập làm chậm xe.

Nút ⚙ có Tiếng Việt/English, âm lượng, chất lượng hình ảnh, giảm chuyển động, kích thước nút cảm ứng và bố cục thuận tay trái. Chuyển tab tự tạm dừng ca chạy.

## Daily Run và chia sẻ

Mỗi ngày UTC có một seed. Link thách đấu chứa ngày và phiên bản mô phỏng; cùng seed, phiên bản và chuỗi điều khiển sẽ tái tạo cùng lượt chạy. Chất lượng hình ảnh không thay đổi xe có va chạm hay cách tính điểm.

Cuối ca có kỷ lục trên máy, ảnh PNG 1080 × 1350, link thách đấu, dữ liệu lượt chơi và nút chạy lại. Dữ liệu JSON lưu input 60 Hz, vị trí 10 Hz và sự kiện; **chưa có trình xem replay, ghost hoặc xuất video trong game**. Điểm lưu trên máy chưa được máy chủ xác minh.

Link `localhost` chỉ dùng trên chính máy đang chạy game. Để bạn bè mở được link, cần đưa thư mục tĩnh lên một HTTP/HTTPS host; bản này chưa được triển khai công khai.

## Đóng gói

```bash
npm run package
```

Thư mục `dist/` chứa game, Three.js đã ghim phiên bản và giấy phép MIT của Three.js. Không cần Node.js ở nơi lưu trữ. Khi `npm start` đang chạy, kiểm tra bản đóng gói ở **http://localhost:4173/dist/**.

## Kiểm tra

```bash
npm run quality
npm run evaluate:routes
npx playwright install chromium firefox webkit
npm run smoke
XEOM_BROWSER=firefox XEOM_URL=http://localhost:4173/dist npm run smoke
XEOM_BROWSER=webkit XEOM_URL=http://localhost:4173/dist npm run smoke
XEOM_BROWSER=firefox XEOM_SOAK=1 XEOM_URL=http://localhost:4173/dist npm run smoke
XEOM_BROWSER=firefox XEOM_ROUTE=hem26 npm run smoke
XEOM_BROWSER=chromium XEOM_HEADED=1 XEOM_URL=http://localhost:4173/dist npm run smoke
```

Giữ server chạy ở terminal khác. Linux có thể cần thư viện hệ thống cho Playwright (`npx playwright install-deps`). Smoke dùng Chrome tại `/opt/google/chrome/chrome` nếu có, nếu không dùng Chromium của Playwright; có thể chỉ định `XEOM_CHROME_PATH`.

Trên máy Linux đã kiểm tra, Chrome headless dùng SwiftShader bằng CPU và không đạt thời gian chạy thử. `XEOM_HEADED=1` mở Chrome qua X11/OpenGL để kiểm tra GPU thật; cần phiên desktop X11 tương thích. Báo cáo ghi riêng hai cách chạy, không coi kiểm tra WebKit trên Linux là kiểm tra iPhone.

`quality` chạy typecheck, kiểm tra mô phỏng và formatter. Smoke thực sự gửi bàn phím để hoàn thành chuyến đầu, kiểm tra touch, menu, pause/restart, ảnh và JSON tải xuống. Chế độ mặc định đi nhanh đến cuối ca bằng fixture mô phỏng để kiểm tra màn hình kết quả. `XEOM_SOAK=1` chạy đủ ca bằng điều khiển bàn phím theo thời gian thực. Cả hai là kiểm tra tự động, không đo cảm giác vui của người chơi.

Kết quả, ảnh chụp và dữ liệu ở `output/playwright/`; đổi thư mục bằng `XEOM_OUTPUT`. Debug HUD: **http://localhost:4173/?debug=1**, hiện FPS, frame time, draw calls, triangles, xe, particles và seed.

## Phạm vi và bằng chứng

Đã có một bản đồ nhỏ với khu chợ, quán ăn, nhà phố, bờ kênh và mạng hẻm; bốn kiểu khách; sáu sự kiện; FLOW; Daily Run; touch; âm thanh tổng hợp; kết quả chia sẻ. AI giao thông hiện chạy theo các vòng đường có seed và phản ứng với còi. Chưa có hệ thống tránh nhau hoặc tìm khoảng trống nâng cao.

Chưa xác nhận 50–60 FPS trên Android tầm trung thật, Safari/iPhone thật, độ cuốn hút hay khả năng lan truyền. Không có multiplayer, leaderboard, mở khóa mỹ phẩm, PWA hoặc trình xem replay. Xem [QA_REPORT.md](QA_REPORT.md) để phân biệt điều đã kiểm tra và các điều kiện còn mở.

[GAME_DESIGN.md](GAME_DESIGN.md) giải thích cơ chế và phạm vi; [RESEARCH_NOTES.md](RESEARCH_NOTES.md) ghi nguồn tham khảo, lựa chọn kỹ thuật và văn hóa. Geometry, biển hiệu, giao diện và âm thanh được tạo trong mã; không dùng logo thương mại hoặc tài sản hình ảnh tải từ nguồn tham khảo.
