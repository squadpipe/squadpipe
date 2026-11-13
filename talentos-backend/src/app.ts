import express from 'express';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { sanitizeErrorMessage } from './utils/errorSanitizer';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Prevent internal database, ORM, or stack traces from leaking in API error responses
app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    if (res.statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body)) {
      const sanitized = { ...body };
      const isServerError = res.statusCode >= 500;
      const fallback = isServerError
        ? 'Something went wrong while processing your request.'
        : 'Unable to complete this request.';

      if (typeof sanitized.message === 'string') {
        sanitized.message = sanitizeErrorMessage(sanitized.message, fallback, isServerError);
      }
      if (typeof sanitized.error === 'string') {
        sanitized.error = sanitizeErrorMessage(sanitized.error, fallback, isServerError);
      }
      if ('stack' in sanitized) {
        delete sanitized.stack;
      }
      return originalJson(sanitized);
    }
    return originalJson(body);
  }) as any;
  next();
});

// Root API v1 router
app.use('/api/v1', routes);

// Global Error Handler
app.use(errorHandler);

export default app;

