import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePhraseValidation } from '../../../src/composables/usePhraseValidation.js';
import { phraseService } from '../../../src/services/phraseService.js';
import { ApiClientError } from '../../../src/services/api.js';

describe('usePhraseValidation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default IDLE state and disabled submission for empty text', () => {
    const { uiState, phraseText, isValidText, canSubmit, isReadOnly } = usePhraseValidation();

    expect(uiState.value).toBe('IDLE');
    expect(phraseText.value).toBe('');
    expect(isValidText.value).toBe(false);
    expect(canSubmit.value).toBe(false);
    expect(isReadOnly.value).toBe(false);
  });

  it('validates phrase successfully and transitions to UNIQUE_APPROVED when similarity < 80%', async () => {
    vi.spyOn(phraseService, 'validatePhrase').mockResolvedValueOnce({
      isDuplicate: false,
      similarityScore: 0.34,
      threshold: 0.8,
      similarPhrase: { id: 'p1', text: 'Existing text' },
    });

    const { phraseText, validatePhrase, uiState, validationResult, isReadOnly } =
      usePhraseValidation();

    phraseText.value = 'A novel unique thought';
    await validatePhrase();

    expect(uiState.value).toBe('UNIQUE_APPROVED');
    expect(validationResult.value?.isDuplicate).toBe(false);
    expect(validationResult.value?.similarityScore).toBe(0.34);
    expect(isReadOnly.value).toBe(false);
  });

  it('transitions to DUPLICATE_INFORMATIVE and keeps isReadOnly false when duplicate detected during validation', async () => {
    vi.spyOn(phraseService, 'validatePhrase').mockResolvedValueOnce({
      isDuplicate: true,
      similarityScore: 0.89,
      threshold: 0.8,
      similarPhrase: { id: 'p2', text: 'A very similar phrase' },
    });

    const { phraseText, validatePhrase, uiState, validationResult, isReadOnly, canSubmit } =
      usePhraseValidation();

    phraseText.value = 'A closely similar phrase';
    await validatePhrase();

    expect(uiState.value).toBe('DUPLICATE_INFORMATIVE');
    expect(validationResult.value?.isDuplicate).toBe(true);
    expect(isReadOnly.value).toBe(false);
    expect(canSubmit.value).toBe(true);
  });

  it('resets UNIQUE_APPROVED, DUPLICATE_INFORMATIVE and ERROR state back to IDLE upon onInput', async () => {
    vi.spyOn(phraseService, 'validatePhrase').mockResolvedValueOnce({
      isDuplicate: false,
      similarityScore: 0.15,
      threshold: 0.8,
      similarPhrase: null,
    });

    const { phraseText, validatePhrase, uiState, onInput, validationResult } =
      usePhraseValidation();

    phraseText.value = 'Initial';
    await validatePhrase();
    expect(uiState.value).toBe('UNIQUE_APPROVED');

    phraseText.value = 'Initial edited';
    onInput();

    expect(uiState.value).toBe('IDLE');
    expect(validationResult.value).toBeNull();

    // Now test DUPLICATE_INFORMATIVE reset
    vi.spyOn(phraseService, 'validatePhrase').mockResolvedValueOnce({
      isDuplicate: true,
      similarityScore: 0.95,
      threshold: 0.8,
      similarPhrase: { id: 'p3', text: 'Another phrase' },
    });
    phraseText.value = 'Duplicate text';
    await validatePhrase();
    expect(uiState.value).toBe('DUPLICATE_INFORMATIVE');

    phraseText.value = 'Duplicate text edited';
    onInput();
    expect(uiState.value).toBe('IDLE');
    expect(validationResult.value).toBeNull();
  });

  it('handles direct savePhrase successfully, resetting form and calling onSuccess', async () => {
    const mockCreated = {
      id: 'uuid-1',
      text: 'Direct save phrase',
      validationStatus: 'UNIQUE' as const,
      similarityScore: null,
      similarToId: null,
      similarPhrase: null,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(phraseService, 'createPhrase').mockResolvedValueOnce(mockCreated);
    const onSuccess = vi.fn();

    const { phraseText, savePhrase, uiState } = usePhraseValidation();
    phraseText.value = 'Direct save phrase';

    const result = await savePhrase(onSuccess);

    expect(result).toEqual(mockCreated);
    expect(onSuccess).toHaveBeenCalledWith(mockCreated);
    expect(uiState.value).toBe('IDLE');
    expect(phraseText.value).toBe('');
  });

  it('transitions directly to DUPLICATE_WARNING when savePhrase encounters HTTP 409', async () => {
    const err409 = new ApiClientError(
      'Duplicate phrase detected',
      409,
      'DUPLICATE_PHRASE',
      {
        similarityScore: 0.92,
        similarPhrase: { id: 'id-dup', text: 'Existing duplicate' },
      }
    );

    vi.spyOn(phraseService, 'createPhrase').mockRejectedValueOnce(err409);

    const { phraseText, savePhrase, uiState, validationResult, isReadOnly } =
      usePhraseValidation();
    phraseText.value = 'My duplicated sentence';

    await savePhrase();

    expect(uiState.value).toBe('DUPLICATE_WARNING');
    expect(validationResult.value?.isDuplicate).toBe(true);
    expect(validationResult.value?.similarityScore).toBe(0.92);
    expect(validationResult.value?.similarPhrase?.text).toBe('Existing duplicate');
    expect(phraseText.value).toBe('My duplicated sentence');
    expect(isReadOnly.value).toBe(true);
  });

  it('allows confirming duplicate save from DUPLICATE_WARNING state', async () => {
    const mockConfirmed = {
      id: 'uuid-dup',
      text: 'Confirmed duplicate text',
      validationStatus: 'CONFIRMED_DUPLICATE' as const,
      similarityScore: 0.88,
      similarToId: 'orig-id',
      similarPhrase: { id: 'orig-id', text: 'Original text' },
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(phraseService, 'createPhrase').mockResolvedValueOnce(mockConfirmed);
    const onSuccess = vi.fn();

    const { phraseText, uiState, confirmDuplicateSave } = usePhraseValidation();
    phraseText.value = 'Confirmed duplicate text';
    uiState.value = 'DUPLICATE_WARNING';

    const result = await confirmDuplicateSave(onSuccess);

    expect(result).toEqual(mockConfirmed);
    expect(onSuccess).toHaveBeenCalledWith(mockConfirmed);
    expect(uiState.value).toBe('IDLE');
    expect(phraseText.value).toBe('');
  });

  it('allows canceling duplicate from DUPLICATE_WARNING state, returning to IDLE and unlocking textarea', () => {
    const { phraseText, uiState, cancelDuplicate, isReadOnly } = usePhraseValidation();
    phraseText.value = 'Text to edit';
    uiState.value = 'DUPLICATE_WARNING';

    cancelDuplicate();

    expect(uiState.value).toBe('IDLE');
    expect(isReadOnly.value).toBe(false);
    expect(phraseText.value).toBe('Text to edit');
  });

  it('handles 503 AI_SERVICE_UNAVAILABLE and sets ERROR state while keeping text and enabling retry', async () => {
    const err503 = new ApiClientError(
      'Hugging Face unavailable',
      503,
      'AI_SERVICE_UNAVAILABLE'
    );
    vi.spyOn(phraseService, 'validatePhrase').mockRejectedValueOnce(err503);

    const { phraseText, validatePhrase, uiState, errorState, canSubmit } =
      usePhraseValidation();
    phraseText.value = 'Text attempting validation';

    await validatePhrase();

    expect(uiState.value).toBe('ERROR');
    expect(errorState.value?.code).toBe('AI_SERVICE_UNAVAILABLE');
    expect(errorState.value?.statusCode).toBe(503);
    expect(phraseText.value).toBe('Text attempting validation');
    expect(canSubmit.value).toBe(true);
  });
});
