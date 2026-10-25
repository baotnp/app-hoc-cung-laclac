# 03 — Luồng màn hình & UX

> Phiên bản 0.1 — nháp chờ Bao duyệt. Quy ước: **chế độ bé** (không chữ, ảnh thật, yên tĩnh), **chế độ ba mẹ** (có chữ, thông tin). `GĐ-xx` xem `08`.

## 1. Sơ đồ màn hình

```mermaid
flowchart LR
  S01["S01 Chạm để bắt đầu<br/>/start"] --> S02["S02 Màn chờ của bé<br/>/home"]
  S02 -. "giữ 3 giây" .-> S11{{"S11 Cổng ba mẹ"}}
  S11 --> P["S03 Trang ba mẹ<br/>/parent"]
  P --> R["S04 Sẵn sàng buổi học<br/>/parent/ready"]
  P --> C["S14 Nội dung<br/>/parent/content"]
  P --> G["S18 Mục tiêu tuần<br/>/parent/goals"]
  P --> T["S13 Tiến độ<br/>/parent/progress"]
  P --> B["S20 Sao lưu<br/>/parent/backup"]
  P --> ST["S19 Cài đặt<br/>/parent/settings"]
  R -->|"Đưa iPad cho bé"| S05
  subgraph SESS["Buổi học (chế độ bé)"]
    S05["S05 Chọn phần thưởng<br/>/session/reward"] --> S06["S06 Đầu tiên – Sau đó<br/>/session/first-then"]
    S06 --> S07["S07 Lượt chơi + bảng sao<br/>/session/trial"]
    S07 --> S08["S08 Màn tiệc<br/>/session/party"]
    S08 --> S09["S09 Cầu nối<br/>/session/bridge"]
    S09 -->|"bảng tiếp"| S07
    S09 -->|"xong"| S10["S10 Nghi thức kết thúc<br/>/session/goodbye"]
    S10 --> S12["S12 Linh vật ngủ<br/>/session/sleep"]
  end
  S12 -. "giữ 3 giây" .-> S11
  S11 -->|"sau buổi"| RV["S15 Xem lại buổi<br/>/parent/review/:id"]
  C --> CI["S16 Sửa mục<br/>/parent/content/:id"]
  CI --> PH["S17 Ảnh"]
  CI --> RC["S17b Thu âm"]
  S02 -. "route lazy" .-> F["S21 Nông trại<br/>/farm (rỗng ở MVP)"]
```

