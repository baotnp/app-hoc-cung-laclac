# 08 — Rủi ro, câu hỏi mở, giả định

> Phiên bản 0.1 — nháp chờ Bao duyệt. Quy ước: `Q-xx` = câu hỏi mở (không chặn công việc); `GĐ-xx` = giá trị giả định đang dùng cho đến khi có xác nhận; `⚠️` = cần xác nhận với cô giáo.
> Mức rủi ro = đánh giá của tác giả tài liệu (khả năng × ảnh hưởng), chưa phải số đo.

## 1. Rủi ro và cách giảm thiểu

### 1.1 Sản phẩm và sư phạm

| ID | Rủi ro | Mức | Giảm thiểu | Khi nào xử lý |
|---|---|---|---|---|
| R-01 | Bé không hứng thú / không chạm / khó chịu với app | Cao | Thử bé sớm (tuần 3); từng bước thêm hiệu ứng; bé chọn phần thưởng; công tắc giác quan; dừng buổi không bị tính thất bại | `07` §6 |
| R-02 | Màn tiệc/âm thanh quá kích thích, làm bé khó chịu | Cao | Tách `calm`/`festive`; tiệc ≤8 giây; "Tắt chuyển động", "Tiệc yên lặng", âm lượng riêng; cấm nhấp nháy/đỏ chói; thử bằng người lớn trước | T12, T22 |
| R-03 | Bé giỏi trên iPad nhưng không tổng quát hóa ra đời | Cao | Cầu nối 4 bậc sau mỗi bài; "đạt" chỉ khi bậc 3–4 (GĐ-05); tỷ lệ iPad không dùng làm điều kiện hoàn tất | `01` §5, `02` |
| R-04 | Bé quen dùng iPad quá nhiều / coi iPad là phần thưởng | Trung bình | iPad ≤10 phút; ba mẹ luôn ngồi cùng; phần thưởng là hoạt động ngoài iPad (GĐ-16); không dùng iPad thưởng cho bài ngoài đời | `01` §6 |
| R-05 | Ba mẹ coi app thay thế can thiệp trực tiếp | Trung bình | Thông điệp "hỗ trợ, không thay thế" ở README và S04; chỉ số cho cô giáo; không tuyên bố y khoa | S04, `09` |
| R-06 | Câu lệnh, thang gợi ý, tiêu chí đạt khác với cô giáo | Cao | Mọi giá trị trong JSON (`confirm.status='assumed'`) → đổi bằng dữ liệu; họp tuần 1; không dùng "đạt" để quyết định khi chưa xác nhận | P0-1 |
| R-07 | Học "vị trí" thay vì "hình" (thiên vị bên trái/phải) | Trung bình | Cân bằng ±1, ≤3 lượt liền cùng bên; cảnh báo >80%; hình gây nhiễu đổi | `06` Q3 |
| R-08 | Ba mẹ bấm xác nhận/sửa mức gợi ý không chính xác → dữ liệu kém tin cậy | Trung bình | Giữ `promptLevelAuto` + `promptLevel`; `promptLevelSource`; `valid`; hiển thị số lượt n; cảnh báo khi n nhỏ | T18 |
| R-09 | Số liệu bị hiểu như đánh giá lâm sàng | Trung bình | Văn phong trung tính; "hỏi cô giáo"; không điểm số/xếp hạng; từ cấm (`09`) | T21 |
| R-10 | Động lực ba mẹ giảm, cảm giác có lỗi khi lỡ ngày | Trung bình | Mục tiêu tuần 5/7, tối thiểu 5 phút, không chuỗi ngày, vòng rỗng trung tính; không linh vật buồn | `01` §5 |
| R-11 | Gia đình thiếu dụng cụ cho bước cầu nối | Trung bình | Hướng dẫn dùng đồ có sẵn; thẻ in (P2); đồ chơi/mô hình thay đồ thật ở bậc 3 | `02` |
| R-12 | Bài vận động thô/hạt nhỏ gây an toàn | Trung bình | Ba mẹ giám sát; chọn hạt đủ lớn; ⚠️ cô xác nhận hướng dẫn an toàn trước khi phát hành P2 | Q-12 |

### 1.2 Kỹ thuật

