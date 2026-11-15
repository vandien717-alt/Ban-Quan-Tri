# Sửa lỗi đăng nhập trang quản trị

Mở trang quản trị rồi nhấn Ctrl+F5 để tải lại `admin.js` mới. Lỗi chung trước đây không phân biệt được API chưa được triển khai và mật khẩu sai. Bản mới sẽ hiện thông báo cụ thể.

## Kiểm tra API Worker

Mở trực tiếp địa chỉ `https://ban-quan-tri-khu1.vandienprint.workers.dev/api/health`.

- Nếu thấy JSON có `"worker":true`, Worker API đang chạy. `adminConfigured` cần là `true` để đăng nhập; giá trị `false` nghĩa là thiếu secret.
- Nếu hiện trang HTML, 404 hoặc `worker` không phải `true`, deploy Worker/API chưa đúng. Chỉ tải file HTML tĩnh sẽ không chạy được đăng nhập.

## Deploy lại Worker

Trong Cloudflare dashboard, đảm bảo deployment dùng module Worker `New folder/gemini-code-1794647485960.js`, assets directory `New folder`, và bật Worker-first cho `/api/*`. Nếu deploy bằng Wrangler, vào thư mục `New folder`, thay KV ID trong `wrangler.toml`, cài/đăng nhập Wrangler và chạy `wrangler deploy`.

Đặt lại secrets cho đúng Worker/environment đang triển khai:

```sh
wrangler secret put ADMIN_PASSWORD
wrangler secret put SESSION_SECRET
```

`SESSION_SECRET` phải dài ít nhất 32 ký tự. Nếu bạn cập nhật secret trên Production, hãy chắc chắn website đang mở là cùng Worker Production (không phải Preview/Development). Sau đó tải lại trang bằng Ctrl+F5 và nhập đúng giá trị `ADMIN_PASSWORD` mới.

Không gửi mật khẩu hoặc giá trị secret vào chat/GitHub. Nếu API báo cấu hình đầy đủ nhưng mật khẩu vẫn sai, đặt lại `ADMIN_PASSWORD` bằng lệnh trên rồi thử lại. Lưu ý mật khẩu phân biệt chữ hoa/chữ thường và không tự thêm dấu cách đầu/cuối.
