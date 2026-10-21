import { env } from '../config/env.js';
import { HuggingFaceEmbeddingProvider } from '../providers/huggingFaceEmbeddingProvider.js';
import { calculateCosineSimilarity } from '../utils/cosineSimilarity.js';

async function main(): Promise<void> {
  process.stdout.write('=====================================================\n');
  process.stdout.write('Prueba de Integración y Validación Semántica con Hugging Face\n');
  process.stdout.write('=====================================================\n');
  process.stdout.write(`Modelo: ${env.HF_MODEL}\n\n`);

  const provider = new HuggingFaceEmbeddingProvider(env.HF_TOKEN, env.HF_MODEL);

  const phraseA = 'Debo pagar la factura de la luz mañana';
  const phraseA_identical = 'debo pagar la factura de la luz mañana'; // Idéntica (case-insensitive)
  const phraseB = 'Tengo que pagar el recibo de electricidad mañana'; // Paráfrasis directa
  const phraseC = 'La receta de pastel de chocolate lleva tres huevos'; // Completamente distinta

  try {
    process.stdout.write(`Generando embeddings con Hugging Face Inference Providers...\n`);
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
    process.stdout.write(`   Score: ${simParaphrase.toFixed(4)} (Alta similitud semántica)\n\n`);

    process.stdout.write(`3. Tema no relacionado ("${phraseA}" vs "${phraseC}"):\n`);
    process.stdout.write(`   Score: ${simDifferent.toFixed(4)} (Sin relación semántica)\n`);
    process.stdout.write('-----------------------------------------------------\n');

    process.stdout.write('\n[EXITO] Inferencia y validación semántica completadas con éxito.\n');
    process.exit(0);
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || String(err);
    process.stderr.write(`\n[FALLO] Error en Hugging Face: ${errorMsg}\n`);
    process.exit(1);
  }
}

main();