| ID | Màn | Chế độ | Nội dung chính | Tương tác |
|---|---|---|---|---|
| S01 | Chạm để bắt đầu | Bé | Linh vật ngủ ở giữa, 1 vòng sáng nhẹ | Chạm bất kỳ → mở khóa âm thanh, linh vật thức dậy vẫy tay |
| S02 | Màn chờ | Bé + thanh ba mẹ ở mép dưới | Linh vật idle; **nút "Giữ 1,5 giây để mở trang ba mẹ"** luôn thấy ở mép dưới | Chạm linh vật → gật đầu (không bắt đầu gì); ba mẹ nhấn giữ nút để vào S03 |
| S03 | Trang ba mẹ | Ba mẹ | Nút "Bắt đầu buổi học", thẻ tuần (x/5 ngày), lối tắt | Chạm |
| S04 | Sẵn sàng | Ba mẹ | Danh sách bài hôm nay, 4 bước buổi học, gợi ý mở đầu bằng người thật | "Đưa iPad cho bé" |
| S05 | Chọn phần thưởng | Bé | 2 ảnh phần thưởng lớn | Chạm 1 hình |
| S06 | Đầu tiên – Sau đó | Bé | 2 ô: [Học cùng Lạc Lạc] → [hình thưởng đã chọn] | Tự chuyển sau giọng ba mẹ (~4 giây) |
| S07 | Lượt chơi | Bé | Bảng sao 5 ô, 2 hình lựa chọn | Chạm |
| S08 | Màn tiệc | Bé (rộn ràng) | Xem mục 5 | Không có |
| S09 | Cầu nối | Hai lớp: lớp bé (không chữ) + thanh ba mẹ | Linh vật + ảnh mục vừa học + giọng "Giờ tìm con chó thật nào!" | Ba mẹ nhấn giữ thanh xác nhận |
| S10 | Nghi thức kết thúc | Bé | Linh vật vẫy tay → ô "Sau đó" → ngủ | Không có |
| S12 | Linh vật ngủ | Bé | Hình tĩnh | Chạm → "zzz" nhẹ, không làm gì khác |
| S11 | Cổng ba mẹ | Cả hai | Vòng tiến trình mờ | Giữ 3 giây |
| S13 | Tiến độ | Ba mẹ | Xem mục 8 | |
| S15 | Xem lại buổi | Ba mẹ | Danh sách lượt, sửa mức gợi ý, ghi chú | |
| S14–S17b | Nội dung / ảnh / thu âm | Ba mẹ | Xem mục 7 | |
| S18 | Mục tiêu tuần | Ba mẹ | Chọn 2–3 bài; số ngày; số phút | |
| S19 | Cài đặt | Ba mẹ | Âm lượng tổng/tiệc, tắt chuyển động, tiệc yên lặng, chất lượng, ghi đè thời gian chờ, **danh sách phần thưởng thật (`rewardKeys`, chọn từ mục `category='reward'`)**, hướng dẫn Guided Access/cài PWA | |
| S20 | Sao lưu | Ba mẹ | Xem mục 9 | |
| S21 | Nông trại | Bé | Màn rỗng (MVP) | |
| — | *(Không có màn thiết lập)* | — | App chỉ dùng cho một bé nên hồ sơ (`DEFAULT_CHILD`: Lạc, 2024-01) và gói khởi đầu được tạo sẵn ở lần mở đầu tiên. Khôi phục sao lưu nằm ở S20 | |

Màn lượt chơi (S07), hướng ngang:

```text
┌──────────────────────────────────────────────────────────┐
│  ★ ★ ☆ ☆ ☆                                    (cao ~10%) │
│ ┌──────────────────────┐ ┌──────────────────────┐        │
│ │                      │ │                      │        │
│ │      ảnh A           │ │      ảnh B           │  ~76%  │
│ │  (≥1/3 diện tích)    │ │  (≥1/3 diện tích)    │        │
│ └──────────────────────┘ └──────────────────────┘        │
│ ◌ cổng ba mẹ (ẩn)                       linh vật ló ra   │
└──────────────────────────────────────────────────────────┘
```

Hướng dọc: hai hình xếp trên-dưới, cùng quy tắc diện tích (GĐ-13).

## 2. Bắt đầu buổi học

```mermaid
flowchart TD
  A["Mở app (nguội)"] --> B["S01 Chạm để bắt đầu"]
  B -->|"chạm = mở khóa AudioContext + phát silent buffer"| C["ensureStarterPack(): tạo hồ sơ bé nếu chưa có + nạp bài"]
  C --> E["S02 Màn chờ"]
  E -->|"ba mẹ giữ 3 giây"| F["S03 Trang ba mẹ"]
  F -->|"Bắt đầu buổi học"| G{"Hôm nay có buổi đang dở?"}
  G -->|có| H["Hỏi: tiếp tục / đóng buổi cũ"]
  G -->|không| I["ItemScheduler.planRound -> Session mới (status=active)"]
  H --> I
  I --> J["S04 Sẵn sàng: mở đầu bằng người thật (ba mẹ làm)"]
  J -->|"Đưa iPad cho bé"| K["Vào chế độ bé, khóa điều hướng"]
  K --> L["S05 Chọn phần thưởng: 2 ảnh ngẫu nhiên từ danh sách ba mẹ cài"]
  L -->|"bé chạm 1 hình"| M["Ghi Session.rewardChoice"]
  M --> N["S06 Đầu tiên – Sau đó, giọng ba mẹ"]
  N --> O["S07 Lượt chơi đầu"]
```

