import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import PhraseForm from '../../src/components/PhraseForm.vue';
import { phraseService } from '../../src/services/phraseService.js';
import { ApiClientError } from '../../src/services/api.js';

describe('PhraseForm component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders initial state with empty textarea and disabled buttons', () => {
    const wrapper = mount(PhraseForm);

    const textarea = wrapper.find('textarea#phrase-input');
    expect(textarea.exists()).toBe(true);
    expect((textarea.element as HTMLTextAreaElement).value).toBe('');

    const counter = wrapper.find('#char-counter');
    expect(counter.text()).toBe('0 / 280 caracteres');

    const buttons = wrapper.findAll('button');
    // Both action buttons should be disabled
    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[1].attributes('disabled')).toBeDefined();
  });

  it('updates counter and enables buttons when text is entered', async () => {
    const wrapper = mount(PhraseForm);

    const textarea = wrapper.find('textarea#phrase-input');
    await textarea.setValue('A test valid sentence');

    const counter = wrapper.find('#char-counter');
    expect(counter.text()).toBe('21 / 280 caracteres');

    const buttons = wrapper.findAll('button');
    expect(buttons[0].attributes('disabled')).toBeUndefined();
    expect(buttons[1].attributes('disabled')).toBeUndefined();
  });

  it('validates text and renders ValidationResultCard when unique', async () => {
    vi.spyOn(phraseService, 'validatePhrase').mockResolvedValueOnce({
      isDuplicate: false,
      similarityScore: 0.28,
      threshold: 0.8,
      similarPhrase: { id: 'p1', text: 'Some existing phrase' },
    });

    const wrapper = mount(PhraseForm);
    const textarea = wrapper.find('textarea#phrase-input');
    await textarea.setValue('A totally unique sentence');

    const validateBtn = wrapper.findAll('button')[0];
    await validateBtn.trigger('click');

    // Wait for async update
    await new Promise((r) => setTimeout(r, 10));

    expect(wrapper.text()).toContain('Frase semánticamente única');
    expect(wrapper.text()).toContain('28.00%');
    expect(wrapper.text()).toContain('Some existing phrase');
  });

  it('renders informative DuplicateAlertCard without action buttons when duplicate is validated', async () => {
    vi.spyOn(phraseService, 'validatePhrase').mockResolvedValueOnce({
      isDuplicate: true,
      similarityScore: 0.895,
      threshold: 0.8,
      similarPhrase: { id: 'p2', text: 'Original duplicated phrase' },
    });

    const wrapper = mount(PhraseForm);
    const textarea = wrapper.find('textarea#phrase-input');
    await textarea.setValue('A duplicate sentence');

    const validateBtn = wrapper.findAll('button')[0];
    await validateBtn.trigger('click');

    await new Promise((r) => setTimeout(r, 10));

    expect(wrapper.text()).toContain('Posible frase duplicada detectada');
    expect(wrapper.text()).toContain('89.50%');
    expect(wrapper.text()).toContain('Original duplicated phrase');

    // Informative card must NOT contain confirmation or cancel buttons
    expect(wrapper.text()).not.toContain('Confirmar y guardar de todos modos');
    expect(wrapper.text()).not.toContain('Cancelar');

    // Textarea must NOT be readonly
    expect(textarea.attributes('readonly')).toBeUndefined();

    // Main action buttons must remain enabled
    const buttons = wrapper.findAll('button');
    expect(buttons[0].attributes('disabled')).toBeUndefined();
    expect(buttons[1].attributes('disabled')).toBeUndefined();
  });

  it('renders DuplicateAlertCard with action buttons and locks textarea when direct save returns 409', async () => {
    const err409 = new ApiClientError(
      'Duplicate detected',
      409,
      'DUPLICATE_PHRASE',
      {
        similarityScore: 0.895,
        similarPhrase: { id: 'p2', text: 'Original duplicated phrase' },
      }
    );
    vi.spyOn(phraseService, 'createPhrase').mockRejectedValueOnce(err409);

    const wrapper = mount(PhraseForm);
    const textarea = wrapper.find('textarea#phrase-input');
    await textarea.setValue('A duplicate sentence');

    const saveBtn = wrapper.findAll('button')[1];
    await saveBtn.trigger('click');

    await new Promise((r) => setTimeout(r, 10));

    expect(wrapper.text()).toContain('Posible frase duplicada detectada');
    expect(wrapper.text()).toContain('Confirmar y guardar de todos modos');
    expect(wrapper.text()).toContain('Cancelar');

    // Textarea must be readonly
    expect(textarea.attributes('readonly')).toBeDefined();

    // Main buttons at the bottom must be disabled
    const allButtons = wrapper.findAll('button');
    const bottomButtons = allButtons.slice(2);
    expect(bottomButtons[0].attributes('disabled')).toBeDefined();
    expect(bottomButtons[1].attributes('disabled')).toBeDefined();

    // Clicking cancel restores IDLE state
    const cancelBtn = allButtons[1];
    await cancelBtn.trigger('click');

    expect(wrapper.text()).not.toContain('Posible frase duplicada detectada');
    expect(textarea.attributes('readonly')).toBeUndefined();
  });

  it('emits phrase-saved event upon successful direct save', async () => {
    const mockCreated = {
      id: 'saved-id',
      text: 'Phrase to be saved',
      validationStatus: 'UNIQUE' as const,
      similarityScore: null,
      similarToId: null,
      similarPhrase: null,
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(phraseService, 'createPhrase').mockResolvedValueOnce(mockCreated);

    const wrapper = mount(PhraseForm);
    const textarea = wrapper.find('textarea#phrase-input');
    await textarea.setValue('Phrase to be saved');

    const saveBtn = wrapper.findAll('button')[1];
    await saveBtn.trigger('click');

    await new Promise((r) => setTimeout(r, 10));

    expect(wrapper.emitted('phrase-saved')).toBeTruthy();
    expect(wrapper.emitted('phrase-saved')?.[0]).toEqual([mockCreated]);
    expect((textarea.element as HTMLTextAreaElement).value).toBe('');
  });
});
