<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    page: number;
    totalPages: number;
    total: number;
    disabled?: boolean;
  }>(),
  {
    disabled: false,
  }
);

defineEmits<{
  (e: 'change-page', newPage: number): void;
}>();

const safeTotalPages = computed(() => {
  return props.totalPages > 0 ? props.totalPages : 1;
});
</script>

<template>
  <div
    class="bg-white rounded-xl border border-slate-200 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 relative"
  >
    <div>
      Mostrando página
      <span class="font-semibold text-slate-900">{{ page }}</span>
      de
      <span class="font-semibold text-slate-900">{{ safeTotalPages }}</span>
      <span class="text-slate-400 mx-1">·</span>
      Total: <span class="font-semibold text-slate-900">{{ total }}</span> frases registradas
    </div>

    <div class="inline-flex items-center gap-1.5">
      <button
        type="button"
        :disabled="page <= 1 || disabled"
        @click="$emit('change-page', page - 1)"
        class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer disabled:bg-slate-50 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
      >
        Anterior
      </button>

      <button
        type="button"
        :disabled="page >= safeTotalPages || disabled"
        @click="$emit('change-page', page + 1)"
        class="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium transition cursor-pointer disabled:bg-slate-50 disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
      >
        Siguiente
      </button>
    </div>
  </div>
</template>
