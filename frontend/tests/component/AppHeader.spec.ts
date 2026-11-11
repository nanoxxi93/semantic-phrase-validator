import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppHeader from '../../src/components/AppHeader.vue';
import { AVAILABLE_MODELS } from '../../src/constants/models.js';

describe('AppHeader component', () => {
  it('renders application title, threshold percentage, and model selector (CA-14)', () => {
    const wrapper = mount(AppHeader, {
      props: {
        selectedModel: '@cf/baai/bge-m3',
        activeModelId: '@cf/baai/bge-m3',
        thresholdPercentage: '80.0%',
      },
    });

    expect(wrapper.text()).toContain('Semantic Phrase Validator');
    expect(wrapper.text()).toContain('Umbral: 80.0%');

    const select = wrapper.find('select#model-selector');
    expect(select.exists()).toBe(true);

    const options = select.findAll('option');
    expect(options).toHaveLength(AVAILABLE_MODELS.length);

    // Active option should display (Activo)
    const cfOption = options.find((o) => o.attributes('value') === '@cf/baai/bge-m3');
    expect(cfOption?.text()).toContain('(Activo)');

    const hfOption = options.find((o) => o.attributes('value') === 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2');
    expect(hfOption?.text()).not.toContain('(Activo)');
  });

  it('emits update:selectedModel when a different model is selected (CA-14, CA-15)', async () => {
    const wrapper = mount(AppHeader, {
      props: {
        selectedModel: '@cf/baai/bge-m3',
        activeModelId: '@cf/baai/bge-m3',
      },
    });

    const select = wrapper.find('select#model-selector');
    await select.setValue('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2');

    expect(wrapper.emitted('update:selectedModel')).toBeTruthy();
    expect(wrapper.emitted('update:selectedModel')?.[0]).toEqual([
      'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    ]);
  });
});
