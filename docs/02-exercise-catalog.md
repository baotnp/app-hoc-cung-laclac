# 02 — Danh mục bài tập (18 bài)

> Phiên bản 0.2 — **đã đối chiếu `10-teacher-lessons.md`** (bản chép tài liệu cô giáo, 25/10/2026). Ký hiệu: `⚠️ CẦN XÁC NHẬN` (vẫn phải hỏi cô), `✅ Cô xác nhận` (đã có trong `10`), `GĐ-xx` (giả định, xem `08`), `P1/P2/P3` = giai đoạn.
> **Nguồn sự thật cho câu lệnh và các bước dạy là `10`.** Khi tài liệu này khác `10`, sửa tài liệu này theo `10`.
> Còn là giả định sau khi có tài liệu cô: **tiêu chí đạt** (GĐ-04/GĐ-05 — tài liệu không nêu ngưỡng %), **danh sách đồ cá nhân của bé** (GĐ-11 — tài liệu chỉ nêu ví dụ "cặp và dép"), tên các mức gợi ý (GĐ-02), nhạy cảm giác quan của bé.
> Không có bài nào được coi là kỹ năng "đạt" chỉ nhờ iPad.

## 1. Quy ước chung

### 1.1 Mã bài và kiểu trò

Mã bài (`code`) dùng làm khóa ổn định trong JSON và dữ liệu (`Exercise.code`).

| Nhóm | Mã | Bài | Kiểu trò (`type`) | GĐ triển khai |
|---|---|---|---|---|
| Bắt chước | IMI-01 | Chơi ú òa | `peekaboo` | P2 đầu (cắt khỏi MVP, GĐ-17) |
| | IMI-02 | Bắt chước cử động bàn tay | `coach_demo` | P2; P3 camera |
| | IMI-03 | Vẫy tay chào / tạm biệt | `coach_demo` | P2; P3 camera |
| Vận động tinh | FIN-01 | Nhặt hạt màu tự do | `coach_demo` | P2 |
| | FIN-02 | Lấy một đồ vật theo yêu cầu | `choose_from_two` (nhận biết) + ngoài đời | **P1** (nhận biết) |
| | FIN-03 | Xếp thẻ tranh thành hàng | `sequence_cards` | P2 đầu (cắt khỏi MVP) |
| Nhận thức – tiếp nhận | COG-01 | Chọn 1/2 hình con vật nuôi (chó, mèo, bò, gà) | `choose_from_two` | **P1** |
| | COG-02 | Làm theo yêu cầu đơn giản (đứng lên, ngồi xuống, bỏ rác) | `coach_demo` | P2; P3 camera |
| | COG-03 | Chọn 1/2 hình đồ vật cá nhân | `choose_from_two` | **P1** |
| Cá nhân – xã hội | SOC-01 | Chơi tương tác (chuyền bóng, xếp chồng khối) | `coach_demo` | P2 |
| | SOC-02 | Cắt trái cây mô hình cùng ba mẹ | `coach_demo` | P2 |
| | SOC-03 | Chơi xe tải cùng ba mẹ | `coach_demo` | P2 |
| Ngôn ngữ – lời nói | LAN-01 | Gọi tên con vật nuôi bằng từ đơn | `say_name` | P2; P3 micro |
| | LAN-02 | Xòe tay kết hợp nói "xin" | `coach_demo` | P2; P3 AAC+camera+micro |
| | LAN-03 | Nhờ giúp bằng cử chỉ hoặc "ạ" | `coach_demo` | P2; P3 AAC |
| Vận động thô | GRO-01 | Chui qua đường hầm | `coach_demo` | P2 |
| | GRO-02 | Đi bộ chậm một mình | `coach_demo` | P2 |
| | GRO-03 | Hai tay cầm bóng và bước đi | `coach_demo` | P2 |

`offline_guide` (bài chỉ có thẻ hướng dẫn + xác nhận, dùng lại màn cầu nối) làm vỏ cho mọi bài chưa có trò riêng, từ đầu P2.

### 1.2 Thang mức gợi ý (`PromptLevel`) — GĐ-02 ⚠️ CẦN XÁC NHẬN thứ tự và tên

| Mã | Tên VN | Số | Nghĩa chung | App tự ghi? |
|---|---|---|---|---|
| `independent` | Tự làm | 0 | Chỉ nghe câu lệnh, tự làm | Có |
| `gesture` | Chỉ | 1 | Có chỉ dẫn bằng chỉ/hình: ở app là **hình đúng nổi lên** hoặc linh vật chỉ | Có (khi app gợi ý) |
| `model` | Làm mẫu | 2 | Linh vật hoặc ba mẹ làm mẫu rồi bé làm | Từ P2 (khi bấm "làm mẫu"); MVP: chỉ ba mẹ sửa sau buổi |
| `partial_physical` | Cầm tay một phần | 3 | Ba mẹ đỡ/nhấc tay | **Chỉ ba mẹ sửa sau buổi** |
| `full_physical` | Cầm tay toàn phần | 4 | Ba mẹ cầm tay làm cùng | **Chỉ ba mẹ sửa sau buổi** |

Ghi chú theo loại bài:

| Loại bài | Chỉnh thang |
|---|---|
| Chọn hình | Đủ 5 mức; app tự ghi `independent` hoặc `gesture` |
| Bắt chước (IMI-02/03) | Mẫu của linh vật là một phần câu lệnh, **không** tính là gợi ý `model` ⚠️ CẦN XÁC NHẬN |
| Lời nói (LAN-01) | `partial_physical`/`full_physical` không áp dụng; `model` = ba mẹ nói mẫu để bé nhắc lại ⚠️ CẦN XÁC NHẬN |
| Vận động thô | Cả 5 mức; ba mẹ nhập |

### 1.3 Cầu nối 4 bậc (chung)

Bậc 1 diễn ra trên app; bậc 2–4 ba mẹ làm và bấm xác nhận (`GeneralizationCheck.level`).

