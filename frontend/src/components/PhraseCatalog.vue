<script setup lang="ts">
import { onMounted } from 'vue';
import { usePhraseCatalog } from '../composables/usePhraseCatalog.js';
import PhraseFilterBar from './PhraseFilterBar.vue';
import PhraseList from './PhraseList.vue';
import PaginationBar from './PaginationBar.vue';

const {
  phrases,
  pagination,
  activeFilter,
  isLoading,
  errorState,
  fetchCatalog,
  setFilter,
  changePage,
  onPhraseCreated,
} = usePhraseCatalog();

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
