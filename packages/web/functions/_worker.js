// API 代理 - 将 /api/* 请求转发到 Worker API
const API_URL = 'https://monopage-api.ice-blue-zyr.workers.dev';

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // 检查是否是 API 请求
  if (!url.pathname.startsWith('/api/')) {
    return next();
  }

  // 构建目标 URL
  const targetPath = url.pathname.replace('/api', '');
  const targetUrl = `${API_URL}${targetPath}${url.search}`;

  // 复制请求头
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // 跳过一些 hop-by-hop 头
    if (!['host', 'content-length'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  // 对于有 body 的请求，需要先读取 body
  let body = null;
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.text();
  }

  // 创建新的请求
  const proxyRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  });

  // 发送请求到 API
  const response = await fetch(proxyRequest);

  // 复制响应
  const modifiedResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  // 复制 Set-Cookie 头
  const setCookie = response.headers.get('Set-Cookie');
  if (setCookie) {
    modifiedResponse.headers.set('Set-Cookie', setCookie);
  }

  return modifiedResponse;
}
