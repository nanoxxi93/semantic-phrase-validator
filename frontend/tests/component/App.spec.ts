import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import App from '../../src/App.vue';
import { phraseService } from '../../src/services/phraseService.js';
import PhraseCatalog from '../../src/components/PhraseCatalog.vue';
import PhraseForm from '../../src/components/PhraseForm.vue';

describe('App component integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls phraseService.checkHealth silently on mount and renders header, form and catalog', async () => {
    const healthSpy = vi.spyOn(phraseService, 'checkHealth').mockResolvedValueOnce({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });

    vi.spyOn(phraseService, 'listPhrases').mockResolvedValueOnce({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });

    const wrapper = mount(App);

    expect(healthSpy).toHaveBeenCalledTimes(1);
    expect(wrapper.findComponent(PhraseForm).exists()).toBe(true);
    expect(wrapper.findComponent(PhraseCatalog).exists()).toBe(true);
    expect(wrapper.text()).toContain('Semantic Phrase Validator');
    expect(wrapper.text()).toContain('Umbral: 80.0%');
  });

  it('triggers catalog refresh when PhraseForm emits phrase-saved', async () => {
    vi.spyOn(phraseService, 'checkHealth').mockResolvedValueOnce({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });

    const listSpy = vi.spyOn(phraseService, 'listPhrases').mockResolvedValue({
      items: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    });

    const wrapper = mount(App);
    await new Promise((r) => setTimeout(r, 10));
    // Initial fetch from onMounted in PhraseCatalog
    expect(listSpy).toHaveBeenCalledTimes(1);

    const form = wrapper.findComponent(PhraseForm);

    const createdPhrase = {
      id: 'p-new',
      text: 'Newly saved sentence',
      validationStatus: 'UNIQUE' as const,
      similarityScore: null,
      similarToId: null,
      similarPhrase: null,
      createdAt: new Date().toISOString(),
    };

    // Emit phrase-saved event from PhraseForm
    await form.vm.$emit('phrase-saved', createdPhrase);
    await new Promise((r) => setTimeout(r, 10));

    // Must have invoked listPhrases again to refresh catalog
    expect(listSpy).toHaveBeenCalledTimes(2);
  });
});