| ID | Rủi ro | Mức | Giảm thiểu | Khi nào |
|---|---|---|---|---|
| R-13 | **Không kịp MVP** | Cao | Rà lại ước lượng (0.2): phạm vi đầy đủ là 19,0 ndc > 16,5 ndc của 3 tuần → đề xuất thêm tuần 5, cổng dời sang 27/11 (`07` §1.2, cần Bao chọn); van an toàn 3,85 ndc; theo dõi theo tuần | `07` §1, §4 |
| R-14 | Safari xóa dữ liệu hoặc mất iPad → mất toàn bộ | Cao | `storage.persist()`; sao lưu ra Tệp (mặc định "Trên iPad này", app cảnh báo nếu chọn đám mây); nhắc 7 ngày; khôi phục từ S20 (app tự dựng lại hồ sơ rỗng, ba mẹ nhập file để thay thế) | T19 |
| R-15 | Âm thanh iOS: cần cử chỉ, công tắc im lặng, bị ngắt | Cao | S01; `audioSession`; phục hồi sau gián đoạn; spike tuần 1 | P0-6, T01 |
| R-16 | `MediaRecorder`/quyền micro khác trên PWA | Trung bình | Dò định dạng; nhập file từ Voice Memos làm dự phòng | P0-6, T07 |
| R-17 | Blob lớn trong IndexedDB chậm/lỗi | Trung bình | Nén ảnh ≤1200 px; `preload` theo vòng; dự phòng `ArrayBuffer` | P0-6 |
| R-18 | Cập nhật service worker làm hỏng buổi đang chơi | Trung bình | `registerType:'prompt'`, chỉ cập nhật trong chế độ ba mẹ | T16, T20 |
| R-19 | Phụ thuộc tool mới (Rive) kéo trễ | Trung bình | MVP dùng SVG + Framer (GĐ-14); API `<LacLac>` giữ nguyên | P0-4, T08 |
| R-20 | Hiệu năng/nhiệt khi có 3D và hạt (P2) | Thấp | Hai mức chất lượng; pixel ratio ≤2; dừng render khi rời màn | P2 |
| R-21 | Nhắc lịch cần máy chủ (Web Push cần server) mà chưa có backend | Trung bình | P2 dùng lịch `.ics` do ba mẹ thêm vào Lịch; hoặc Cloudflare Worker không lưu trạng thái (GĐ-25) | P2 |
| R-22 | Báo cáo LLM cần proxy giữ khóa API → mâu thuẫn "chưa cần backend" | Trung bình | Một Cloudflare Worker không lưu dữ liệu; chỉ nhận số liệu ẩn danh; CSP chỉ mở đúng origin; có báo cáo mẫu cục bộ dự phòng | P2 |
| R-23 | Quá nhiều trạng thái trong buổi → lỗi hiếm | Trung bình | `trialMachine` reducer thuần có test; một nguồn `Session.phase`; phục hồi crash | T03, T11 |
| R-24 | Ảnh nội dung kém (tách chủ thể lỗi, nền lẫn) làm bé phân tâm | Trung bình | Hướng dẫn dùng "tách chủ thể" của iPad; xem trước trên nền trơn; không tự viết code tách nền | T06 |

### 1.3 Pháp lý, bản quyền, dự án

| ID | Rủi ro | Mức | Giảm thiểu | Khi nào |
|---|---|---|---|---|
| R-25 | Tài nguyên có giấy phép không rõ | Trung bình | Chỉ **Tự tạo / CC0 / MIT**; `ASSETS.md` bắt buộc; **không dùng Pixabay Content License** (GĐ-18) | P0-8 |
| R-26 | Linh vật giống Duolingo | Thấp–Trung bình | Brief hình khối riêng (`04` §7); kiểm tra trước khi chốt; âm tự tạo | P0-4 |
| R-27 | Dữ liệu trẻ em và Nghị định 13/2023/NĐ-CP khi mở rộng | Trung bình (từ P3) | Dữ liệu cục bộ; ẩn danh hóa; đồng ý rõ ràng; **cần tham vấn pháp lý** trước khi thử với gia đình khác (không suy diễn điều khoản trong tài liệu này) | Trước P3 |
| R-28 | Dùng nội dung chương trình của trung tâm cho gia đình khác (quyền sử dụng) | Thấp–Trung bình | Hỏi trung tâm; nội dung bài là dữ liệu có thể thay | Q-13 |
| R-29 | Một lập trình viên: ốm/kiệt sức/mất thời gian | Trung bình | Phạm vi nhỏ, tài liệu, sao lưu mã nguồn, task ≤1 ndc | liên tục |
| R-30 | Phạm vi P2 quá lớn (5 kiểu trò, Rive, 3D, LLM, nhắc lịch) | Cao | Ưu tiên theo mục tiêu tuần của cô; có thể trượt sang P3; không mở thêm trước khi qua cổng P1 | Kế hoạch P2 |

