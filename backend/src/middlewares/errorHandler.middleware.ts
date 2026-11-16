import { Request, Response, NextFunction } from 'express';
import { sanitizeThrownError } from '../utils/errorSanitizer';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[Error caught by global handler]:', err);

  const status = err.status || err.statusCode || 500;
  const message = sanitizeThrownError(
    err,
    status >= 500 ? 'Internal Server Error' : 'Unable to complete this request.',
    status >= 500
  );

  res.status(status).json({
    success: false,
    message,
  });
};

