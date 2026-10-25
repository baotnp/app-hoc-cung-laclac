# Học cùng Lạc Lạc

PWA hỗ trợ ba mẹ luyện tập cùng bé mỗi ngày tại nhà, chạy offline trên iPad. App **hỗ trợ, không thay thế** buổi can thiệp với cô giáo.

Thiết kế và kế hoạch nằm trong `docs/01` → `docs/09`. Tài liệu là nguồn sự thật: code lệch tài liệu thì sửa code.

## Chạy

```bash
npm install
npm run dev        # phát triển
npm test           # 175 test (Vitest)
npm run typecheck  # tsc --noEmit
npm run build      # kiểm kiểu + dựng bản phát hành vào dist/
npm run preview    # xem thử bản phát hành
```

Cài lên iPad: mở URL trong Safari → nút Chia sẻ → Thêm vào Màn hình chính. Khóa màn hình trong buổi học bằng Guided Access (hướng dẫn nằm trong app, màn Cài đặt).

## Dữ liệu

Toàn bộ dữ liệu nằm trên thiết bị (IndexedDB qua Dexie). Không có backend; `public/_headers` đặt `connect-src 'self'` nên app không thể gửi dữ liệu ra ngoài. Ảnh và giọng của bé chỉ rời app qua file sao lưu do ba mẹ chủ động xuất.

`local-content/` (ảnh, giọng của gia đình) nằm trong `.gitignore` và không bao giờ được commit.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/data/` | Dexie schema, repo, truy vấn báo cáo Q1–Q6, sao lưu, gói khởi đầu |
| `src/engine/` | Schema Zod cho bài tập, máy trạng thái một lượt, detector, trò `choose_from_two` |
| `src/scheduler/` | `ItemScheduler` + bản `simple@1`, tiêu chí đạt |
| `src/reward/` | Bảng sao, mục tiêu ngày, ngày luyện, sổ nông trại (chỉ thêm), cột mốc |
| `src/audio/` | Web Audio: mở khóa cho iOS, phát, ducking, thu âm |
| `src/mascot/`, `src/ui/` | Linh vật Lạc Lạc, bảng sao, màn tiệc, nút nhấn giữ |
| `src/child/`, `src/session/` | Các màn của bé và bộ điều phối buổi học |
| `src/parent/` | Chế độ ba mẹ: nội dung, mục tiêu, tiến độ, xem lại, sao lưu, cài đặt |
| `src/farm/` | Nông trại — giai đoạn 2; hiện chỉ là route lazy |
| `content/exercises/` | Nội dung bài dạng JSON. Thêm bài mới = thêm file, không sửa code |

## Ràng buộc không được vi phạm

- Chế độ bé không có chữ (ngoại lệ: lớp của ba mẹ hiện khi nhấn giữ).
- Không âm báo sai, không màu đỏ cho kết quả của bé, không nhấp nháy quá 2 lần/giây, không rung màn hình.
- Không cơ chế phạt: không chuỗi ngày, không mất sao hay phần thưởng đã có.
- Không tuyên bố y khoa trong bất kỳ chuỗi hiển thị nào.
- Giọng trong app luôn là giọng ba mẹ thu thật, không tổng hợp.
