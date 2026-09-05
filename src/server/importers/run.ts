// Precisa vir antes de qualquer import que alcance env.ts.
import "./load-env";

import { parseArgs } from "node:util";
import mongoose from "mongoose";

import { upsertPublication } from "../repositories/publications";
import { fetchText } from "./http";
import { CATEGORIES, discoverProductUrls, type CategoryKey } from "./panini/discover";
import { mapToPublication } from "./panini/map";
import { parseProductPage } from "./panini/parse";

/**
 * CLI do importador.
 *
 *   pnpm import:panini --dry-run --limit=5
 *   pnpm import:panini --category=dc --limit=100
 *   pnpm import:panini --refresh          (ignora o cache em disco)
 *
 * O padrão é dry-run desligado, mas o fluxo recomendado é sempre rodar com
 * --dry-run primeiro e conferir o `originalContents` a olho. Ver
 * docs/IMPORTER.md.
 */

const { values } = parseArgs({
  options: {
    "dry-run": { type: "boolean", default: false },
    category: { type: "string", default: "dc" },
    limit: { type: "string" },
    refresh: { type: "boolean", default: false },
    verbose: { type: "boolean", default: false },
  },
});

const dryRun = values["dry-run"];
const refresh = values.refresh;
const verbose = values.verbose;
const limit = values.limit ? Number(values.limit) : undefined;
const category = values.category as CategoryKey;

if (!(category in CATEGORIES)) {
  console.error(
    `Categoria inválida: "${category}". Use uma de: ${Object.keys(CATEGORIES).join(", ")}`,
  );
  process.exit(1);
}

if (values.limit && (!Number.isInteger(limit) || limit! < 1)) {
  console.error(`--limit deve ser um inteiro positivo, recebi "${values.limit}"`);
  process.exit(1);
}

async function main() {
  const { universe } = CATEGORIES[category];

  console.log(
    `Importando categoria "${category}" (${universe})` +
      `${limit ? `, limite ${limit}` : ""}${dryRun ? " — DRY RUN, nada será gravado" : ""}`,
  );

  const urls = await discoverProductUrls({ category, limit, refresh });
  console.log(`${urls.length} URLs de produto descobertas.\n`);

  let created = 0;
  let updated = 0;
  let failed = 0;
  let withContents = 0;

  for (const [index, url] of urls.entries()) {
    const position = `[${index + 1}/${urls.length}]`;

    try {
      const html = await fetchText(url, { refresh });
      const raw = parseProductPage(html, url);
      const publication = mapToPublication(raw, universe);

      if (publication.originalContents.length > 0) withContents += 1;

      if (dryRun) {
        console.log(`${position} ${publication.title}`);
        console.log(
          `         sku=${publication.sku ?? "—"} formato=${publication.format} páginas=${publication.pages ?? "—"}`,
        );
        console.log(
          `         linha=${publication.line ?? "—"} vol=${publication.volumeNumber ?? "—"}`,
        );
        for (const content of publication.originalContents) {
          const issues = content.issues?.length ? ` #${content.issues.join(", #")}` : "";
          const qualifier = content.qualifier ? ` ${content.qualifier}` : "";
          const year = content.volumeYear ? ` (${content.volumeYear})` : "";
          // Sem série reconhecida, mostra o cru: é o sinal de que o parser
          // topou com um formato novo e precisa de olho.
          const label = content.series
            ? `${content.series}${qualifier}${year}${issues}`
            : `[cru] ${content.raw}`;
          console.log(`         ↳ ${label}`);
        }
        if (verbose) console.log(JSON.stringify(publication, null, 2));
        continue;
      }

      const result = await upsertPublication(publication);
      if (result.created) created += 1;
      else updated += 1;
      console.log(`${position} ${result.created ? "criado " : "atualizado"} ${publication.slug}`);
    } catch (error) {
      failed += 1;
      console.error(`${position} FALHOU ${url}`);
      console.error(`         ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(
    `\nResumo: ${urls.length} páginas, ${withContents} com conteúdo original, ${failed} falhas.` +
      (dryRun ? "" : ` ${created} criadas, ${updated} atualizadas.`),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    // Sem isso o processo fica pendurado no pool do Mongoose.
    void mongoose.disconnect();
  });