| Quy tắc | Chi tiết |
|---|---|
| Cold launch luôn qua S01 | iOS chỉ cho phát âm thanh sau một chạm (`04`, `05`) |
| Không có nút "Chơi" cho bé ở S02 | Buổi học do ba mẹ dẫn (nguyên tắc: ba mẹ luôn ngồi cùng) |
| S05 | Nếu bé không chạm sau 10 giây: hình ngẫu nhiên nổi nhẹ; nếu vẫn không chạm sau thêm 10 giây, ba mẹ có thể chạm hộ (ghi `rewardChoiceBy='parent'`) |
| S06 | Hiển thị đúng 2 ô; "Sau đó" **luôn** là hoạt động ngoài iPad (GĐ-16) |

## 3. Vòng lặp một lượt

```mermaid
stateDiagram-v2
  [*] --> Showing : lượt bắt đầu
  Showing --> Instructing : hình hiện xong (300 ms)
  Instructing --> Waiting : câu lệnh phát xong, bắt đầu đếm
  Waiting --> Reward : chạm hình đúng
  Waiting --> Cueing : chạm hình sai
  Waiting --> Cueing : hết 5 giây (waitBeforeCueMs)
  Cueing --> AwaitingAfterCue : hình đúng nổi lên, lặp câu lệnh 1 lần
  AwaitingAfterCue --> Reward : chạm hình đúng
  AwaitingAfterCue --> Parked : hết 15 giây không chạm
  Parked --> Reward : ba mẹ giúp bé chạm
  Reward --> NextTrial : thưởng xong (≤1,2 giây)
  NextTrial --> Showing : còn lượt
  NextTrial --> RoundComplete : đủ 5 lượt
  RoundComplete --> [*] : sang màn tiệc
  Waiting --> ParentMenu : nhấn giữ cổng
  AwaitingAfterCue --> ParentMenu : nhấn giữ cổng
  ParentMenu --> Waiting : tiếp tục
  ParentMenu --> [*] : dừng buổi
```

| Trạng thái | Việc app làm | Ghi dữ liệu |
|---|---|---|
| Showing | Hai ảnh mờ dần vào 300 ms. Vị trí đích theo `ItemScheduler` (xáo trộn cân bằng) | `displayed[]`, `targetSlot` |
| Instructing | Phát câu lệnh giọng ba mẹ. Chạm lúc này bị gắn `phase='before_audio_end'`, không tính lựa chọn đầu | `instructionStartMs/EndMs` |
| Waiting | Đếm `waitBeforeCueMs` (mặc định 5000). Chạm: phản hồi chạm trung tính (nhún 2%) cho cả hai hình, **không âm** | `touches[]` |
| Cueing | Hình đúng nổi nhẹ (scale 1→1,06, ≤600 ms, không rung/nháy). Lặp câu lệnh 1 lần. Hình sai giữ nguyên (không mờ, không đỏ) | `appCue{reason,atMs}`; `promptLevel='gesture'` |
| AwaitingAfterCue | Chờ chạm hình đúng; chạm hình sai: không phản hồi thêm | `touches[]` |
| Parked | Không làm gì thêm: không tiếng, không chữ. Ba mẹ tự cầm tay hoặc dừng | `parked=true` |
| Reward | Hình đúng sáng nhẹ; linh vật gật đầu; giọng ba mẹ: "Đúng rồi, con chó!"; sao sáng + "ting" | `completedAt`, `latency` |
| NextTrial | Tự động, ghi `Trial`. Ghi Session snapshot (khôi phục khi crash) | `trials`, `sessions` |

