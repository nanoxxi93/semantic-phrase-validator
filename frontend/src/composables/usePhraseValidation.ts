import { ref, computed } from 'vue';
import { phraseService } from '../services/phraseService.js';
import { ApiClientError } from '../services/api.js';
import type { UiState, ErrorState } from '../types/ui.js';
import type { PhraseValidationResult } from '../types/api.js';
import type { PhraseListItem, SimilarPhraseSummary } from '../types/phrase.js';

export const usePhraseValidation = () => {
  const phraseText = ref('');
  const uiState = ref<UiState>('IDLE');
  const validationResult = ref<PhraseValidationResult | null>(null);
  const errorState = ref<ErrorState | null>(null);
  const showValidationSkeleton = ref(false);
  let skeletonTimer: ReturnType<typeof setTimeout> | null = null;

  const clearSkeletonTimer = (): void => {
    if (skeletonTimer !== null) {
      clearTimeout(skeletonTimer);
      skeletonTimer = null;
    }
    showValidationSkeleton.value = false;
  };

  const startSkeletonTimer = (): void => {
    clearSkeletonTimer();
    skeletonTimer = setTimeout(() => {
      if (uiState.value === 'VALIDATING') {
        showValidationSkeleton.value = true;
        validationResult.value = null;
      }
    }, 150);
  };

  const charCount = computed(() => phraseText.value.length);
  const isValidText = computed(() => {
    const trimmed = phraseText.value.trim();
    return trimmed.length >= 1 && phraseText.value.length <= 280;
  });

  const isLoading = computed(
    () => uiState.value === 'VALIDATING' || uiState.value === 'SAVING'
  );

  const isReadOnly = computed(() => uiState.value === 'DUPLICATE_WARNING');

  const canSubmit = computed(
    () => isValidText.value && !isLoading.value && uiState.value !== 'DUPLICATE_WARNING'
  );

  const handleApiError = (err: unknown): void => {
    if (err instanceof ApiClientError) {
      errorState.value = {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      };
    } else if (err instanceof Error) {
      errorState.value = {
        code: 'UNKNOWN_ERROR',
        message: err.message,
      };
    } else {
      errorState.value = {
        code: 'UNKNOWN_ERROR',
        message: 'An unexpected error occurred',
      };
    }
    uiState.value = 'ERROR';
  };

  const onInput = (): void => {
    clearSkeletonTimer();
    if (
      uiState.value === 'UNIQUE_APPROVED' ||
      uiState.value === 'DUPLICATE_INFORMATIVE' ||
      uiState.value === 'ERROR'
    ) {
      uiState.value = 'IDLE';
      errorState.value = null;
      validationResult.value = null;
    }
  };

  const validatePhrase = async (): Promise<void> => {
    if (!canSubmit.value) return;

    uiState.value = 'VALIDATING';
    errorState.value = null;
    startSkeletonTimer();

    try {
      const result = await phraseService.validatePhrase(phraseText.value.trim());
      clearSkeletonTimer();
      validationResult.value = result;

      if (result.isDuplicate) {
        uiState.value = 'DUPLICATE_INFORMATIVE';
      } else {
        uiState.value = 'UNIQUE_APPROVED';
      }
    } catch (err) {
      clearSkeletonTimer();
      handleApiError(err);
    }
  };

  const reset = (): void => {
    clearSkeletonTimer();
    phraseText.value = '';
    uiState.value = 'IDLE';
    validationResult.value = null;
    errorState.value = null;
  };

  const savePhrase = async (
    onSuccess?: (created: PhraseListItem) => void
  ): Promise<PhraseListItem | undefined> => {
    if (!canSubmit.value) return undefined;

    uiState.value = 'SAVING';
    errorState.value = null;

    try {
      const created = await phraseService.createPhrase(phraseText.value.trim(), false);
      reset();
      onSuccess?.(created);
      return created;
    } catch (err) {
      if (err instanceof ApiClientError && err.statusCode === 409) {
        const details = err.details as {
          similarityScore?: number | null;
          similarPhrase?: SimilarPhraseSummary | null;
        } | null;

        validationResult.value = {
          isDuplicate: true,
          similarityScore: details?.similarityScore ?? null,
          threshold: 0.8,
          similarPhrase: details?.similarPhrase ?? null,
        };
        uiState.value = 'DUPLICATE_WARNING';
        return undefined;
      }
      handleApiError(err);
      return undefined;
    }
  };

  const confirmDuplicateSave = async (
    onSuccess?: (created: PhraseListItem) => void
  ): Promise<PhraseListItem | undefined> => {
    if (uiState.value !== 'DUPLICATE_WARNING' || isLoading.value) return undefined;

    uiState.value = 'SAVING';
    errorState.value = null;

    try {
      const created = await phraseService.createPhrase(phraseText.value.trim(), true);
      reset();
      onSuccess?.(created);
      return created;
    } catch (err) {
      handleApiError(err);
      return undefined;
    }
  };

  const cancelDuplicate = (): void => {
    clearSkeletonTimer();
    if (uiState.value === 'DUPLICATE_WARNING') {
      uiState.value = 'IDLE';
      validationResult.value = null;
    }
  };

  return {
    phraseText,
    uiState,
    validationResult,
    errorState,
    showValidationSkeleton,
    charCount,
    isValidText,
    isLoading,
    isReadOnly,
    canSubmit,
    onInput,
    validatePhrase,
    savePhrase,
    confirmDuplicateSave,
    cancelDuplicate,
    reset,
  };
};
