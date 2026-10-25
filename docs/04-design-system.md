# 04 — Hệ thống thiết kế

> Phiên bản 0.1 — nháp chờ Bao duyệt. `GĐ-xx` xem `08`. Các con số kích thước/thời lượng là **điểm khởi đầu**, hiệu chỉnh sau buổi thử với bé (`07`). Quan sát nhạy cảm giác quan của bé là câu hỏi mở (Q-04).

## 1. Nguyên tắc

| # | Nguyên tắc | Hệ quả |
|---|---|---|
| 1 | **Màn học yên tĩnh, phần thưởng rộn ràng** | Hai bộ token tách biệt (`calm`, `festive`); hiệu ứng mạnh chỉ ở bộ `festive` |
| 2 | Bé không đọc | Chế độ bé không có chữ; mọi hướng dẫn qua hình + giọng ba mẹ |
| 3 | Không phạt | Không âm báo sai, không màu đỏ lỗi, không mất sao/phần thưởng |
| 4 | Giác quan an toàn | Không nhấp nháy, không rung màn hình, không đỏ chói; công tắc tắt chuyển động |
| 5 | Ba mẹ cần rõ ràng | Chế độ ba mẹ dùng chữ lớn, tương phản cao, tiếng Việt có dấu đầy đủ |
| 6 | Tự tạo hoặc CC0/MIT | Mọi tài nguyên ghi vào `ASSETS.md` |

## 2. Token — hai trạng thái

Chuyển trạng thái bằng thuộc tính gốc `data-mode="calm" | "festive"` (và `data-ui="parent"` cho chế độ ba mẹ). Mặc định `calm`.

```css
:root {
  /* ---- chung ---- */
  --radius-card: 28px;
  --radius-chip: 14px;
  --space-1: 8px;  --space-2: 16px;  --space-3: 24px;  --space-4: 32px;  --space-6: 48px;
  --ease-calm: cubic-bezier(0.4, 0, 0.2, 1);      /* không overshoot */
  --ease-festive: cubic-bezier(0.34, 1.4, 0.64, 1); /* overshoot nhẹ, chỉ trong tiệc */
}

/* ====== HỌC YÊN TĨNH ====== */
[data-mode="calm"] {
  --bg:            #EDE9DF;   /* nền trơn ấm, HSL S≈28% */
  --bg-soft:       #F2F0EA;   /* S≈23% */
  --stage-pad:     4vw;
  --card-w:        44vw;      /* 2 lựa chọn: mỗi hình ≥1/3 diện tích khung nhìn (44vw × 76vh ≈ 0,334) */
  --card-h:        76vh;
  --card-gap:      4vw;
  --star-off:      #D9D3C6;   /* S≈20% */
  --star-on:       #DDB65A;   /* vàng dịu, vật nhỏ */
  --cue-halo:      rgba(221, 182, 90, 0.28); /* lớp phủ trong suốt của --star-on quanh hình đúng khi nổi lên */
  --ink-child:     #3A352E;   /* dùng cho nét linh vật, biểu tượng */
  --dur-fade:      300ms;
  --dur-cue:       600ms;     /* hình đúng nổi lên */
  --dur-reward:    1200ms;    /* tối đa gật đầu + sao sáng */
  --scale-cue:     1.06;
  --scale-press:   0.98;
  --anim-loop-max-hz: 0.5;    /* trừ nhịp thở idle ~0,33 Hz */
}

/* ====== THƯỞNG RỘN RÀNG (chỉ màn tiệc, nông trại) ====== */
[data-mode="festive"] {
  --bg-a:    #FFF3D9;  --bg-b:  #FFE3C2;       /* nền sáng ấm, đổi mềm */
  --sun:     #FFD35C;  --coral: #FF8E72;       /* không dùng đỏ thuần */
  --sky:     #6EC5E9;  --lilac: #B79CF0;  --mint: #7FD1B9;
  --dur-party:     7000ms;   /* mục tiêu; 5–8 giây */
  --max-flash-hz:  2;        /* mọi thứ nhấp nháy ≤ 2 lần/giây */
  --particles-high: 120;     /* chất lượng cao */
  --particles-light: 40;     /* chất lượng nhẹ */
}

/* ====== CHẾ ĐỘ BA MẸ ====== */
[data-ui="parent"] {
  --p-bg:        #FAF8F3;
  --p-surface:   #FFFFFF;
  --p-border:    #DDD6C8;
  --p-ink:       #2A2723;   /* tương phản 14,0 trên p-bg */
  --p-ink-muted: #5E574D;   /* 6,72 trên p-bg */
  --p-accent:    #2F6F68;   /* 5,5 trên p-bg; 5,84 chữ trắng trên accent */
  --p-warn:      #8A6A00;   /* 4,78 trên p-bg — dùng cho nhắc nhở trung tính */
  /* KHÔNG có token "danger/đỏ" cho trạng thái của bé */
}
```

