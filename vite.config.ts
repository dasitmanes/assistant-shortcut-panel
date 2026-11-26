import react from '@vitejs/plugin-react';
import { defineConfig, type Connect, type Plugin } from 'vite';

const modes = new Set(['allowed', 'paused', 'forbidden']);
const contextFields = ['object_id', 'object_type', 'route'];

function isMockInvocation(body: unknown): boolean {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  if (Object.keys(body).sort().join(',') !== contextFields.join(',')) return false;

  const context = body as Record<string, unknown>;
  return typeof context.route === 'string' && /^\/(?!\/)[^?#\\]*$/.test(context.route) &&
    ((context.object_type === null && context.object_id === null) ||
      (typeof context.object_type === 'string' && typeof context.object_id === 'string'));
}

const demoApi: Connect.NextHandleFunction = (request, response, next) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (!url.pathname.startsWith('/api/assistant/')) return next();

  function send(status: number, data?: unknown) {
    response.writeHead(status, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' });
    response.end(data === undefined ? undefined : JSON.stringify(data));
  }

  if (url.pathname === '/api/assistant/policy' && request.method === 'GET') {
    const selected = url.searchParams.get('scenario') ?? '';
    const access = modes.has(selected) ? selected : 'forbidden';
    response.setHeader('Set-Cookie', `assistant-demo-mode=${access}; Path=/api/assistant; HttpOnly; SameSite=Strict`);
    send(200, { access });
    return;
  }

  if (url.pathname !== '/api/assistant/invoke' || request.method !== 'POST') {
    send(404);
    return;
  }

  const policy = /(?:^|;\s*)assistant-demo-mode=([^;]*)/.exec(request.headers.cookie ?? '')?.[1];
  if (policy !== 'allowed') {
    send(policy === 'paused' ? 423 : 403);
    return;
  }

  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk: string) => {
    if (body.length <= 4096) body += chunk.slice(0, 4097 - body.length);
  });
  request.on('end', () => {
    if (body.length > 4096) return send(413);
    try {
      send(isMockInvocation(JSON.parse(body)) ? 204 : 400);
    } catch {
      send(400);
    }
  });
};

function mockAssistant(): Plugin {
  return {
    name: 'local-assistant-demo-api',
    configureServer(server) { server.middlewares.use(demoApi); },
    configurePreviewServer(server) { server.middlewares.use(demoApi); },
  };
}

export default defineConfig({ plugins: [react(), mockAssistant()] });
