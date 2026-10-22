import { env } from '../config/env.js';
import { HuggingFaceEmbeddingProvider } from '../providers/huggingFaceEmbeddingProvider.js';
import { calculateCosineSimilarity } from '../utils/cosineSimilarity.js';

async function main(): Promise<void> {
  process.stdout.write('=====================================================\n');
  process.stdout.write('Prueba de Integración y Validación Semántica con Hugging Face\n');
  process.stdout.write('=====================================================\n');
  process.stdout.write(`Modelo: ${env.HF_MODEL}\n\n`);

  // Verificación defensiva previa de credenciales
  if (!env.HF_TOKEN || env.HF_TOKEN.includes('dummy')) {
    process.stderr.write('[AVISO] HF_TOKEN no está configurado con una clave real o contiene el valor dummy por defecto.\n');
    process.stderr.write('Para probar la inferencia real en caliente:\n');
    process.stderr.write('  1. Obtén un token en https://huggingface.co/settings/tokens\n');
    process.stderr.write('  2. Asegúrate de tener saldo/créditos de inferencia activos en tu cuenta de Hugging Face.\n');
    process.stderr.write('  3. Configura HF_TOKEN=<tu_token> en backend/.env\n\n');
    process.stderr.write('Nota: Las suites de pruebas automatizadas (npm run test:monorepo) no requieren saldo ni conexión externa.\n');
    process.exit(1);
  }

  const provider = new HuggingFaceEmbeddingProvider(env.HF_TOKEN, env.HF_MODEL);

  const phraseA = 'Debo pagar la factura de la luz mañana';
  const phraseA_identical = 'debo pagar la factura de la luz mañana'; // Idéntica (case-insensitive)
  const phraseB = 'Tengo que pagar el recibo de electricidad mañana'; // Paráfrasis directa
  const phraseC = 'La receta de pastel de chocolate lleva tres huevos'; // Completamente distinta

  try {
    process.stdout.write('Generando embeddings con Hugging Face Inference Providers...\n');
    const vecA = await provider.generateEmbedding(phraseA);
    const vecA_id = await provider.generateEmbedding(phraseA_identical);
    const vecB = await provider.generateEmbedding(phraseB);
    const vecC = await provider.generateEmbedding(phraseC);

    const simIdentical = calculateCosineSimilarity(vecA, vecA_id);
    const simParaphrase = calculateCosineSimilarity(vecA, vecB);
    const simDifferent = calculateCosineSimilarity(vecA, vecC);

    process.stdout.write('\nResultados de Similitud Coseno:\n');
    process.stdout.write('-----------------------------------------------------\n');
    process.stdout.write(`1. Idéntica ("${phraseA}" vs "${phraseA_identical}"):\n`);
    process.stdout.write(`   Score: ${simIdentical.toFixed(4)} (100% idéntica)\n\n`);

    process.stdout.write(`2. Paráfrasis ("${phraseA}" vs "${phraseB}"):\n`);
    process.stdout.write(`   Score: ${simParaphrase.toFixed(4)} (Alta similitud semántica > Umbral ${env.SIMILARITY_THRESHOLD})\n\n`);

    process.stdout.write(`3. Tema no relacionado ("${phraseA}" vs "${phraseC}"):\n`);
    process.stdout.write(`   Score: ${simDifferent.toFixed(4)} (Sin relación semántica < Umbral ${env.SIMILARITY_THRESHOLD})\n`);
    process.stdout.write('-----------------------------------------------------\n');

    process.stdout.write('\n[EXITO] Inferencia y validación semántica completadas con éxito.\n');
    process.exit(0);
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || String(err);
    const statusCode =
      (err as { statusCode?: number; status?: number })?.statusCode ||
      (err as { statusCode?: number; status?: number })?.status;

    process.stderr.write(`\n[FALLO] Error en Hugging Face: ${errorMsg}\n`);

    if (statusCode === 401 || statusCode === 403 || errorMsg.includes('Unauthorized') || errorMsg.includes('Invalid token')) {
      process.stderr.write('Causa probable: Token de Hugging Face no válido o revocado. Verifica https://huggingface.co/settings/tokens\n');
    } else if (
      statusCode === 402 ||
      errorMsg.toLowerCase().includes('payment') ||
      errorMsg.toLowerCase().includes('credit') ||
      errorMsg.toLowerCase().includes('balance')
    ) {
      process.stderr.write('Causa probable: Saldo insuficiente en Hugging Face Inference Providers. Recarga créditos en https://huggingface.co/settings/billing\n');
    }

    process.exit(1);
  }
}

main();
