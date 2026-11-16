export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication required. Invalid or missing token.',
  FORBIDDEN: 'Insufficient role permissions for this operation.',
  NOT_FOUND: 'Requested resource was not found.',
  VALIDATION_ERROR: 'Request payload validation failed.',
  INTERNAL_ERROR: 'An unexpected internal error occurred.'
} as const;

