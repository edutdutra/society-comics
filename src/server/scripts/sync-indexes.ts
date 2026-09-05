// Precisa vir antes de qualquer import que alcance env.ts.
import "../importers/load-env";

import mongoose from "mongoose";

import { connectToDatabase } from "../db";
import { Publication } from "../models/Publication";

/**
 * Cria no banco os índices declarados em models/Publication.ts.
 *
 * Existe como script explícito porque o `autoIndex` do Mongoose não é
 * confiável fora de desenvolvimento: ele roda em background no boot da
 * aplicação, sem garantia de ter terminado, e num cluster com várias
 * instâncias todas tentam criar os mesmos índices ao mesmo tempo.
 *
 * `syncIndexes()` também **remove** índices que existem no banco mas não estão
 * mais no schema — por isso rode-o com consciência, não em todo deploy.
 *
 *   pnpm db:indexes
 */
async function main() {
  await connectToDatabase();

  console.log("Sincronizando índices da coleção publications...");
  const removed = await Publication.syncIndexes();

  if (removed.length > 0) {
    console.log(`Índices removidos por não existirem mais no schema: ${removed.join(", ")}`);
  }

  // `listIndexes()` devolve `any[]`; tipar o mínimo que usamos evita propagar
  // o any para o console.log.
  const indexes = (await Publication.listIndexes()) as { name: string; key: unknown }[];
  console.log(`\n${indexes.length} índices ativos:`);
  for (const index of indexes) {
    console.log(`  ${index.name}  ${JSON.stringify(index.key)}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void mongoose.disconnect();
  });