Quy tắc liên quan: nếu bé chạm cùng một bên > 80% số lượt, ghi cờ và hiển thị cảnh báo cho ba mẹ **sau buổi** (không làm gián đoạn bé) — GĐ-24.

## 4. Bước cầu nối

```mermaid
flowchart TD
  A["Sau tiệc của một bảng"] --> B["Chọn mục để nhắc"]
  B --> B1{"Có mục đạt trên iPad mà chưa đạt ngoài đời?"}
  B1 -->|có| C["Mục đó"]
  B1 -->|không| D["Mục mới nhất của bảng"]
  C --> E["S09: linh vật + ảnh mục + giọng ba mẹ: Giờ tìm con chó thật nào!"]
  D --> E
  E --> F["Thanh ba mẹ (ẩn, nhấn giữ 0,6 giây để hiện)"]
  F --> G{"Ba mẹ chọn"}
  G -->|"Để sau"| Z["Không ghi gì, tiếp tục"]
  G -->|"Đã làm ngoài đời"| H["Chọn bậc: 2 Thẻ giấy / 3 Đồ thật / 4 Tự nhiên"]
  H --> I["Chọn kết quả: Bé làm được / Cần giúp / Chưa"]
  I --> J["Ghi GeneralizationCheck (level, result, confirmedBy, date)"]
  J --> K{"Đạt ngoài đời theo GĐ-05?"}
  K -->|có| L["Tạo Milestone + linh vật vui nhẹ"]
  K -->|không| Z
  L --> Z
  Z --> M{"Chơi thêm 1 bảng? (chỉ khi iPad còn ≥2 phút so với ipadMaxMinutes và < maxRoundsPerSession)"}
  M -->|có| N["Về S07"]
  M -->|không| O["S10 Nghi thức kết thúc"]
```

- Màn S09 là nơi **ba mẹ rời iPad cùng bé** để tìm đồ thật; không có đếm giờ, không có áp lực.
- Thanh xác nhận chỉ hiện khi nhấn giữ nhẹ để bé không bấm nhầm.
- "Để sau" và "Chưa" đều hợp lệ; không ghi lỗi, không hiện đỏ.
- Trong MVP, gợi ý cách làm ở bậc 2/3/4 là văn bản mẫu gắn từng bài (`bridge.levels` trong JSON, `06` §4.2). ⚠️ CẦN XÁC NHẬN nội dung với cô giáo.
- S09 chạy **hai lớp**: lớp của bé (linh vật + ảnh mục, **không chữ**) và thanh xác nhận của ba mẹ (`data-ui="parent"`), chỉ hiện sau khi nhấn giữ 0,6 giây và tự ẩn sau khi chọn. Quy tắc "không chữ ở chế độ bé" (`04` §2) áp dụng cho lớp của bé; lớp ba mẹ được phép có chữ.

## 5. Màn tiệc (5–8 giây, khung cố định)

```mermaid
flowchart LR
  A["Sao thứ 5 sáng"] --> B["0,5 s: nền mờ chuyển sang tông rộn ràng"]
  B --> C["0,5-2 s: Lạc Lạc nhảy + bong bóng bay lên + đoạn nhạc ngắn"]
  C --> D["2-6 s: các con vật vừa học chạy qua, mỗi con kèm tiếng kêu"]
  D --> E["6-7 s: Lạc Lạc vẫy tay"]
  E --> F["7 s: nền trở lại tông yên tĩnh -> S09 Cầu nối"]
```

| Thành phần | Giá trị | Biến tấu hằng ngày (nhẹ) |
|---|---|---|
| Tổng thời lượng | 5–8 giây, mục tiêu 7 | Không đổi |
| Khung (thứ tự bước) | Cố định | Không đổi |
| Màu bong bóng | 4 bảng màu | Xoay vòng theo ngày |
| Điệu nhảy | 1 mặc định | + điệu mới theo tuần (giai đoạn 2) |
| Con vật chạy qua | Tối đa 3, từ các mục xuất hiện trong bảng | Theo bảng |
| Âm lượng | `partyVolume` (mặc định 60%, GĐ-09) | — |