## 2. Câu hỏi mở

Không câu nào chặn công việc. Mỗi câu dùng giá trị giả định trong cột "Đang dùng".

### 2.1 Câu hỏi từ brief

| ID | Câu hỏi | Đang dùng (GĐ) | Ai trả lời / cách xác nhận | Nếu sai thì |
|---|---|---|---|---|
| Q-01a | Câu lệnh chuẩn cô giáo dùng cho từng bài | "Con {tên} đâu?"; lời khen "Đúng rồi, con {tên}!"; cầu nối "Giờ tìm con {tên} thật nào!" (GĐ-01) ⚠️ | Cô giáo (P0-1) | Thu âm lại; không đổi code |
| Q-01b | Thứ tự/tên các mức gợi ý | `independent→gesture→model→partial_physical→full_physical`; hình nổi lên của app = `gesture` (GĐ-02) ⚠️ | Cô giáo | Đổi nhãn/ánh xạ trong cấu hình + dữ liệu cũ ánh xạ lại (có `promptLevelAuto`) |
| Q-01c | Thời gian chờ trước gợi ý | 5.000 ms; sau gợi ý 15.000 ms (GĐ-03) ⚠️ | Cô giáo + quan sát `firstChoice.latencyMs` trong buổi thử | Sửa `timing` trong JSON / cài đặt |
| Q-01d | Tiêu chí đạt | Trên iPad: 5 buổi gần nhất, ≥80% tự làm đúng, ≥6 lượt (GĐ-04). Ngoài đời: ≥2 xác nhận *Bé làm được* ở bậc 3–4, ≥2 ngày khác nhau (GĐ-05) ⚠️ | Cô giáo | Sửa `mastery` trong JSON / hằng số GĐ-05 |
| Q-01e | Định nghĩa "đúng" từng bài trong `02` (đặc biệt bắt chước, vận động, lời nói) | Bản nháp trong `02` ⚠️ | Cô giáo | Sửa `02` + bài P2 |
| Q-02 | Danh sách đồ vật cá nhân của bé | 6 món gợi ý: bình nước, dép, mũ, ba lô, khăn, gối (GĐ-11) | Ba mẹ + cô | Chỉ đổi ảnh/mục |
| Q-03 | Bé chạm chính xác chưa; kéo thả được chưa | Chạm được, **chưa** chắc kéo thả; MVP chỉ dùng chạm (`pointerup`, hit-slop 24 px) (GĐ-08) | Quan sát buổi thử #1 | Điều chỉnh kích thước/hit-slop; P2 đồ chơi ảo có chế độ chạm-rồi-chạm |
| Q-04 | Bé nhạy cảm giác quan với âm/ánh sáng nào | Chưa biết; mặc định yên tĩnh, âm lượng 60%, tiệc có thể tắt (GĐ-09) | Ba mẹ + buổi thử (thẻ `sound_distress`/`visual_distress`) | Hạ âm lượng, đổi âm, bật tắt chuyển động |
| Q-05 | Thời gian dùng iPad hiện tại của bé | Giả định không dùng làm căn cứ thiết kế; app giữ ≤10 phút/buổi (GĐ-10) | Ba mẹ | Điều chỉnh `ipadMaxMinutes` |

### 2.2 Câu hỏi bổ sung (phát sinh khi thiết kế)

