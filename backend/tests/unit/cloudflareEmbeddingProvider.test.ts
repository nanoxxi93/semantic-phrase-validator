import { describe, it, expect, vi } from 'vitest';
import { CloudflareEmbeddingProvider } from '../../src/providers/cloudflareEmbeddingProvider.js';
import { EmptyTextError } from '../../src/errors/EmptyTextError.js';
import { ExternalAIProviderError } from '../../src/errors/ExternalAIProviderError.js';
import { InvalidEmbeddingResponseError } from '../../src/errors/InvalidEmbeddingResponseError.js';

describe('CloudflareEmbeddingProvider (Unit Tests)', () => {
  const mockAccountId = 'test-account-id';
  const mockAuthHeaderValue = 'test-auth-val';
  const DIM = 1024;

  const createDummy1024Vector = (): number[] => {
    return new Array(DIM).fill(0.0123);
  };

  it('exposes modelIdentifier as @cf/baai/bge-m3 by default', () => {
    const provider = new CloudflareEmbeddingProvider(mockAccountId, mockAuthHeaderValue);
    expect(provider.modelIdentifier).toBe('@cf/baai/bge-m3');
  });

  it('allows customizing modelIdentifier and gatewayId', () => {
    const provider = new CloudflareEmbeddingProvider(mockAccountId, mockAuthHeaderValue, {
      model: '@cf/baai/custom-m3',
      gatewayId: 'my-gateway',
    });
    expect(provider.modelIdentifier).toBe('@cf/baai/custom-m3');
  });

  it('throws EmptyTextError without calling fetch when text is empty or only whitespace', async () => {
    const mockFetch = vi.fn();
    const provider = new CloudflareEmbeddingProvider(mockAccountId, mockAuthHeaderValue, {
      fetchClient: mockFetch as unknown as typeof fetch,
    });

    await expect(provider.generateEmbedding('')).rejects.toThrow(EmptyTextError);
    await expect(provider.generateEmbedding('   \n\t  ')).rejects.toThrow(EmptyTextError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('CA-03 & CA-04: successfully extracts 1024 numbers from 2D tensor response', async () => {
    const dummyVector = createDummy1024Vector();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          data: [dummyVector],
          shape: [1, 1024],
        },
        success: true,
        errors: [],
      }),
    });

    const provider = new CloudflareEmbeddingProvider(mockAccountId, mockAuthHeaderValue, {
      gatewayId: 'test-gateway',
      fetchClient: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.generateEmbedding('  valid sentence to embed  ');

    expect(result).toHaveLength(1024);
    expect(result).toEqual(dummyVector);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`https://api.cloudflare.com/client/v4/accounts/${mockAccountId}/ai/run`);
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe(`Bearer ${mockAuthHeaderValue}`);
    expect(init.headers['cf-aig-gateway-id']).toBe('test-gateway');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('@cf/baai/bge-m3');
    expect(body.input.text).toEqual(['valid sentence to embed']);
  });

  it('CA-04: successfully extracts 1024 numbers from 1D array response', async () => {
    const dummyVector = createDummy1024Vector();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          data: dummyVector,
        },
        success: true,
      }),
    });

    const provider = new CloudflareEmbeddingProvider(mockAccountId, mockAuthHeaderValue, {
      fetchClient: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.generateEmbedding('hello world');
    expect(result).toHaveLength(1024);
  });

  it('CA-09: retries on HTTP 429 and succeeds on next attempt', async () => {
    const dummyVector = createDummy1024Vector();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          errors: [{ message: 'Rate limit exceeded' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          result: { data: [dummyVector] },
          success: true,
        }),
      });

    const provider = new CloudflareEmbeddingProvider(mockAccountId, mockAuthHeaderValue, {
      fetchClient: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.generateEmbedding('hello retry');
    expect(result).toHaveLength(1024);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('CE-4: does not retry non-retryable 401 Unauthorized errors and fails immediately', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        errors: [{ message: 'Invalid API Token' }],
      }),
    });

    const provider = new CloudflareEmbeddingProvider(mockAccountId, mockAuthHeaderValue, {
      fetchClient: mockFetch as unknown as typeof fetch,
    });

    await expect(provider.generateEmbedding('test auth')).rejects.toThrow(ExternalAIProviderError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('CE-8: throws InvalidEmbeddingResponseError if response dimension is not 1024', async () => {
    const shortVector = new Array(512).fill(0.1);
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: { data: [shortVector] },
        success: true,
      }),
    });

    const provider = new CloudflareEmbeddingProvider(mockAccountId, mockAuthHeaderValue, {
      fetchClient: mockFetch as unknown as typeof fetch,
    });

    await expect(provider.generateEmbedding('dimension check')).rejects.toThrow(
      InvalidEmbeddingResponseError
    );
  });

  it('throws InvalidEmbeddingResponseError if vector contains NaN or non-numeric values', async () => {
    const corruptedVector = createDummy1024Vector();
    corruptedVector[5] = NaN;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: { data: [corruptedVector] },
        success: true,
      }),
    });

    const provider = new CloudflareEmbeddingProvider(mockAccountId, mockAuthHeaderValue, {
      fetchClient: mockFetch as unknown as typeof fetch,
    });

    await expect(provider.generateEmbedding('nan check')).rejects.toThrow(
      InvalidEmbeddingResponseError
    );
  });
});
