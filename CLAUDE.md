# một lời chúc — trang thiệp 20/10 cho chị em trong phòng

Trang landing page một trang, cuộn dọc. Cả phòng vào viết lời chúc 20/10 cho 7 chị em. Gấp: sự kiện là ngày 20/10/2026.

## Yêu cầu đã chốt với user (đừng hỏi lại)
- **Tên web**: `một lời chúc`, luôn viết thường, không viết hoa.
- **Font**: Mona Sans, lấy từ Google Fonts (có subset tiếng Việt, đã kiểm tra).
- **Layout**:
  - Có header (sticky, kiểu kính), vùng nội dung và footer. Header CHỈ có icon bông hoa + tên web, căn giữa, không nút/menu nào (cả desktop và mobile).
  - Các section theo thứ tự: hero → lời chúc chung (highlight) → câu chúc phụ (lưới card) → 7 chị em (thẻ gồm ảnh/avatar chữ cái, tên, biệt danh, số lời chúc đã nhận, nút "gửi lời chúc") → hộp thư (đăng nhập OTP) → footer.
- **Giao diện**: responsive, có animation (GSAP ScrollTrigger, cánh hoa rơi bằng canvas, confetti khi gửi) và hiệu ứng liquid glass (backdrop-filter; trên Chromium thêm SVG displacement). Tôn trọng `prefers-reduced-motion`.
- **Palette**: `#756AB6`, `#AC87C5`, `#E0AED0`, `#FFE5E5`.
  - Chữ phải tương phản rõ, ưu tiên chữ đen (ink khoảng `#17131f`).
  - Nút chính nền đen chữ trắng. `#756AB6` chỉ dùng làm điểm nhấn hoặc chữ lớn.
- **Nội dung chúc**: giọng chân thành, phù hợp, KHÔNG cố hài hước. Đã viết sẵn trong `js/config.js`.
- **Vai trò**:
  - Public: ai cũng gửi được lời chúc tới một chị em cụ thể, tự nhập tên hoặc để trống thành "Ẩn danh".
  - 7 chị em: đăng nhập bằng OTP qua email, chỉ đọc được lời chúc gửi mình. Hiển thị dạng thiệp lật.
  - Admin (2 email `ng***@gmail.com` và `ng***@dsc.com.vn`, email thật trong members.local.sql, member_id `admin`/`admin2`): đọc tất cả, lọc theo người nhận, xuất CSV (có BOM UTF-8). Trên giao diện, admin hiển thị với nhãn **"Test"** (`adminLabel` trong config).
- **Công nghệ**:
  - HTML thuần, không có bước build, dùng thư viện qua CDN. Host bằng GitHub Pages (có file `.nojekyll`).
  - Backend: Supabase free (bảng, RLS, email OTP).
  - Gửi mail: Custom SMTP bằng Gmail App Password, vì SMTP mặc định của Supabase bị giới hạn.
- **Bảo mật email**: repo public nên email thật CHỈ nằm trong `supabase/members.local.sql` (đã gitignore). `config.js` chỉ chứa `emailHint` dạng che (`ha***@dsc.com.vn`).
- **Luồng đăng nhập**: chọn tên → trang hiện gợi ý email → nhập email → `signInWithOtp({ email, options: { shouldCreateUser: false } })` → nhập mã 6 số → `verifyOtp({ email, token, type: 'email' })`.

## 7 chị em (id dùng trong config và DB)
| id | Tên | Biệt danh | Email |
|---|---|---|---|
| ha | Thu Hà | Giỏi việc nước, đảm việc nhà, nheo nhóc vì đàn em thơ | trong members.local.sql |
| chi | Linh Chis | Chihuahua | 〃 |
| huong | Hương Thù | Có thù với nước có màu | 〃 |
| hang | Thu Hằng | 80% là xem cam nhà trẻ | 〃 |
| ly | LyLy | emeLY | 〃 |
| nhi | Em Nhi | Con bot ngáo ngơ | 〃 |
| lan | Lan | (không có biệt danh) | 〃 |

## Trạng thái hiện tại
ĐÃ XONG:
- `supabase/schema.sql`: bảng `members` và `wishes`. RLS:
  - anon/authenticated được insert, có kiểm tra `is_recipient`.
  - Chỉ người nhận hoặc admin được select.
  - Không có policy update/delete.
  - Hàm `wish_counts()` dạng security definer, trả về số lời chúc cho trang public.