Tương phản trên là số đã tính bằng công thức WCAG; chữ nhỏ cho ba mẹ luôn ≥ 4,5:1.

| Token | Quy tắc bé (calm) |
|---|---|
| Độ bão hòa nền & vùng lớn | HSL S ≤ 30% |
| Vật nhỏ (sao, linh vật) | HSL S ≤ 66% |
| Ảnh nội dung | Ảnh thật trên nền trơn `--bg`; không viền đậm, không bóng đổ mạnh |
| Chữ trong chế độ bé | **Không có**. Ngoại lệ duy nhất: lớp của ba mẹ (`data-ui="parent"`) chồng lên màn bé — thanh xác nhận ở S09 và menu tạm dừng — chỉ hiện khi nhấn giữ |

### 2.1 Chuyển động (token JS cho Framer Motion)

```ts
export const motion = {
  calm: {
    fade:   { duration: 0.30, ease: [0.4, 0, 0.2, 1] },
    cue:    { duration: 0.60, ease: [0.4, 0, 0.2, 1] },  // scale 1 -> 1.06
    press:  { duration: 0.12 },                           // scale 0.98
    nod:    { duration: 0.60 },                           // y 6px, rotate 4°
  },
  festive: {
    jump:   { type: 'spring', stiffness: 260, damping: 14 },
    party:  { totalMs: 7000 },
  },
  reduced: { fade: { duration: 0.20 } }                   // khi bật "Tắt chuyển động"
} as const
```

## 3. Quy tắc chuyển động

| Quy tắc | Calm (học) | Festive (tiệc) |
|---|---|---|
| Thuộc tính được animate | `opacity`, `transform` (scale, translate nhỏ) | + hạt, nền chuyển màu mềm |
| Biên độ | scale ≤ ±6%, translate ≤ 24 px, xoay ≤ 6° | Linh vật scale ≤ 1,12; hạt tự do |
| Vòng lặp | Chỉ idle thở (±2%, ~3 giây/vòng) | Mỗi hiệu ứng ≤ 2 vòng, cả tiệc ≤ 8 giây |
| Nhấp nháy | **Cấm** | ≤ 2 lần/giây, không chớp toàn màn |
| Rung màn hình / lắc | **Cấm** | **Cấm** |
| Đỏ chói, thay đổi độ sáng toàn màn >10%/giây | **Cấm** | **Cấm** |
| Số lớp hạt đồng thời | — | ≤ 3 |
| Chuyển màn | Cross-fade 300–400 ms | Cross-fade qua nền trung tính |
| Sai (chọn khác / hết giờ) | Chỉ hình đúng nổi nhẹ; **không** làm mờ, đỏ, rung hình sai | — |

Công tắc **Tắt chuyển động** (ba mẹ bật; cũng tôn trọng `prefers-reduced-motion`): chỉ còn cross-fade 200 ms; linh vật đổi ảnh tĩnh theo trạng thái; tiệc chỉ còn chuyển mờ giữa các khung tĩnh; không bong bóng, không hạt. Công tắc áp dụng ở mọi lớp (kể cả linh vật, không ngoại lệ).

## 4. Quy tắc âm thanh