| Bậc | Tên | Ý nghĩa | Ai ghi |
|---|---|---|---|
| 1 | iPad | Bé làm trên app (dữ liệu `Trial`) | App |
| 2 | Thẻ giấy | Cùng nội dung trên thẻ/ảnh in | Ba mẹ |
| 3 | Đồ thật | Đồ vật thật, mô hình, đồ chơi | Ba mẹ |
| 4 | Tình huống tự nhiên | Trong sinh hoạt thường ngày | Ba mẹ (hoặc cô giáo) |

Kỹ năng "đạt" khi thỏa GĐ-05 (≥2 xác nhận *Bé làm được* ở bậc 3/4 vào ≥2 ngày khác nhau) ⚠️ CẦN XÁC NHẬN. Kết quả xác nhận: `did_it` (Bé làm được) / `with_help` (Cần giúp) / `not_yet` (Chưa). Không có kết quả nào hiện bằng chữ "sai/thất bại".

### 1.4 Cách tính đúng chung

- **Tự làm đúng** = `correctFirstTry && promptLevel==='independent'`.
- Chọn hình: **đầu tiên** bé chạm đúng hình = `correctFirstTry`.
- Học không lỗi: mọi lượt kết thúc đúng; mức gợi ý thể hiện bé cần bao nhiêu hỗ trợ.
- Thời gian chờ trước gợi ý: 5 giây ở bài có lời nói (✅ cô ghi "đợi 3–5 giây" ở bài 13, 14, 15), 8–10 giây ở bài vận động vì bé cần thời gian di chuyển (GĐ-03). Sau gợi ý: dài hơn mốc chờ (15–30 giây).

### 1.5 Dữ liệu chung mọi bài (xem `06`)

Mọi lượt ghi: `exerciseId`, `targetItemId`, `displayed[]`, `firstChoice` (gồm `latencyMs`), `completedLatencyMs`, `promptLevel` (+ `promptLevelAuto`, `promptLevelSource`), `appCue`, `touches[]`, `valid`, `detectorKind`. Các mục "Dữ liệu ghi thêm" dưới đây nằm trong `Trial.gameData` (`06` §2.5) và chỉ liệt kê phần **khác** với mặc định.

### 1.6 Kiểu trò

| `type` | Cơ chế tương tác | `ResponseDetector` | GĐ |
|---|---|---|---|
| `choose_from_two` | Chạm | `touch_choice` | P1 |
| `peekaboo` | Chạm khăn + xác nhận phản ứng của ba mẹ | `touch_reveal`, `parent_confirm` | P2 đầu |
| `sequence_cards` | Kéo hoặc chạm-rồi-chạm | `touch_drag` | P2 đầu |
| `offline_guide` | Thẻ hướng dẫn + xác nhận | `parent_confirm` | P2 đầu |
| `coach_demo` | Hình minh họa + dải nhắc 3 bước cho ba mẹ, ba mẹ xác nhận | `parent_confirm` → `body_pose`/`hand_pose` (P3) | P2 — **12 bài**: IMI-02/03, FIN-01, COG-02, SOC-01/02/03, LAN-02/03, GRO-01/02/03 |
| `say_name` | Hình + chờ bé nói | `parent_confirm` → `voice_activity` (P3) | P2/P3 |
| `drag_to_jar`, `turn_taking`, `slice_fruit`, `drive_truck`, `aac_request` | Trò riêng cho FIN-01, SOC-01/02/03, LAN-02/03 | `touch_drag`, `touch_swipe`, `touch_button`… | **Chưa làm.** 18 bài hiện dùng `coach_demo` thay cho các kiểu này; giữ tên trong `ExerciseType` cho sau |

Cột `ResponseDetector` là **lộ trình thay thế theo giai đoạn**: mỗi lượt chỉ có **một** detector hoạt động (`Trial.detectorKind`, `ExerciseConfig.response.detector`). Mũi tên `→` nghĩa là bản P3 thay bản trước; dấu phẩy nghĩa là chọn một trong các bản tùy cấu hình bài.

---

## 2. Nhóm Bắt chước

### IMI-01 — Chơi ú òa (`peekaboo`, P2 đầu)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Chơi ú òa qua lại; chú ý và phản ứng với "òa!" |
| Câu của cô (`10`) ✅ | "Hôm nay chúng ta cùng nhau bắt chước chơi ú òa nhé!" · "ú òa" |
| 3 bước của cô (`10`) ✅ | **1** Rủ bé chơi. **2** Làm mẫu: che mặt bằng tay **hoặc phủ khăn lên đầu trốn**, mở khăn ra và nói "ú òa"; những lần đầu có thể cầm tay bé. **3** Để bé chủ động chơi ú òa cùng ba mẹ. |
| Loại trò trên iPad | `peekaboo` — bé chạm tấm khăn, khăn mở ra và hiện hình. |
| Trò & tương tác | Lạc Lạc che mặt bằng hai tay (hoặc khăn). Bé chạm khăn (hoặc ba mẹ chạm cùng bé) → "Òa!" (giọng ba mẹ). Ba mẹ cũng chơi ú òa thật xen kẽ. Hai người: lượt con / lượt mẹ lật khăn. |
| Cách tính đúng & gợi ý | Đúng = chạm khăn **hoặc** ba mẹ xác nhận phản ứng (nhìn, cười, đòi chơi tiếp) ⚠️ CẦN XÁC NHẬN định nghĩa "đúng". Gợi ý: `gesture` = khăn đung đưa nhẹ; `model` = ba mẹ ú òa trước; `partial_physical` = ba mẹ nắm tay chạm khăn. |
| Cầu nối | **B2** ú òa với ảnh/tấm bìa che mặt. **B3** ú òa với khăn thật và đồ chơi. **B4** ú òa tự nhiên với ba mẹ/anh chị/người quen. |
| Dữ liệu ghi thêm | `touch_reveal` (t, chạm khăn có/không), `parentTags[]` ∈ {`looked`,`smiled`,`asked_more`,`none`} ⚠️ CẦN XÁC NHẬN danh sách thẻ, số lần bé khởi xướng. |
| Giai đoạn | P2 đầu (cắt khỏi MVP, GĐ-17). |
| Bắt buộc ngoài đời | **Có, phần lớn.** Ú òa là tương tác mặt đối mặt (ánh mắt, cười, đòi tiếp); iPad chỉ làm mồi/mô phỏng. |

