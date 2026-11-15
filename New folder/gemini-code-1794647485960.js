const COOKIE_NAME = 'bqt_admin_session';
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_JSON_BYTES = 2 * 1024 * 1024;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers } });
}
function b64url(bytes) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function fromB64url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
function cookie(value, maxAge) {
  return `bqt_admin_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}`;
}
async function sessionKey(secret, usage) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [usage]);
}
async function createSession(secret) {
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await sessionKey(secret, 'sign'), new TextEncoder().encode(payload)));
  return `${payload}.${b64url(signature)}`;
}
async function validSession(request, secret) {
  const pair = (request.headers.get('Cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith('bqt_admin_session='));
  if (!pair) return false;
  try {
    const [payload, signature, extra] = decodeURIComponent(pair.slice('bqt_admin_session='.length)).split('.');
    if (!payload || !signature || extra) return false;
    const verified = await crypto.subtle.verify('HMAC', await sessionKey(secret, 'verify'), fromB64url(signature), new TextEncoder().encode(payload));
    const claims = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return verified && Number.isInteger(claims.exp) && claims.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}
async function readJson(request) {
  if (Number(request.headers.get('content-length') || 0) > MAX_JSON_BYTES) throw new Error('Dữ liệu gửi lên quá lớn.');
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_JSON_BYTES) throw new Error('Dữ liệu gửi lên quá lớn.');
  return JSON.parse(body);
}
function adminReady(env) {
  return Boolean(env.ADMIN_PASSWORD && env.SESSION_SECRET && env.SESSION_SECRET.length >= 32);
}

async function handleApi(request, env, url) {
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json({ worker: true, adminConfigured: adminReady(env), postsConfigured: Boolean(env.BQT_POSTS), mailConfigured: Boolean(env.RESEND_API_KEY && env.BQT_EMAIL && env.RESEND_FROM) });
  }
  if (url.pathname === '/api/posts' && request.method === 'GET') {
    if (!env.BQT_POSTS) return json({ posts: [] });
    try { return json({ posts: await env.BQT_POSTS.get('published-posts', 'json') || [] }); }
    catch { return json({ error: 'Không thể tải bài đăng lúc này.' }, 500); }
  }
  if (url.pathname.startsWith('/api/admin/')) {
    if (!adminReady(env)) return json({ error: 'Worker thiếu ADMIN_PASSWORD hoặc SESSION_SECRET (tối thiểu 32 ký tự).' }, 503);
    if (url.pathname === '/api/admin/login' && request.method === 'POST') {
      try {
        const body = await readJson(request);
        const input = new TextEncoder().encode(String(body.password || ''));
        const expected = new TextEncoder().encode(env.ADMIN_PASSWORD);
        const inputHash = new Uint8Array(await crypto.subtle.digest('SHA-256', input));
        const expectedHash = new Uint8Array(await crypto.subtle.digest('SHA-256', expected));
        let mismatch = input.length ^ expected.length;
        for (let i = 0; i < inputHash.length; i++) mismatch |= inputHash[i] ^ expectedHash[i];
        if (mismatch) return json({ error: 'Mật khẩu không khớp với ADMIN_PASSWORD của Worker Production. Kiểm tra đúng Worker/môi trường và thử lại.' }, 401);
        return json({ ok: true }, 200, { 'set-cookie': cookie(encodeURIComponent(await createSession(env.SESSION_SECRET)), SESSION_SECONDS) });
      } catch (error) { return json({ error: error instanceof SyntaxError ? 'Dữ liệu đăng nhập không hợp lệ.' : (error.message || 'Không thể đăng nhập.') }, 400); }
    }
    if (url.pathname === '/api/admin/logout' && request.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': cookie('', 0) });
    if (!await validSession(request, env.SESSION_SECRET)) return json({ error: 'Phiên đăng nhập hết hạn hoặc chưa đăng nhập. Hãy đăng nhập lại.' }, 401);
    if (url.pathname === '/api/admin/session' && request.method === 'GET') return json({ authenticated: true });
    if (url.pathname === '/api/admin/posts' && request.method === 'POST') {
      if (!env.BQT_POSTS) return json({ error: 'Worker chưa được gắn KV namespace với tên binding BQT_POSTS.' }, 503);
      try {
        const body = await readJson(request);
        const title = String(body.title || '').trim().slice(0, 120);
        const content = String(body.body || '').trim().slice(0, 5000);
        const date = String(body.date || '');
        const kind = body.kind === 'activity' ? 'activity' : 'notice';
        if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Tiêu đề và ngày đăng là bắt buộc.' }, 400);
        let file;
        if (body.file?.data) {
          if (typeof body.file.data !== 'string' || body.file.data.length > 1_900_000) return json({ error: 'Tệp đính kèm quá lớn.' }, 413);
          if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(body.file.type)) return json({ error: 'Chỉ hỗ trợ PDF hoặc ảnh JPG, PNG, WEBP, GIF.' }, 400);
          file = { name: String(body.file.name || 'tep-dinh-kem').slice(0, 160), type: body.file.type, data: body.file.data };
        }
        const posts = await env.BQT_POSTS.get('published-posts', 'json') || [];
        posts.unshift({ id: crypto.randomUUID(), title, body: content, date, kind, file });
        await env.BQT_POSTS.put('published-posts', JSON.stringify(posts.slice(0, 200)));
        return json({ ok: true });
      } catch (error) { return json({ error: error.message || 'Không thể lưu bài đăng.' }, 400); }
    }
  }
  if (url.pathname === '/api/feedback' && request.method === 'POST') {
    if (!env.RESEND_API_KEY || !env.BQT_EMAIL || !env.RESEND_FROM) return json({ error: 'Chưa cấu hình email góp ý trên Worker.' }, 503);
    try {
      const body = await readJson(request);
      const name = String(body.name || '').trim().slice(0, 100);
      const apartment = String(body.apartment || '').trim().slice(0, 40);
      const message = String(body.message || '').trim().slice(0, 5000);
      if (!name || !apartment || !message) return json({ error: 'Vui lòng nhập họ tên, số căn hộ và nội dung góp ý.' }, 400);
      if (String(body.website || '').trim()) return json({ ok: true });
      const result = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.RESEND_FROM, to: [env.BQT_EMAIL], subject: `Góp ý cư dân - Căn hộ ${apartment}`, text: `Họ tên: ${name}\nSố căn hộ: ${apartment}\n\nNội dung:\n${message}` }) });
      return result.ok ? json({ ok: true }) : json({ error: 'Resend chưa gửi được email; kiểm tra cấu hình dịch vụ.' }, 502);
    } catch (error) { return json({ error: error.message || 'Không thể gửi góp ý.' }, 400); }
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
