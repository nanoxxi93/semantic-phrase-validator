import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePhraseCatalog } from '../../../src/composables/usePhraseCatalog.js';
import { phraseService } from '../../../src/services/phraseService.js';
import type { PhraseListItem } from '../../../src/types/phrase.js';

describe('usePhraseCatalog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches phrases and updates pagination and list', async () => {
    const mockResponse = {
      items: [
        {
          id: '1',
          text: 'Sentence 1',
          validationStatus: 'UNIQUE' as const,
          similarityScore: null,
          similarToId: null,
          similarPhrase: null,
          createdAt: '2026-10-21T18:00:00.000Z',
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    };

    const listSpy = vi.spyOn(phraseService, 'listPhrases').mockResolvedValueOnce(mockResponse);

    const { phrases, pagination, fetchCatalog, activeFilter } = usePhraseCatalog();
    await fetchCatalog();

    expect(listSpy).toHaveBeenCalledWith(1, 10, undefined);
    expect(phrases.value).toEqual(mockResponse.items);
    expect(pagination.value.total).toBe(1);
    expect(activeFilter.value).toBe('ALL');
  });

  it('setFilter updates activeFilter, resets page to 1 and refetches catalog', async () => {
    const listSpy = vi.spyOn(phraseService, 'listPhrases').mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });

    const { activeFilter, pagination, setFilter } = usePhraseCatalog();
    pagination.value.page = 3;

    await setFilter('CONFIRMED_DUPLICATE');

    expect(activeFilter.value).toBe('CONFIRMED_DUPLICATE');
    expect(pagination.value.page).toBe(1);
    expect(listSpy).toHaveBeenCalledWith(1, 10, 'CONFIRMED_DUPLICATE');
  });

  it('changePage updates page number within bounds and refetches', async () => {
    const listSpy = vi.spyOn(phraseService, 'listPhrases').mockResolvedValue({
      items: [],
      pagination: { page: 2, limit: 10, total: 20, totalPages: 2 },
    });

    const { pagination, changePage } = usePhraseCatalog();
    pagination.value.totalPages = 2;

    await changePage(2);
    expect(pagination.value.page).toBe(2);
    expect(listSpy).toHaveBeenCalledWith(2, 10, undefined);

    // Should ignore out-of-bounds requests
    await changePage(5);
    expect(pagination.value.page).toBe(2);
  });

  it('onPhraseCreated switches filter to ALL and resets to page 1 if current filter excludes new phrase', async () => {
    const listSpy = vi.spyOn(phraseService, 'listPhrases').mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 10, total: 5, totalPages: 1 },
    });

    const { activeFilter, pagination, onPhraseCreated } = usePhraseCatalog();
    activeFilter.value = 'UNIQUE';
    pagination.value.page = 2;

    const newDuplicatePhrase: PhraseListItem = {
      id: 'dup-1',
      text: 'A duplicate phrase',
      validationStatus: 'CONFIRMED_DUPLICATE',
      similarityScore: 0.85,
      similarToId: 'orig-1',
      similarPhrase: { id: 'orig-1', text: 'Original phrase' },
      createdAt: '2026-10-21T21:00:00.000Z',
    };

    await onPhraseCreated(newDuplicatePhrase);

    expect(activeFilter.value).toBe('ALL');
    expect(pagination.value.page).toBe(1);
    expect(listSpy).toHaveBeenCalledWith(1, 10, undefined);
  });

  it('onPhraseCreated resets page to 1 when on subsequent pages with matching filter', async () => {
    const listSpy = vi.spyOn(phraseService, 'listPhrases').mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 10, total: 15, totalPages: 2 },
    });

    const { activeFilter, pagination, onPhraseCreated } = usePhraseCatalog();
    activeFilter.value = 'ALL';
    pagination.value.page = 2;

    const newPhrase: PhraseListItem = {
      id: 'uniq-1',
      text: 'A unique phrase',
      validationStatus: 'UNIQUE',
      similarityScore: null,
      similarToId: null,
      similarPhrase: null,
      createdAt: '2026-10-21T21:00:00.000Z',
    };

    await onPhraseCreated(newPhrase);

    expect(pagination.value.page).toBe(1);
    expect(listSpy).toHaveBeenCalledWith(1, 10, undefined);
  });
});
