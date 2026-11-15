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
  const article = document.createElement('article'); article.className = post.kind === 'activity' ? 'activity-item' : 'news-item';
  const icon = document.createElement('div'); icon.className = 'item-icon';
  if (post.file?.type?.startsWith('image/') && post.file.data) {
    const image = document.createElement('img'); image.src = post.file.data; image.alt = `Ảnh đính kèm: ${post.title}`; icon.append(image);
  } else {
    const symbol = document.createElement('i'); symbol.className = post.file?.type === 'application/pdf' ? 'fa-solid fa-file-pdf' : (post.kind === 'activity' ? 'fa-solid fa-people-group' : 'fa-solid fa-bullhorn'); symbol.setAttribute('aria-hidden', 'true'); icon.append(symbol);
  }
  const copy = document.createElement('div'); copy.className = 'item-copy';
  const title = document.createElement('h3'); title.textContent = post.title; copy.append(title);
  if (post.body) { const description = document.createElement('p'); description.textContent = post.body; copy.append(description); }
  const date = document.createElement('time'); date.dateTime = post.date || ''; date.textContent = formatDate(post.date); copy.append(date);
  if (post.file?.data) {
    const attachment = document.createElement('a'); attachment.href = post.file.data; attachment.download = post.file.name || 'tep-dinh-kem'; attachment.target = '_blank'; attachment.rel = 'noopener noreferrer'; attachment.textContent = `Mở tệp đính kèm: ${post.file.name || 'Tệp'}`; copy.append(attachment);
  }
  article.append(icon, copy); return article;
}
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra, vui lòng thử lại.');
  return data;
}
function renderPosts(serverPosts = []) {
  const notices = [...serverPosts.filter(post => post.kind !== 'activity'), ...initialNotices];
  const activities = serverPosts.filter(post => post.kind === 'activity');
  document.querySelector('#notice-list').replaceChildren(...notices.map(createPostElement));
  const list = document.querySelector('#activity-list');
  if (!activities.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'Chưa có hoạt động mới của Ban Quản Trị.'; list.replaceChildren(empty); }
  else list.replaceChildren(...activities.map(createPostElement));
}
async function loadPosts() {
  try { const data = await api('/api/posts'); renderPosts(Array.isArray(data.posts) ? data.posts : []); }
  catch { renderPosts([]); }
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
      await api('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: form.elements.name.value, apartment: form.elements.apartment.value, message: form.elements.message.value, website: form.elements.website.value }) });
      form.reset(); status.textContent = 'Đã gửi góp ý riêng đến Ban Quản Trị. Xin cảm ơn!';
    } catch (error) { status.textContent = error.message; status.classList.add('error'); }
    finally { button.disabled = false; }
  });
}
function addDialogStyles() {
  const style = document.createElement('style'); style.textContent = `.feedback-dialog{width:min(520px,calc(100% - 28px));border:0;border-radius:15px;padding:0;box-shadow:0 20px 70px #001c10aa;color:#172a23}.feedback-dialog::backdrop{background:#002515aa;backdrop-filter:blur(3px)}.dialog-head{display:flex;align-items:center;justify-content:space-between;padding:15px 20px;background:#075632;color:white}.dialog-head h2{margin:0;font-size:1.15rem}.dialog-close{border:0;background:transparent;color:white;font-size:1.5rem;cursor:pointer}.dialog-body{padding:18px 20px}.dialog-body form{display:grid;gap:9px}.dialog-body label{font-weight:700;font-size:.88rem}.dialog-body input,.dialog-body textarea{width:100%;border:1px solid #cbd8d0;border-radius:7px;padding:10px;font:inherit}.dialog-body button{border:0;border-radius:7px;background:#075632;color:white;padding:11px 14px;font:inherit;font-weight:700;cursor:pointer}.private-note{font-size:.82rem;color:#59685f;margin:0 0 8px}.feedback-status{min-height:1.2em;margin:0;color:#075632;font-size:.85rem;font-weight:600}.feedback-status.error{color:#b42318}.website-field{position:absolute!important;left:-10000px!important}`;
  document.head.append(style);
}
function setupSearch() {
  const input = document.querySelector('#site-search');
  input.addEventListener('input', () => { const query = input.value.trim().toLocaleLowerCase('vi'); document.querySelectorAll('.news-item, .document-item, .activity-item').forEach(item => { item.hidden = query.length > 0 && !item.textContent.toLocaleLowerCase('vi').includes(query); }); });
}
function setupMenu() {
  const button = document.querySelector('.menu-toggle'); const links = document.querySelector('#nav-links');
  button.addEventListener('click', () => { const open = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', String(open)); links.classList.toggle('is-open', open); });
  links.addEventListener('click', event => { const anchor = event.target.closest('a'); if (!anchor) return; if (anchor.dataset.feedback === 'true') { event.preventDefault(); document.querySelector('#feedback-dialog').showModal(); } button.setAttribute('aria-expanded', 'false'); links.classList.remove('is-open'); });
  document.querySelectorAll('[data-feedback="true"]').forEach(anchor => anchor.addEventListener('click', event => { event.preventDefault(); document.querySelector('#feedback-dialog').showModal(); }));
}
document.addEventListener('DOMContentLoaded', () => { addDialogStyles(); renderPosts(); loadPosts(); buildFeedbackDialog(); setupSearch(); setupMenu(); document.querySelector('#current-year').textContent = new Date().getFullYear(); });
