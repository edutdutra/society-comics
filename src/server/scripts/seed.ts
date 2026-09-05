// Precisa vir antes de qualquer import que alcance env.ts.
import "../importers/load-env";

import mongoose from "mongoose";

import { countPublications, upsertPublication } from "../repositories/publications";
import { PublicationInput } from "../schemas/publication";
import { SEED_PUBLICATIONS } from "./seed-data";

/**
 * Popula o banco com o catálogo de exemplo.
 *
 *   pnpm db:seed
 *
 * Usa o mesmo `upsertPublication` do importador, então é idempotente pelo SKU:
 * rodar duas vezes atualiza os mesmos documentos em vez de duplicar. Não apaga
 * nada — se você já importou dados de verdade, o seed convive com eles.
 */
async function main() {
  console.log(`Semeando ${SEED_PUBLICATIONS.length} publicações...\n`);

  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const entry of SEED_PUBLICATIONS) {
    try {
      // Passa pelo mesmo portão de validação que o importador usa: se um
      // registro do seed sair do schema, falha aqui e não no banco.
      const publication = PublicationInput.parse(entry);
      const result = await upsertPublication(publication);

      if (result.created) created += 1;
      else updated += 1;

      console.log(`  ${result.created ? "criado    " : "atualizado"} ${publication.slug}`);
    } catch (error) {
      failed += 1;
      console.error(`  FALHOU     ${entry.slug}`);
      console.error(`             ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const total = await countPublications();
  console.log(`\n${created} criadas, ${updated} atualizadas, ${failed} falhas.`);
  console.log(`Total na coleção: ${total}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void mongoose.disconnect();
  });
