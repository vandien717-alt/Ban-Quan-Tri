const STORAGE_KEY = 'becamex-bqt-posts-v1';
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
const initialNotices = [
  { title: 'Thông báo về việc tổ chức Trung thu cho các cháu thiếu nhi năm 2026', date: '2026-09-16', body: 'Thông tin chương trình Trung thu dành cho các cháu thiếu nhi trong khu dân cư.', kind: 'notice' },
  { title: 'Hướng dẫn phòng cháy chữa cháy trong khu dân cư', date: '2026-09-10', body: 'Một số lưu ý để đảm bảo an toàn phòng cháy chữa cháy.', kind: 'notice' },
  { title: 'Kế hoạch bảo trì thang máy và hệ thống thiết bị tòa nhà', date: '2026-09-05', body: 'Kế hoạch bảo trì định kỳ các hạng mục tại khu dân cư.', kind: 'notice' }
];

function formatDate(value) {
  if (!value) return '';
  const parts = value.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
}
function createPostElement(post) {
  const article = document.createElement('article');
  article.className = post.kind === 'activity' ? 'activity-item' : 'news-item';
  const icon = document.createElement('div');
  icon.className = 'item-icon';
  if (post.file?.type?.startsWith('image/') && post.file.data) {
    const image = document.createElement('img'); image.src = post.file.data; image.alt = `Ảnh đính kèm: ${post.title}`; icon.append(image);
  } else {
    const symbol = document.createElement('i');
    symbol.className = post.file?.type === 'application/pdf' ? 'fa-solid fa-file-pdf' : (post.kind === 'activity' ? 'fa-solid fa-people-group' : 'fa-solid fa-bullhorn');
    symbol.setAttribute('aria-hidden', 'true'); icon.append(symbol);
  }
  const copy = document.createElement('div'); copy.className = 'item-copy';
  const title = document.createElement('h3'); title.textContent = post.title; copy.append(title);
  if (post.body) { const description = document.createElement('p'); description.textContent = post.body; copy.append(description); }
  const date = document.createElement('time'); date.dateTime = post.date || ''; date.textContent = formatDate(post.date); copy.append(date);
  if (post.file?.data) {
    const attachment = document.createElement('a'); attachment.href = post.file.data; attachment.download = post.file.name || 'tep-dinh-kem';
    attachment.target = '_blank'; attachment.rel = 'noopener noreferrer'; attachment.textContent = `Mở tệp đính kèm: ${post.file.name || 'Tệp'}`; copy.append(attachment);
  }
  article.append(icon, copy); return article;
}
function renderPosts(serverPosts = []) {
  const notices = [...serverPosts.filter(post => post.kind !== 'activity'), ...initialNotices];
  const activities = serverPosts.filter(post => post.kind === 'activity');
  document.querySelector('#notice-list').replaceChildren(...notices.map(createPostElement));
  const list = document.querySelector('#activity-list');
  if (!activities.length) {
    const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'Chưa có hoạt động mới của Ban Quản Trị.'; list.replaceChildren(empty);
  } else list.replaceChildren(...activities.map(createPostElement));
}
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra, vui lòng thử lại.');
  return data;
}
async function loadPosts() {
  try { const data = await api('/api/posts', { method: 'GET', headers: {} }); renderPosts(Array.isArray(data.posts) ? data.posts : []); }
  catch { renderPosts([]); }
}
function addStyles() {
  const style = document.createElement('style');
  style.textContent = `
    [hidden]{display:none!important}.feedback-dialog{width:min(520px,calc(100% - 28px));border:0;border-radius:15px;padding:0;box-shadow:0 20px 70px #001c10aa;color:#172a23}.feedback-dialog::backdrop{background:#002515aa;backdrop-filter:blur(3px)}
    .dialog-head{display:flex;align-items:center;justify-content:space-between;padding:15px 20px;background:#075632;color:white}.dialog-head h2{margin:0;font-size:1.15rem}.dialog-close{border:0;background:transparent;color:white;font-size:1.5rem;cursor:pointer}.dialog-body{padding:18px 20px}.dialog-body form,.admin-form{display:grid;gap:9px}.dialog-body label,.admin-form label{font-weight:700;font-size:.88rem}.dialog-body input,.dialog-body textarea,.admin-form input,.admin-form select,.admin-form textarea{width:100%;border:1px solid #cbd8d0;border-radius:7px;padding:10px;font:inherit}.dialog-body button,.admin-form button,.admin-actions button{border:0;border-radius:7px;background:#075632;color:white;padding:11px 14px;font:inherit;font-weight:700;cursor:pointer}.dialog-body button:hover,.admin-form button:hover,.admin-actions button:hover{background:#034328}.private-note{font-size:.82rem;color:#59685f;margin:0 0 8px}.feedback-status,.admin-status{min-height:1.2em;margin:0;color:#075632;font-size:.85rem;font-weight:600}.feedback-status.error,.admin-status.error{color:#b42318}.admin-area{grid-column:1/-1}.admin-area .panel-body{padding:16px}.admin-login{max-width:440px}.admin-form .form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.admin-form input[type=file]{font-size:.82rem}.admin-actions{display:flex;justify-content:flex-end;margin-bottom:12px}.admin-controls{display:grid;grid-template-columns:1fr 1.2fr;gap:22px}.admin-controls h3{margin:0 0 12px;color:#075632}.admin-hint{margin:0;color:#5f6b64;font-size:.85rem}@media(max-width:700px){.admin-controls{grid-template-columns:1fr}.admin-form .form-row{grid-template-columns:1fr}}
  `;
  document.head.append(style);
}
function buildFeedbackDialog() {
  const dialog = document.createElement('dialog'); dialog.className = 'feedback-dialog'; dialog.id = 'feedback-dialog';
  dialog.innerHTML = `<div class="dialog-head"><h2><i class="fa-solid fa-comments"></i> Liên hệ – Góp ý</h2><button class="dialog-close" type="button" aria-label="Đóng">&times;</button></div><div class="dialog-body"><p class="private-note">Thông tin góp ý chỉ được gửi riêng đến Ban Quản Trị, không hiển thị công khai trên trang web.</p><form id="feedback-form"><label for="feedback-name">Họ và tên *</label><input id="feedback-name" name="name" maxlength="100" required autocomplete="name"><label for="feedback-apartment">Số căn hộ *</label><input id="feedback-apartment" name="apartment" maxlength="40" required placeholder="Ví dụ: A2.1.15"><label for="feedback-message">Nội dung góp ý *</label><textarea id="feedback-message" name="message" rows="5" maxlength="5000" required></textarea><label class="website-field" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><button type="submit"><i class="fa-solid fa-paper-plane"></i> Gửi góp ý</button><p class="feedback-status" role="status" aria-live="polite"></p></form></div>`;
  document.body.append(dialog);
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.querySelector('#feedback-form').addEventListener('submit', async event => {
    event.preventDefault(); const form = event.currentTarget; const status = form.querySelector('.feedback-status'); const button = form.querySelector('button[type="submit"]');
    status.textContent = 'Đang gửi...'; status.classList.remove('error'); button.disabled = true;
    try {
      await api('/api/feedback', { method: 'POST', body: JSON.stringify({ name: form.elements.name.value, apartment: form.elements.apartment.value, message: form.elements.message.value, website: form.elements.website.value }) });
      form.reset(); status.textContent = 'Đã gửi góp ý riêng đến Ban Quản Trị. Xin cảm ơn!';
    } catch (error) { status.textContent = error.message; status.classList.add('error'); }
    finally { button.disabled = false; }
  });
  return dialog;
}
function buildAdminArea() {
  const section = document.createElement('section'); section.className = 'panel admin-area'; section.id = 'upload'; section.hidden = true;
  section.innerHTML = `<div class="panel-heading"><h2><i class="fa-solid fa-lock"></i> KHU VỰC BAN QUẢN TRỊ</h2><span class="admin-badge">Chỉ tài khoản BQT</span></div><div class="panel-body"><div class="admin-actions"><button type="button" class="admin-logout" hidden>Đăng xuất</button></div><div class="admin-login"><p class="private-note">Đăng nhập để đăng thông báo và hoạt động lên website.</p><form class="admin-form" id="admin-login-form"><label for="admin-password">Mật khẩu Ban Quản Trị</label><input id="admin-password" name="password" type="password" autocomplete="current-password" required><button type="submit">Đăng nhập</button><p class="admin-status" role="status"></p></form></div><div class="admin-controls" hidden><div><h3>Đăng thông tin mới</h3><form class="admin-form" id="admin-post-form"><label for="admin-title">Tiêu đề *</label><input id="admin-title" name="title" maxlength="120" required><div class="form-row"><div><label for="admin-kind">Loại nội dung</label><select id="admin-kind" name="kind"><option value="notice">Thông báo</option><option value="activity">Hoạt động</option></select></div><div><label for="admin-date">Ngày đăng *</label><input id="admin-date" name="date" type="date" required></div></div><label for="admin-body">Nội dung</label><textarea id="admin-body" name="body" rows="4" maxlength="5000"></textarea><label for="admin-file">Ảnh hoặc PDF (tối đa 1,5 MB)</label><input id="admin-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"><button type="submit">Đăng tải</button><p class="admin-status" role="status"></p></form></div><div><h3>Quản lý nội dung hiển thị</h3><p class="admin-hint">Nội dung sẽ được lưu trên máy chủ và hiển thị công khai trong mục Thông báo hoặc Hoạt động.</p></div></div></div>`;
  document.querySelector('.dashboard').append(section);
  const login = section.querySelector('#admin-login-form');
  const loginStatus = login.querySelector('.admin-status');
  const loginBox = section.querySelector('.admin-login');
  const controls = section.querySelector('.admin-controls');
  const logout = section.querySelector('.admin-logout');
  const setAuthenticated = authenticated => { loginBox.hidden = authenticated; controls.hidden = !authenticated; logout.hidden = !authenticated; };
  const checkSession = async () => { try { await api('/api/admin/session', { method: 'GET', headers: {} }); setAuthenticated(true); } catch { setAuthenticated(false); } };
  login.addEventListener('submit', async event => {
    event.preventDefault(); loginStatus.textContent = 'Đang xác thực...'; loginStatus.classList.remove('error');
    try { await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: login.elements.password.value }) }); login.reset(); loginStatus.textContent = ''; setAuthenticated(true); }
    catch (error) { loginStatus.textContent = error.message; loginStatus.classList.add('error'); }
  });
  logout.addEventListener('click', async () => { try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } finally { setAuthenticated(false); } });
  const postForm = section.querySelector('#admin-post-form');
  section.querySelector('#admin-date').value = new Date().toISOString().slice(0, 10);
  postForm.addEventListener('submit', async event => {
    event.preventDefault(); const status = postForm.querySelector('.admin-status'); const button = postForm.querySelector('button[type="submit"]'); button.disabled = true; status.textContent = 'Đang đăng...'; status.classList.remove('error');
    try {
      const file = postForm.elements.file.files[0]; let attachment;
      if (file) {
        if (file.size > MAX_FILE_BYTES) throw new Error('Tệp vượt quá giới hạn 1,5 MB.');
        if (!['application/pdf','image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('Chỉ nhận ảnh JPG, PNG, WEBP, GIF hoặc PDF.');
        attachment = { name: file.name, type: file.type, data: await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Không đọc được tệp.')); reader.readAsDataURL(file); }) };
      }
      await api('/api/admin/posts', { method: 'POST', body: JSON.stringify({ title: postForm.elements.title.value, kind: postForm.elements.kind.value, date: postForm.elements.date.value, body: postForm.elements.body.value, file: attachment }) });
      postForm.reset(); section.querySelector('#admin-date').value = new Date().toISOString().slice(0, 10); status.textContent = 'Đã đăng nội dung lên website.'; await loadPosts();
    } catch (error) { status.textContent = error.message; status.classList.add('error'); if (error.message.includes('đăng nhập')) setAuthenticated(false); }
    finally { button.disabled = false; }
  });
  section.hidden = false;
  checkSession();
  return section;
}
function setupSearch() {
  const input = document.querySelector('#site-search');
  input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase('vi');
    document.querySelectorAll('.news-item, .document-item, .activity-item').forEach(item => { item.hidden = query.length > 0 && !item.textContent.toLocaleLowerCase('vi').includes(query); });
  });
}
function setupMenu() {
  const button = document.querySelector('.menu-toggle'); const links = document.querySelector('#nav-links');
  button.addEventListener('click', () => { const open = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', String(open)); links.classList.toggle('is-open', open); });
  links.addEventListener('click', event => {
    const anchor = event.target.closest('a'); if (!anchor) return;
    if (anchor.getAttribute('href') === '#contact') { event.preventDefault(); document.querySelector('#feedback-dialog').showModal(); }
    if (anchor.getAttribute('href') === '#upload') { event.preventDefault(); document.querySelector('#upload').scrollIntoView({ behavior: 'smooth' }); }
    button.setAttribute('aria-expanded', 'false'); links.classList.remove('is-open');
  });
  document.querySelectorAll('a[href="#contact"]').forEach(anchor => anchor.addEventListener('click', event => { event.preventDefault(); document.querySelector('#feedback-dialog').showModal(); }));
}
document.addEventListener('DOMContentLoaded', () => {
  addStyles();
  const oldUpload = document.querySelector('.upload-panel'); if (oldUpload) oldUpload.remove();
  renderPosts(); loadPosts();
  buildFeedbackDialog(); buildAdminArea(); setupSearch(); setupMenu();
  document.querySelector('#current-year').textContent = new Date().getFullYear();
});