### IMI-02 — Bắt chước cử động bàn tay (`coach_demo`, P2; P3 camera)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Bắt chước cử động bàn tay mẫu. |
| Câu của cô (`10`) ✅ | "Hôm nay ba mẹ hướng dẫn con bắt chước các cử động của bàn tay nhé" · "bây giờ con làm giống ba/mẹ nhé" |
| 3 bước của cô (`10`) ✅ | **1** Ngồi đối diện, làm động tác **lắc bàn tay**, giữ nguyên tư thế mẫu. **2** Nếu bé khó làm theo, cầm tay bé hỗ trợ. **3** Lặp lại với **vẫy tay, gập tay**, giảm dần hỗ trợ. (Danh sách cử động ✅ đã có: lắc tay, vẫy tay, gập tay.) |
| Loại trò trên iPad | `coach_demo` — hoạt động ngoài đời; iPad hiện hình minh họa + nhắc ba mẹ từng bước, ba mẹ chấm. |
| Trò & tương tác | Lạc Lạc làm mẫu một cử động (vỗ tay, xòe tay, giơ tay… ⚠️ CẦN XÁC NHẬN danh sách cử động); âm thanh lệnh bằng giọng ba mẹ ("Làm như Lạc Lạc"). Ba mẹ xác nhận qua thanh xác nhận nhỏ nhấn giữ. P3: camera nhận tay (MediaPipe) gợi ý xác nhận. |
| Cách tính đúng & gợi ý | Đúng = bé làm cử động tương tự trong 5 giây sau mẫu ⚠️ CẦN XÁC NHẬN. Gợi ý: `gesture` = mẫu lặp chậm; `partial_physical`/`full_physical` = ba mẹ cầm tay (nhập sau). |
| Cầu nối | **B2** thẻ ảnh bàn tay làm mẫu. **B3** ba mẹ/búp bê làm mẫu bằng tay thật. **B4** bắt chước trong bài hát/trò chơi tự nhiên. |
| Dữ liệu ghi thêm | `poseId` (cử động), `parentConfirm` (có/không), P3: `detectorConfidence`. |
| Giai đoạn | P2 (`parent_confirm`), P3 (`hand_pose`). |
| Bắt buộc ngoài đời | **Có.** Bắt chước người thật là mục tiêu; mẫu linh vật 2D khác người thật về góc nhìn/độ phản hồi. |

### IMI-03 — Vẫy tay chào / tạm biệt (`coach_demo`, P2; P3 camera)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Vẫy tay khi chào và tạm biệt. |
| Câu của cô (`10`) ✅ | "Hôm nay con bắt chước ba mẹ vẫy tay chào hoặc tạm biệt nhé!" |
| 3 bước của cô (`10`) ✅ | **1** Ba mẹ **giơ 1 tay lên, xòe bàn tay ra rồi vẫy chào**, chú ý để bé nhìn vào tay. **2** Tận dụng lúc gặp người hoặc ra khỏi nhà để bé bắt chước. **3** Bé chủ động vẫy chào/tạm biệt **đúng tình huống**. |
| Loại trò trên iPad | `coach_demo`. |
| Trò & tương tác | Linh vật vẫy tay (đã dùng ở nghi thức kết thúc MVP). Bài P2: linh vật chào/tạm biệt và chờ bé vẫy lại; ba mẹ xác nhận. P3: nhận cử động vẫy bằng camera. |
| Cách tính đúng & gợi ý | Đúng = bé vẫy tay trong 5 giây sau chào ⚠️ CẦN XÁC NHẬN (có cần ngữ cảnh/nhìn?). Gợi ý: `model` = ba mẹ vẫy trước; `partial_physical` = đỡ khuỷu tay. |
| Cầu nối | **B2** thẻ hình người vẫy tay. **B3** vẫy với búp bê/thú bông và với ba mẹ. **B4** chào/tạm biệt khi có người đến/đi. |
| Dữ liệu ghi thêm | `context` ∈ {`hello`,`goodbye`}, `parentConfirm`. |
| Giai đoạn | P2; P3 camera. Nghi thức MVP chỉ là linh vật vẫy, không chấm bé. |
| Bắt buộc ngoài đời | **Có.** Chào hỏi chỉ có nghĩa với người thật, đúng thời điểm. |

---

## 3. Nhóm Vận động tinh

### FIN-01 — Nhặt hạt màu tự do (`coach_demo`, P2)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Nhặt hạt và bỏ vào lọ (màu tự do: không bắt phân biệt màu). |
| Câu của cô (`10`) ✅ | hiệu lệnh "Nhặt hạt" |
| 3 bước của cô (`10`) ✅ | **1** Làm mẫu nhặt hạt bỏ vào **hộp nhựa**, chậm 2–3 lần, kèm "Nhặt hạt". **2** Cầm tay bé nhặt hạt cho vào hộp. **3** Giảm dần hỗ trợ, thả tay khi bé tự làm được. |
| Loại trò trên iPad | `coach_demo` (trò kéo thả `drag_to_jar` để sau, không nằm trong 18 bài đã chốt). |
| Trò & tương tác | Hạt màu lớn rải trên nền; bé kéo hạt vào lọ (có vật lý nhẹ); mỗi hạt vào lọ phát tiếng "tách" mềm. Chưa biết bé kéo thả được chưa nên có chế độ chạm-rồi-chạm (GĐ-08). |
| Cách tính đúng & gợi ý | Đúng = hạt do bé kéo vào lọ. Gợi ý: `gesture` = hạt gần lọ nổi nhẹ; `model` = linh vật kéo 1 hạt; `partial_physical` = ba mẹ đỡ tay. |
| Cầu nối | **B2** khay in sẵn các vòng tròn để đặt hạt. **B3** hạt thật (đủ lớn) bỏ vào hộp. **B4** nhặt đồ nhỏ bỏ vào hộp khi dọn đồ chơi. |
| Dữ liệu ghi thêm | số hạt, thời gian mỗi hạt, `dragPathLen`, số lần thả hụt. |
| Giai đoạn | P2. |
| Bắt buộc ngoài đời | **Có.** Cầm nắm thật khác trượt trên kính; **an toàn:** hạt nhỏ gây nguy cơ hóc/nuốt cho bé dưới 3 tuổi, ba mẹ giám sát, chọn hạt đủ lớn ⚠️ CẦN XÁC NHẬN với cô. |

