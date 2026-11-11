<script setup lang="ts">
import { AVAILABLE_MODELS, DEFAULT_MODEL_ID } from '../constants/models.js';

withDefaults(
  defineProps<{
    selectedModel?: string;
    activeModelId?: string;
    thresholdPercentage?: string;
  }>(),
  {
    selectedModel: DEFAULT_MODEL_ID,
    activeModelId: DEFAULT_MODEL_ID,
    thresholdPercentage: '80.0%',
  }
);

defineEmits<{
  (e: 'update:selectedModel', value: string): void;
}>();
</script>

<template>
  <header class="bg-white border-b border-slate-200">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div class="flex items-start gap-3.5 pt-1 md:pt-0">
        <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm shrink-0 mt-0.5">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Semantic Phrase Validator
          </h1>
          <p class="text-xs sm:text-sm text-slate-500 mt-0.5">
            Detección semántica de duplicados con embeddings vectoriales multimodelo
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-3 self-start md:self-center">
        <!-- Selector interactivo de modelos -->
        <div class="flex items-center gap-1.5">
          <label for="model-selector" class="text-xs text-slate-500 font-medium">Modelo:</label>
          <select
            id="model-selector"
            aria-label="Seleccionar modelo de embeddings para explorar catálogo"
            :value="selectedModel"
            @change="$emit('update:selectedModel', ($event.target as HTMLSelectElement).value)"
            class="text-xs font-medium rounded-lg border border-slate-300 bg-white py-1.5 pl-2.5 pr-7 text-slate-800 shadow-2xs focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 cursor-pointer"
          >
            <option
              v-for="model in AVAILABLE_MODELS"
              :key="model.id"
              :value="model.id"
            >
              {{ model.name }} {{ model.id === activeModelId ? '✓ (Activo)' : '' }}
            </option>
          </select>
        </div>

        <!-- Badge de umbral reactivo -->
        <div
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
          title="SIMILARITY_THRESHOLD configurado en Backend"
        >
          <span class="text-slate-400">Umbral: </span>
          <span class="font-mono font-semibold text-slate-900">{{ thresholdPercentage }}</span>
        </div>
      </div>
    </div>
  </header>
</template>
