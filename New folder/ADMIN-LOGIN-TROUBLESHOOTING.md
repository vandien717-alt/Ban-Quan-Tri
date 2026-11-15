# Sửa lỗi đăng nhập trang quản trị (HTTP 404)

Ảnh lỗi `API quản trị chưa được Worker xử lý (HTTP 404)` có nghĩa là trang web đang được phục vụ như file tĩnh, hoặc Worker đang chạy code cũ chỉ chuyển tiếp request sang static assets. Mật khẩu không phải nguyên nhân của lỗi này.

## Đã sửa trong repository

- Worker entry point `gemini-code-1794647485960.js` hiện có API `/api/health`, `/api/admin/login`, `/api/admin/session`, `/api/admin/logout`, `/api/admin/posts`, `/api/posts` và `/api/feedback`.
- `wrangler.toml` giờ đặt tên Worker `ban-quan-tri-khu1` theo hostname người dùng cung cấp; bật Worker-first cho `/api/*`; `/admin` được chuyển tới `/admin.html`.
- Đã bỏ KV ID giả `ban-quan-tri-khu1`. Đăng nhập chỉ cần Worker secrets; để lưu bài đăng cần thêm KV binding `BQT_POSTS` qua dashboard.

## Cấu hình trong Cloudflare Dashboard

1. Chọn đúng account → **Workers & Pages** → Worker **ban-quan-tri-khu1**.
2. Mở **Settings → Variables and Secrets**; thêm secrets cho **Production**: `ADMIN_PASSWORD` (mật khẩu do BQT chọn), `SESSION_SECRET` (chuỗi ngẫu nhiên tối thiểu 32 ký tự). Không paste bí mật vào GitHub.
3. Vào **Storage & databases → Workers KV**, tạo namespace hoặc dùng namespace bài đăng đang có. Copy namespace ID.
4. Trong Worker settings, **Bindings → Add → KV namespace**, variable name phải chính xác `BQT_POSTS`; chọn namespace; Save.
5. Triển khai Worker bằng đúng entry point từ repo (`New folder/gemini-code-1794647485960.js`) với Static Assets directory `New folder` và Worker-first route `/api/*`. Nếu dashboard đang kết nối Git, production branch `main`, root directory `New folder`, deploy bằng Wrangler config tại thư mục đó. Đợi deployment mới thành công.
6. Không tạo Worker khác: URL cần giữ là `ban-quan-tri-khu1.workers.dev`.

## Kiểm tra

Mở `https://ban-quan-tri-khu1.workers.dev/api/health`. Phải thấy JSON với `worker: true`, `adminConfigured: true`, `postsConfigured: true`. Nếu `worker: true` không xuất hiện, Cloudflare vẫn chưa triển khai entry point Worker này; sửa mật khẩu không giải quyết được HTTP 404. Sau đó vào `/admin`, đăng nhập bằng giá trị bạn đã đặt cho `ADMIN_PASSWORD`.

Nếu đã đặt secrets nhưng health trả `adminConfigured: false`, đặt lại secrets ở môi trường **Production** cho đúng Worker. Không gửi mật khẩu, `SESSION_SECRET`, API key hay cookie phiên trong chat.
