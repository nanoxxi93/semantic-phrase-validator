<script setup lang="ts">
import { computed } from 'vue';
import type { PhraseListItem } from '../types/phrase.js';
import { formatDateTime, formatRelativeTime } from '../utils/date.js';

const props = defineProps<{
  phrase: PhraseListItem;
}>();

const scoreFormatted = computed(() => {
  if (props.phrase.similarityScore === null || props.phrase.similarityScore === undefined) {
    return null;
  }
  return `${(props.phrase.similarityScore * 100).toFixed(2)}%`;
});

const isoDate = computed(() => {
  try {
    return new Date(props.phrase.createdAt).toISOString();
  } catch {
    return String(props.phrase.createdAt);
  }
});

const formattedDate = computed(() => {
  return formatDateTime(props.phrase.createdAt);
});

const relativeTime = computed(() => {
  return formatRelativeTime(props.phrase.createdAt);
});
</script>

<template>
  <article class="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs hover:border-slate-300 transition relative">
    <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div class="space-y-2 flex-1">
        <p class="text-sm sm:text-base font-medium text-slate-900 leading-snug">
          «{{ phrase.text }}»
        </p>

        <!-- Vinculación a frase similar si es duplicado confirmado -->
        <div
          v-if="phrase.validationStatus === 'CONFIRMED_DUPLICATE' && phrase.similarPhrase"
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900"
        >
          <svg class="w-3.5 h-3.5 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <span>
            Similar a: <strong class="font-medium">«{{ phrase.similarPhrase.text }}»</strong>
          </span>
        </div>
      </div>

      <!-- Metadatos de Validación (Badge + Score + Fecha) -->
      <div class="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100">
        <div class="flex items-center gap-1.5">
          <template v-if="phrase.validationStatus === 'CONFIRMED_DUPLICATE'">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              Duplicado Confirmado
            </span>
            <span
              v-if="scoreFormatted"
              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-amber-50 text-amber-900 border border-amber-200"
              title="Puntaje de similitud"
            >
              {{ scoreFormatted }}
            </span>
          </template>

          <template v-else>
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Frase Única
            </span>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono text-slate-500 bg-slate-100">
              Score: —
            </span>
          </template>
        </div>

        <time :datetime="isoDate" class="text-[11px] font-mono text-slate-400">
          {{ relativeTime }} · {{ formattedDate }}
        </time>
      </div>
    </div>
  </article>
</template>