- `supabase/members.local.sql`: email thật, không commit.
- `js/config.js`: Supabase URL/key (đang là placeholder → chế độ demo), lời chúc chung, 6 câu chúc phụ, 7 thành viên, `adminEmailHint`.
- `.gitignore`, `.nojekyll`, `dsc-greeting-web.code-workspace`.
- Các URL CDN đã kiểm tra, đều trả về 200:
  - https://cdn.tailwindcss.com/3.4.16
  - https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js
  - https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js
  - https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js
  - https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js

BẢN ĐẦU ĐÃ CODE XONG (19/10), test E2E luồng demo bằng Brave headless: 29/29 pass:
- `index.html`, `css/style.css`, `js/app.js`, `README.md` (hướng dẫn Supabase/SMTP/Pages từng bước), `assets/avatars/*.svg`.
- KHÔNG dùng Tailwind: CSS viết tay, chuyển từ mockup đã duyệt (chủ động bỏ Tailwind CDN cho nhẹ, đỡ cảnh báo production).
- `app.js`: API 2 chế độ (DEMO localStorage / Supabase). Danh tính sau đăng nhập lấy từ `my_member_id()` + `is_admin()`, không tin ô đã chọn. Insert lời chúc không `.select()` (anon không có quyền select). Email phải khớp `emailHint` (prefix + domain) mới gửi mã. CSV có BOM + chặn CSV injection.
- Liquid glass SVG displacement chỉ bật trên Chromium (class `lg-svg` trên `<html>`), áp cho `.glass-lg` (header, lời chúc chung, modal).

CÒN LẠI:
- User tự setup Supabase theo README rồi gửi URL + anon key để điền `config.js`.
- Bật GitHub Pages sau khi push.

## Đã chốt sau mockup v1 (19/10)
- Avatar: bộ Lorelei (DiceBear, CC0), file SVG nền trong suốt ở `assets/avatars/{id}.svg`; nền tròn tô bằng CSS theo palette; mỗi người có huy hiệu emoji theo biệt danh (ha 🏡, chi 🐶, huong 💧, hang 📹, ly ✨, nhi 🤖, lan 🌸).
- Lời chúc chung có thêm "anh em Khối Công nghệ thông tin - DSC" (đã sửa trong config).
- Footer bên phải: "Vibe coding bởi youngboysitinh và em trợ lý 🥲💕".
- Mobile: nút "Viết lời chúc" là nút nổi dưới đáy màn hình (header không có nút).
- Đăng nhập hộp thư: chọn tên bằng lưới avatar (7 chị em + ô "Test"), không dùng dropdown.
- Mockup ở scratchpad, đã publish: https://claude.ai/artifact/WRKeecig9si26GJVRh2ZsR

## Người nhận ẩn: Tester (20/10)
- Quy tắc: 1 người nhận = 1 email (riêng admin được 2 email). KHÔNG đổi schema (đã thử và bỏ bảng member_aliases).
- `tester` là dòng thường trong `members` (role member), email thật trong members.local.sql. Config: `hidden: true`, `emailHint: "mn***@gmail.com"`.
- Ẩn khỏi lưới chị em, vòng avatar, ô chọn tên, tổng số lời chúc công khai. Chỉ hiện trong dropdown gửi lời chúc và màn admin (nhãn "Tester (ẩn)").
- Đăng nhập: chọn ô "Test" → nhập email Tester (ô Test chấp nhận cả gợi ý của người ẩn, không hiển thị) → DB trả `my_member_id = tester` → hộp thư Tester.

## Việc user tự làm (không chặn việc code)
- Ảnh 7 chị em: bỏ vào `assets/members/` rồi điền `photo` trong `config.js`.
- Tạo project Supabase, gửi URL và anon key.
- Tạo Gmail App Password cho SMTP.

## Gửi nhiều người một lần (20/10)
- Modal gửi: lưới checkbox (7 chị em + Tester) thay dropdown, ô "Gửi tất cả" = 7 chị em hiển thị (KHÔNG gồm người ẩn).
- `api.sendWishes(rows)`: một câu insert mảng, mỗi người nhận 1 dòng riêng. Không đổi schema/RLS.
- `config.js` đã trỏ Supabase thật → test E2E PHẢI chặn config.js (CDP Fetch) để ép DEMO, không gửi thử lên production.
