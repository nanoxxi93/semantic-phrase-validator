import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware that strictly verifies Content-Type header on POST requests.
 * Rejects non-JSON media types with HTTP 415 Unsupported Media Type.
 */
export function contentTypeValidator(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'POST') {
    const contentType = req.headers['content-type'];

    if (!contentType || !contentType.toLowerCase().includes('application/json')) {
      res.status(415).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Content-Type must be application/json',
          details: null,
        },
      });
      return;
    }
  }

  next();
}
