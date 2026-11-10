import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { migrate } from './db.js';
import { api } from './routes.js';
import { authEnabled, checkPassword, issueToken, requireAuth } from './auth.js';

await migrate();

const app = new Hono();
app.use('*', logger());

// ---------- rotas públicas ----------
app.get('/api/health', (c) => c.json({ ok: true }));
app.get('/api/auth', (c) => c.json({ required: authEnabled }));
app.post('/api/login', async (c) => {
  const { password } = await c.req.json().catch(() => ({ password: '' }));
  if (!checkPassword(String(password ?? ''))) return c.json({ error: 'Senha inválida' }, 401);
  return c.json({ token: issueToken() });
});

// ---------- rotas protegidas ----------
app.use('/api/*', requireAuth);
app.route('/api', api);
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal_error', message: err.message }, 500);
});

// ---------- frontend (build do Vite) ----------
const distDir = resolve(process.cwd(), '../web/dist');
if (existsSync(distDir)) {
  const root = relative(process.cwd(), distDir);
  const indexHtml = readFileSync(resolve(distDir, 'index.html'), 'utf8');
  app.use('/*', serveStatic({ root }));
  app.get('*', (c) => (c.req.path.startsWith('/api/') ? c.json({ error: 'not_found' }, 404) : c.html(indexHtml)));
}

const port = Number(process.env.PORT) || 3333;
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`my-finances API em http://localhost:${info.port}  (auth ${authEnabled ? 'ativa' : 'desativada'})`);
});
