<script setup lang="ts">
import type { PhraseListItem } from '../types/phrase.js';
import PhraseCard from './PhraseCard.vue';

withDefaults(
  defineProps<{
    phrases: PhraseListItem[];
    isLoading?: boolean;
  }>(),
  {
    isLoading: false,
  }
);
</script>

<template>
  <div class="space-y-3">
    <!-- Estado de carga (Skeleton) -->
    <div v-if="isLoading" class="space-y-3">
      <div
        v-for="i in 3"
        :key="i"
        class="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs animate-pulse"
      >
        <div class="h-4 bg-slate-200 rounded w-3/4 mb-2.5"></div>
        <div class="h-3 bg-slate-100 rounded w-1/3"></div>
      </div>
    </div>

    <!-- Estado vacío accesible (CE-7) -->
    <div
      v-else-if="phrases.length === 0"
      class="bg-white rounded-xl border border-dashed border-slate-300 p-8 text-center"
    >
      <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </div>
      <h3 class="text-sm font-semibold text-slate-800">No hay frases registradas</h3>
      <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
        No se encontraron oraciones para el filtro actual. Las frases que agregues y valides se mostrarán en este catálogo con su trazabilidad semántica.
      </p>
    </div>

    <!-- Lista de tarjetas de frase -->
    <div v-else class="space-y-3">
      <PhraseCard
        v-for="phrase in phrases"
        :key="phrase.id"
        :phrase="phrase"
      />
    </div>
  </div>
</template>