| ID | Câu hỏi | Đang dùng | Ai trả lời |
|---|---|---|---|
| Q-06 | Bé hiện nói/phát âm được gì (làm cơ sở cho LAN-01/02/03) | Không giả định; bài lời nói để P2/P3 | Cô giáo, ba mẹ |
| Q-07 | Danh sách 4–6 phần thưởng thật bé thích (ngoài iPad) | Giả định ba mẹ tự nhập; ví dụ thổi bong bóng, chơi xe (GĐ-16) | Ba mẹ |
| Q-08 | Cô giáo muốn xem dữ liệu dạng gì, bao lâu một lần | Bảng tuần trên iPad của ba mẹ (MVP) | Cô giáo (P0-1) |
| Q-09 | Ai dùng iPad (một hay hai ba/mẹ), có dùng chung với việc khác không | Một iPad, một bé, nhiều người lớn (GĐ-15) | Ba mẹ |
| Q-10 | Khung giờ bé học tốt nhất | Chưa biết; thu `Session.startedAt` để suy ra ở P2 | Dữ liệu |
| Q-11 | iPad đặt ngang hay dọc, có giá đỡ không | Ngang là chính (GĐ-13) | Ba mẹ |
| Q-12 | Hướng dẫn an toàn cho bài vận động thô và hạt nhỏ | Văn bản chung "ba mẹ giám sát"; ⚠️ chờ cô | Cô giáo |
| Q-13 | Có được dùng tên/nội dung 18 bài của trung tâm trong sản phẩm mở rộng không | Chỉ dùng nội bộ cho Lạc ở MVP | Trung tâm |
| Q-14 | Tư vấn pháp lý cho dữ liệu trẻ em (Nghị định 13/2023/NĐ-CP) trước khi thử với gia đình khác | Chưa làm | Bao (trước P3) |
| Q-15 | Định nghĩa "xếp thẻ tranh thành hàng" (xếp liền hàng hay theo thứ tự) | Xếp liền một hàng (`02` FIN-03) ⚠️ | Cô giáo |

## 3. Chương trình họp cô giáo (P0-1, ~45–60 phút)

Mang theo: `02-exercise-catalog.md` (in hoặc mở trên iPad), bảng 18 bài, danh sách câu lệnh mẫu.

| # | Chủ đề | Câu hỏi cụ thể | Đầu ra cần mang về | Điền vào |
|---|---|---|---|---|
| A | Câu lệnh | Cô nói đúng câu nào cho từng bài (chọn hình, bắt chước, vận động, lời nói)? Có đổi theo giai đoạn? | Bảng câu lệnh 18 bài | Q-01a |
| B | Thang gợi ý | Thứ tự các mức, tên gọi, "chỉ" có nghĩa gì? Mẫu của người có tính là gợi ý không (bắt chước)? | Bảng mức gợi ý theo loại bài | Q-01b |
| C | Thời gian chờ | Chờ bao lâu trước khi gợi ý? Gợi ý đầu tiên là gì? Có nên lặp câu lệnh? | Số giây + quy tắc | Q-01c |
| D | Tiêu chí đạt | Bao nhiêu % trong mấy buổi? Bao nhiêu lần ngoài đời thì tính đạt? Cần ở mấy bậc? | Con số | Q-01d |
| E | "Đúng" của từng bài | Bài nào chấp nhận gần đúng (lời nói)? Thế nào là đã chui qua/đi chậm? Xếp thành hàng nghĩa là gì? | Định nghĩa | Q-01e, Q-15 |
| F | Đồ vật cá nhân | Bé đang học những đồ vật nào? Đồ cùng loại hay đúng món đó? | Danh sách | Q-02 |
| G | Giác quan | Cô quan sát bé nhạy với âm/ánh sáng nào? Cần tránh gì? | Danh sách tránh | Q-04 |
| H | Bước cầu nối | Cách ở nhà làm bậc 2/3/4 cho từng bài, với đồ có sẵn? | Hướng dẫn mẫu (`bridge.levels`) | `02` |
| I | An toàn | Cách an toàn cho bài chui hầm, đi chậm, hạt nhỏ, dao nhựa? | Văn bản an toàn | Q-12 |
| J | Lịch | Mỗi ngày mấy phút? iPad tối đa? Có nên mục tiêu 5/7? | Khuyến nghị | `01` §5, Q-05 |
| K | Báo cáo | Cô muốn thấy gì mỗi lần gặp? | Danh sách số liệu | Q-08 |
| L | Phạm vi | Có bài nào không nên làm trên iPad? Điều gì cô lo ngại? | Danh sách | R-05 |
| M | Quyền | Có được dùng nội dung bài cho gia đình khác không? | Có/không | Q-13 |

Sau họp: cập nhật `confirm.status` trong JSON (`assumed` → `confirmed`), bảng §4 dưới đây, và `02`.

## 4. Bảng giả định (GĐ)

