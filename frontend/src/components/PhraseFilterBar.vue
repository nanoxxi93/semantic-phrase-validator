<script setup lang="ts">
import type { CatalogFilter } from '../types/ui.js';

defineProps<{
  totalCount: number;
  activeFilter: CatalogFilter;
}>();

defineEmits<{
  (e: 'change-filter', filter: CatalogFilter): void;
}>();
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <div>
      <h2 class="text-base font-bold text-slate-900 flex items-center gap-2">
        <span>Frases Registradas</span>
        <span class="px-2 py-0.5 text-xs font-mono font-semibold rounded-full bg-slate-200 text-slate-700">
          {{ totalCount }}
        </span>
      </h2>
      <p class="text-xs text-slate-500">
        Historial ordenado cronológicamente con trazabilidad de similitud semántica
      </p>
    </div>

    <!-- Tabs de filtro por validationStatus -->
    <div
      class="inline-flex p-1 rounded-xl bg-slate-200/70 border border-slate-200 self-start sm:self-auto"
      role="group"
      aria-label="Filtrar frases por estado"
    >
      <button
        type="button"
        @click="$emit('change-filter', 'ALL')"
        :class="[
          'px-3 py-1.5 rounded-lg text-xs transition cursor-pointer',
          activeFilter === 'ALL'
            ? 'font-semibold bg-white text-slate-900 shadow-2xs'
            : 'font-medium text-slate-600 hover:text-slate-900',
        ]"
      >
        Todas
      </button>

      <button
        type="button"
        @click="$emit('change-filter', 'UNIQUE')"
        :class="[
          'px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer',
          activeFilter === 'UNIQUE'
            ? 'font-semibold bg-white text-slate-900 shadow-2xs'
            : 'font-medium text-slate-600 hover:text-slate-900',
        ]"
      >
        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
        <span>Únicas</span>
      </button>

      <button
        type="button"
        @click="$emit('change-filter', 'CONFIRMED_DUPLICATE')"
        :class="[
          'px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer',
          activeFilter === 'CONFIRMED_DUPLICATE'
            ? 'font-semibold bg-white text-slate-900 shadow-2xs'
            : 'font-medium text-slate-600 hover:text-slate-900',
        ]"
      >
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        <span>Duplicados Confirmados</span>
      </button>
    </div>
  </div>
</template>
