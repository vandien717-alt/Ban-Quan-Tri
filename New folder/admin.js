const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
async function api(path, options = {}) {
  let response;
  try { response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.headers || {}) } }); }
  catch { throw new Error('Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử lại.'); }
  const type = response.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Error(`Cloudflare chưa chạy API Worker cho website này (HTTP ${response.status}). Cần triển khai Worker, không chỉ upload file trang web.`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Máy chủ trả về lỗi HTTP ${response.status}.`);
  return data;
}
function showStatus(element, message, error = false) { element.textContent = message; element.classList.toggle('error', error); }
function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Không đọc được tệp.')); reader.readAsDataURL(file); });
}
document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.querySelector('#login-form'); const dashboard = document.querySelector('#dashboard'); const postForm = document.querySelector('#post-form');
  const loginStatus = loginForm.querySelector('.status'); const postStatus = postForm.querySelector('.status'); const dateInput = postForm.elements.date;
  const setLoggedIn = value => { dashboard.hidden = !value; loginForm.hidden = value; };
  dateInput.value = new Date().toISOString().slice(0, 10);
  try {
    const health = await api('/api/health');
    if (!health.adminConfigured) showStatus(loginStatus, 'Worker hoạt động nhưng chưa có secret ADMIN_PASSWORD hoặc SESSION_SECRET. Cấu hình trong Worker → Settings → Variables and Secrets.', true);
  } catch (error) { showStatus(loginStatus, error.message, true); }
  try { await api('/api/admin/session'); setLoggedIn(true); } catch { setLoggedIn(false); }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault(); const button = loginForm.querySelector('button[type="submit"]'); button.disabled = true; showStatus(loginStatus, 'Đang đăng nhập...');
    try {
      await api('/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: loginForm.elements.password.value }) });
      loginForm.reset(); showStatus(loginStatus, ''); setLoggedIn(true);
    } catch (error) { showStatus(loginStatus, error.message, true); }
    finally { button.disabled = false; }
  });
  document.querySelector('#logout').addEventListener('click', async () => { try { await api('/api/admin/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }); } finally { setLoggedIn(false); } });
  postForm.addEventListener('submit', async event => {
    event.preventDefault(); const button = postForm.querySelector('button[type="submit"]'); button.disabled = true; showStatus(postStatus, 'Đang đăng nội dung...');
    try {
      const file = postForm.elements.file.files[0]; let attachment;
      if (file) {
        if (file.size > MAX_FILE_BYTES) throw new Error('Tệp vượt quá giới hạn 1,5 MB.');
        if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) throw new Error('Chỉ nhận ảnh JPG, PNG, WEBP, GIF hoặc PDF.');
        attachment = { name: file.name, type: file.type, data: await fileAsDataUrl(file) };
      }
      await api('/api/admin/posts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: postForm.elements.title.value, kind: postForm.elements.kind.value, date: postForm.elements.date.value, body: postForm.elements.body.value, file: attachment }) });
      postForm.reset(); dateInput.value = new Date().toISOString().slice(0, 10); showStatus(postStatus, 'Đã đăng nội dung lên website.');
    } catch (error) { showStatus(postStatus, error.message, true); if (error.message.includes('hết hạn') || error.message.includes('chưa đăng nhập')) setLoggedIn(false); }
    finally { button.disabled = false; }
  });
});
