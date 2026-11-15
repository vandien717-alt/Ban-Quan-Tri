const COOKIE_NAME = 'bqt_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_JSON_BYTES = 2 * 1024 * 1024;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers
    }
  });
}
function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function sessionKey(secret, usages) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}
async function createSession(secret) {
  const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await sessionKey(secret, ['sign']), new TextEncoder().encode(payload)));
  return `${payload}.${encodeBase64Url(signature)}`;
}
async function hasValidSession(request, secret) {
  const cookie = request.headers.get('Cookie') || '';
  const pair = cookie.split(';').map(value => value.trim()).find(value => value.startsWith(`${COOKIE_NAME}=`));
  if (!pair) return false;
  try {
    const [payload, signature, extra] = decodeURIComponent(pair.slice(COOKIE_NAME.length + 1)).split('.');
    if (!payload || !signature || extra) return false;
    const valid = await crypto.subtle.verify('HMAC', await sessionKey(secret, ['verify']), decodeBase64Url(signature), new TextEncoder().encode(payload));
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return valid && Number.isInteger(claims.exp) && claims.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
async function parseJson(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_JSON_BYTES) throw new Error('Dữ liệu gửi lên quá lớn.');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) throw new Error('Dữ liệu gửi lên quá lớn.');
  return JSON.parse(text);
}
function adminConfigured(env) {
  return Boolean(env.ADMIN_PASSWORD && env.SESSION_SECRET && env.SESSION_SECRET.length >= 32);
}
function cookie(value, maxAge) {
  return `${COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}`;
}
async function handleApi(request, env, url) {
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json({ worker: true, adminConfigured: adminConfigured(env), postsConfigured: Boolean(env.BQT_POSTS), mailConfigured: Boolean(env.RESEND_API_KEY && env.BQT_EMAIL && env.RESEND_FROM) });
  }

  if (url.pathname === '/api/posts' && request.method === 'GET') {
    if (!env.BQT_POSTS) return json({ posts: [] });
    try {
      const posts = await env.BQT_POSTS.get('published-posts', 'json') || [];
      return json({ posts: Array.isArray(posts) ? posts : [] });
    } catch { return json({ error: 'Không thể tải bài đăng lúc này.' }, 500); }
  }

  if (url.pathname === '/api/feedback' && request.method === 'POST') {
    if (request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
    if (!env.RESEND_API_KEY || !env.BQT_EMAIL || !env.RESEND_FROM) return json({ error: 'Chưa cấu hình email góp ý trên Worker.' }, 503);
    try {
      const data = await parseJson(request);
      const name = String(data.name || '').trim().slice(0, 100);
      const apartment = String(data.apartment || '').trim().slice(0, 40);
      const message = String(data.message || '').trim().slice(0, 5000);
      if (!name || !apartment || !message) return json({ error: 'Vui lòng nhập họ tên, số căn hộ và nội dung góp ý.' }, 400);
      if (String(data.website || '').trim()) return json({ ok: true });
      const result = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: env.RESEND_FROM, to: [env.BQT_EMAIL], subject: `Góp ý cư dân - Căn hộ ${apartment}`, text: `GÓP Ý GỬI BAN QUẢN TRỊ\n\nHọ và tên: ${name}\nSố căn hộ: ${apartment}\n\nNội dung góp ý:\n${message}` })
      });
      if (!result.ok) return json({ error: 'Dịch vụ email chưa gửi được. Kiểm tra cấu hình Resend.' }, 502);
      return json({ ok: true });
    } catch (error) { return json({ error: error instanceof SyntaxError ? 'Dữ liệu gửi lên không hợp lệ.' : (error.message || 'Không thể gửi góp ý.') }, 400); }
  }

  if (url.pathname.startsWith('/api/admin/')) {
    if (!adminConfigured(env)) return json({ error: 'Worker thiếu ADMIN_PASSWORD hoặc SESSION_SECRET (cần tối thiểu 32 ký tự).' }, 503);

    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      try {
        const data = await parseJson(request);
        const provided = new TextEncoder().encode(String(data.password || ''));
        const expected = new TextEncoder().encode(env.ADMIN_PASSWORD);
        const providedHash = new Uint8Array(await crypto.subtle.digest('SHA-256', provided));
        const expectedHash = new Uint8Array(await crypto.subtle.digest('SHA-256', expected));
        let mismatch = provided.length ^ expected.length;
        for (let i = 0; i < providedHash.length; i++) mismatch |= providedHash[i] ^ expectedHash[i];
        if (mismatch) return json({ error: 'Mật khẩu không khớp với secret ADMIN_PASSWORD trong Worker Production.' }, 401);
        return json({ ok: true }, 200, { 'set-cookie': cookie(encodeURIComponent(await createSession(env.SESSION_SECRET)), SESSION_SECONDS) });
      } catch (error) { return json({ error: error instanceof SyntaxError ? 'Yêu cầu đăng nhập không hợp lệ.' : 'Không thể tạo phiên đăng nhập.' }, 400); }
    }

    if (url.pathname === '/api/admin/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
    if (!await hasValidSession(request, env.SESSION_SECRET)) return json({ error: 'Phiên đăng nhập hết hạn hoặc chưa đăng nhập. Hãy đăng nhập lại.' }, 401);
    if (url.pathname === '/api/admin/session' && request.method === 'GET') return json({ authenticated: true });

    if (url.pathname === '/api/admin/posts' && request.method === 'POST') {
      if (!env.BQT_POSTS) return json({ error: 'Đăng nhập thành công nhưng Worker chưa được gắn KV binding tên BQT_POSTS.' }, 503);
      try {
        const data = await parseJson(request);
        const title = String(data.title || '').trim().slice(0, 120);
        const body = String(data.body || '').trim().slice(0, 5000);
        const date = String(data.date || '');
        const kind = data.kind === 'activity' ? 'activity' : 'notice';
        if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Tiêu đề và ngày đăng là bắt buộc.' }, 400);
        let file;
        if (data.file?.data) {
          if (typeof data.file.data !== 'string' || data.file.data.length > 1_900_000) return json({ error: 'Tệp đính kèm quá lớn.' }, 413);
          if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(data.file.type)) return json({ error: 'Chỉ hỗ trợ PDF hoặc ảnh JPG, PNG, WEBP, GIF.' }, 400);
          file = { name: String(data.file.name || 'tep-dinh-kem').slice(0, 160), type: data.file.type, data: data.file.data };
        }
        const posts = await env.BQT_POSTS.get('published-posts', 'json') || [];
        posts.unshift({ id: crypto.randomUUID(), title, body, date, kind, file });
        await env.BQT_POSTS.put('published-posts', JSON.stringify(posts.slice(0, 200)));
        return json({ ok: true });
      } catch (error) { return json({ error: error.message || 'Không thể lưu bài đăng.' }, 400); }
    }
  }
  return json({ error: 'Không tìm thấy API.' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
    if (url.pathname === '/admin') return Response.redirect(new URL('/admin.html', url), 302);
    return env.ASSETS.fetch(request);
  }
};