### FIN-02 — Lấy một đồ vật theo yêu cầu (`choose_from_two` nhận biết + ngoài đời, P1)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Hiểu tên đồ vật và đi lấy/đưa đúng đồ khi được yêu cầu. |
| Câu của cô (`10`) ✅ | "Lấy + tên đồ vật" · "Con hãy lấy + tên đồ vật" |
| 3 bước của cô (`10`) ✅ | **1** Làm mẫu: nói "Lấy + tên đồ vật" và thực hiện hành động lấy, vài lần với vài đồ. **2** Hỗ trợ bé lấy đúng đồ, cầm tay bé làm vài lần. **3** Giảm hỗ trợ, chỉ nói "Con hãy lấy + tên đồ vật" rồi chờ. **Lưu ý:** lấy được đồ ở gần rồi thì nhờ lấy đồ xa hơn. |
| Loại trò trên iPad | `choose_from_two`. |
| Trò & tương tác | Dùng lại `choose_from_two` với nhóm đồ vật hằng ngày và câu lệnh "Lấy {đồ vật}" (chỉ khác nội dung JSON). App chỉ gánh bước **nhận biết hình**; việc **lấy** là ngoài đời. |
| Cách tính đúng & gợi ý | Như COG-03. |
| Cầu nối | **B2** ba mẹ đưa 2 thẻ ảnh, bé chọn thẻ rồi đi lấy đồ. **B3** hai đồ thật trên bàn, bé lấy đồ được yêu cầu. **B4** "Lấy giày cho con" trong nhà. |
| Dữ liệu ghi thêm | Mặc định + `GeneralizationCheck` ở B2–B4. |
| Giai đoạn | **P1** (nhận biết); lấy thật là ngoài đời. |
| Bắt buộc ngoài đời | **Có, là phần chính.** Lấy là hành động vận động + định hướng trong không gian thật; iPad không thay được. |

### FIN-03 — Xếp thẻ tranh thành hàng (`sequence_cards`, P2 đầu)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Xếp các thẻ tranh **liền thành một hàng ngang** (✅ `10` trả lời Q-15: "thành hàng" = xếp liền một hàng ngang, **không** theo thứ tự nội dung). |
| Câu của cô (`10`) ✅ | "Hôm nay, ba mẹ và con cùng nhau chơi xếp tranh theo hàng nhé" · "xếp vào, xếp vào, xếp vào" |
| 3 bước của cô (`10`) ✅ | **1** Làm mẫu xếp tranh **thành hàng dài**, vừa làm vừa nói "xếp vào, xếp vào, xếp vào". **2** Cầm tay bé lấy tranh và xếp **theo hàng ngang**. **3** Thả dần tay, đưa tranh và yêu cầu bé xếp theo hàng. |
| Loại trò trên iPad | `sequence_cards` — bé kéo các thẻ vào một hàng ngang. |
| Trò & tương tác | 2–3 thẻ ảnh nằm phía dưới; một hàng ô trống phía trên. Kéo thẻ vào ô (hoặc chạm thẻ rồi chạm ô). Ô tự "hít" khi thả gần. |
| Cách tính đúng & gợi ý | Đúng = thẻ vào ô kế tiếp của hàng. Gợi ý: `gesture` = ô kế tiếp nổi nhẹ; `model` = linh vật xếp 1 thẻ; `partial_physical`. |
| Cầu nối | **B2** xếp thẻ giấy thật. **B3** xếp đồ vật thật (xe, khối) thành hàng. **B4** xếp giày dép, đồ chơi thành hàng khi dọn. |
| Dữ liệu ghi thêm | thứ tự thả, số lần thả sai ô, `dragPathLen`. |
| Giai đoạn | P2 đầu (cắt khỏi MVP, GĐ-17). |
| Bắt buộc ngoài đời | **Có.** Cầm thẻ thật, đặt thẳng hàng là kỹ năng vận động tinh cần bàn tay thật. |

---

## 4. Nhóm Nhận thức – ngôn ngữ tiếp nhận

### COG-01 — Chọn 1 trong 2 hình con vật nuôi (`choose_from_two`, **P1 lõi**)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Chọn đúng hình con vật theo tên (chó, mèo, bò, gà). |
| Câu của cô (`10`) ✅ | Giới thiệu: "Đây là con mèo, đây là con chó" · Yêu cầu: "Chỉ vào con [tên con vật]" hoặc "Lấy cho ba mẹ con [tên con vật]" |
| 3 bước của cô (`10`) ✅ | **1** Chỉ vào từng hình và gọi tên để bé nhớ lại, cho bé thời gian nhìn. **2** Đưa yêu cầu; **thử khoảng 5 lần, đảo vị trí các con vật**. **3** Nếu bé làm sai hoặc không phản ứng thì cầm bàn tay bé hướng dẫn, giảm dần hỗ trợ. **Lưu ý:** không để bé cắn/ngậm thẻ; bé chán thì đổi cặp con vật. |
| Loại trò trên iPad | `choose_from_two` — bé chạm 1 trong 2 hình. "Thử khoảng 5 lần" ✅ khớp `trialsPerRound: 5`, "đảo vị trí" ✅ khớp `positions.strategy`. |
| Trò & tương tác | 2 ảnh thật trên nền trơn, mỗi ảnh ≥1/3 màn hình. Giọng ba mẹ đọc đúng câu của cô. Bé chạm. Vị trí xáo trộn; hình còn lại là con vật khác trong nhóm. |
| Cách tính đúng & gợi ý | Đúng = chạm hình đúng đầu tiên. Sai hoặc chờ 5 giây → hình đúng nổi lên (mức `gesture`), câu lệnh lặp 1 lần, không âm báo sai. Thưởng: gật đầu + "Đúng rồi, con chó!" + "ting". |
| Cầu nối | **B2** thẻ giấy in chó/mèo, hỏi "Con chó đâu?". **B3** đồ chơi/mô hình con chó và con mèo. **B4** thấy chó thật, sách, tranh trong nhà/ngoài đường. Linh vật nhắc "Giờ tìm con chó thật nào!". |
| Dữ liệu ghi thêm | Chỉ các trường chuẩn (xem `06` ví dụ đầy đủ). |
| Giai đoạn | **P1**. |
| Bắt buộc ngoài đời | **Có.** Ảnh 2D ≠ con vật thật (kích thước, chuyển động, tiếng). "Đạt" chỉ khi ở bậc 3–4. |

