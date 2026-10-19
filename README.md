# một lời chúc

Trang thiệp 20/10 để cả phòng gửi lời chúc tới 7 chị em.

- **Ai cũng gửi được** lời chúc tới một chị em, có thể để trống tên thành "Ẩn danh". Không cần đăng nhập.
- **7 chị em** đăng nhập bằng mã 6 số gửi qua email và chỉ đọc được lời chúc gửi mình, hiển thị dạng thiệp lật.
- **Tài khoản "Test"** (admin) đọc tất cả, lọc theo người nhận và xuất CSV.

Trang dùng HTML/CSS/JS thuần, không có bước build, thư viện tải qua CDN. Backend là Supabase (gói free), trang được host bằng GitHub Pages.

---

## 1. Chạy thử trên máy

```bash
python3 -m http.server 5500
```

Mở http://localhost:5500.

Khi `js/config.js` còn để `YOUR_SUPABASE_URL`, trang chạy ở **chế độ demo**:

- Lời chúc chỉ lưu trong trình duyệt đang mở.
- Mã OTP luôn là `123456`. Email phải khớp với gợi ý của người được chọn.
- Chọn ô "Test" để vào màn admin.
- Góc màn hình có nhãn "Chế độ demo" để dễ nhận biết.

## 2. Cấu trúc thư mục

```
index.html                 Trang chính
css/style.css              Giao diện
js/config.js               Nội dung + cấu hình (chỉ cần sửa file này)
js/app.js                  Logic: gửi lời chúc, đăng nhập OTP, hộp thư, admin, hiệu ứng
assets/avatars/{id}.svg    Avatar vẽ (bộ Lorelei của DiceBear, giấy phép CC0)
supabase/schema.sql        Bảng, quyền (RLS), hàm
supabase/members.local.sql Danh sách email thật (KHÔNG commit, đã nằm trong .gitignore)
```

---

## 3. Cài Supabase (làm 1 lần, khoảng 20 phút)

### 3.1. Tạo project

1. Vào https://supabase.com → **New project**.
2. Đặt tên (ví dụ `mot-loi-chuc`), chọn region **Southeast Asia (Singapore)**, đặt mật khẩu database rồi lưu lại ở đâu đó.
3. Đợi khoảng 1–2 phút cho project khởi tạo xong.

### 3.2. Tạo bảng và quyền

1. Menu trái → **SQL Editor** → **New query**.
2. Dán toàn bộ nội dung `supabase/schema.sql` → **Run**. File này chạy lại nhiều lần vẫn an toàn.
3. Tạo query mới, dán `supabase/members.local.sql` → **Run**.
4. Kiểm tra: **Table Editor** → bảng `members` phải có **10 dòng** (7 chị em + `admin` + `admin2` + `tester`).

> **Tester** là người nhận ẩn, dùng để bạn tự test. Tester chỉ hiện trong dropdown người nhận của màn gửi lời chúc, không có trong lưới chị em. Muốn đăng nhập vào Tester thì chọn ô **Test**, nhập email của Tester, và trang sẽ mở hộp thư của Tester. Người ẩn được khai báo bằng `hidden: true` trong `config.js`.

### 3.3. Tắt đăng ký tự do, kiểm tra độ dài mã

Vào **Authentication** → **Sign In / Providers**:

- Tắt **Allow new users to sign up**. Chỉ những email bạn tạo ở bước 3.4 mới đăng nhập được, và người lạ sẽ nhận lỗi "Email này chưa có trong danh sách chị em".
- Trong mục **Email**: provider phải đang bật. **Email OTP Length** phải là **6**. **Email OTP Expiration** để 3600 giây (1 giờ) hoặc ngắn hơn tuỳ bạn.

### 3.4. Tạo 9 user

Vào **Authentication** → **Users** → **Add user** → **Create new user**, rồi lặp lại cho đủ 10 email trong `members.local.sql`:

