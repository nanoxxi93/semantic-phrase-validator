import type { Request, Response } from 'express';

export interface ModelInfo {
  provider: 'cloudflare' | 'huggingface';
  modelIdentifier: string;
  dimension: number;
  threshold: number;
}

/**
 * Controller providing active embedding model configuration and threshold to client applications.
 * Enables dynamic UI adaptation without hardcoded provider/model strings.
 */
export class ModelController {
  constructor(private readonly modelInfo: ModelInfo) {}

  public getModelInfo = (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      data: this.modelInfo,
    });
  };
}
