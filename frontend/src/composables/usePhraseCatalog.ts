import { ref } from 'vue';
import { phraseService } from '../services/phraseService.js';
import { ApiClientError } from '../services/api.js';
import type { PhraseListItem, ValidationStatus } from '../types/phrase.js';
import type { PaginationMetadata } from '../types/api.js';
import type { CatalogFilter, ErrorState } from '../types/ui.js';

export const usePhraseCatalog = () => {
  const phrases = ref<PhraseListItem[]>([]);
  const pagination = ref<PaginationMetadata>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const activeFilter = ref<CatalogFilter>('ALL');
  const isLoading = ref(false);
  const errorState = ref<ErrorState | null>(null);

  const fetchCatalog = async (): Promise<void> => {
    isLoading.value = true;
    errorState.value = null;

    const statusParam: ValidationStatus | undefined =
      activeFilter.value === 'ALL' ? undefined : activeFilter.value;

    try {
      const response = await phraseService.listPhrases(
        pagination.value.page,
        pagination.value.limit,
        statusParam
      );
      phrases.value = response.items;
      pagination.value = response.pagination;
    } catch (err) {
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
      }
    } finally {
      isLoading.value = false;
    }
  };

  const setFilter = async (newFilter: CatalogFilter): Promise<void> => {
    activeFilter.value = newFilter;
    pagination.value.page = 1;
    await fetchCatalog();
  };

  const changePage = async (newPage: number): Promise<void> => {
    if (
      newPage < 1 ||
      (pagination.value.totalPages > 0 && newPage > pagination.value.totalPages) ||
      newPage === pagination.value.page
    ) {
      return;
    }
    pagination.value.page = newPage;
    await fetchCatalog();
  };

  const onPhraseCreated = async (createdPhrase: PhraseListItem): Promise<void> => {
    const isExcludedByCurrentFilter =
      activeFilter.value !== 'ALL' &&
      activeFilter.value !== createdPhrase.validationStatus;

    if (isExcludedByCurrentFilter) {
      activeFilter.value = 'ALL';
      pagination.value.page = 1;
    } else if (pagination.value.page > 1) {
      pagination.value.page = 1;
    }

    await fetchCatalog();
  };

  return {
    phrases,
    pagination,
    activeFilter,
    isLoading,
    errorState,
    fetchCatalog,
    setFilter,
    changePage,
    onPhraseCreated,
  };
};