- **Email**: email thật, viết thường.
- **Password**: gõ đại một chuỗi dài bất kỳ. Không ai dùng đến mật khẩu này vì đăng nhập bằng mã.
- Tick **Auto Confirm User**.

> Email trong **Users** và trong bảng `members` phải giống hệt nhau. Nếu lệch, người đó đăng nhập được nhưng trang sẽ báo "chưa được gán cho chị em nào".

### 3.5. Sửa email template để gửi mã 6 số

Vào **Authentication** → **Emails** → tab **Templates** → chọn **Magic Link**. Người dùng đã có tài khoản sẽ nhận email theo mẫu này.

**Subject:**

```
Mã đăng nhập một lời chúc: {{ .Token }}
```

**Body** (dán vào ô Source):

```html
<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#17131f">
  <p style="font-size:14px;color:#756AB6;letter-spacing:.08em;text-transform:uppercase;margin:0">một lời chúc · 20/10</p>
  <h2 style="margin:12px 0 8px">Mã đăng nhập hộp thư của bạn</h2>
  <p style="margin:0 0 16px">Nhập mã dưới đây vào trang để mở hộp thư lời chúc:</p>
  <p style="font-size:34px;font-weight:700;letter-spacing:8px;background:#FFE5E5;border-radius:12px;padding:16px;text-align:center;margin:0 0 16px">{{ .Token }}</p>
  <p style="font-size:13px;color:#4b4459;margin:0">Nếu bạn không yêu cầu mã này, cứ bỏ qua email.</p>
</div>
```

Bấm **Save**. Template **bắt buộc** phải có `{{ .Token }}`. Nếu không, email chỉ có link mà không có mã để nhập.

### 3.6. Gửi mail qua Gmail (Custom SMTP)

SMTP mặc định của Supabase chỉ gửi được vài email mỗi giờ, nên cần dùng Gmail.

**Tạo App Password trên Gmail:**

1. Tài khoản Gmail phải bật **Xác minh 2 bước**: https://myaccount.google.com/security
2. Vào https://myaccount.google.com/apppasswords → đặt tên `supabase` → **Create**.
3. Copy mật khẩu 16 ký tự, bỏ hết dấu cách.

**Điền vào Supabase:** vào **Authentication** → **Emails** → tab **SMTP Settings** → bật **Enable Custom SMTP**:

| Ô | Giá trị |
|---|---|
| Sender email | địa chỉ Gmail vừa tạo App Password |
| Sender name | `một lời chúc` |
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | địa chỉ Gmail (giống Sender email) |
| Password | App Password 16 ký tự |
| Minimum interval between emails | để mặc định (60 giây) |

Bấm **Save**.

Sau đó vào **Authentication** → **Rate Limits**, tăng **Rate limit for sending emails** lên khoảng **60/giờ**. Mục này chỉ sửa được sau khi bật Custom SMTP.

### 3.7. Điền URL và key vào trang

1. Vào **Project Settings** → **Data API**, copy **Project URL**.
2. Vào **Project Settings** → **API Keys**, copy key **anon** (hoặc **publishable**).
3. Mở `js/config.js` và thay vào:

```js
supabaseUrl: "https://xxxxxxxx.supabase.co",
supabaseAnonKey: "eyJhbGciOi...",   // hoặc sb_publishable_...
```

> Key anon/publishable được phép để công khai trong repo vì dữ liệu đã được RLS bảo vệ.
> **Tuyệt đối không** dán key `service_role` hay `secret` vào đây.

### 3.8. Thử thật trên máy

Chạy lại `python3 -m http.server 5500` rồi kiểm tra:

1. Nhãn "Chế độ demo" không còn hiện.
2. Gửi một lời chúc thử → số lời chúc trên thẻ tăng lên.
3. Ở phần **Hộp thư**, chọn ô **Test** → nhập email admin → kiểm tra hộp thư Gmail (cả mục Spam) → nhập mã → thấy lời chúc vừa gửi.
4. Bấm **Xuất CSV** → mở bằng Excel, tiếng Việt hiển thị đúng.

