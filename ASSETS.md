# ASSETS.md — Nhật ký tài nguyên

Quy tắc (xem `docs/04-design-system.md` §8):

- Chỉ nhận giấy phép **Tự tạo / CC0 / MIT**. **Không dùng Pixabay Content License** (GĐ-18).
- Không thêm file nào vào `public/` hoặc `src/assets/` nếu chưa có dòng trong bảng dưới.
- Ảnh và giọng của gia đình **không bao giờ** nằm ở đây: chúng chỉ được nhập qua app và lưu trong IndexedDB (`local-content/` đã nằm trong `.gitignore`).

| ID | Tập tin | Mô tả | Nguồn / tác giả | URL | Giấy phép | Ngày lấy | Chỉnh sửa | Dùng ở |
|----|---------|-------|-----------------|-----|-----------|----------|-----------|--------|
| A-001 | `public/icons/icon-512.svg` | Biểu tượng app: linh vật Lạc Lạc | Tự tạo | — | CC0 (tự tạo) | 2026-10-24 | — | PWA manifest |
| A-002 | `public/icons/icon-192.svg` | Biểu tượng 192 px | Tự tạo | — | CC0 (tự tạo) | 2026-10-24 | Thu nhỏ từ A-001 | PWA manifest |
| A-003 | `public/icons/icon-180.svg` | `apple-touch-icon` | Tự tạo | — | CC0 (tự tạo) | 2026-10-24 | Thu nhỏ từ A-001 | iOS Màn hình chính |
| A-004 | `public/icons/icon-maskable.svg` | Biểu tượng maskable | Tự tạo | — | CC0 (tự tạo) | 2026-10-24 | Bỏ bo góc từ A-001 | PWA manifest |
| A-005 | `src/mascot/LacLac.tsx` | Linh vật Lạc Lạc (SVG nhiều lớp, 7 trạng thái) | Tự tạo theo brief `docs/04` §7 | — | CC0 (tự tạo) | 2026-10-24 | — | Mọi màn của bé |
| A-006 | `src/ui/StarBoard.tsx` | Bảng sao 5 ô (SVG) | Tự tạo | — | CC0 (tự tạo) | 2026-10-24 | — | S07 |
| A-007 | `src/ui/PartyScene.tsx` | Hạt và bong bóng màn tiệc (CSS/SVG) | Tự tạo | — | CC0 (tự tạo) | 2026-10-24 | — | S08 |
| A-008 | `src/audio/tones.ts` | 5 nốt "ting" (C5 D5 E5 G5 A5) tổng hợp bằng Web Audio | Tự tạo | — | CC0 (tự tạo) | 2026-10-24 | — | Thưởng mỗi lượt |
| A-009 | `src/audio/tones.ts` | Đoạn nhạc tiệc 6,8 giây tổng hợp bằng Web Audio | Tự tạo | — | CC0 (tự tạo) | 2026-10-24 | — | S08 |
| A-010 | `public/starter/images/animal.dog.jpg` | Ảnh con chó (gói khởi đầu) | Lottie's pets & stuff (Flickr) | https://www.flickr.com/photos/36943025@N07/26407452085 | CC0 1.0 | 2026-10-25 | Cắt vuông, 800 px, nền `--bg` | COG-01 |
| A-011 | `public/starter/images/animal.cat.jpg` | Ảnh con mèo | Caleb Woods (StockSnap) | https://stocksnap.io/photo/cat-kitten-534P87FLH7 | CC0 1.0 | 2026-10-25 | Cắt vuông, 800 px | COG-01 |
| A-012 | `public/starter/images/animal.cow.jpg` | Ảnh con bò | Ian Livesey (StockSnap) | https://stocksnap.io/photo/cow-animal-FVKHAEXJRI | CC0 1.0 | 2026-10-25 | Cắt vuông, 800 px | COG-01 |
| A-013 | `public/starter/images/animal.chicken.jpg` | Ảnh con gà | Skitter Photo (StockSnap) | https://stocksnap.io/photo/rooster-cock-B5794119D6 | CC0 1.0 | 2026-10-25 | Cắt vuông, 800 px | COG-01 |
| A-014 | `public/starter/images/reward.bubbles.jpg` | Ảnh thổi bong bóng | Sebastian Pichler (StockSnap) | https://stocksnap.io/photo/bubbles-grass-UIU20NGOBV | CC0 1.0 | 2026-10-25 | Cắt vuông, 800 px | S05 chọn thưởng |
| A-015 | `public/starter/images/reward.car.jpg` | Ảnh xe đồ chơi | Mike Birdy (StockSnap) | https://stocksnap.io/photo/toy-car-2F0K9XM0NX | CC0 1.0 | 2026-10-25 | Cắt vuông, 800 px | S05 chọn thưởng |
| A-016 | `public/starter/images/reward.swing.jpg` | Ảnh xích đu | Ben Rosett (StockSnap) | https://stocksnap.io/photo/weddingreception-swing-VQNCFNDLZS | CC0 1.0 | 2026-10-25 | Cắt vuông, 800 px | S05 chọn thưởng |
| A-017 | `public/starter/sounds/animal.dog.m4a` | Tiếng chó sủa | esperri (Freesound) | https://freesound.org/people/esperri/sounds/118964 | CC0 1.0 | 2026-10-25 | Cắt 1,0 s, chuẩn hóa đỉnh −9 dBFS, fade 20/50 ms, AAC mono 64 kbps | Màn tiệc |
| A-018 | `public/starter/sounds/animal.cat.m4a` | Tiếng mèo kêu | philsapphire (Freesound) | https://freesound.org/people/philsapphire/sounds/256452 | CC0 1.0 | 2026-10-25 | Cắt 1,5 s, cùng xử lý như A-017 | Màn tiệc |
| A-019 | `public/starter/sounds/animal.cow.m4a` | Tiếng bò rống | Zozzy (Freesound) | https://freesound.org/people/Zozzy/sounds/59245 | CC0 1.0 | 2026-10-25 | Cắt 1,5 s, cùng xử lý như A-017 | Màn tiệc |
| A-020 | `public/starter/sounds/animal.chicken.m4a` | Tiếng gà kêu | Rudmer_Rotteveel (Freesound) | https://freesound.org/people/Rudmer_Rotteveel/sounds/316920 | CC0 1.0 | 2026-10-25 | Cắt 1,2 s, cùng xử lý như A-017 | Màn tiệc |
| A-021 | `public/starter/images/object.ball.svg` | Hình minh họa quả bóng | Tự tạo (SVG trong repo) | — | CC0 (tự tạo) | 2026-10-25 | — | SOC-01, GRO-02, GRO-03, LAN-02/03 |
| A-022 | `public/starter/images/object.block.svg` | Hình minh họa khối gỗ | Tự tạo | — | CC0 (tự tạo) | 2026-10-25 | — | SOC-01, GRO-02, GRO-03 |
| A-023 | `public/starter/images/object.bead.svg` | Hình minh họa hạt màu | Tự tạo | — | CC0 (tự tạo) | 2026-10-25 | — | FIN-01 |
| A-024 | `public/starter/images/object.bin.svg` | Hình minh họa hộp / thùng rác | Tự tạo | — | CC0 (tự tạo) | 2026-10-25 | — | FIN-01, COG-02, LAN-03 |
| A-025 | `public/starter/images/object.fruit.svg` | Hình minh họa trái cây mô hình | Tự tạo | — | CC0 (tự tạo) | 2026-10-25 | — | SOC-02 |
| A-026 | `public/starter/images/object.truck.svg` | Hình minh họa xe tải | Tự tạo | — | CC0 (tự tạo) | 2026-10-25 | — | SOC-03 |
| A-027 | `public/starter/images/object.hand.svg` | Hình minh họa bàn tay xòe / vẫy | Tự tạo | — | CC0 (tự tạo) | 2026-10-25 | — | IMI-02, IMI-03, LAN-02 |
| A-028 | `public/starter/images/object.tunnel.svg` | Hình minh họa đường hầm | Tự tạo | — | CC0 (tự tạo) | 2026-10-25 | — | GRO-01 |

