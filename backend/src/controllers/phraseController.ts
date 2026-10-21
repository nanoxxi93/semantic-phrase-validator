import type { Request, Response, NextFunction } from 'express';
import type { PhraseService } from '../services/phraseService.js';
import {
  validatePhraseSchema,
  createPhraseSchema,
  listPhrasesQuerySchema,
} from './phrase.schemas.js';

/**
 * Controller handling HTTP requests for phrase validation, creation, and listing.
 * Strictly adheres to constitutional separation of concerns: delegates domain logic to PhraseService.
 */
export class PhraseController {
  constructor(private readonly phraseService: PhraseService) {}

  /**
   * POST /api/phrases/validate
   * Validates phrase for semantic duplicate without persisting.
   */
  public validate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { text } = validatePhraseSchema.parse(req.body);
      const result = await this.phraseService.validatePhrase(text);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/phrases
   * Persists phrase as UNIQUE or CONFIRMED_DUPLICATE.
   */
  public create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { text, confirmDuplicate } = createPhraseSchema.parse(req.body);
      const result = await this.phraseService.createPhrase(text, confirmDuplicate);

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/phrases
   * Retrieves paginated list of catalog phrases with optional validation status filter.
   */
  public list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, status } = listPhrasesQuerySchema.parse(req.query);
      const result = await this.phraseService.listPhrases(page, limit, status);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
}