### COG-02 — Làm theo yêu cầu đơn giản: đứng lên, ngồi xuống, bỏ rác (`coach_demo`, P2; P3 camera)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Làm theo lời yêu cầu một bước. |
| Câu của cô (`10`) ✅ | "Ngồi xuống" · "Đứng lên" · "hãy bỏ rác" |
| 3 bước của cô (`10`) ✅ | **1** Đưa yêu cầu **chậm và to, rõ**, làm mẫu: nói "Ngồi xuống" rồi ngồi xuống; nói "Đứng lên" rồi đứng thẳng lên. **2** Đến lượt bé, cầm tay hướng dẫn, lặp lại **2–3 lần**. **3** Đưa yêu cầu và chờ bé làm theo, giảm hỗ trợ dần. |
| Loại trò trên iPad | `coach_demo`. |
| Trò & tương tác | Giọng ba mẹ đọc câu của cô; iPad hiện hình minh họa và nhắc 3 bước; ba mẹ xác nhận. P3: MediaPipe Pose nhận đứng/ngồi để gợi ý xác nhận. Bỏ rác dùng thùng rác thật. |
| Cách tính đúng & gợi ý | Đúng = bé thực hiện trong 5 giây sau lệnh ⚠️ CẦN XÁC NHẬN. Gợi ý: `gesture` (chỉ), `model` (linh vật/ba mẹ làm mẫu), `partial_physical`, `full_physical`. |
| Cầu nối | **B2** thẻ hình hành động. **B3** làm với ghế, thùng rác thật. **B4** "Đứng lên", "Bỏ rác vào thùng" trong sinh hoạt. |
| Dữ liệu ghi thêm | `action` ∈ {`stand`,`sit`,`throw_trash`}, `parentConfirm`; P3 `detectorConfidence`. |
| Giai đoạn | P2; P3 camera. |
| Bắt buộc ngoài đời | **Có, toàn bộ hành động.** iPad chỉ phát lệnh/mẫu và ghi dữ liệu. |

### COG-03 — Chọn 1 trong 2 hình đồ vật cá nhân (`choose_from_two`, **P1 lõi**)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Chọn đúng hình đồ vật của bé (ví dụ bình nước, dép, mũ, ba lô, khăn, gối; danh sách mặc định GĐ-11 ⚠️ CẦN XÁC NHẬN). |
| Câu của cô (`10`) ✅ | Làm mẫu: "Ở đây mẹ có cặp và dép, bây giờ mẹ lấy dép, aaa dép đây, hoan hô" · Yêu cầu: "Ở đây mẹ có cặp và dép, con hãy chỉ vào dép" hoặc "Lấy cho ba/mẹ…" |
| 3 bước của cô (`10`) ✅ | **1** Đặt 2 hình đồ cá nhân lên bàn và làm mẫu bằng câu trên. **2** Hướng dẫn bé làm; bé lúng túng thì cầm tay bé lấy hình đúng đưa cho ba mẹ và **vỗ tay khen**, dần thả tay. **3** Đổi vị trí tranh và đưa yêu cầu để bé tự lấy đúng. |
| Loại trò trên iPad | `choose_from_two`. |
| Trò & tương tác | Như COG-01; ảnh là **chính đồ của bé**, ba mẹ chụp/tách chủ thể bằng iPad. Danh sách đồ cá nhân của bé vẫn là GĐ-11 ⚠️ CẦN XÁC NHẬN (tài liệu cô chỉ nêu ví dụ "cặp và dép"). |
| Cách tính đúng & gợi ý | Như COG-01. |
| Cầu nối | **B2** thẻ in ảnh đồ của bé. **B3** đồ thật của bé đặt 2 chỗ. **B4** "Lấy dép" lúc ra khỏi nhà. |
| Dữ liệu ghi thêm | Chuẩn. Ảnh đồ cá nhân bị ẩn danh hóa thành `personal_object_N` khi gửi LLM (xem `09`). |
| Giai đoạn | **P1**. |
| Bắt buộc ngoài đời | **Có.** Ảnh một món khác đồ thật ở nhiều nhà; cần xác nhận bé nhận ra đồ cùng loại hay chỉ đúng món đó ⚠️ CẦN XÁC NHẬN. |

---

## 5. Nhóm Cá nhân và xã hội

