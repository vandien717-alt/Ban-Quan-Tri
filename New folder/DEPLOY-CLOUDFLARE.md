# Triển khai Cloudflare và quản trị nội dung

## Chuẩn bị một lần

Cấu hình này chạy Worker module và Static Assets bằng Cloudflare Wrangler. Chạy các lệnh từ thư mục `New folder` trong repository.

1. Cài Node.js và Wrangler: `npm install --global wrangler`, sau đó đăng nhập: `wrangler login`.
2. Tạo KV namespace lưu bài đăng: `wrangler kv namespace create BQT_POSTS`.
3. Mở `wrangler.toml`, thay `REPLACE_WITH_KV_NAMESPACE_ID` bằng ID Wrangler vừa trả về.
4. Cấu hình secrets (không đưa các giá trị này vào GitHub hoặc mã frontend):

   ```sh
   wrangler secret put ADMIN_PASSWORD
   wrangler secret put SESSION_SECRET
   wrangler secret put RESEND_API_KEY
   wrangler secret put BQT_EMAIL
   wrangler secret put RESEND_FROM
   ```

   - `ADMIN_PASSWORD`: dùng mật khẩu mạnh, riêng cho BQT.
   - `SESSION_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 ký tự.
   - `RESEND_API_KEY`: API key Resend.
   - `BQT_EMAIL`: email BQT nhận góp ý (ví dụ `bqt.noxh.becamex1b@gmail.com`).
   - `RESEND_FROM`: địa chỉ gửi được xác minh bởi Resend, ví dụ `Ban Quan Tri <bqt@domain-da-xac-minh.vn>`.

5. Trong Resend, xác minh domain gửi thư; địa chỉ Gmail đích có thể là người nhận, nhưng địa chỉ `from` cần đáp ứng yêu cầu xác minh của Resend.
6. Deploy: `wrangler deploy`. Sau đó mở trang website và `/admin.html`.

Wrangler sẽ gọi Worker trước với API routes `/api/*`; các file trang web còn lại được phục vụ qua Static Assets binding `ASSETS`.

## Quyền riêng tư / bảo mật

- Form góp ý gửi họ tên, số căn hộ và lời nhắn trực tiếp từ Worker đến `BQT_EMAIL` qua Resend. Những nội dung này không được lưu vào KV, không trả về danh sách bài đăng và không hiển thị công khai.
- Đăng bài yêu cầu mật khẩu được kiểm tra trên Worker. Phiên đăng nhập được ký bằng `SESSION_SECRET`, đặt trong cookie `HttpOnly; Secure; SameSite=Strict`, thời hạn 8 giờ.
- Bài đăng của BQT được lưu trong KV và công khai trên trang chủ. Không đăng thông tin cư dân nhạy cảm trong nội dung công khai.
- `/admin.html` không được liệt kê trong tìm kiếm (`noindex`), nhưng URL có thể truy cập công khai; bảo vệ thực sự nằm ở API Worker, không phải việc ẩn URL.
- Chỉ dùng trên HTTPS (Cloudflare cung cấp HTTPS sau deploy). Thay mật khẩu khi thành viên BQT rời quyền quản trị.

## Kiểm tra sau deploy

1. Mở trang chủ và gửi góp ý thử; xác nhận email về đúng hộp thư và không thấy nội dung góp ý trên website.
2. Mở `/admin.html`, thử đăng xuất rồi đăng nhập bằng `ADMIN_PASSWORD`.
3. Đăng một bài thử, kiểm tra bài xuất hiện trên trang chủ; đăng xuất và thử gửi API đăng bài để xác nhận bị từ chối.

Nếu chưa cấu hình KV hoặc Resend, website sẽ thông báo lỗi phù hợp, không giả vờ lưu hoặc gửi thành công.
