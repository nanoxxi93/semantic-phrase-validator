<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppHeader from './components/AppHeader.vue';
import PhraseForm from './components/PhraseForm.vue';
import PhraseCatalog from './components/PhraseCatalog.vue';
import { phraseService } from './services/phraseService.js';
import type { PhraseListItem } from './types/phrase.js';

const catalogRef = ref<InstanceType<typeof PhraseCatalog> | null>(null);

const handlePhraseSaved = (phrase: PhraseListItem) => {
  catalogRef.value?.onPhraseCreated(phrase);
};

onMounted(() => {
  // Silent health check probe to warm up serverless / container cold start without UI feedback
  phraseService.checkHealth().catch(() => {
    // Silently ignore; user action will reveal any real connection errors cleanly
  });
});
</script>

<template>
  <div class="min-h-full flex flex-col flex-1 bg-slate-50 text-slate-800 antialiased font-sans">
    <AppHeader threshold-percentage="80.0%" />

    <main class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
      <PhraseForm @phrase-saved="handlePhraseSaved" />
      <PhraseCatalog ref="catalogRef" />
    </main>
  </div>
</template>
