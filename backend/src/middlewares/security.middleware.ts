import { Request, Response, NextFunction } from 'express';

export const securityHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (process.env.NODE_ENV === 'production' && (req.secure || forwardedProto === 'https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

export function getAllowedCorsOrigins(): string[] {
  const isProd = process.env.NODE_ENV === 'production';
  const configured = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && !(isProd && origin === '*'));

  if (configured.length > 0) {
    return configured;
  }

  const frontendUrl = (process.env.FRONTEND_URL || '').trim();
  if (isProd) {
    return frontendUrl && frontendUrl !== '*' ? [frontendUrl] : [];
  }

  const devDefaults = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  if (frontendUrl && !devDefaults.includes(frontendUrl)) {
    devDefaults.push(frontendUrl);
  }
  return devDefaults;
}

export function createCorsOriginChecker() {
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser / server-to-server requests with no Origin header
    if (!origin) {
      callback(null, true);
      return;
    }

    const allowed = getAllowedCorsOrigins();
    if (allowed.includes('*') || allowed.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin "${origin}" is not permitted by CORS policy`));
  };
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix: string;
  message?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, RateLimitBucket>();

  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }, Math.max(60_000, options.windowMs));
  pruneInterval.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const cfConnectingIp = req.headers['cf-connecting-ip'];
    const clientIp =
      (Array.isArray(cfConnectingIp) ? cfConnectingIp[0] : cfConnectingIp)?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'anonymous';
    const identity = req.user?.id || clientIp;
    const key = `${options.keyPrefix}:${identity}`;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', String(options.max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.max - 1)));
      next();
      return;
    }

    existing.count += 1;
    const remaining = Math.max(0, options.max - existing.count);
    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (existing.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        message: options.message || 'Too many requests. Please wait and try again.',
      });
      return;
    }

    next();
  };
}

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 60),
  keyPrefix: 'auth',
  message: 'Too many authentication attempts. Please wait a few minutes and try again.',
});

export const sensitiveAuthRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.SENSITIVE_AUTH_RATE_LIMIT_MAX || 25),
  keyPrefix: 'auth-sensitive',
  message: 'Too many password or verification attempts. Please try again later.',
});

export const emailRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.EMAIL_RATE_LIMIT_MAX || 60),
  keyPrefix: 'email',
  message: 'Email dispatch rate limit reached. Please wait before sending more emails.',
});

export const uploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_LIMIT_MAX || 250),
  keyPrefix: 'upload',
  message: 'Too many file uploads/parses in a short period. Please wait a moment.',
});

export const publicUploadRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.PUBLIC_UPLOAD_RATE_LIMIT_MAX || 60),
  keyPrefix: 'public-upload',
  message: 'Too many application submissions from this IP. Please wait a moment and try again.',
});

