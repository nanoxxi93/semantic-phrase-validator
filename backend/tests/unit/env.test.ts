import { describe, it, expect } from 'vitest';
import { validateEnv } from '../../src/config/env.js';

describe('validateEnv', () => {
  const baseValidEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  };

  describe('when EMBEDDING_PROVIDER is huggingface (or default)', () => {
    it('succeeds when HF_TOKEN is provided', () => {
      const parsed = validateEnv({
        ...baseValidEnv,
        EMBEDDING_PROVIDER: 'huggingface',
        HF_TOKEN: 'hf_valid_test_token',
      });

      expect(parsed.EMBEDDING_PROVIDER).toBe('huggingface');
      expect(parsed.HF_TOKEN).toBe('hf_valid_test_token');
      expect(parsed.HF_MODEL).toBe('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2');
    });

    it('defaults to huggingface when EMBEDDING_PROVIDER is omitted', () => {
      const parsed = validateEnv({
        ...baseValidEnv,
        HF_TOKEN: 'hf_test_token',
      });

      expect(parsed.EMBEDDING_PROVIDER).toBe('huggingface');
    });

    it('throws validation error when HF_TOKEN is missing', () => {
      expect(() =>
        validateEnv({
          ...baseValidEnv,
          EMBEDDING_PROVIDER: 'huggingface',
        })
      ).toThrow('HF_TOKEN is required when EMBEDDING_PROVIDER is "huggingface"');
    });
  });

  describe('when EMBEDDING_PROVIDER is cloudflare', () => {
    it('succeeds when CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are provided', () => {
      const parsed = validateEnv({
        ...baseValidEnv,
        EMBEDDING_PROVIDER: 'cloudflare',
        CLOUDFLARE_ACCOUNT_ID: 'cf_acc_123456',
        CLOUDFLARE_API_TOKEN: 'cf_tok_abcdef123',
      });

      expect(parsed.EMBEDDING_PROVIDER).toBe('cloudflare');
      expect(parsed.CLOUDFLARE_ACCOUNT_ID).toBe('cf_acc_123456');
      expect(parsed.CLOUDFLARE_API_TOKEN).toBe('cf_tok_abcdef123');
      expect(parsed.CLOUDFLARE_MODEL).toBe('@cf/baai/bge-m3');
    });

    it('allows overriding CLOUDFLARE_MODEL', () => {
      const parsed = validateEnv({
        ...baseValidEnv,
        EMBEDDING_PROVIDER: 'cloudflare',
        CLOUDFLARE_ACCOUNT_ID: 'cf_acc_123456',
        CLOUDFLARE_API_TOKEN: 'cf_tok_abcdef123',
        CLOUDFLARE_MODEL: '@cf/baai/bge-large-en-v1.5',
      });

      expect(parsed.CLOUDFLARE_MODEL).toBe('@cf/baai/bge-large-en-v1.5');
    });

    it('throws error when CLOUDFLARE_ACCOUNT_ID is missing', () => {
      expect(() =>
        validateEnv({
          ...baseValidEnv,
          EMBEDDING_PROVIDER: 'cloudflare',
          CLOUDFLARE_API_TOKEN: 'cf_tok_abcdef123',
        })
      ).toThrow('CLOUDFLARE_ACCOUNT_ID is required when EMBEDDING_PROVIDER is "cloudflare"');
    });

    it('throws error when CLOUDFLARE_API_TOKEN is missing', () => {
      expect(() =>
        validateEnv({
          ...baseValidEnv,
          EMBEDDING_PROVIDER: 'cloudflare',
          CLOUDFLARE_ACCOUNT_ID: 'cf_acc_123456',
        })
      ).toThrow('CLOUDFLARE_API_TOKEN is required when EMBEDDING_PROVIDER is "cloudflare"');
    });
  });
});
