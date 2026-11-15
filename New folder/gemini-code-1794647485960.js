const COOKIE_NAME = 'bqt_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_JSON_BYTES = 2 * 1024 * 1024;
const ALLOWED_ORIGIN = null;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}
function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromBase64url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}
async function createSession(secret) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  const signature = base64url(await hmac(secret, payload));
  return `${payload}.${signature}`;
}
async function validSession(request, secret) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  const token = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const verified = await crypto.subtle.verify('HMAC', key, fromBase64url(signature), new TextEncoder().encode(payload));
    const claims = JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
    return verified && Number.isInteger(claims.exp) && claims.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
function originAllowed(request) {
  const origin = request.headers.get('Origin');
  return !origin || origin === new URL(request.url).origin;
}
async function readJson(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_JSON_BYTES) throw new Error('Dữ liệu gửi lên quá lớn.');
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) throw new Error('Dữ liệu gửi lên quá lớn.');
  return JSON.parse(text);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': url.origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400', 'vary': 'Origin' } });

    if (url.pathname === '/api/posts' && request.method === 'GET') {
      if (!env.BQT_POSTS) return json({ posts: [] });
      try {
        const posts = await env.BQT_POSTS.get('published-posts', 'json') || [];
        return json({ posts: Array.isArray(posts) ? posts : [] });
      } catch { return json({ error: 'Không thể tải nội dung lúc này.' }, 500); }
    }

    if (url.pathname === '/api/feedback' && request.method === 'POST') {
      if (!originAllowed(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
      if (!env.RESEND_API_KEY || !env.BQT_EMAIL || !env.RESEND_FROM) return json({ error: 'Hệ thống nhận góp ý chưa được cấu hình. Vui lòng liên hệ Ban Quản Trị.' }, 503);
      try {
        const data = await readJson(request);
        const name = String(data.name || '').trim().slice(0, 100);
        const apartment = String(data.apartment || '').trim().slice(0, 40);
        const message = String(data.message || '').trim().slice(0, 5000);
        if (!name || !apartment || !message) return json({ error: 'Vui lòng nhập họ tên, số căn hộ và nội dung góp ý.' }, 400);
        if (String(data.website || '').trim()) return json({ ok: true });
        const email = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            from: env.RESEND_FROM,
            to: [env.BQT_EMAIL],
            subject: `Góp ý cư dân - Căn hộ ${apartment}`,
            text: `GÓP Ý GỬI BAN QUẢN TRỊ\n\nHọ và tên: ${name}\nSố căn hộ: ${apartment}\n\nNội dung góp ý:\n${message}`
          })
        });
        if (!email.ok) return json({ error: 'Chưa gửi được góp ý. Vui lòng thử lại sau.' }, 502);
        return json({ ok: true });
      } catch (error) {
        return json({ error: error instanceof SyntaxError ? 'Dữ liệu gửi lên không hợp lệ.' : (error.message || 'Không thể gửi góp ý lúc này.') }, 400);
      }
    }

    if (url.pathname.startsWith('/api/admin/')) {
      if (!originAllowed(request)) return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
      if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET || env.SESSION_SECRET.length < 32) return json({ error: 'Chưa cấu hình tài khoản quản trị an toàn.' }, 503);
      if (url.pathname === '/api/admin/login' && request.method === 'POST') {
        try {
          const data = await readJson(request);
          const supplied = new TextEncoder().encode(String(data.password || ''));
          const configured = new TextEncoder().encode(env.ADMIN_PASSWORD);
          const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', value));
          const a = await digest(supplied), b = await digest(configured);
          let diff = supplied.length ^ configured.length;
          for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
          if (diff !== 0) return json({ error: 'Mật khẩu không chính xác.' }, 401);
          const token = await createSession(env.SESSION_SECRET);
          return json({ ok: true }, 200, { 'set-cookie': `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${SESSION_SECONDS}` });
        } catch { return json({ error: 'Yêu cầu đăng nhập không hợp lệ.' }, 400); }
      }
      if (url.pathname === '/api/admin/logout' && request.method === 'POST') {
        return json({ ok: true }, 200, { 'set-cookie': `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0` });
      }
      if (!await validSession(request, env.SESSION_SECRET)) return json({ error: 'Vui lòng đăng nhập tài khoản Ban Quản Trị.' }, 401);
      if (url.pathname === '/api/admin/session' && request.method === 'GET') return json({ authenticated: true });
      if (url.pathname === '/api/admin/posts' && request.method === 'POST') {
        if (!env.BQT_POSTS) return json({ error: 'Kho lưu trữ nội dung chưa được cấu hình.' }, 503);
        try {
          const data = await readJson(request);
          const title = String(data.title || '').trim().slice(0, 120);
          const body = String(data.body || '').trim().slice(0, 5000);
          const date = String(data.date || '');
          const kind = data.kind === 'activity' ? 'activity' : 'notice';
          if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Tiêu đề và ngày đăng là bắt buộc.' }, 400);
          let file;
          if (data.file && data.file.data) {
            if (typeof data.file.data !== 'string' || data.file.data.length > 1_900_000) return json({ error: 'Tệp đính kèm quá lớn.' }, 413);
            if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(data.file.type)) return json({ error: 'Chỉ hỗ trợ PDF hoặc ảnh JPG, PNG, WEBP, GIF.' }, 400);
            file = { name: String(data.file.name || 'tep-dinh-kem').slice(0, 160), type: data.file.type, data: data.file.data };
          }
          const posts = await env.BQT_POSTS.get('published-posts', 'json') || [];
          posts.unshift({ id: crypto.randomUUID(), title, body, date, kind, file });
          await env.BQT_POSTS.put('published-posts', JSON.stringify(posts.slice(0, 200)));
          return json({ ok: true });
        } catch (error) { return json({ error: error.message || 'Không thể đăng nội dung lúc này.' }, 400); }
      }
    }
    return json({ error: 'Không tìm thấy API.' }, 404);
  }
};
