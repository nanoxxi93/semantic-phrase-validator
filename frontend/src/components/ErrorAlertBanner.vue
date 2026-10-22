<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  code?: string;
  message?: string;
  statusCode?: number;
}>();

const computedTitle = computed(() => {
  if (props.code === 'AI_SERVICE_UNAVAILABLE' || props.statusCode === 503) {
    return 'Servicio de inferencia temporalmente no disponible';
  }
  if (props.code === 'RATE_LIMIT_EXCEEDED' || props.statusCode === 429) {
    return 'Límite de peticiones excedido';
  }
  if (props.code === 'NETWORK_ERROR') {
    return 'Error de conexión con el servidor';
  }
  return 'Ocurrió un error en la operación';
});

const computedMessage = computed(() => {
  if (props.code === 'AI_SERVICE_UNAVAILABLE' || props.statusCode === 503) {
    return 'El proveedor de embeddings (Hugging Face) no respondió a tiempo. Por favor, reintenta en unos segundos.';
  }
  if (props.code === 'RATE_LIMIT_EXCEEDED' || props.statusCode === 429) {
    return 'Has alcanzado el límite de peticiones. Por favor, espera unos segundos antes de reintentar.';
  }
  if (props.code === 'NETWORK_ERROR') {
    return 'No fue posible comunicar con el servidor backend. Comprueba tu conexión de red.';
  }
  return props.message || 'Error inesperado. Puedes intentar la operación nuevamente.';
});
</script>

<template>
  <div class="rounded-xl border border-rose-200 bg-rose-50 p-4 relative" role="alert">
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div class="flex-1 text-xs sm:text-sm">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-semibold text-rose-950">{{ computedTitle }}</h3>
          <code
            v-if="code"
            class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[11px]"
          >
            {{ code }} {{ statusCode ? `(${statusCode})` : '' }}
          </code>
        </div>
        <p class="text-rose-700 mt-0.5 text-xs">
          {{ computedMessage }}
        </p>
      </div>
    </div>
  </div>
</template>
