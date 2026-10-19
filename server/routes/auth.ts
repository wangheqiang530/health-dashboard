import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  clearDashboardSessionCookie,
  createDashboardSession,
  dashboardSessionCookie,
  extractDashboardSessionToken,
  findDashboardSession,
  revokeDashboardSession,
  revokeOtherDashboardSessions,
} from '../auth.ts';
import {
  DASHBOARD_SESSION_DURATIONS,
  getDashboardInitialPasswordPath,
  getDashboardSessionDuration,
  isDashboardSessionDuration,
  setDashboardPassword,
  setDashboardSessionDuration,
  verifyDashboardPassword,
} from '../settings.ts';

const loginSchema = z.object({
  password: z.string().min(1).max(200),
  duration: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8).max(200),
});

const sessionDurationSchema = z.object({
  duration: z.string(),
});

interface LoginAttempt {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, LoginAttempt>();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;

const loginAttemptKey = (request: FastifyRequest): string =>
  `${request.ip}:${request.headers['user-agent'] || 'unknown'}`;

const isRateLimited = (key: string): boolean => {
  const attempt = loginAttempts.get(key);
  if (!attempt) return false;
  if (Date.now() >= attempt.resetAt) {
    loginAttempts.delete(key);
    return false;
  }
  return attempt.count >= MAX_LOGIN_ATTEMPTS;
};

const recordFailedAttempt = (key: string): void => {
  const existing = loginAttempts.get(key);
  if (!existing || Date.now() >= existing.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: Date.now() + LOGIN_WINDOW_MS });
    return;
  }
  existing.count += 1;
};

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/auth/status', async (request) => {
    const token = extractDashboardSessionToken(request.headers);
    const session = await findDashboardSession(token);
    return {
      authenticated: Boolean(session),
      expiresAt: session?.expiresAt.toISOString() || null,
      sessionDuration: session?.duration || null,
      defaultSessionDuration: await getDashboardSessionDuration(),
      initialPasswordFile: await getDashboardInitialPasswordPath(),
      sessionDurations: DASHBOARD_SESSION_DURATIONS,
    };
  });

  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: '请输入有效密码。' });
    }

    const attemptKey = loginAttemptKey(request);
    if (isRateLimited(attemptKey)) {
      return reply.code(429).send({ error: '登录尝试过于频繁，请 15 分钟后再试。' });
    }

    const valid = await verifyDashboardPassword(body.data.password);
    if (!valid) {
      recordFailedAttempt(attemptKey);
      return reply.code(401).send({ error: '密码错误。' });
    }

    loginAttempts.delete(attemptKey);
    const defaultDuration = await getDashboardSessionDuration();
    const duration =
      body.data.duration && isDashboardSessionDuration(body.data.duration)
        ? body.data.duration
        : defaultDuration;
    const session = await createDashboardSession(duration, request);
    reply.header('Set-Cookie', dashboardSessionCookie(session.token, duration, request));
    return {
      ok: true,
      token: session.token,
      expiresAt: session.expiresAt.toISOString(),
      duration,
    };
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    await revokeDashboardSession(extractDashboardSessionToken(request.headers));
    reply.header('Set-Cookie', clearDashboardSessionCookie(request));
    return { ok: true };
  });

  app.get('/api/v1/auth/settings', async () => ({
    defaultSessionDuration: await getDashboardSessionDuration(),
    initialPasswordFile: await getDashboardInitialPasswordPath(),
    sessionDurations: DASHBOARD_SESSION_DURATIONS,
  }));

  app.put('/api/v1/auth/password', async (request, reply) => {
    const body = passwordSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: '新密码至少需要 8 个字符。' });
    }

    const valid = await verifyDashboardPassword(body.data.currentPassword);
    if (!valid) {
      return reply.code(400).send({ error: '当前密码不正确。' });
    }

    await setDashboardPassword(body.data.newPassword);
    const token = extractDashboardSessionToken(request.headers);
    const session = await findDashboardSession(token);
    if (session) {
      await revokeOtherDashboardSessions(session.tokenHash);
    }
    return { ok: true, message: '面板密码已更新，其他设备的登录会话已失效。' };
  });

  app.put('/api/v1/auth/session-duration', async (request, reply) => {
    const body = sessionDurationSchema.safeParse(request.body);
    if (!body.success || !isDashboardSessionDuration(body.data.duration)) {
      return reply.code(400).send({ error: '会话有效期无效。' });
    }
    const duration = await setDashboardSessionDuration(body.data.duration);
    return { ok: true, defaultSessionDuration: duration };
  });
}
