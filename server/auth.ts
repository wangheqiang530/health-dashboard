import { createHash, randomBytes } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { pool } from './db.ts';
import type { DashboardSessionDuration } from './settings.ts';

const SESSION_COOKIE = 'health_dashboard_session';
const SESSION_DURATION_MS: Record<DashboardSessionDuration, number> = {
  session: 7 * 24 * 60 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '365d': 365 * 24 * 60 * 60 * 1000,
};

export interface DashboardSession {
  tokenHash: string;
  expiresAt: Date;
  duration: DashboardSessionDuration;
}

const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex');

const parseCookies = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key) return cookies;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
    return cookies;
  }, {});
};

export function extractDashboardSessionToken(
  headers: FastifyRequest['headers']
): string {
  const authorization = headers.authorization;
  if (typeof authorization === 'string' && authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  const direct = headers['x-dashboard-token'];
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  return parseCookies(headers.cookie)[SESSION_COOKIE] || '';
}

export async function findDashboardSession(
  token: string
): Promise<DashboardSession | null> {
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  const result = await pool.query<{
    token_hash: string;
    expires_at: Date;
    duration: DashboardSessionDuration;
  }>(
    `UPDATE dashboard_sessions
     SET last_seen_at = NOW()
     WHERE token_hash = $1 AND expires_at > NOW()
     RETURNING token_hash, expires_at, duration`,
    [tokenHash]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
    duration: row.duration,
  };
}

export async function createDashboardSession(
  duration: DashboardSessionDuration,
  request: FastifyRequest
): Promise<{ token: string; tokenHash: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS[duration]);

  await pool.query('DELETE FROM dashboard_sessions WHERE expires_at <= NOW()');
  await pool.query(
    `INSERT INTO dashboard_sessions
       (token_hash, duration, expires_at, user_agent, source_ip)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      tokenHash,
      duration,
      expiresAt,
      request.headers['user-agent'] || null,
      request.ip || null,
    ]
  );

  return { token, tokenHash, expiresAt };
}

export async function revokeDashboardSession(token: string): Promise<void> {
  if (!token) return;
  await pool.query('DELETE FROM dashboard_sessions WHERE token_hash = $1', [
    hashSessionToken(token),
  ]);
}

export async function revokeOtherDashboardSessions(tokenHash: string): Promise<void> {
  await pool.query('DELETE FROM dashboard_sessions WHERE token_hash <> $1', [tokenHash]);
}

const isSecureRequest = (request: FastifyRequest): boolean => {
  const forwardedProto = request.headers['x-forwarded-proto'];
  if (typeof forwardedProto === 'string') {
    return forwardedProto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return request.protocol === 'https';
};

export function dashboardSessionCookie(
  token: string,
  duration: DashboardSessionDuration,
  request: FastifyRequest
): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (isSecureRequest(request)) parts.push('Secure');
  if (duration !== 'session') {
    parts.push(`Max-Age=${Math.floor(SESSION_DURATION_MS[duration] / 1000)}`);
  }
  return parts.join('; ');
}

export function clearDashboardSessionCookie(request: FastifyRequest): string {
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (isSecureRequest(request)) parts.push('Secure');
  return parts.join('; ');
}