| GĐ | Nội dung | Tài liệu | ⚠️ |
|---|---|---|---|
| GĐ-01 | Câu lệnh "Con {tên} đâu?"; lời khen "Đúng rồi, con {tên}!"; cầu nối "Giờ tìm con {tên} thật nào!" | 01, 02, 06 | ⚠️ |
| GĐ-02 | Thang gợi ý `independent(0)→gesture(1)→model(2)→partial_physical(3)→full_physical(4)`; hình đúng nổi lên = `gesture` | 02, 06 | ⚠️ |
| GĐ-03 | Chờ 5 giây trước gợi ý; 15 giây sau gợi ý; lặp câu lệnh 1 lần khi gợi ý | 01, 03, 06 | ⚠️ |
| GĐ-04 | Đạt trên iPad (theo mục): **5 buổi gần nhất**, ≥80% tự làm đúng, tổng ≥6 lượt. Cửa sổ 5 (không phải 3) vì 5 lượt/buổi chia cho pool 4 mục chỉ cho ~1,25 lượt/mục/buổi | 01, 06 | ⚠️ |
| GĐ-05 | Đạt ngoài đời: ≥2 xác nhận *Bé làm được* ở bậc 3 hoặc 4, vào ≥2 ngày khác nhau | 01, 02, 06 | ⚠️ |
| GĐ-06 | Một buổi = 1 vòng (bảng sao) 5 lượt; tối đa 2 vòng; iPad ≤10 phút; ngày của bé xong khi vòng 1 xong; tổng buổi 20–25 phút | 01, 06 | ⚠️ |
| GĐ-07 | Mục mới = `max(1, floor(0.3·N))` khi còn mục mới (N=5 → 1 mới + 4 đã biết); "đã biết" = ≥3 lượt | 01, 05, 06 | |
| GĐ-08 | Bé chạm được, chưa chắc kéo thả; MVP chỉ chạm; nhận tại `pointerup`, hit-slop 24 px, bỏ 150 ms đầu | 02, 04, 06 | |
| GĐ-09 | Chưa biết nhạy cảm giác quan; âm lượng mặc định 60%; tiệc có thể tắt chuyển động/âm | 03, 04 | |
| GĐ-10 | Thời gian iPad hiện tại không dùng để thiết kế; app giữ ≤10 phút/buổi | 01 | ⚠️ |
| GĐ-11 | 6 đồ cá nhân gợi ý: bình nước, dép, mũ, ba lô, khăn, gối | 02, 04 | ⚠️ |
| GĐ-12 | Tuần của app bắt đầu Thứ Hai; múi giờ Asia/Ho_Chi_Minh | 01, 06 | |
| GĐ-13 | iPad nằm ngang là chính; dọc hỗ trợ cơ bản | 03, 04, 05 | |
| GĐ-14 | MVP: linh vật SVG + Framer Motion; Rive từ P2 (API `<LacLac>` giữ nguyên) | 04, 05 | |
| GĐ-15 | Một iPad, một hồ sơ bé. Bao đã chốt: **không có màn thiết lập** — hồ sơ (`DEFAULT_CHILD` trong `src/data/starter.ts`) được tạo sẵn ở lần mở đầu tiên. Lược đồ vẫn hỗ trợ nhiều bé nên mở rộng sau chỉ cần thêm UI chọn hồ sơ | 03, 06 | |
| GĐ-16 | 4–6 phần thưởng thật do ba mẹ chọn, mỗi buổi ngẫu nhiên 2; phần thưởng ngoài iPad | 01, 03 | |
| GĐ-17 | Cắt Ú òa, Xếp tranh, `offline_guide` khỏi MVP vì ngân sách; theo phương án A của `07` §1.2 thì lấy lại ở tuần 5 (T24) | 01, 02, 07 | Bao duyệt |
| GĐ-18 | Chỉ nhận giấy phép Tự tạo / CC0 / MIT. **Pixabay Content License không đạt chuẩn** (không phải CC0 cũng không phải MIT) → không dùng | 04, 07 | |
| GĐ-19 | Công suất 22 giờ/tuần; 1 ndc = 4 giờ; ước lượng task theo bản 0.2 của `07` | 07 | |
| GĐ-20 | Hai lối vào chế độ ba mẹ: **nút thấy được** ở màn chờ S02 (giữ 1,5 giây) và **cổng vô hình** trong buổi học (giữ 3 giây, vùng 120×120 px góc trên-trái). Không phải ranh giới bảo mật. Bản đầu chỉ có cổng vô hình, thử trên iPad thật thì ba mẹ không tìm ra đường vào | 01, 03, 04 | |
| GĐ-21 | Ngày luyện = bảng 1 xong, **hoặc** tổng thời gian các buổi trong ngày ≥ 5 phút, **hoặc** có xác nhận cầu nối bậc ≥2 trong ngày | 01, 06 | ⚠️ |
| GĐ-22 | Điều mới của tuần mở ở lần xong ngày đầu tiên của tuần; tuần bỏ lỡ vẫn được cấp ở các lần xong ngày kế tiếp (tối đa 1 mục/ngày), không mất; MVP chỉ ghi dữ liệu | 01, 06 | |
| GĐ-23 | Sao lưu là zip không mã hóa; ghi âm giọng bé mặc định không đưa vào | 06 | |
| GĐ-24 | Cảnh báo thiên vị khi >80% lượt chọn đầu cùng một vị trí, ≥5 lượt (một buổi) hoặc ≥15 lượt (3 buổi) | 01, 03, 06 | |
| GĐ-25 | Nhắc lịch P2 dùng `.ics` hoặc Worker không lưu trạng thái | 08 | |
| GĐ-26 | `VocalClip` có trong lược đồ nhưng MVP không ghi | 02, 06 | |
| GĐ-27 | Lượt đầu của vòng là mục đã biết (khởi động dễ) nếu có; đổi được bằng `scheduling.firstTrialKnownItem` trong JSON bài | 06 | ⚠️ |
| GĐ-28 | Mục nhắc cầu nối: ưu tiên mục đã đạt trên iPad mà chưa đạt ngoài đời, nếu không thì mục mới nhất của vòng | 03, 06 | ⚠️ |
| GĐ-29 | Ưu tiên cấu hình: `ChildSettings.*Override` (ba mẹ sửa ở S19) thắng `ExerciseConfig`; `Session.configSnapshot` ghi giá trị hiệu lực | 06, 05 | |
| GĐ-30 | Chọn bài cho mỗi vòng: xoay vòng trong `WeeklyGoal.exerciseIds`, ưu tiên bài lâu nhất chưa chạy trong tuần | 06 | ⚠️ |
| GĐ-31 | 18 bài của cô (`10`) ánh xạ sang **5 loại trò**: `choose_from_two` (bài 5, 7, 9), `peekaboo` (1), `say_name` (13), `sequence_cards` (6), `coach_demo` (12 bài còn lại). Tất cả thuộc đợt 1 vì cả 5 trò đã chạy được | 01, 02, 10 | |
| GĐ-32 | Câu ba mẹ đọc gắn vào **bài**, không gắn vào mục (`ExerciseConfig.spoken`, hỗ trợ `{label}`). Một mục nằm trong nhiều bài với câu khác nhau: con bò vừa là "Chỉ vào con bò" vừa là "Con gì đây?" vừa là "ú òa". Ba mẹ tự sửa câu của mục thì câu của ba mẹ thắng (`Item.textsEditedAt`) | 06, 10 | |
| GĐ-33 | Bài khai loại trò hoặc detector app chưa cài thì bị loại khỏi buổi (`canRun`), và mọi lỗi trong buổi bị `SessionBoundary` chặn. Lý do: thử trên máy thật, bài khai `touch_reveal` chưa đăng ký cho bé một màn chạm không ăn, và bài xếp thẻ thiếu thẻ làm trắng cả app | 05, 01 | |
| GĐ-34 | Mừng khi bé làm đúng: tiếng hoan hô tổng hợp bằng Web Audio (vỗ tay + 4 nốt đi lên, ≤1,6 giây) và sao bung ra một lần. **Không phải giọng người** — giọng chỉ đến từ bản thu của ba mẹ. Ba mẹ chọn mức ở `ChildSettings.celebrationLevel` (`fun` mặc định / `calm`) | 04, 01 | |

## 5. Tự kiểm khả thi

| Câu hỏi | Trả lời |
|---|---|
| MVP có xong được trong 3 tuần với 1 người không? | **Không.** Rà lại ước lượng ở `07` 0.2: phạm vi đầy đủ F-01…F-18 (đã cắt GĐ-17) = **19,0 ndc**, công suất 3 tuần = 16,5 ndc. Đề xuất phương án A: thêm tuần 5, cổng dời sang 27/11; hoặc phương án B/C ở `07` §1.2 — **cần Bao chọn** |
| Phần bị cắt | Theo phương án A: không cắt vĩnh viễn gì; Ú òa, Xếp tranh, `offline_guide` (GĐ-17) làm ở tuần 5 (T24) và bị bỏ trước nếu hụt thời gian. Nông trại hiển thị, nhắc lịch, biểu đồ, tóm tắt tuần vẫn thuộc P2 đúng như brief |
| Rủi ro lớn nhất | R-13 (trễ), R-01/R-02 (bé không hứng thú/quá kích thích), R-14 (mất dữ liệu), R-06 (sai lệch với cô giáo) |