| Nhóm | Mục tiêu đỉnh (dBFS) | Ghi chú |
|---|---|---|
| Giọng ba mẹ (câu lệnh, lời khen) | −3 | Chuẩn hóa đỉnh bằng `gain` lưu theo clip (`MediaAsset.gain`); nghe giọng là chính |
| "Ting" của sao | −12 | 5 nốt marimba mềm tăng dần (C5 D5 E5 G5 A5), ≤ 400 ms; tự tạo, không dùng âm giống Duolingo |
| Tiếng kêu con vật | −9 | CC0; cắt ≤ 1,5 giây |
| Nhạc tiệc | −10 | 5–8 giây, tự tạo hoặc CC0; không lặp |
| Chạm trung tính | — | **Không có tiếng** (chỉ phản hồi hình nhún 2%) |
| Âm báo sai | — | **Không tồn tại** |

| Quy tắc | Giá trị |
|---|---|
| Nhạc nền | Mặc định **tắt**; không có nhạc nền ở màn học |
| Âm lượng tổng mặc định | 60% (GĐ-09), chỉnh được; `partyVolume` riêng |
| Tiệc yên lặng | Bỏ nhạc tiệc và hiệu ứng âm; giữ tiếng kêu con vật ở âm lượng nhỏ; **không đổi phần hình** (phần hình do "Tắt chuyển động" quyết định) |
| Phát đồng thời | ≤ 3 âm; khi giọng ba mẹ phát, các âm khác hạ 8 dB |
| Fade | vào 20 ms, ra 50 ms (chống tiếng "tách") |
| Khoảng cách giữa sự kiện âm | ≥ 300 ms (tránh dồn dập) |
| Giọng ba mẹ | **Luôn thu thật**, không tổng hợp/nhân bản giọng bằng AI |
| Linh vật | **Không có giọng riêng**; mọi lời nói là giọng ba mẹ |

## 5. Kích thước vùng chạm

iPad Pro 11" (M1): khung nhìn CSS 1194×834 (ngang) / 834×1194 (dọc); 1 CSS px ≈ 0,19 mm. Ba mẹ nên thử nghiệm với tay bé (Q-03).

| Phần tử | Tối thiểu | Khuyến nghị | Ghi chú |
|---|---|---|---|
| Hình lựa chọn (chế độ bé) | 44vw × 76vh (≈ 525 × 634 px ngang) | theo token | Mỗi hình ≥ 1/3 diện tích khung nhìn |
| Vật chạm khác của bé (nút AAC, hạt, khối…) | **96 × 96 px** (≈ 18 mm) | ≥ 140 px | Hiệu chỉnh theo quan sát buổi thử (Q-03) |
| Khoảng cách giữa hai vật chạm của bé | 32 px | 48 px | Tránh chạm nhầm |
| Vùng bắt chạm quanh hình (hit-slop) | +0 | +min(24 px, gap/2) | Không chồng lấn |
| Cổng ba mẹ | 120 × 120 px | — | Giữ 3 giây; vòng tiến trình hiện sau 0,5 giây |
| Nút ba mẹ | 48 × 48 px | 56 px | Trên chế độ ba mẹ |
| Thanh xác nhận trong buổi (ba mẹ) | 64 × 64 px, nhấn giữ 0,6 giây | — | Bé khó bấm nhầm |
| Hành động hủy dữ liệu | Nhấn giữ 1,5 giây + xác nhận | — | Không có "xóa nhanh" |

Quy tắc xử lý chạm của trẻ nhỏ (GĐ-08):
- Nhận lựa chọn tại `pointerup` nếu `pointerdown` cùng hình và dịch chuyển < 24 px (tránh quệt lòng bàn tay).
- Bỏ qua ngón thứ hai khi đã có ngón đang chạm; bỏ qua chạm trong 150 ms đầu của lượt.
- `touch-action: manipulation`, tắt chọn văn bản/menu giữ ảnh, tắt kéo ảnh.
- Ghi tọa độ chạm để phân tích độ chính xác sau này.

## 6. Kiểu chữ (chế độ ba mẹ)