| Biến thể giác quan | Hành vi |
|---|---|
| "Tắt chuyển động" | Khung tĩnh (linh vật + con vật) chuyển mờ, không bong bóng, không hạt; phần âm giữ nguyên |
| "Tiệc yên lặng" | Giữ nguyên phần hình; bỏ nhạc tiệc; chỉ còn tiếng kêu con vật ở âm lượng nhỏ |
| Chất lượng "nhẹ" | Ít hạt (40 thay vì 120), không bóng đổ |
| Cấm | Nhấp nháy >2 lần/giây, đỏ chói toàn màn, rung màn hình |

Bé không thể bỏ qua tiệc (≤8 giây). Ba mẹ có thể dừng bằng cổng 3 giây.

## 6. Chuyển màn & nghi thức kết thúc

```mermaid
sequenceDiagram
  participant App
  participant Lac as Lạc Lạc
  participant Be as Bé
  participant Me as Ba mẹ
  App->>Lac: Bước cầu nối xong -> trạng thái wave
  Lac->>Be: Vẫy tay (giọng ba mẹ: Tạm biệt nhé!)
  Be-->>Lac: (bé vẫy lại - không chấm ở MVP)
  App->>Be: Hiện lại ô "Sau đó" (hình thưởng bé đã chọn) + giọng ba mẹ
  Lac->>Lac: Ngáp -> ngủ
  App->>App: Màn tối nhẹ dần 2 giây -> S12
  Me->>App: Giữ 3 giây (cổng)
  App->>Me: S15 Xem lại buổi (sửa mức gợi ý, ghi chú)
```

| Quy tắc chuyển màn | Giá trị |
|---|---|
| Kiểu chuyển | Chỉ mờ dần (cross-fade) 300–400 ms. Không trượt, không lật, không zoom |
| Chuyển yên tĩnh ↔ rộn ràng | Đi qua nền trơn trung tính, 300 ms |
| Âm thanh khi chuyển | Fade-out 100 ms trước khi đổi màn |
| S12 (ngủ) | Không có tương tác bắt đầu thêm; chạm = "zzz" nhẹ |
| Kết thúc sớm do ba mẹ | Chạy nghi thức rút gọn (vẫy tay → ngủ); `Session.status='stopped_by_parent'`; **không** hiện từ "thất bại" |
| Hết thời gian iPad (≥10 phút) | Sau lượt hiện tại, sang tiệc (nếu đủ 5 sao) hoặc nghi thức rút gọn; không cắt giữa lượt |

## 7. Chế độ ba mẹ, nội dung (thu âm + chụp ảnh)

### 7.1 Vào chế độ ba mẹ

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Pressing : pointerdown 1 ngón trong vùng cổng (trong buổi)
  Idle --> PressingVisible : pointerdown trên nút ba mẹ ở S02
  Pressing --> Idle : nhả < 3 giây / thêm ngón / kéo ra ngoài
  Pressing --> Ring : sau 0,5 giây hiện vòng tiến trình mờ
  PressingVisible --> Idle : nhả < 1,5 giây
  PressingVisible --> Unlocked : đủ 1,5 giây
  Ring --> Idle : nhả < 3 giây
  Ring --> Unlocked : đủ 3 giây
  Unlocked --> ParentHome : S02/S12 (ngoài buổi)
  Unlocked --> PauseMenu : đang trong buổi
  PauseMenu --> Session : Tiếp tục
  PauseMenu --> ParentHome : Dừng buổi (không có chữ thất bại)
  ParentHome --> Idle : 5 phút không chạm -> về S02
