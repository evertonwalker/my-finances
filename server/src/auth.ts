import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';

const PASSWORD = process.env.APP_PASSWORD || '';
// Se AUTH_SECRET não for definido, gera um a cada boot (tokens expiram ao reiniciar).
const SECRET = process.env.AUTH_SECRET || randomBytes(32).toString('hex');
const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 dias

export const authEnabled = PASSWORD.length > 0;

function sign(payload: string) {
  return createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkPassword(input: string) {
  if (!authEnabled) return true;
  return safeEqual(sign(input), sign(PASSWORD));
}

export function issueToken() {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${sign(exp)}`;
}

function verifyToken(token: string) {
  const [exp, sig] = token.split('.');
  if (!exp || !sig) return false;
  if (!safeEqual(sig, sign(exp))) return false;
  return Number(exp) > Date.now();
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (!authEnabled) return next();
  const header = c.req.header('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !verifyToken(token)) return c.json({ error: 'unauthorized' }, 401);
  return next();
};