| Thuộc tính | Giá trị |
|---|---|
| Họ chữ | Hệ thống: `-apple-system, "SF Pro Text", system-ui, sans-serif` (đủ dấu tiếng Việt, không tải font) |
| Nội dung (`body`) | 18 px / 1,5 |
| Nhãn, chú thích | 16 px / 1,5 (không nhỏ hơn 16 px) |
| Tiêu đề phụ `h3` | 22 px / 1,35, đậm 600 |
| Tiêu đề `h2` | 28 px / 1,3, đậm 600 |
| Tiêu đề `h1` | 36 px / 1,25, đậm 600 |
| Số liệu | `font-variant-numeric: tabular-nums` |
| Dòng | ≤ 68 ký tự mỗi dòng |
| Quy tắc | Không dùng đỏ cho kết quả của bé; không in nghiêng cho đoạn dài; line-height ≥ 1,3 để dấu tiếng Việt không bị cắt |

Văn phong: câu ngắn, trung tính, không phán xét ("Lạc đã chọn bên trái 5/5 lượt. Nên hỏi cô giáo." thay vì "Bé bị thiên vị"). Không dùng từ cấm (xem `09` §6).

## 7. Brief linh vật "Lạc Lạc"

**Hạt đậu phộng tròn có mắt và chân, hoàn toàn tự thiết kế.** Không giống Duolingo về hình dáng, màu sắc hay âm thanh.

### 7.1 Hình khối

| Phần | Mô tả |
|---|---|
| Thân | Hình "số 8" của củ đậu phộng: 2 thùy, thùy trên nhỏ hơn (≈ 85% đường kính thùy dưới), eo thắt rõ ≈ 78% bề ngang |
| Tỷ lệ | rộng : cao ≈ 1 : 1,4; viewBox mặc định 200 × 280 |
| Mặt | Trên thùy trên: 2 mắt oval dọc tối (12 × 18 đơn vị) có 1 chấm sáng nhỏ, **không lòng trắng**; miệng cong nhỏ; 2 má hồng nhạt |
| Vỏ | Chấm lưới nhạt (độ đục ≈ 6–8%) gợi vỏ đậu, không chữ |
| Tay | 2 tay ngắn tròn đầu (≈ 18 × 40), có khớp xoay cho vẫy/làm mẫu |
| Chân | 2 chân ngắn, giày tròn màu xanh ngọc |
| Không có | Mỏ, cánh, đuôi, lông mày giận, nước mắt, mồ hôi |

### 7.2 Bảng màu (calm dùng sắc dịu)

| Vai trò | Màu | Ghi chú |
|---|---|---|
| Vỏ chính | `#E4CCA6` | HSL S≈53% |
| Vỏ đậm (bóng, eo) | `#CFAE7C` | |
| Chấm vỏ | `#B98F5A` | độ đục thấp |
| Giày/viền nhấn | `#6FA8A0` | xanh ngọc, S≈25% |
| Má | `#E6B8A8` | HSL S≈55%; dùng nhạt |
| Mắt/miệng | `#3A352E` | |
| Điểm sáng mắt | `#FFFFFF` | |

Khác biệt với Duolingo (cần kiểm trước khi chốt): không phải chim, không dùng xanh lá tươi, không mắt tròn lòng trắng to, không mỏ, không giọng riêng, bộ âm thanh tự tạo.

### 7.3 Các trạng thái

| Trạng thái | Mô tả | Thời lượng / vòng | Dùng ở | MVP |
|---|---|---|---|---|
| `idle` | Thở ±2% scale, chớp mắt mỗi 4–6 giây | Vòng 3 giây | S02, S05, S09 | Có |
| `wake` | Từ ngủ → idle: mở mắt, vươn | 0,8 giây | S01 | Có |
| `nod` | Gật đầu: y 6 px, xoay 4°, 2 nhịp | 0,6 giây | Thưởng mỗi lượt, cầu nối | Có |
| `jump` | Nhảy: giãn–nén, scale ≤ 1,12 | 0,9 giây | Màn tiệc | Có |
| `wave` | Vẫy tay: tay xoay ±25°, 3 vòng | 1,5 giây | Nghi thức kết thúc, chào | Có |
| `yawn` | Ngáp, mắt khép dần | 1,0 giây | Nghi thức kết thúc | Có |
| `sleep` | Mắt nhắm (vòng cung), thở chậm, vầng trăng nhỏ cạnh | Vòng 4 giây | S01, S12 | Có |
| `peek` | Che mặt bằng hai tay, hé mắt | 1,5 giây | Ú òa | P2 đầu |
| `demo_*` | **Làm mẫu động tác:** `clap`, `hand_open`, `wave_demo`, `stand`, `sit`, `crawl_tunnel`, `walk_slow`, `hold_ball_walk` | 1–3 giây mỗi cái | `coach_demo` | P2 |

