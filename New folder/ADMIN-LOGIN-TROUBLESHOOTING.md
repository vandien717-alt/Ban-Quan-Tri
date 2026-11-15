# Sửa lỗi đăng nhập Admin (API HTTP 404)

Ảnh lỗi `API quản trị chưa được Worker xử lý (HTTP 404)` có nghĩa là Worker API chưa được triển khai vào đúng hostname. Đây không phải lỗi mật khẩu. Bản mới trong repository hiện có route đăng nhập thực tế và cấu hình Worker khớp hostname `ban-quan-tri-khu1`.

## Điểm cần lưu ý trước deploy

`wrangler.toml` nằm trong `New folder`; tên Worker là `ban-quan-tri-khu1`; asset directory là thư mục hiện tại. KV không bắt buộc để đăng nhập. Để đăng bài, hãy thêm KV binding variable name `BQT_POSTS` trong Worker Settings. Không dùng placeholder KV ID.

## Cloudflare Dashboard

1. Vào **Workers & Pages → ban-quan-tri-khu1 → Deployments**. Xác nhận Worker service/production đang trỏ tới hostname `ban-quan-tri-khu1.vandienprint.workers.dev`.
2. Nếu Workers Builds được kết nối GitHub, chọn repo `vandien717-alt/Ban-Quan-Tri`, production branch `main`, root directory `New folder`, và bật deploy bằng Wrangler config. Redeploy revision mới nhất.
3. Nếu đang dùng upload/Pages static deployment, nó không cài API Worker. Tạo/cập nhật Worker từ `New folder/gemini-code-1794647485960.js` với Static Assets directory `New folder` và Worker-first cho `/api/*`, hoặc dùng Workers Builds/Wrangler. Không chỉ upload `admin.html`.
4. Ở Worker **Settings → Variables and Secrets → Production**, đặt `ADMIN_PASSWORD` (mật khẩu thật) và `SESSION_SECRET` (chuỗi ngẫu nhiên dài tối thiểu 32 ký tự). Lưu và triển khai lại Production.
5. Trong **Settings → Bindings**, gắn KV namespace cho bài đăng với variable name chính xác `BQT_POSTS`.
6. Mở `https://ban-quan-tri-khu1.vandienprint.workers.dev/api/health`. Phải thấy JSON và `worker:true`, `adminConfigured:true`; `postsConfigured:true` nếu đã gắn KV.
7. Mở `/admin`, Ctrl+F5 rồi đăng nhập. UI hiện tại sẽ chỉ rõ lỗi API, thiếu secret, mật khẩu sai hoặc KV chưa gắn.

Không đặt mật khẩu trong JS/HTML hoặc GitHub, và không gửi mật khẩu/secret trong chat. Xem thêm hướng dẫn deploy: `DEPLOY-CLOUDFLARE.md`.
