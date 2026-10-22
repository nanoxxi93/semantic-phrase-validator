import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PhraseCard from '../../src/components/PhraseCard.vue';
import PhraseFilterBar from '../../src/components/PhraseFilterBar.vue';
import PaginationBar from '../../src/components/PaginationBar.vue';
import PhraseList from '../../src/components/PhraseList.vue';
import PhraseCatalog from '../../src/components/PhraseCatalog.vue';
import { phraseService } from '../../src/services/phraseService.js';
import type { PhraseListItem } from '../../src/types/phrase.js';

describe('Catalog components', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('PhraseCard renders UNIQUE phrase with green badge and no score', () => {
    const uniquePhrase: PhraseListItem = {
      id: 'p1',
      text: 'Unique concept in test',
      validationStatus: 'UNIQUE',
      similarityScore: null,
      similarToId: null,
      similarPhrase: null,
      createdAt: '2026-10-21T15:30:00.000Z',
    };

    const wrapper = mount(PhraseCard, {
      props: { phrase: uniquePhrase },
    });

    expect(wrapper.text()).toContain('«Unique concept in test»');
    expect(wrapper.text()).toContain('Frase Única');
    expect(wrapper.text()).toContain('Score: —');
  });

  it('PhraseCard renders CONFIRMED_DUPLICATE with amber badge and similarity score', () => {
    const dupPhrase: PhraseListItem = {
      id: 'p2',
      text: 'Duplicate sentence in test',
      validationStatus: 'CONFIRMED_DUPLICATE',
      similarityScore: 0.865,
      similarToId: 'orig-1',
      similarPhrase: { id: 'orig-1', text: 'Original phrase text' },
      createdAt: '2026-10-21T16:00:00.000Z',
    };

    const wrapper = mount(PhraseCard, {
      props: { phrase: dupPhrase },
    });

    expect(wrapper.text()).toContain('«Duplicate sentence in test»');
    expect(wrapper.text()).toContain('Duplicado Confirmado');
    expect(wrapper.text()).toContain('86.50%');
    expect(wrapper.text()).toContain('Similar a: «Original phrase text»');
  });

  it('PhraseFilterBar emits change-filter with selected filter', async () => {
    const wrapper = mount(PhraseFilterBar, {
      props: {
        totalCount: 15,
        activeFilter: 'ALL',
      },
    });

    expect(wrapper.text()).toContain('15');

    const buttons = wrapper.findAll('button');
    // Button 0: Todas, Button 1: Únicas, Button 2: Duplicados
    await buttons[1].trigger('click');
    expect(wrapper.emitted('change-filter')?.[0]).toEqual(['UNIQUE']);

    await buttons[2].trigger('click');
    expect(wrapper.emitted('change-filter')?.[1]).toEqual(['CONFIRMED_DUPLICATE']);
  });

  it('PaginationBar calculates safe pages and emits change-page', async () => {
    const wrapper = mount(PaginationBar, {
      props: {
        page: 1,
        totalPages: 3,
        total: 25,
      },
    });

    expect(wrapper.text()).toContain('página 1 de 3');
    expect(wrapper.text()).toContain('Total: 25');

    const prevBtn = wrapper.findAll('button')[0];
    const nextBtn = wrapper.findAll('button')[1];

    expect(prevBtn.attributes('disabled')).toBeDefined();
    expect(nextBtn.attributes('disabled')).toBeUndefined();

    await nextBtn.trigger('click');
    expect(wrapper.emitted('change-page')?.[0]).toEqual([2]);
  });

  it('PhraseList displays empty state when phrases array is empty', () => {
    const wrapper = mount(PhraseList, {
      props: { phrases: [], isLoading: false },
    });

    expect(wrapper.text()).toContain('No hay frases registradas');
  });

  it('PhraseCatalog mounts and loads catalog automatically', async () => {
    vi.spyOn(phraseService, 'listPhrases').mockResolvedValueOnce({
      items: [
        {
          id: 'item-1',
          text: 'Loaded phrase',
          validationStatus: 'UNIQUE',
          similarityScore: null,
          similarToId: null,
          similarPhrase: null,
          createdAt: new Date().toISOString(),
        },
      ],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });

    const wrapper = mount(PhraseCatalog);
    await new Promise((r) => setTimeout(r, 10));

    expect(wrapper.text()).toContain('Loaded phrase');
    expect(wrapper.text()).toContain('Frases Registradas');
    expect(wrapper.find('span.font-mono.font-semibold').text()).toBe('1');
  });
});
