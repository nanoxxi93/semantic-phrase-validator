<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { usePhraseCatalog } from '../composables/usePhraseCatalog.js';
import { DEFAULT_MODEL_ID } from '../constants/models.js';
import PhraseFilterBar from './PhraseFilterBar.vue';
import PhraseList from './PhraseList.vue';
import PaginationBar from './PaginationBar.vue';

const props = withDefaults(
  defineProps<{
    selectedModel?: string;
    activeModelId?: string;
  }>(),
  {
    selectedModel: DEFAULT_MODEL_ID,
    activeModelId: DEFAULT_MODEL_ID,
  }
);

const {
  phrases,
  pagination,
  activeFilter,
  isLoading,
  errorState,
  fetchCatalog,
  setFilter,
  setSelectedModel,
  changePage,
  onPhraseCreated,
} = usePhraseCatalog(props.selectedModel);

watch(
  () => props.selectedModel,
  (newModel) => {
    if (newModel) {
      setSelectedModel(newModel);
    }
  }
);

onMounted(() => {
  fetchCatalog();
});

defineExpose({
  onPhraseCreated,
  fetchCatalog,
  phrases,
  activeFilter,
  pagination,
  errorState,
});
</script>

<template>
  <section class="space-y-4 relative">
    <PhraseFilterBar
      :total-count="pagination.total"
      :active-filter="activeFilter"
      @change-filter="setFilter"
    />

    <PhraseList
      :phrases="phrases"
      :is-loading="isLoading"
    />

    <PaginationBar
      v-if="pagination.total > 0"
      :page="pagination.page"
      :total-pages="pagination.totalPages"
      :total="pagination.total"
      :disabled="isLoading"
      @change-page="changePage"
    />
  </section>
</template>
