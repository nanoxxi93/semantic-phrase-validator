import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PhraseCard from '../../src/components/PhraseCard.vue';
import type { PhraseListItem } from '../../src/types/phrase.js';

describe('PhraseCard component', () => {
  it('renders phrase with Cloudflare BGE-M3 model badge (CA-16)', () => {
    const phrase: PhraseListItem = {
      id: 'uuid-cf-1',
      text: 'Debo pagar el recibo de la luz',
      embeddingModel: '@cf/baai/bge-m3',
      validationStatus: 'UNIQUE',
      similarityScore: null,
      similarToId: null,
      similarPhrase: null,
      createdAt: '2026-11-10T12:00:00.000Z',
    };

    const wrapper = mount(PhraseCard, {
      props: { phrase },
    });

    expect(wrapper.text()).toContain('Debo pagar el recibo de la luz');
    expect(wrapper.text()).toContain('Frase Única');
    expect(wrapper.text()).toContain('BGE-M3 · 1024d');
  });

  it('renders phrase with Hugging Face MiniLM model badge (CA-16)', () => {
    const phrase: PhraseListItem = {
      id: 'uuid-hf-1',
      text: 'Tengo que abonar la factura eléctrica',
      embeddingModel: 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
      validationStatus: 'CONFIRMED_DUPLICATE',
      similarityScore: 0.9241,
      similarToId: 'uuid-cf-1',
      similarPhrase: { id: 'uuid-cf-1', text: 'Debo pagar el recibo de la luz' },
      createdAt: '2026-11-10T12:05:00.000Z',
    };

    const wrapper = mount(PhraseCard, {
      props: { phrase },
    });

    expect(wrapper.text()).toContain('Tengo que abonar la factura eléctrica');
    expect(wrapper.text()).toContain('Duplicado Confirmado');
    expect(wrapper.text()).toContain('92.41%');
    expect(wrapper.text()).toContain('MiniLM · 384d');
    expect(wrapper.text()).toContain('Similar a:');
  });

  it('renders graceful fallback badge for unknown model (CE-11)', () => {
    const phrase: PhraseListItem = {
      id: 'uuid-unk-1',
      text: 'Frase con modelo desconocido',
      embeddingModel: 'custom-org/legacy-model-v0',
      validationStatus: 'UNIQUE',
      similarityScore: null,
      similarToId: null,
      similarPhrase: null,
      createdAt: '2026-11-10T12:10:00.000Z',
    };

    const wrapper = mount(PhraseCard, {
      props: { phrase },
    });

    expect(wrapper.text()).toContain('legacy-model-v0');
  });
});
