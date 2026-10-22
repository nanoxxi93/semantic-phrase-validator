<script setup lang="ts">
withDefaults(
  defineProps<{
    thresholdPercentage?: string;
  }>(),
  {
    thresholdPercentage: '80.0%',
  }
);
</script>

<template>
  <header class="bg-white border-b border-slate-200">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="flex items-start gap-3.5 pt-1 sm:pt-0">
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
            Detección semántica de duplicados con Hugging Face Embeddings (<code class="font-mono text-xs text-slate-600 bg-slate-100 px-1 py-0.5 rounded">MiniLM-L12-v2</code>)
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2.5 self-start sm:self-center">
        <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200" title="SIMILARITY_THRESHOLD configurado en Backend">
          <span class="text-slate-400">Umbral: </span>
          <span class="font-mono font-semibold text-slate-900">{{ thresholdPercentage }}</span>
        </div>
      </div>
    </div>
  </header>
</template>
