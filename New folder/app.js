const STORAGE_KEY = 'becamex-bqt-posts-v1';
const MAX_FILE_BYTES = 1.5 * 1024 * 1024;
const initialNotices = [
  { title: 'Thông báo về việc tổ chức Trung thu cho các cháu thiếu nhi năm 2026', date: '2026-09-16', body: 'Thông tin chương trình Trung thu dành cho các cháu thiếu nhi trong khu dân cư.', kind: 'notice' },
  { title: 'Hướng dẫn phòng cháy chữa cháy trong khu dân cư', date: '2026-09-10', body: 'Một số lưu ý để đảm bảo an toàn phòng cháy chữa cháy.', kind: 'notice' },
  { title: 'Kế hoạch bảo trì thang máy và hệ thống thiết bị tòa nhà', date: '2026-09-05', body: 'Kế hoạch bảo trì định kỳ các hạng mục tại khu dân cư.', kind: 'notice' }
];

function readPosts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

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
  if (post.file && post.file.type && post.file.type.startsWith('image/')) {
    const image = document.createElement('img');
    image.src = post.file.data;
    image.alt = `Ảnh đính kèm: ${post.title}`;
    icon.append(image);
  } else {
    const symbol = document.createElement('i');
    symbol.className = post.file && post.file.type === 'application/pdf' ? 'fa-solid fa-file-pdf' : (post.kind === 'activity' ? 'fa-solid fa-people-group' : 'fa-solid fa-bullhorn');
    symbol.setAttribute('aria-hidden', 'true');
    icon.append(symbol);
  }
  const copy = document.createElement('div');
  copy.className = 'item-copy';
  const title = document.createElement('h3');
  title.textContent = post.title;
  copy.append(title);
  if (post.body) {
    const description = document.createElement('p');
    description.textContent = post.body;
    copy.append(description);
  }
  const date = document.createElement('time');
  date.dateTime = post.date || '';
  date.textContent = formatDate(post.date);
  copy.append(date);
  if (post.file && post.file.data) {
    const attachment = document.createElement('a');
    attachment.href = post.file.data;
    attachment.download = post.file.name || 'tep-dinh-kem';
    attachment.target = '_blank';
    attachment.rel = 'noopener noreferrer';
    attachment.textContent = `Mở tệp đính kèm: ${post.file.name || 'Tệp'}`;
    copy.append(attachment);
  }
  article.append(icon, copy);
  return article;
}

function renderPosts() {
  const posts = readPosts().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const notices = [...posts.filter(post => post.kind !== 'activity'), ...initialNotices];
  const activities = posts.filter(post => post.kind === 'activity');
  const noticeList = document.querySelector('#notice-list');
  const activityList = document.querySelector('#activity-list');
  noticeList.replaceChildren(...notices.map(createPostElement));
  if (!activities.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Chưa có hoạt động mới. Ban Quản Trị có thể đăng hoạt động bằng biểu mẫu bên cạnh.';
    activityList.replaceChildren(empty);
  } else {
    activityList.replaceChildren(...activities.map(createPostElement));
  }
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Không thể đọc tệp đã chọn.'));
    reader.readAsDataURL(file);
  });
}

function setupForm() {
  const form = document.querySelector('#post-form');
  const status = document.querySelector('#form-status');
  const dateInput = document.querySelector('#post-date');
  dateInput.value = new Date().toISOString().slice(0, 10);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.textContent = '';
    status.classList.remove('error');
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const file = form.elements.file.files[0];
      let attachment;
      if (file) {
        if (file.size > MAX_FILE_BYTES) throw new Error('Tệp vượt quá giới hạn 1,5 MB. Vui lòng chọn tệp nhỏ hơn.');
        if (!(file.type.startsWith('image/') || file.type === 'application/pdf')) throw new Error('Chỉ nhận ảnh hoặc tài liệu PDF.');
        attachment = { name: file.name, type: file.type, data: await fileAsDataUrl(file) };
      }
      const post = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: form.elements.title.value.trim(),
        body: form.elements.body.value.trim(),
        date: form.elements.date.value,
        kind: form.elements.type.value,
        file: attachment
      };
      if (!post.title) throw new Error('Vui lòng nhập tiêu đề.');
      const current = readPosts();
      current.unshift(post);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
      renderPosts();
      form.reset();
      dateInput.value = new Date().toISOString().slice(0, 10);
      status.textContent = post.kind === 'activity' ? 'Đã đăng hoạt động trên trình duyệt này.' : 'Đã đăng thông báo trên trình duyệt này.';
    } catch (error) {
      status.textContent = error.name === 'QuotaExceededError' ? 'Bộ nhớ trình duyệt đã đầy. Hãy thử xóa bớt nội dung hoặc chọn tệp nhỏ hơn.' : error.message;
      status.classList.add('error');
    } finally {
      submit.disabled = false;
    }
  });
}

function setupSearch() {
  const input = document.querySelector('#site-search');
  input.addEventListener('input', () => {
    const query = input.value.trim().toLocaleLowerCase('vi');
    document.querySelectorAll('.news-item, .document-item, .activity-item').forEach(item => {
      item.hidden = query.length > 0 && !item.textContent.toLocaleLowerCase('vi').includes(query);
    });
  });
}

function setupMenu() {
  const button = document.querySelector('.menu-toggle');
  const links = document.querySelector('#nav-links');
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    links.classList.toggle('is-open', open);
  });
  links.addEventListener('click', event => {
    if (event.target.closest('a')) {
      button.setAttribute('aria-expanded', 'false');
      links.classList.remove('is-open');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderPosts();
  setupForm();
  setupSearch();
  setupMenu();
  document.querySelector('#current-year').textContent = new Date().getFullYear();
});
