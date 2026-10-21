import type { Request, Response } from 'express';

/**
 * Ultralightweight health probe controller for Fly.io and Docker container monitoring.
 * Responds immediately with HTTP 200 without touching database or external APIs.
 */
export function healthController(_req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
}