**A-010…A-016 là ảnh tạm để chạy thử máy.** `docs/02` yêu cầu ảnh thật trên nền trơn, và với đồ cá nhân thì phải là **chính đồ của bé**. Ba mẹ thay bằng ảnh mình chụp ở màn Nội dung; gói khởi đầu không ghi đè ảnh đã thay. CC0 1.0 không bắt buộc ghi công, nhưng vẫn ghi nguồn ở đây để kiểm lại được.

## Còn thiếu cho buổi thử với bé (việc P0-2, P0-3)

| Cần | Số lượng | Ai làm | Ghi chú |
|---|---|---|---|
| **Ảnh 6 đồ vật cá nhân của bé** | 6 | Ba mẹ tự chụp | Bắt buộc là **chính đồ của bé** (`02` COG-03), không dùng ảnh stock. Đã thử nguồn CC0: không có bộ ảnh đồ vật nền trơn dùng được. GĐ-11 ⚠️ chờ cô giáo chốt danh sách |
| **Giọng ba mẹ** | ~45 clip | Ba mẹ thu trong app | App chơi được ngay khi chưa thu (chế độ "ba mẹ đọc trực tiếp"), nhưng thu sẵn thì buổi học mượt hơn. ⚠️ chờ câu lệnh chuẩn của cô (GĐ-01) rồi hãy thu hàng loạt |
| Ảnh con vật của riêng nhà | tùy | Ba mẹ | A-010…A-013 đã đủ để chạy; thay bằng ảnh con vật bé thật sự gặp thì tốt hơn cho bước cầu nối |
| Ảnh phần thưởng thật | 1–3 | Ba mẹ | A-014…A-016 là ảnh tạm; ảnh hoạt động nhà mình hay làm sẽ dễ hiểu hơn với bé |
