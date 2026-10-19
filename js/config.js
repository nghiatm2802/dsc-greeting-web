// =====================================================================
//  CẤU HÌNH — chỉ cần sửa file này
// =====================================================================
window.APP_CONFIG = {
  // Supabase Dashboard → Project Settings → API Keys.
  // Để nguyên "YOUR_..." thì trang chạy ở CHẾ ĐỘ DEMO:
  // dữ liệu chỉ lưu trên trình duyệt này, mã OTP demo luôn là 123456.
  supabaseUrl: "YOUR_SUPABASE_URL",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY",

  siteName: "một lời chúc",
  occasion: "20 · 10 · 2026",

  // ---------------- Lời chúc chung (block highlight) ----------------
  mainWish: {
    title: "Gửi những người phụ nữ của phòng mình",
    body:
      "Nhân ngày Phụ nữ Việt Nam 20/10, anh em Khối Công nghệ thông tin - DSC, xin gửi đến các chị, các em lời cảm ơn chân thành nhất. " +
      "Cảm ơn vì sự tận tâm trong từng công việc, vì những lời hỏi han ân cần, " +
      "và vì đã luôn giữ cho phòng mình sự ấm áp, tinh tế mà không bảng kế hoạch nào đo đếm được. " +
      "Chúc các chị em luôn mạnh khoẻ, bình an và rạng rỡ; " +
      "chúc mỗi ngày đều được trân trọng như hôm nay, " +
      "và chúc mọi dự định, dù trong công việc hay cuộc sống, đều thành hiện thực.",
    signature: "Thân mến, cả phòng",
  },

  // ---------------- Các câu chúc phụ ----------------
  subWishes: [
    { icon: "🌷", title: "Bình an", text: "Mong mỗi ngày của chị em đều nhẹ nhàng, an yên, đủ đầy niềm vui nhỏ." },
    { icon: "💪", title: "Mạnh khoẻ", text: "Luôn dồi dào sức khoẻ để theo đuổi những điều mình yêu thích." },
    { icon: "🌱", title: "Vững vàng", text: "Tự tin trên con đường sự nghiệp, mỗi bước đi đều thêm vững chãi." },
    { icon: "🏡", title: "Hạnh phúc", text: "Gia đình ấm êm, luôn có người thương ở bên sẻ chia và chăm sóc." },
    { icon: "✨", title: "Rạng rỡ", text: "Giữ mãi nụ cười tươi và sự tự tin toả sáng theo cách của riêng mình." },
    { icon: "💐", title: "Được trân trọng", text: "Không chỉ hôm nay mà mọi ngày, những nỗ lực của chị em đều được ghi nhận." },
  ],

  // ---------------- 7 chị em ----------------
  // id: phải trùng member_id trong supabase/members.local.sql
  // badge: huy hiệu nhỏ cạnh avatar, lấy theo biệt danh
  // photo: ảnh thật, ví dụ "assets/members/ha.jpg" (null = dùng avatar vẽ ở assets/avatars/{id}.svg)
  // emailHint: gợi ý email khi đăng nhập — KHÔNG ghi email đầy đủ vì repo public
  members: [
    { id: "ha",    name: "Thu Hà",    nickname: "Giỏi việc nước, đảm việc nhà, nheo nhóc vì đàn em thơ", badge: "🏡", photo: null, emailHint: "ha***@dsc.com.vn" },
    { id: "chi",   name: "Linh Chis", nickname: "Chihuahua",                    badge: "🐶", photo: null, emailHint: "ch***@dsc.com.vn" },
    { id: "huong", name: "Hương Thù", nickname: "Có thù với nước có màu",       badge: "💧", photo: null, emailHint: "hu***@dsc.com.vn" },
    { id: "hang",  name: "Thu Hằng",  nickname: "80% là xem cam nhà trẻ",       badge: "📹", photo: null, emailHint: "ha***@dsc.com.vn" },
    { id: "ly",    name: "LyLy",      nickname: "emeLY",                        badge: "✨", photo: null, emailHint: "tr***@gmail.com" },
    { id: "nhi",   name: "Em Nhi",    nickname: "Con bot ngáo ngơ",             badge: "🤖", photo: null, emailHint: "nh***@dsc.com.vn" },
    { id: "lan",   name: "Lan",       nickname: null,                           badge: "🌸", photo: null, emailHint: "la***@dsc.com.vn" },
  ],

  // Tài khoản admin hiển thị với nhãn "Test" (2 email, xem members.local.sql)
  adminLabel: "Test",
  adminEmailHint: "ng***@gmail.com hoặc ng***@dsc.com.vn",
};
