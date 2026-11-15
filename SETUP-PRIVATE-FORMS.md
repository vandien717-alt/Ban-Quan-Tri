# Cấu hình riêng tư cho website Ban Quản Trị

Website cần chạy bằng Cloudflare Worker (module worker) cùng Cloudflare Static Assets. Không dùng cách kiểm tra mật khẩu chỉ ở JavaScript trình duyệt: khu vực đăng bài được bảo vệ ở Worker và nội dung đăng được lưu ở KV.

## Thiết lập Cloudflare

1. Deploy thư mục `New folder` làm Static Assets và dùng `gemini-code-1794647485960.js` làm Worker entry point; bật chế độ Worker xử lý request trước assets để các đường dẫn `/api/*` được Worker nhận.
2. Tạo một Cloudflare KV namespace, sau đó thêm binding tên `BQT_POSTS` trỏ đến namespace vừa tạo.
3. Thêm các Worker secrets/variables:
   - `ADMIN_PASSWORD`: mật khẩu mạnh, chỉ chia sẻ với thành viên BQT được phép đăng bài.
   - `SESSION_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 ký tự.
   - `RESEND_API_KEY`: API key của Resend.
   - `RESEND_FROM`: địa chỉ gửi đã xác minh domain trong Resend, ví dụ `Ban Quan Tri <bqt@ten-mien-da-xac-minh.vn>`.
   - `BQT_EMAIL`: địa chỉ nhận góp ý, ví dụ `bqt.noxh.becamex1b@gmail.com`.
4. Gắn domain đã xác minh với Resend, deploy Worker, rồi thử gửi góp ý và đăng thử nội dung bằng tài khoản quản trị.

## Quyền riêng tư và giới hạn

- Form góp ý gửi họ tên, căn hộ, nội dung trực tiếp từ Worker tới `BQT_EMAIL`; nội dung góp ý không được lưu vào KV hoặc hiển thị trên trang.
- Thông báo và hoạt động chỉ được đăng sau khi đăng nhập hợp lệ. Cookie phiên `HttpOnly`, `Secure`, `SameSite=Strict`, hết hạn sau 8 giờ.
- Bài đăng công khai được lưu trong KV; vì là nội dung công khai, không đăng thông tin cá nhân nhạy cảm trong bài viết.
- Form phía trình duyệt không thể bí mật gửi email trực tiếp. Worker dùng Resend để giữ API key ở phía máy chủ. Không đặt API key/mật khẩu trong `app.js`, HTML hoặc repository.
- Nếu thiếu cấu hình Cloudflare/Resend, biểu mẫu sẽ báo lỗi cấu hình thay vì giả vờ gửi thành công.