```

Có **hai lối vào**, cùng mục đích là ngăn bé vô tình vào chứ không phải bảo mật (GĐ-20):

| Lối | Ở đâu | Giữ | Vì sao |
|---|---|---|---|
| Nút thấy được | S02 màn chờ, mép dưới | 1,5 giây | Màn chờ không phải màn học; cổng vô hình ở đây làm **ba mẹ** không tìm ra đường vào (đã xảy ra trên iPad thật) |
| Cổng vô hình | Các màn trong buổi học, vùng 120×120 px góc trên-trái, không có hình ảnh | 3 giây | Trong buổi phải tuyệt đối không có gì để bé chạm nhầm |

Ngoài ra Guided Access khóa thoát app (xem `05`).

### 7.2 Chụp/nhập ảnh nội dung

```mermaid
flowchart TD
  A["S14 Nội dung: chọn mục hoặc Thêm mục"] --> B["S16 Sửa mục: thẻ kiểm tra Ảnh / Câu lệnh / Lời khen / Tiếng kêu"]
  B --> C["Ảnh: Chọn từ Ảnh hoặc Chụp"]
  C --> D["Thẻ hướng dẫn: nhấn giữ đồ vật trong Ảnh để tách chủ thể -> Sao chép/Lưu -> chọn lại ở đây"]
  D --> E["File input accept=image/*"]
  E --> F["Xem trước trên nền trơn"]
  F --> G["Xử lý: decode, resize ≤1200 px, xóa EXIF/GPS bằng canvas, giữ alpha nếu có"]
  G --> H["Lưu Blob vào media; gắn Item.imageMediaId"]
  H --> B
```

### 7.3 Thu âm

```mermaid
flowchart TD
  A["S16 Chọn vai âm: Câu lệnh / Lời khen / Cầu nối / Tiếng kêu"] --> B["Gợi ý câu mẫu (GĐ-01): Con chó đâu? / Đúng rồi, con chó! / Giờ tìm con chó thật nào!"]
  B --> C{"Quyền micro?"}
  C -->|chưa| D["Xin quyền; nếu từ chối: hướng dẫn bật trong Cài đặt"]
  C -->|có| E["Chạm để thu (tối đa 5 giây), thấy mức âm"]
  D --> E
  E --> F["Nghe lại"]
  F -->|"Thu lại"| E
  F -->|"Dùng bản này"| G["Tính gain chuẩn hóa -> lưu Blob + MediaAsset.gain"]
  G --> H["Gắn vào Item.audio[role]"]
  H --> A
```

Lưu ý: một mục có thể có nhiều câu lệnh/lời khen (xoay vòng) để tránh lặp máy móc; MVP khuyến nghị tối thiểu 1 câu lệnh + 2 lời khen. ⚠️ CẦN XÁC NHẬN câu lệnh với cô giáo **trước** khi thu hàng loạt.

## 8. Xem tiến độ (MVP: bảng, không biểu đồ)

```mermaid
flowchart TD
  A["S03 Trang ba mẹ: thẻ tuần"] --> B["S13 Tiến độ (tuần này, chọn tuần khác)"]
  B --> C["Ngày luyện: x/5 vòng đầy / rỗng (trung tính)"]
  B --> D["Theo bài: tỷ lệ tự làm tuần này vs tuần trước"]
  B --> E["Mức gợi ý: phân bố % theo 4 tuần gần nhất"]
  B --> F["Mục: trạng thái Mới / Đang học / Đạt trên iPad / Đạt ngoài đời"]
  B --> G["Cảnh báo thiên vị vị trí (nếu có)"]
  B --> H["Cầu nối và cột mốc: danh sách theo ngày"]
  F --> I["Chi tiết mục: danh sách lượt gần nhất"]
  A --> J["S15 Xem lại buổi gần nhất"]
  J --> K["Sửa mức gợi ý / đánh dấu lượt không hợp lệ / ghi chú / gắn thẻ quan sát"]
