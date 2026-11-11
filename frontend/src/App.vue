<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppHeader from './components/AppHeader.vue';
import PhraseForm from './components/PhraseForm.vue';
import PhraseCatalog from './components/PhraseCatalog.vue';
import { phraseService } from './services/phraseService.js';
import { DEFAULT_MODEL_ID } from './constants/models.js';
import type { PhraseListItem } from './types/phrase.js';
import type { ActiveModelInfo } from './types/api.js';

const catalogRef = ref<InstanceType<typeof PhraseCatalog> | null>(null);
const activeModelInfo = ref<ActiveModelInfo | null>(null);
const selectedModel = ref<string>(DEFAULT_MODEL_ID);

const activeModelId = computed(() => {
  return activeModelInfo.value?.modelIdentifier ?? DEFAULT_MODEL_ID;
});

const thresholdPercentage = computed(() => {
  if (!activeModelInfo.value?.threshold) return '80.0%';
  return `${(activeModelInfo.value.threshold * 100).toFixed(1)}%`;
});

const handlePhraseSaved = (phrase: PhraseListItem) => {
  catalogRef.value?.onPhraseCreated(phrase);
};

onMounted(async () => {
  // Silent health check probe to warm up serverless / container cold start without UI feedback
  phraseService.checkHealth().catch(() => {});

  // Fetch active model info from backend to dynamically configure UI and selector
  try {
    const modelData = await phraseService.getActiveModel();
    activeModelInfo.value = modelData;
    selectedModel.value = modelData.modelIdentifier;
  } catch {
    // If backend /api/model is temporarily unavailable, gracefully preserve defaults (CE-9)
  }
});
</script>

<template>
  <div class="min-h-full flex flex-col flex-1 bg-slate-50 text-slate-800 antialiased font-sans">
    <AppHeader
      :selected-model="selectedModel"
      :active-model-id="activeModelId"
      :threshold-percentage="thresholdPercentage"
      @update:selected-model="selectedModel = $event"
    />

    <main class="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
      <PhraseForm
        :selected-model="selectedModel"
        :active-model-id="activeModelId"
        @phrase-saved="handlePhraseSaved"
      />
      <PhraseCatalog
        ref="catalogRef"
        :selected-model="selectedModel"
        :active-model-id="activeModelId"
      />
    </main>
  </div>
</template>
