const UNIQUE_CONSTRAINT_PATTERN = /Unique constraint failed/i;
const NOT_FOUND_PATTERN = /Record to (?:update|delete) (?:not found|does not exist)/i;

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
  /\bECONNREFUSED\b/i,
  /\bETIMEDOUT\b/i,
  /\bpostgres(?:ql)?\b/i,
];

const SERVER_5XX_DB_PATTERNS: RegExp[] = [
  ...INTERNAL_ERROR_PATTERNS,
  /\bdatabase\b/i,
  /\bsql\b/i,
  /constraint/i,
];

/**
 * Strips database, ORM, connection string, and query internals from HTTP error messages
 * so clients and toast banners never expose infrastructure details.
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

