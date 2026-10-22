import { describe, it, expect, vi, beforeEach } from 'vitest';
import { phraseService } from '../../../src/services/phraseService.js';
import { ApiClientError } from '../../../src/services/api.js';

describe('phraseService and api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('validatePhrase calls POST /phrases/validate with text payload', async () => {
    const mockData = {
      isDuplicate: false,
      similarityScore: 0.35,
      threshold: 0.8,
      similarPhrase: { id: 'p1', text: 'Another phrase' },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockData }),
    } as Response);

    const result = await phraseService.validatePhrase('Test phrase');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/phrases/validate'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Test phrase' }),
      })
    );
    expect(result).toEqual(mockData);
  });

  it('createPhrase calls POST /phrases with text and confirmDuplicate', async () => {
    const mockCreated = {
      id: 'uuid-1',
      text: 'Unique sentence',
      validationStatus: 'UNIQUE',
      similarityScore: null,
      similarToId: null,
      similarPhrase: null,
      createdAt: '2026-10-21T20:00:00.000Z',
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: mockCreated }),
    } as Response);

    const result = await phraseService.createPhrase('Unique sentence', true);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/phrases'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Unique sentence', confirmDuplicate: true }),
      })
    );
    expect(result).toEqual(mockCreated);
  });

  it('listPhrases calls GET /phrases with correct pagination and status query parameters', async () => {
    const mockCatalog = {
      items: [],
      pagination: { page: 2, limit: 10, total: 0, totalPages: 0 },
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockCatalog }),
    } as Response);

    const result = await phraseService.listPhrases(2, 10, 'CONFIRMED_DUPLICATE');

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/phrases?page=2&limit=10&status=CONFIRMED_DUPLICATE'),
      expect.any(Object)
    );
    expect(result).toEqual(mockCatalog);
  });

  it('checkHealth calls GET /health', async () => {
    const mockHealth = { status: 'healthy', timestamp: '2026-10-21T22:00:00.000Z' };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: mockHealth }),
    } as Response);

    const result = await phraseService.checkHealth();

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.any(Object)
    );
    expect(result).toEqual(mockHealth);
  });

  it('throws ApiClientError with backend error response details on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: {
          code: 'DUPLICATE_PHRASE',
          message: 'Semantic duplicate detected',
          details: { similarityScore: 0.89 },
        },
      }),
    } as Response);

    let errorThrown: ApiClientError | null = null;
    try {
      await phraseService.createPhrase('Duplicate phrase');
    } catch (err) {
      errorThrown = err as ApiClientError;
    }

    expect(errorThrown).not.toBeNull();
    expect(errorThrown).toBeInstanceOf(ApiClientError);
    expect(errorThrown?.statusCode).toBe(409);
    expect(errorThrown?.code).toBe('DUPLICATE_PHRASE');
    expect(errorThrown?.details).toEqual({ similarityScore: 0.89 });
  });

  it('throws ApiClientError with NETWORK_ERROR code when network fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('Failed to fetch')
    );

    let errorThrown: ApiClientError | null = null;
    try {
      await phraseService.validatePhrase('Some text');
    } catch (err) {
      errorThrown = err as ApiClientError;
    }

    expect(errorThrown).not.toBeNull();
    expect(errorThrown).toBeInstanceOf(ApiClientError);
    expect(errorThrown?.statusCode).toBe(0);
    expect(errorThrown?.code).toBe('NETWORK_ERROR');
    expect(errorThrown?.message).toContain('Failed to fetch');
  });
});
