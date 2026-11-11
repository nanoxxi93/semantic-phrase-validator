import { env } from '../config/env.js';
import { CloudflareEmbeddingProvider } from '../providers/cloudflareEmbeddingProvider.js';
import { calculateCosineSimilarity } from '../utils/cosineSimilarity.js';

async function main(): Promise<void> {
  process.stdout.write('=====================================================\n');
  process.stdout.write('Prueba de Integración y Validación Semántica con Cloudflare Workers AI\n');
  process.stdout.write('=====================================================\n');
  process.stdout.write(`Modelo: ${env.CLOUDFLARE_MODEL}\n`);
  if (env.CLOUDFLARE_GATEWAY_ID) {
    process.stdout.write(`AI Gateway: ${env.CLOUDFLARE_GATEWAY_ID}\n`);
  }
  process.stdout.write('\n');

  // Verificación defensiva de credenciales
  if (
    !env.CLOUDFLARE_ACCOUNT_ID ||
    env.CLOUDFLARE_ACCOUNT_ID.includes('tu_cloudflare') ||
    !env.CLOUDFLARE_API_TOKEN ||
    env.CLOUDFLARE_API_TOKEN.includes('tu_cloudflare')
  ) {
    process.stderr.write('[AVISO] Credenciales de Cloudflare no configuradas en el archivo .env.\n');
    process.stderr.write('Para probar la inferencia real:\n');
    process.stderr.write('  1. Obtén tu Account ID en https://dash.cloudflare.com/ (Workers & Pages)\n');
    process.stderr.write('  2. Crea un API Token con permiso "Workers AI - Read" en https://dash.cloudflare.com/profile/api-tokens\n');
    process.stderr.write('  3. Configura en tu backend/.env:\n');
    process.stderr.write('       EMBEDDING_PROVIDER=cloudflare\n');
    process.stderr.write('       CLOUDFLARE_ACCOUNT_ID=<tu_account_id>\n');
    process.stderr.write('       CLOUDFLARE_API_TOKEN=<tu_api_token>\n\n');
    process.stderr.write('Nota: Las suites de pruebas automatizadas (npm run test) no requieren conexión externa.\n');
    process.exit(1);
  }

  const provider = new CloudflareEmbeddingProvider(
    env.CLOUDFLARE_ACCOUNT_ID,
    env.CLOUDFLARE_API_TOKEN,
    {
      model: env.CLOUDFLARE_MODEL,
      gatewayId: env.CLOUDFLARE_GATEWAY_ID,
    }
  );

  const phraseA = 'Debo pagar la factura de la luz mañana';
  const phraseA_identical = 'debo pagar la factura de la luz mañana'; // Idéntica (case-insensitive)
  const phraseB = 'Tengo que pagar el recibo de electricidad mañana'; // Paráfrasis directa
  const phraseC = 'La receta de pastel de chocolate lleva tres huevos'; // Completamente distinta

  try {
    process.stdout.write('Generando embeddings con Cloudflare Workers AI...\n');
    const startTime = Date.now();

    const [vecA, vecA_id, vecB, vecC] = await Promise.all([
      provider.generateEmbedding(phraseA),
      provider.generateEmbedding(phraseA_identical),
      provider.generateEmbedding(phraseB),
      provider.generateEmbedding(phraseC),
    ]);

    const totalTimeMs = Date.now() - startTime;

    process.stdout.write(`Vectores generados exitosamente en ${totalTimeMs} ms.\n`);
    process.stdout.write(`Dimensión de los vectores: ${vecA.length} (esperado: 1024)\n\n`);

    const simIdentical = calculateCosineSimilarity(vecA, vecA_id);
    const simParaphrase = calculateCosineSimilarity(vecA, vecB);
    const simDifferent = calculateCosineSimilarity(vecA, vecC);

    process.stdout.write('Resultados de Similitud Coseno:\n');
    process.stdout.write('-----------------------------------------------------\n');
    process.stdout.write(`1. Idéntica ("${phraseA}" vs "${phraseA_identical}"):\n`);
    process.stdout.write(`   Score: ${simIdentical.toFixed(4)} (100% idéntica)\n\n`);

    process.stdout.write(`2. Paráfrasis ("${phraseA}" vs "${phraseB}"):\n`);
    process.stdout.write(
      `   Score: ${simParaphrase.toFixed(4)} (Umbral actual: ${env.SIMILARITY_THRESHOLD})\n\n`
    );

    process.stdout.write(`3. Tema no relacionado ("${phraseA}" vs "${phraseC}"):\n`);
    process.stdout.write(
      `   Score: ${simDifferent.toFixed(4)} (Umbral actual: ${env.SIMILARITY_THRESHOLD})\n`
    );
    process.stdout.write('-----------------------------------------------------\n\n');

    process.stdout.write('Análisis de Calibración de Umbral para BGE-M3:\n');
    if (simParaphrase >= env.SIMILARITY_THRESHOLD && simDifferent < env.SIMILARITY_THRESHOLD) {
      process.stdout.write(
        `✓ El umbral actual SIMILARITY_THRESHOLD=${env.SIMILARITY_THRESHOLD} discrimina perfectamente paráfrasis de textos no relacionados.\n`
      );
    } else if (simParaphrase < env.SIMILARITY_THRESHOLD) {
      process.stdout.write(
        `⚠ La paráfrasis obtuvo ${simParaphrase.toFixed(4)}, que está por debajo del umbral ${env.SIMILARITY_THRESHOLD}. Se sugiere calibrar SIMILARITY_THRESHOLD=${(
          simParaphrase - 0.05
        ).toFixed(2)} en .env.\n`
      );
    } else {
      process.stdout.write(
        `⚠ El texto no relacionado obtuvo ${simDifferent.toFixed(4)}. Se sugiere aumentar el umbral a ${(
          simDifferent + 0.1
        ).toFixed(2)} en .env.\n`
      );
    }

    process.stdout.write('\n[EXITO] Inferencia con Cloudflare Workers AI (BGE-M3) verificada con éxito.\n');
    process.exit(0);
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || String(err);
    const statusCode =
      (err as { statusCode?: number; status?: number })?.statusCode ||
      (err as { statusCode?: number; status?: number })?.status;

    process.stderr.write(`\n[FALLO] Error en Cloudflare Workers AI: ${errorMsg}\n`);

    if (statusCode === 401 || statusCode === 403) {
      process.stderr.write(
        'Causa probable: Token de API de Cloudflare no válido o sin permiso "Workers AI - Read".\n'
      );
    } else if (statusCode === 404) {
      process.stderr.write(
        'Causa probable: Account ID no encontrado o modelo inexistente en Workers AI.\n'
      );
    } else if (statusCode === 429) {
      process.stderr.write(
        'Causa probable: Límite de tasa (Rate limit) o cuota diaria de neuronas gratuitas agotada.\n'
      );
    }

    process.exit(1);
  }
}

main();