### SOC-01 — Chơi tương tác: chuyền bóng qua lại, xếp chồng khối gỗ (`coach_demo`, P2)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Luân phiên lượt, chờ lượt, chơi cùng người. |
| Câu của cô (`10`) ✅ | "1 2 3 - Đẩy" · "[tên bé] ơi, đẩy bóng qua cho ba mẹ" (⚠️ CẦN XÁC NHẬN cách gọi bé Lạc) |
| 3 bước của cô (`10`) ✅ | **1** Ngồi đối diện, làm mẫu đẩy bóng qua lại, đếm "1 2 3 - Đẩy". **2** Gọi tên bé và yêu cầu đẩy bóng trở lại; **đứng tư thế dang tay** để ra hiệu sẵn sàng nhận bóng. **3** Lặp lại đến khi bé chủ động đẩy qua lại; bé chưa tự ngồi thì cần người hỗ trợ. |
| Loại trò trên iPad | `coach_demo` — hoạt động làm với bóng thật; iPad nhắc 3 bước, ba mẹ chấm. |
| Trò & tương tác | iPad hiện hình quả bóng/khối gỗ và dải nhắc cho ba mẹ; việc chuyền bóng diễn ra ngoài đời. |
| Cách tính đúng & gợi ý | Đúng = bé thực hiện lượt của mình và chờ khi đến lượt người kia ⚠️ CẦN XÁC NHẬN định nghĩa. Gợi ý: `gesture` = vật của bé được viền nhẹ; `model` = ba mẹ làm lượt mẫu; `partial_physical`. |
| Cầu nối | **B2** thẻ hình "chuyền bóng". **B3** bóng/khối gỗ thật ngồi đối diện. **B4** chơi với anh chị/bạn. |
| Dữ liệu ghi thêm | số lượt luân phiên, `waitedForTurn` (bé chờ hay chạm sớm), thời gian mỗi lượt. |
| Giai đoạn | P2. |
| Bắt buộc ngoài đời | **Có, phần lớn.** Giao tiếp mắt, ngồi đối diện, vật nặng/lăn thật; iPad chỉ mô phỏng nhịp lượt. |

### SOC-02 — Cắt trái cây mô hình cùng ba mẹ (`coach_demo`, P2)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Cùng ba mẹ làm hoạt động cắt trái cây mô hình. |
| Câu của cô (`10`) ✅ | "Hôm nay ba mẹ sẽ tập cho con cắt trái cây mô hình cùng ba mẹ" · "Cắt, wow, ngon quá" · "Cắt" |
| 3 bước của cô (`10`) ✅ | **1** Đưa bộ đồ chơi cắt trái cây về phía trước bé, làm mẫu, khi cắt nói "Cắt, wow, ngon quá". **2** Cầm tay bé: một tay giữ trái cây trên thớt, một tay cầm dao và cắt, kèm "Cắt"; dần thả lỏng tay, **có thể luân phiên lượt**. **3** Cho bé chủ động cắt cùng ba mẹ. |
| Loại trò trên iPad | `coach_demo`. |
| Trò & tương tác | iPad hiện hình trái cây mô hình và dải nhắc; việc cắt làm bằng bộ đồ chơi thật. |
| Cách tính đúng & gợi ý | Đúng = đường vuốt đi qua quả. Gợi ý: `gesture` = vạch gợi ý mờ; `model` = linh vật cắt mẫu; `partial_physical`. |
| Cầu nối | **B2** thẻ hình trái cây đã cắt. **B3** bộ trái cây velcro/gỗ + dao nhựa. **B4** cùng ba mẹ bóc/đưa trái cây thật khi ăn. |
| Dữ liệu ghi thêm | `swipeLen`, số quả cắt, lượt của ai (`player`: `child`/`parent`). |
| Giai đoạn | P2. |
| Bắt buộc ngoài đời | **Có.** Lực tay, giữ đồ vật, phối hợp hai tay; nếu nhà chưa có bộ mô hình thì ghi `offline_guide` và dùng đồ có sẵn ⚠️ CẦN XÁC NHẬN an toàn dao nhựa với cô. |

### SOC-03 — Chơi xe tải cùng ba mẹ (`coach_demo`, P2)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Chơi cùng nhau với xe tải. |
| Câu của cô (`10`) ✅ | "Hôm nay ba mẹ sẽ tập cho con cùng chơi xe tải với ba mẹ nhé" · "Nhìn nè + tên con + Xe tải!" · "Xe tải, bíp bíp" |
| 3 bước của cô (`10`) ✅ | Ngồi sàn **cách bé 0,6–1 m**. **1** Nói "Nhìn nè + tên con + Xe tải!" và đẩy xe về phía bé; thùng xe có thể chở thức ăn làm phần thưởng. **2** Khuyến khích bé đẩy xe trở lại, lặp "Xe tải, bíp bíp" mỗi lần đẩy. **3** Để bé chủ động đẩy xe đến chơi với ba mẹ. |
| Loại trò trên iPad | `coach_demo`. |
| Trò & tương tác | iPad hiện hình xe tải và dải nhắc; việc đẩy xe làm bằng xe đồ chơi thật. |
| Cách tính đúng & gợi ý | Đúng = bé điều khiển xe trong lượt của mình; gợi ý như SOC-01. |
| Cầu nối | **B2** thẻ hình xe tải. **B3** xe tải đồ chơi + vật để chở. **B4** chơi xe tự nhiên với ba mẹ/anh chị. |
| Dữ liệu ghi thêm | số lượt, lượt của ai, thời gian điều khiển. |
| Giai đoạn | P2. |
| Bắt buộc ngoài đời | **Có.** Chơi biểu tượng và tương tác với người thật. |

---

## 6. Nhóm Ngôn ngữ – lời nói

### LAN-01 — Gọi tên con vật nuôi bằng từ đơn (`say_name`, P2; P3 micro)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Bé nói tên con vật bằng một từ (chó, mèo, bò, gà). |
| Câu của cô (`10`) ✅ | Làm mẫu: "Con nhìn vào tranh nè, đây là chó, chó, chó…" · Yêu cầu: "Con gì đây?" · Mớm lời: "Đây là con…" |
| 3 bước của cô (`10`) ✅ | **1** Cầm tranh ngang tầm mắt bé, chỉ tay và gọi tên **2–3 lần bằng từ đơn**. **2** Yêu cầu bé chỉ vào tranh và gọi tên; **đợi 3–5 giây**, chưa nói được thì mớm lời rồi giới thiệu lại tên. **3** Làm tương tự với con vật khác; khi bé quen thì chỉ hỏi "Con gì đây?". **Lưu ý:** phát âm **chậm, to, khẩu hình rõ**; tập **10–15 phút/lần**. |
| Loại trò trên iPad | `say_name` — hiện 1 hình lớn, ba mẹ hỏi "Con gì đây?", ba mẹ chấm. Mốc chờ 5 giây ✅ nằm trong khoảng "3–5 giây" của cô. |
| Trò & tương tác | 1 hình lớn, ba mẹ đọc câu của cô rồi chờ; ba mẹ xác nhận (P2). P3: phát hiện bé phát âm (VAD); luôn cho ba mẹ xác nhận. |
| Cách tính đúng & gợi ý | Đúng = bé nói từ (có chấp nhận gần đúng?) ⚠️ CẦN XÁC NHẬN. Gợi ý: `gesture` = linh vật chỉ con vật; `model` = ba mẹ nói mẫu rồi bé nhắc lại. |
| Cầu nối | **B2** thẻ giấy "con gì đây". **B3** đồ chơi con vật. **B4** thấy con vật thật/trong sách và bé gọi tên. |
| Dữ liệu ghi thêm | `vocalization` ∈ {`none`,`sound`,`approximation`,`word`} ⚠️ CẦN XÁC NHẬN danh mục; `VocalClip` (tùy chọn, cần đồng ý; MVP không ghi, GĐ-26). |
| Giai đoạn | P2 (xác nhận tay); P3 (VAD, nhận từ riêng). |
| Bắt buộc ngoài đời | **Có.** Lời nói có nghĩa khi dùng để giao tiếp thật; app không nghe hiểu nghĩa. |

