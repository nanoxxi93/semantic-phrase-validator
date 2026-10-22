<script setup lang="ts">
import { computed } from 'vue';
import type { SimilarPhraseSummary } from '../types/phrase.js';

const props = withDefaults(
  defineProps<{
    similarityScore?: number | null;
    threshold?: number;
    similarPhrase?: SimilarPhraseSummary | null;
  }>(),
  {
    similarityScore: null,
    threshold: 0.8,
    similarPhrase: null,
  }
);

const scoreFormatted = computed(() => {
  if (props.similarityScore === null || props.similarityScore === undefined) return null;
  return `${(props.similarityScore * 100).toFixed(2)}%`;
});

const thresholdPercentage = computed(() => {
  return `${(props.threshold * 100).toFixed(0)}%`;
});

const closestPhraseText = computed(() => {
  return props.similarPhrase?.text || null;
});
</script>

<template>
  <div class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 relative">
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-sm font-semibold text-emerald-950">Frase semánticamente única</h3>
          <span
            v-if="scoreFormatted"
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-emerald-200/70 text-emerald-900"
          >
            Similitud máx: {{ scoreFormatted }} (&lt; {{ thresholdPercentage }})
          </span>
          <span
            v-else
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-emerald-200/70 text-emerald-900"
          >
            Primera frase del catálogo
          </span>
        </div>
        <p class="text-xs text-emerald-800 mt-1">
          <template v-if="closestPhraseText">
            No supera el umbral de duplicidad. Frase más cercana en catálogo:
            <span class="italic font-medium text-emerald-950">«{{ closestPhraseText }}»</span>
          </template>
          <template v-else>
            No supera el umbral de duplicidad. No existen oraciones previas registradas para comparar.
          </template>
        </p>
      </div>
    </div>
  </div>
</template>
