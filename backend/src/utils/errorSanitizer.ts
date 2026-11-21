const UNIQUE_CONSTRAINT_PATTERN = /Unique constraint failed/i;
const NOT_FOUND_PATTERN = /Record to (?:update|delete) (?:not found|does not exist)/i;
const FILE_TOO_LARGE_PATTERN = /\b(?:LIMIT_FILE_SIZE|File too large|entity\.too\.large)\b/i;

const INTERNAL_ERROR_PATTERNS: RegExp[] = [
  /\bprisma\b/i,
  /PrismaClient/i,
  /ConnectorError/i,
  /PostgresError/i,
  /QueryEngine/i,
  /postgresql:\/\//i,
  /postgres:\/\//i,
  /Can't reach database server/i,
  /Invalid `[^`]+` invocation/i,
  /Foreign key constraint/i,
  /Null constraint violation/i,
  /\brelation "[^"]+" does not exist\b/i,
  /\bcolumn "[^"]+" (?:of relation "[^"]+" )?does not exist\b/i,
  /\bdatabase "[^"]*" does not exist\b/i,
  /\bpg_hba\b/i,
  /\bpg_catalog\b/i,
  /\b(?:ECONNREFUSED|ETIMEDOUT|ECONNRESET|ENOTFOUND|EAI_AGAIN)\b/i,
  /\bfetch failed\b/i,
  /\bsocket hang up\b/i,
  /\bpostgres(?:ql)?\b/i,
  /AI JSON repair failed/i,
  /Schema validation failed/i,
  /Invalid JSON syntax/i,
  /\bZodError\b/i,
  /\b(?:TypeError|SyntaxError|ReferenceError|RangeError|MulterError)\b/,
  /Unexpected token/i,
  /Failed to (?:upload|retrieve) CV (?:to|from)/i,
  /Resume parser service/i,
  /Number must be (?:greater|less) than/i,
  /Expected (?:string|number|boolean|object|array), received/i,
  /environment variable/i,
  /\b(?:SMTP|JWT|CLOUDFLARE_R2|AWS_S3|OPENAI|ANTHROPIC|GEMINI)_[A-Z0-9_]+\b/,
  /\b(?:JsonWebTokenError|TokenExpiredError|NotBeforeError)\b/i,
  /Request failed with status code/i,
  /\b(?:EHOSTUNREACH|EPIPE)\b/i,
];

const SERVER_5XX_DB_PATTERNS: RegExp[] = [
  ...INTERNAL_ERROR_PATTERNS,
  /\bdatabase\b/i,
  /\bsql\b/i,
  /constraint/i,
  /\bERR_[A-Z0-9_]+\b/,
];

/**
 * Strips database, ORM, connection string, AI/schema internals, and stack traces from HTTP
 * error messages so clients and toast banners never expose technical or infrastructure details.
 */
export const sanitizeErrorMessage = (
  rawMessage: unknown,
  fallback = 'Something went wrong while processing your request.',
  isServerError = true
): string => {
  if (typeof rawMessage !== 'string' || !rawMessage.trim()) {
    return fallback;
  }

  const trimmed = rawMessage.trim();

  if (UNIQUE_CONSTRAINT_PATTERN.test(trimmed)) {
    return 'A record with these details already exists.';
  }

  if (NOT_FOUND_PATTERN.test(trimmed)) {
    return 'The requested record was not found.';
  }

  if (FILE_TOO_LARGE_PATTERN.test(trimmed)) {
    return 'The uploaded file is too large. Please upload a smaller file.';
  }

  const patterns = isServerError ? SERVER_5XX_DB_PATTERNS : INTERNAL_ERROR_PATTERNS;
  if (patterns.some((pattern) => pattern.test(trimmed))) {
    return fallback;
  }

  return trimmed;
};

export const sanitizeThrownError = (
  err: any,
  fallback = 'Something went wrong while processing your request.',
  isServerError = true
): string => {
  if (!err) return fallback;

  if (err.code === 'P2002') {
    return 'A record with these details already exists.';
  }
  if (err.code === 'P2025') {
    return 'The requested record was not found.';
  }
  if (typeof err.name === 'string' && err.name.startsWith('Prisma')) {
    return fallback;
  }

  return sanitizeErrorMessage(err.message, fallback, isServerError);
};