### LAN-02 — Xòe tay kết hợp nói "xin" (`coach_demo`, P2; P3 AAC)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Xòe tay và nói "xin" để xin thứ mình muốn. |
| Câu của cô (`10`) ✅ | "xin…" · "con muốn lấy đồ chơi thì con phải xòe tay ra và nói xin…" · "xin…xin…xin…" · "con xin mẹ đi" |
| 3 bước của cô (`10`) ✅ | **1** Làm mẫu xòe tay ra và nói "xin…" kèm lời giải thích. **2** Cầm tay bé xòe ra và mớm lời, đặt tay lên môi bé để gợi ý; **đợi 3–5 giây**, chưa nói được thì cầm tay bé chỉ vào môi ba mẹ để nhìn rõ khẩu hình. **3** Chỉ đưa yêu cầu "con xin mẹ đi" để bé tự thực hiện. **Lưu ý:** không ép bé tập quá lâu. |
| Loại trò trên iPad | `coach_demo` — iPad hiện hình bàn tay xòe và nhắc 3 bước; ba mẹ chấm. Nút AAC để ở P3. |
| Trò & tương tác | Hoạt động ngoài đời với món bé muốn; iPad chỉ nhắc và ghi dữ liệu. |
| Cách tính đúng & gợi ý | Đúng = xòe tay **và/hoặc** nói "xin" ⚠️ CẦN XÁC NHẬN (cần cả hai?). Gợi ý: `model`, `partial_physical` (đỡ tay xòe). |
| Cầu nối | **B2** thẻ "xin". **B3** món bé thích đặt trong tầm nhìn, chờ bé xin. **B4** xin đồ ăn/đồ chơi trong sinh hoạt. |
| Dữ liệu ghi thêm | `gestureDetected`, `vocalization`, `requestedItem`. |
| Giai đoạn | P2 (hướng dẫn, `offline_guide`); P3 (AAC, camera, micro). |
| Bắt buộc ngoài đời | **Có, toàn bộ.** Cần động cơ thật (món bé muốn) và người đáp lại. |

### LAN-03 — Nhờ giúp đỡ bằng cử chỉ hoặc "ạ" (`coach_demo`, P2; P3 AAC)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Nhờ giúp khi cần bằng cử chỉ hoặc "ạ". |
| Câu của cô (`10`) ✅ | "ạ!" |
| 3 bước của cô (`10`) ✅ | **Chuẩn bị:** đặt đồ chơi bé thích trong **hộp/lọ nắp vặn chặt**, đưa hộp cho bé và ra hiệu bé lấy. **1** Khi bé không mở được, **chờ một lúc và không nói gì**; bé chưa biết nhờ thì đưa tay ra gần chờ bé đưa hộp, hoặc yêu cầu bé nói "ạ!". **2** **Sau 3–5 giây**, bé đưa hộp hoặc nói "ạ" thì mở hộp giúp ngay và khen; chưa thì cầm tay bé đặt lên miệng mẹ và nói "ạ", dần chỉ mở khẩu hình. **3** Tiếp tục luyện tập và giảm dần hỗ trợ. (✅ `10` trả lời được cách tạo tình huống nhờ giúp.) |
| Loại trò trên iPad | `coach_demo`. |
| Trò & tương tác | Hoạt động ngoài đời với hộp nắp vặn chặt; iPad nhắc 3 bước, ba mẹ chấm. |
| Cách tính đúng & gợi ý | Đúng = bé nhờ giúp bằng cử chỉ hoặc "ạ" ⚠️ CẦN XÁC NHẬN. Gợi ý: `model`, `partial_physical`. |
| Cầu nối | **B2** thẻ "giúp". **B3** tình huống chuẩn bị sẵn (ví dụ hộp đồ chơi nắp chặt) — cách tạo tình huống cần cô hướng dẫn ⚠️ CẦN XÁC NHẬN. **B4** nhờ giúp tự nhiên khi cần. |
| Dữ liệu ghi thêm | `requestMode` ∈ {`gesture`,`vocal`,`button`}, `situation`. |
| Giai đoạn | P2 (hướng dẫn); P3 (AAC). |
| Bắt buộc ngoài đời | **Có, toàn bộ.** Giao tiếp chức năng cần tình huống thật và người đáp lại. |

---

## 7. Nhóm Vận động thô

Cả ba bài: linh vật làm mẫu và làm huấn luyện viên, dùng đồ có sẵn trong nhà. An toàn môi trường (sàn, vật nhọn, chỗ chui) do ba mẹ đảm bảo và ⚠️ CẦN XÁC NHẬN với cô.