```

| Khối | Dữ liệu (truy vấn ở `06` §5) | Ghi chú ngôn ngữ |
|---|---|---|
| Ngày luyện | `PracticeGoal` + `Q5` (GĐ-21) | "3/5 ngày" — không từ "bỏ lỡ" |
| Tỷ lệ tự làm | `Q1` | Hiển thị % và n lượt |
| Mức gợi ý | `Q2` | Kèm xu hướng (↗ ↘ →) trung tính |
| Thiên vị | `Q3` | "Bé chọn bên trái 5/5 lượt, nên hỏi cô giáo." (⚠️ không đưa lời khuyên lâm sàng) |
| Cầu nối | `GeneralizationCheck`, `Milestone` | Huy hiệu theo tiến bộ thật |

Thêm: nút "Ghi chú cho buổi gặp cô giáo" (văn bản tự do, lưu cục bộ). Báo cáo PDF để giai đoạn 3.

## 9. Sao lưu và khôi phục

```mermaid
flowchart TD
  A["S20 Sao lưu"] --> B{"Việc?"}
  B -->|"Sao lưu"| C["Chọn: gồm ảnh/âm thanh (mặc định bật); gồm ghi âm giọng bé (mặc định tắt, nếu có)"]
  C --> D["Gom bảng + media vào .zip trong Web Worker, thanh tiến trình"]
  D --> E["navigator.share({files}) hoặc tải về nếu share không có"]
  E --> F["Ghi AppMeta.lastBackupAt"]
  B -->|"Khôi phục"| G["Chọn file .zip"]
  G --> H["Kiểm tra manifest: format, formatVersion, sha256"]
  H -->|"sai/hỏng"| I["Báo lỗi rõ, không đổi dữ liệu"]
  H -->|"hợp lệ"| J["Xem trước: số bản ghi, ngày sao lưu, phiên bản app"]
  J --> K{"Chọn cách"}
  K -->|"Gộp (mặc định)"| L["Thêm bản ghi mới, giữ bản updatedAt mới hơn"]
  K -->|"Thay thế"| M["Xóa dữ liệu hiện tại rồi nạp (nhấn giữ để xác nhận)"]
  L --> N["Giao dịch Dexie; thành công -> tải lại app"]
  M --> N
  N --> O["Chạy migration nếu dbSchemaVersion cũ"]
```

Nhắc sao lưu: thẻ nhỏ ở trang ba mẹ khi `lastBackupAt` > 7 ngày, chữ trung tính ("Nên sao lưu để giữ dữ liệu của Lạc"); ẩn được trong 7 ngày; không bao giờ hiện cho bé.

## 10. Tình huống đặc biệt

| Tình huống | Hành vi |
|---|---|
| Âm thanh bị ngắt (khóa màn hình, cuộc gọi, chuyển app) | Tạm dừng lượt; hiện S01 "chạm để tiếp tục" (linh vật ngủ → thức); sau chạm, lặp lại câu lệnh của lượt hiện tại |
| Thiếu ảnh/giọng của một mục | Mục bị loại khỏi buổi; ba mẹ thấy "Thiếu: câu lệnh (con chó)" ở S04 |
| Không đủ 2 mục để chọn 1/2 | S04 báo cần thêm mục; buổi không bắt đầu |
| Mở app giữa buổi đang dở (crash) | `Session` cũ được đóng thành `abandoned` (các lượt đã ghi còn nguyên) hoặc ba mẹ chọn tiếp tục khi vào S04 |
| Mất dữ liệu (Safari xóa) | App dựng lại hồ sơ và gói khởi đầu (nội dung rỗng). Ba mẹ vào S04 sẽ thấy "chưa đủ nội dung" và khôi phục từ file sao lưu ở S20; thẻ nhắc sao lưu ở S03 cũng hiện lại |
| Ba mẹ muốn dừng giữa chừng | Cổng 3 giây → "Dừng buổi" → nghi thức rút gọn; buổi vẫn tính theo GĐ-21 nếu đủ 5 phút |
