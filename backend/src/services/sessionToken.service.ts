import crypto from 'crypto';
import type { CookieOptions, Request, Response } from 'express';
import { prisma } from '../config/prisma.config';
import { getJwtRefreshExpiryMs } from '../config/jwt.config';

export const REFRESH_COOKIE_NAME = 'sp_refresh_token';
export const SESSION_TOKEN_DB_PREFIX = 'sess_';
const REFRESH_TOKEN_FORMAT_RE = /^[01]\.[A-Za-z0-9_-]{20,}$/;
const REPLAY_GRACE_WINDOW_MS = 5000;

export function hashSessionRefreshToken(rawToken: string): string {
  const digest = crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
  return `${SESSION_TOKEN_DB_PREFIX}${digest}`;
}

export function isValidRawSessionTokenFormat(rawToken: string): boolean {
  return REFRESH_TOKEN_FORMAT_RE.test(rawToken.trim());
}

export function parseCookieHeader(cookieHeader?: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;

  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const rawVal = part.slice(eqIdx + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(rawVal);
    } catch {
      cookies[key] = rawVal;
    }
  }
  return cookies;
}

export function getRefreshCookieFromRequest(req: Request): string {
  const parsedFromMiddleware = (req as any).cookies?.[REFRESH_COOKIE_NAME];
  if (typeof parsedFromMiddleware === 'string' && parsedFromMiddleware.trim()) {
    return parsedFromMiddleware.trim();
  }
  const fromHeader = parseCookieHeader(req.headers.cookie)[REFRESH_COOKIE_NAME];
  return typeof fromHeader === 'string' ? fromHeader.trim() : '';
}

export function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  if (forwardedProto === 'https') return true;
  const origin = String(req.headers.origin || '').trim().toLowerCase();
  if (origin.startsWith('https://')) return true;
  return false;
}

export function resolveRefreshCookieOptions(req: Request, maxAgeMs?: number): CookieOptions {
  const secure = isHttpsRequest(req);
  const base: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/api/v1/auth',
  };
  if (typeof maxAgeMs === 'number' && maxAgeMs > 0) {
    base.maxAge = maxAgeMs;
  }
  return base;
}

export function setSessionRefreshCookie(
  req: Request,
  res: Response,
  rawToken: string,
  persistent: boolean
): void {
  const maxAgeMs = persistent ? getJwtRefreshExpiryMs(true) : undefined;
  res.cookie(REFRESH_COOKIE_NAME, rawToken, resolveRefreshCookieOptions(req, maxAgeMs));
}

export function clearSessionRefreshCookie(req: Request, res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, resolveRefreshCookieOptions(req));
}

export function createRawSessionToken(persistent: boolean): string {
  return `${persistent ? '1' : '0'}.${crypto.randomBytes(32).toString('base64url')}`;
}

async function pruneStaleUserSessions(userId: string): Promise<void> {
  const now = new Date();
  const revokedCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await prisma.refreshToken
    .deleteMany({
      where: {
        userId,
        token: { startsWith: SESSION_TOKEN_DB_PREFIX },
        OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: revokedCutoff } }],
      },
    })
    .catch(() => {});
}

export async function issueSessionRefreshToken(
  userId: string,
  persistent: boolean = true
): Promise<{ rawToken: string; persistent: boolean; expiresAt: Date }> {
  const rawToken = createRawSessionToken(persistent);
  const tokenHash = hashSessionRefreshToken(rawToken);
  const expiresAt = new Date(Date.now() + getJwtRefreshExpiryMs(persistent));

  await prisma.refreshToken.create({
    data: {
      userId,
      token: tokenHash,
      expiresAt,
    },
  });

  void pruneStaleUserSessions(userId);
  return { rawToken, persistent, expiresAt };
}

export type RotateRefreshResult =
  | {
      ok: true;
      user: any;
      newRawToken: string;
      persistent: boolean;
    }
  | {
      ok: false;
      reason: 'missing' | 'invalid' | 'revoked' | 'expired' | 'suspended';
    };

export async function rotateSessionRefreshToken(rawToken: string): Promise<RotateRefreshResult> {
  const trimmed = String(rawToken || '').trim();
  if (!trimmed) {
    return { ok: false, reason: 'missing' };
  }
  if (!isValidRawSessionTokenFormat(trimmed)) {
    return { ok: false, reason: 'invalid' };
  }

  const persistent = trimmed.startsWith('1.');
  const tokenHash = hashSessionRefreshToken(trimmed);
  const record = await prisma.refreshToken.findFirst({
    where: { token: tokenHash },
    include: { user: true },
  });

  if (!record || !record.user) {
    return { ok: false, reason: 'invalid' };
  }

  if (record.user.status === 'SUSPENDED') {
    return { ok: false, reason: 'suspended' };
  }

  const now = new Date();
  if (record.revokedAt) {
    // Suspected token replay well past concurrent-tab grace: revoke active sessions for safety
    if (now.getTime() - record.revokedAt.getTime() > REPLAY_GRACE_WINDOW_MS) {
      await revokeAllUserSessions(record.userId);
    }
    return { ok: false, reason: 'revoked' };
  }

  if (record.expiresAt <= now) {
    return { ok: false, reason: 'expired' };
  }

  const newRawToken = createRawSessionToken(persistent);
  const newTokenHash = hashSessionRefreshToken(newRawToken);
  const newExpiresAt = new Date(now.getTime() + getJwtRefreshExpiryMs(persistent));

  const rotated = await prisma.$transaction(async (tx) => {
    const revokeRes = await tx.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: now },
    });
    if (revokeRes.count !== 1) {
      return false;
    }
    await tx.refreshToken.create({
      data: {
        userId: record.userId,
        token: newTokenHash,
        expiresAt: newExpiresAt,
      },
    });
    return true;
  });

  if (!rotated) {
    return { ok: false, reason: 'revoked' };
  }

  void pruneStaleUserSessions(record.userId);
  return {
    ok: true,
    user: record.user,
    newRawToken,
    persistent,
  };
}

export interface RevokedSessionActor {
  id: string;
  tenantId: string;
  email: string;
  role: string;
}

export async function revokeSessionRefreshToken(
  rawToken?: string
): Promise<RevokedSessionActor | null> {
  const trimmed = String(rawToken || '').trim();
  if (!trimmed || !isValidRawSessionTokenFormat(trimmed)) return null;
  const tokenHash = hashSessionRefreshToken(trimmed);
  try {
    const record = await prisma.refreshToken.findFirst({
      where: {
        token: tokenHash,
        revokedAt: null,
      },
      include: {
        user: {
          select: { id: true, tenantId: true, email: true, role: true },
        },
      },
    });
    await prisma.refreshToken.updateMany({
      where: {
        token: tokenHash,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (record?.user) {
      return {
        id: record.user.id,
        tenantId: record.user.tenantId || 'squadpipe-agency',
        email: record.user.email,
        role: String(record.user.role),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  if (!userId) return;
  await prisma.refreshToken
    .updateMany({
      where: {
        userId,
        token: { startsWith: SESSION_TOKEN_DB_PREFIX },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    })
    .catch(() => {});
}
