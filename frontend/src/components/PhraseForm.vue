<script setup lang="ts">
import { usePhraseValidation } from '../composables/usePhraseValidation.js';
import ValidationResultCard from './ValidationResultCard.vue';
import DuplicateAlertCard from './DuplicateAlertCard.vue';
import ErrorAlertBanner from './ErrorAlertBanner.vue';
import type { PhraseListItem } from '../types/phrase.js';

const emit = defineEmits<{
  (e: 'phrase-saved', phrase: PhraseListItem): void;
}>();

const {
  phraseText,
  uiState,
  validationResult,
  errorState,
  showValidationSkeleton,
  charCount,
  isLoading,
  isReadOnly,
  canSubmit,
  onInput,
  validatePhrase,
  savePhrase,
  confirmDuplicateSave,
  cancelDuplicate,
} = usePhraseValidation();

const onDirectSave = async () => {
  await savePhrase((created) => {
    emit('phrase-saved', created);
  });
};

const onConfirmDuplicate = async () => {
  await confirmDuplicateSave((created) => {
    emit('phrase-saved', created);
  });
};
</script>

<template>
  <section class="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 relative">
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <label for="phrase-input" class="block text-sm font-semibold text-slate-800">
          Nueva oración corta
        </label>
        <span
          id="char-counter"
          :class="[
            'text-xs font-mono',
            charCount > 260 ? 'text-amber-600 font-semibold' : 'text-slate-500',
          ]"
        >
          {{ charCount }} / 280 caracteres
        </span>
      </div>

      <div class="relative">
        <textarea
          id="phrase-input"
          v-model="phraseText"
          rows="2"
          maxlength="280"
          :readonly="isReadOnly"
          @input="onInput"
          placeholder="Escribe una oración corta para validar su similitud semántica antes de guardarla..."
          class="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none focus:ring-3 focus:ring-indigo-500/15 transition resize-none disabled:bg-slate-50 disabled:text-slate-500"
        ></textarea>
      </div>

      <!-- Feedback dinámico según máquina de estados -->
      <!-- 1. VALIDATING: Spinner de Inferencia prominente (con retardo de 150ms para evitar FLS) -->
      <div
        v-if="showValidationSkeleton"
        id="state-panel-VALIDATING"
        class="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4"
      >
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 text-indigo-600 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <div class="text-xs sm:text-sm">
            <p class="font-semibold text-indigo-950">Analizando significado semántico...</p>
            <p class="text-indigo-700 mt-0.5">
              Generando vector de 384 dimensiones y calculando similitud coseno contra el catálogo.
            </p>
          </div>
        </div>
      </div>

      <!-- 2. UNIQUE_APPROVED -->
      <ValidationResultCard
        v-else-if="uiState === 'UNIQUE_APPROVED' || (uiState === 'VALIDATING' && validationResult && !validationResult.isDuplicate)"
        :similarity-score="validationResult?.similarityScore"
        :threshold="validationResult?.threshold"
        :similar-phrase="validationResult?.similarPhrase"
      />

      <!-- 3. DUPLICATE_INFORMATIVE (o durante validación/guardado previo sin alterar estabilidad de pantalla) -->
      <DuplicateAlertCard
        v-else-if="uiState === 'DUPLICATE_INFORMATIVE' || (uiState === 'VALIDATING' && validationResult?.isDuplicate) || (uiState === 'SAVING' && validationResult?.isDuplicate)"
        :similarity-score="validationResult?.similarityScore"
        :threshold="validationResult?.threshold"
        :similar-phrase="validationResult?.similarPhrase"
        :show-actions="false"
      />

      <!-- 4. DUPLICATE_WARNING (Alerta de guardado directo con conflicto 409) -->
      <DuplicateAlertCard
        v-else-if="uiState === 'DUPLICATE_WARNING'"
        :similarity-score="validationResult?.similarityScore"
        :threshold="validationResult?.threshold"
        :similar-phrase="validationResult?.similarPhrase"
        :is-loading="isLoading"
        :show-actions="true"
        @confirm="onConfirmDuplicate"
        @cancel="cancelDuplicate"
      />

      <!-- 5. ERROR -->
      <ErrorAlertBanner
        v-else-if="uiState === 'ERROR'"
        :code="errorState?.code"
        :message="errorState?.message"
        :status-code="errorState?.statusCode"
      />

      <!-- Barra de acciones -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100">
        <p class="text-xs text-slate-500 flex items-center gap-1.5">
          <svg class="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Puedes pre-validar la similitud antes de persistir o guardar directamente.</span>
        </p>

        <div class="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            :disabled="!canSubmit"
            @click="validatePhrase"
            :class="[
              'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer',
              !canSubmit && (uiState !== 'VALIDATING' || showValidationSkeleton)
                ? 'opacity-50 cursor-not-allowed'
                : '',
            ]"
          >
            <svg
              v-if="showValidationSkeleton"
              class="w-4 h-4 text-indigo-600 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg
              v-else
              class="w-4 h-4 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Validar similitud</span>
          </button>

          <button
            type="button"
            :disabled="!canSubmit"
            @click="onDirectSave"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              v-if="uiState === 'SAVING'"
              class="w-4 h-4 text-white animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg
              v-else
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Guardar frase</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