Muốn xoá lời chúc thử: vào **Table Editor** → bảng `wishes` → chọn dòng → **Delete**. Trên trang không có nút xoá.

---

## 4. Đưa lên GitHub Pages

1. Push code lên GitHub (nhánh `main`).
2. Vào repo → **Settings** → **Pages**.
3. **Source**: Deploy from a branch → Branch **main**, thư mục **/ (root)** → **Save**.
4. Đợi 1–2 phút. Trang sẽ ở địa chỉ `https://<tên-github>.github.io/<tên-repo>/`.
5. (Nên làm) Supabase → **Authentication** → **URL Configuration** → **Site URL** điền địa chỉ trên.

Repo đã có sẵn file `.nojekyll` để GitHub Pages phục vụ đúng các file tĩnh.

---

## 5. Sửa nội dung

Mọi nội dung nằm trong `js/config.js`:

- `mainWish`: lời chúc chung.
- `subWishes`: các câu chúc phụ.
- `members`: tên, biệt danh, huy hiệu, gợi ý email.
  - `id` phải trùng `member_id` trong database.
  - `emailHint` chỉ ghi dạng che (`ha***@dsc.com.vn`) vì repo public. Khi đăng nhập, email phải khớp phần đầu và tên miền của gợi ý.
  - Muốn dùng ảnh thật: bỏ ảnh vào `assets/members/` rồi điền `photo: "assets/members/ha.jpg"`. Để `null` thì trang dùng avatar vẽ.
- `adminLabel`: nhãn hiển thị của tài khoản admin (đang là "Test").

## 6. Xử lý sự cố

| Hiện tượng | Cách xử lý |
|---|---|
| Không nhận được mã | Xem mục Spam. Kiểm tra SMTP (App Password đúng chưa, đã bỏ dấu cách chưa). Vào **Logs** → **Auth** trên Supabase xem lỗi. |
| "Email này chưa có trong danh sách" | Email chưa được tạo ở **Authentication → Users**, hoặc gõ sai. |
| "Đăng nhập được nhưng chưa được gán cho chị em nào" | Email trong **Users** không có trong bảng `members`, hoặc lệch chữ hoa/thường. Sửa rồi chạy lại `members.local.sql`. |
| "Bạn thao tác hơi nhanh" | Bị giới hạn gửi mail. Đợi 1 phút, hoặc tăng Rate Limits (mục 3.6). |
| "Mã không đúng hoặc đã hết hạn" | Dùng mã trong email **mới nhất**. Mỗi lần bấm "Gửi lại mã" thì mã cũ hết hiệu lực. |
| Email có link mà không có mã | Template Magic Link thiếu `{{ .Token }}` (mục 3.5). |
| Số lời chúc không hiện | Chưa chạy `schema.sql`, hoặc sai URL/key trong `config.js`. Mở DevTools → Console để xem lỗi. |

## 7. Checklist trước ngày 20/10

- [ ] Bảng `members` có 10 dòng, **Users** có 10 user (đã Auto Confirm).
- [ ] Đã tắt đăng ký tự do (Allow new users to sign up: off).
- [ ] Template Magic Link có `{{ .Token }}`, OTP Length = 6.
- [ ] Custom SMTP Gmail đã gửi thử thành công.
- [ ] `config.js` đã có URL và key thật, nhãn demo không còn hiện.
- [ ] Đăng nhập thử bằng 1 email chị em và bằng tài khoản Test.
- [ ] Đã xoá các lời chúc thử trong bảng `wishes` (lời chúc gửi Tester để lại cũng được, không hiện công khai).
- [ ] GitHub Pages chạy được, đã mở thử bằng điện thoại.

---

Avatar: [Lorelei](https://www.dicebear.com/styles/lorelei/) của Lisa Wischofsky, giấy phép CC0, qua DiceBear. Font: Mona Sans.