Không có trạng thái buồn/giận/khóc/thất vọng (quy tắc cấm, `01` §5.4). Khi ba mẹ dừng buổi hoặc bỏ ngày: linh vật chỉ `sleep`.

### 7.4 Quy trình dựng

1. Vẽ phác trên giấy/Figma (tuần 1, P0-4); chốt hình khối + bảng màu.
2. Xuất SVG nhiều lớp: `body`, `eyes`, `mouth`, `cheeks`, `armL`, `armR`, `legL`, `legR`, `shoes`, `dots`.
3. MVP: component `<LacLac state=... />` dùng SVG + Framer Motion (GĐ-14): mỗi trạng thái là một tập biến đổi trên các lớp.
4. P2: thay bằng Rive với state machine; **giữ nguyên API** `<LacLac state />` để thay không đụng màn hình.

## 8. Danh sách tài nguyên MVP

| Nhóm | Số lượng ước tính | Nguồn | Ghi chú |
|---|---|---|---|
| Linh vật (SVG nhiều lớp) | 1 bộ | Tự tạo | |
| Ảnh con vật nuôi: chó, mèo, bò, gà | 4 (nên có 2 ảnh/loài) | Ba mẹ tự chụp, hoặc nguồn CC0 (Openverse lọc CC0) | Nền trơn/tách chủ thể; ghi URL, tác giả, giấy phép, ngày tải |
| Ảnh đồ vật cá nhân của bé | 6 (GĐ-11) | Ba mẹ tự chụp | **Không commit lên git/Pages** — chỉ nhập qua app |
| Ảnh phần thưởng thật (hoạt động ưa thích) | 4–6 | Ba mẹ tự chụp | GĐ-16 |
| Biểu tượng (sao, vòng tiến trình, nút, trang trí) | ~15 | Fluent Emoji (MIT), Kenney (CC0), hoặc tự vẽ | Chỉ SVG |
| Hạt/hình tiệc (bong bóng, confetti) | ~6 | Tự tạo | Màu theo `festive` |
| Âm "ting" 5 nốt | 5 | Tự tạo (tổng hợp Web Audio hoặc thu nhạc cụ) | |
| Nhạc tiệc + sting | 1–2 | Tự tạo hoặc Freesound lọc CC0 | 5–8 giây |
| Tiếng kêu chó, mèo, bò, gà | 4 | Freesound (lọc CC0) | Cắt ≤ 1,5 giây, kiểm tra tai nghe + loa |
| **Giọng ba mẹ** | ~45–50 clip | Ba mẹ thu trong app | Mỗi mục: 1–2 câu lệnh, 2 lời khen, 1 câu cầu nối; 5–6 câu chung (đầu tiên–sau đó, tạm biệt, tiệc) |
| Biểu tượng ứng dụng | 192, 512, 180 (apple-touch), 1024 | Tự tạo | Linh vật |
| Mô hình 3D, nhạc nông trại | Không | Giai đoạn 2 (Quaternius, Kenney) | Chỉ dựng route |

### Mẫu `ASSETS.md`

```markdown
| ID | Tập tin | Mô tả | Nguồn / tác giả | URL | Giấy phép | Ngày lấy | Chỉnh sửa | Dùng ở |
|----|---------|-------|-----------------|-----|-----------|----------|-----------|--------|
| A-001 | public/ui/star.svg | Sao | Tự tạo | — | CC0 (tự tạo) | 2026-10-26 | — | Bảng sao |
| A-002 | starter/animal-dog.jpg | Ảnh chó | (tác giả) | https://… | CC0 1.0 | 2026-10-27 | Cắt, nền | COG-01 |
```

Quy tắc: không thêm file nào vào `public/` hoặc `src/assets/` nếu chưa có dòng trong `ASSETS.md`. Chỉ nhận **Tự tạo / CC0 / MIT**. **Không dùng Pixabay Content License** (không phải CC0 cũng không phải MIT: có điều khoản hạn chế bán lại và hình có người/thương hiệu) — GĐ-18.