### GRO-01 — Chui qua đường hầm (`coach_demo`, P2)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Chui qua đường hầm. |
| Câu của cô (`10`) ✅ | "Mẹ bò nè, trẻ nhìn nha" · "Trẻ bò nè!" · "Giỏi lắm, trẻ bò theo mẹ nhé" · "Hay quá! Hoan hô trẻ" |
| 3 bước của cô (`10`) ✅ | **Chuẩn bị:** đường hầm mua sẵn **hoặc kê ghế và phủ chăn mỏng**. **1** Làm mẫu chui qua bằng **2 khuỷu tay và 2 đầu gối**, bò chậm, hướng dẫn bé hạ thấp người. **2** Tập bò **bên ngoài** hầm trước rồi mới bò qua; ba mẹ đứng ở điểm đến cổ vũ hoặc cầm đồ chơi dụ bé. **3** Mẹ cổ vũ, bé tự bò qua. **Lưu ý:** khoảng cách hầm **ngắn trước, tăng dần**. |
| Loại trò trên iPad | `coach_demo`. |
| Trò & tương tác | iPad hiện hình đường hầm và dải nhắc; ba mẹ dựng hầm từ đồ có sẵn và bấm xác nhận. |
| Cách tính đúng & gợi ý | Đúng = bé chui qua ⚠️ CẦN XÁC NHẬN (tự bò hay có khuyến khích). Gợi ý: `gesture` (chỉ lối), `model` (linh vật/ba mẹ chui trước), `partial_physical`, `full_physical`. |
| Cầu nối | **B2** thẻ hình hầm. **B3** hầm thật tại nhà (đây là bài chính). **B4** chui qua đồ ở sân chơi. |
| Dữ liệu ghi thêm | `gameData.completed` (chui qua), thời gian; mức hỗ trợ ghi vào `promptLevel` do ba mẹ nhập (`promptLevelSource='parent_edit'`). |
| Giai đoạn | P2. |
| Bắt buộc ngoài đời | **Có, toàn bộ.** Vận động toàn thân; app chỉ làm mẫu và nhắc. |

### GRO-02 — Đi bộ chậm một mình (`coach_demo`, P2)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Đi bộ chậm một mình. |
| Câu của cô (`10`) ✅ | "Chậm, 1-2, 1-2" · đếm nhịp "1 2 1 2" · "Tốt lắm! Chậm lại" |
| 3 bước của cô (`10`) ✅ | **Chuẩn bị:** vẽ vạch xuất phát và vạch đích **cách nhau 2–3 m**. **1** Làm mẫu đi từ vạch xuất phát đến vạch đích, **chậm 2–3 lần**. **2** Yêu cầu bé đi chậm cùng ba mẹ; chưa tự được thì cầm tay dẫn và **đếm nhịp "1 2 1 2"**. **3** Giảm hỗ trợ, chỉ đếm nhịp. |
| Loại trò trên iPad | `coach_demo`. |
| Trò & tương tác | iPad hiện hình minh họa và dải nhắc; ba mẹ xác nhận. Camera chỉ thử ở P3 nếu đo được độ tin cậy. |
| Cách tính đúng & gợi ý | Đúng = bé đi chậm một quãng một mình ⚠️ CẦN XÁC NHẬN ("chậm", quãng ngắn nhất). Gợi ý: `model`, `partial_physical` (nắm tay), `full_physical`. |
| Cầu nối | **B2** thẻ hình "đi chậm". **B3** đi dọc vạch băng dính trong nhà. **B4** đi chậm ngoài trời cùng ba mẹ. |
| Dữ liệu ghi thêm | `gameData.distanceM` (ước lượng); mức hỗ trợ ghi vào `promptLevel` do ba mẹ nhập. |
| Giai đoạn | P2. |
| Bắt buộc ngoài đời | **Có, toàn bộ.** |

### GRO-03 — Hai tay cầm bóng và bước đi (`coach_demo`, P2)

| Mục | Nội dung |
|---|---|
| Mục tiêu | Giữ bóng bằng hai tay và bước đi. |
| Câu của cô (`10`) ✅ | "Mẹ làm mẫu, cầm bóng đi chậm" · "Cầm bóng, đi nào" · "Hoan hô, con làm được rồi!" |
| 3 bước của cô (`10`) ✅ | **Chuẩn bị:** đứng thẳng tự nhiên, 2 tay cầm bóng. **1** Làm mẫu: 2 tay cầm bóng, bước chậm đến vạch vẽ sẵn, **2–3 lần**. **2** Đưa bóng cho bé, yêu cầu cầm bằng 2 tay và đi về phía trước; khó thì cầm tay bé giữ bóng và bước cùng. **3** Thả dần tay để bé tự cầm bóng đến vạch đích. |
| Loại trò trên iPad | `coach_demo`. |
| Trò & tương tác | iPad hiện hình quả bóng và dải nhắc; ba mẹ xác nhận. |
| Cách tính đúng & gợi ý | Đúng = giữ bóng bằng hai tay và bước ≥ vài bước ⚠️ CẦN XÁC NHẬN. Gợi ý như GRO-02. |
| Cầu nối | **B2** thẻ hình. **B3** bóng nhẹ vừa hai tay. **B4** bê đồ bằng hai tay (hộp, gối) trong sinh hoạt. |
| Dữ liệu ghi thêm | `gameData.steps` (ước lượng); mức hỗ trợ ghi vào `promptLevel` do ba mẹ nhập. |
| Giai đoạn | P2. |
| Bắt buộc ngoài đời | **Có, toàn bộ.** |

---

## 8. Tổng hợp theo giai đoạn

| Giai đoạn | Bài |
|---|---|
| **P1 (MVP)** | COG-01, COG-03, FIN-02 (nhận biết) |
| **P2 đầu (tuần 5, phần cắt)** | IMI-01 (`peekaboo`), FIN-03 (`sequence_cards`) |
| **P2** | 12 bài `coach_demo` (IMI-02/03, FIN-01, COG-02, SOC-01/02/03, LAN-02/03, GRO-01/02/03) + LAN-01 (`say_name`) |
| **P3** | AAC LAN-02/03, camera (IMI-02/03, COG-02), micro (LAN-01), nhận từ riêng |

Nhận xét: khối lượng P2 lớn (5 kiểu trò mới + linh vật làm mẫu). Ưu tiên P2 theo mục tiêu tuần thực tế của cô giáo, không theo thứ tự bảng. Xem rủi ro trong `08`.
