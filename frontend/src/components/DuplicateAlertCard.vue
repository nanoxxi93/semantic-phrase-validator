<script setup lang="ts">
import { computed } from 'vue';
import type { SimilarPhraseSummary } from '../types/phrase.js';

const props = withDefaults(
  defineProps<{
    similarityScore?: number | null;
    threshold?: number;
    similarPhrase?: SimilarPhraseSummary | null;
    isLoading?: boolean;
    showActions?: boolean;
  }>(),
  {
    similarityScore: null,
    threshold: 0.8,
    similarPhrase: null,
    isLoading: false,
    showActions: true,
  }
);

defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

const scoreFormatted = computed(() => {
  if (props.similarityScore === null || props.similarityScore === undefined) return '100.00%';
  return `${(props.similarityScore * 100).toFixed(2)}%`;
});

const thresholdPercentage = computed(() => {
  return `${(props.threshold * 100).toFixed(0)}%`;
});
</script>

<template>
  <div class="rounded-xl border-2 border-amber-300 bg-amber-50/90 p-4 sm:p-5 relative shadow-xs">
    <div class="flex flex-col sm:flex-row items-start gap-3.5">
      <div class="w-9 h-9 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <div class="flex-1 min-w-0 space-y-3">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-sm font-bold text-amber-950">
              Posible frase duplicada detectada
            </h3>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-200 text-amber-950 border border-amber-300">
              Similitud: {{ scoreFormatted }} (Umbral: {{ thresholdPercentage }})
            </span>
          </div>
          <p class="text-xs text-amber-800 mt-1">
            El significado semántico de tu oración es muy similar a una frase registrada previamente:
          </p>
        </div>

        <div v-if="similarPhrase" class="rounded-lg bg-white/90 border border-amber-200 p-3 text-xs">
          <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
            <span>Frase más parecida encontrada</span>
            <span v-if="similarPhrase.id">ID: #{{ similarPhrase.id.slice(0, 8) }}...</span>
          </div>
          <p class="text-slate-800 font-medium text-sm">
            «{{ similarPhrase.text }}»
          </p>
        </div>

        <div v-if="showActions" class="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            :disabled="isLoading"
            @click="$emit('confirm')"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            <svg
              v-if="isLoading"
              class="w-4 h-4 animate-spin"
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
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Confirmar y guardar de todos modos</span>
          </button>

          <button
            type="button"
            :disabled="isLoading"
            @click="$emit('cancel')"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition cursor-pointer disabled:opacity-50"
          >
            <svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Cancelar</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
