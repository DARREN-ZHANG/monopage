// API 代理 - 将 /api/* 请求转发到 Worker API
const API_URL = 'https://monopage-api.ice-blue-zyr.workers.dev';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // 检查是否是 API 请求
  if (url.pathname.startsWith('/api/')) {
    // 构建目标 URL
    const targetPath = url.pathname.replace('/api', '');
    const targetUrl = `${API_URL}${targetPath}${url.search}`;

    // 转发请求
    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    });

    // 发送请求到 API
    const response = await fetch(modifiedRequest);

    // 复制响应并添加 CORS 头（如果需要）
    const modifiedResponse = new Response(response.body, response);

    // 复制所有 Set-Cookie 头
    const setCookie = response.headers.get('Set-Cookie');
    if (setCookie) {
      // 需要修改 Cookie 的 domain 和 secure 属性
      const modifiedCookie = setCookie
        .replace(/;\s*Secure/gi, '; Secure')
        .replace(/;\s*Domain=[^;]+/gi, '');
      modifiedResponse.headers.set('Set-Cookie', modifiedCookie);
    }

    return modifiedResponse;
  }

  // 非 API 请求，返回静态资源（由 Pages 处理）
  return context.next();
}
