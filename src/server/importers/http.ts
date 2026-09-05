import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { env } from "../env";

/**
 * Cliente HTTP do importador: cache em disco + rate limit.
 *
 * As duas coisas existem pelo mesmo motivo — não martelar o site de origem.
 * Durante o desenvolvimento do parser você roda a importação dezenas de vezes;
 * sem cache, cada rodada seria um novo crawl completo do catálogo.
 *
 * Regras de convivência estão em docs/IMPORTER.md.
 */

const CACHE_DIR = join(process.cwd(), ".cache", "panini");

let lastRequestAt = 0;

/** Espaça as requisições em IMPORTER_DELAY_MS, medido de fim a início. */
async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  const wait = env.IMPORTER_DELAY_MS - elapsed;
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

function cachePathFor(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 32);
  // Dois níveis de diretório: um só diretório com milhares de arquivos fica
  // lento de listar no Windows.
  return join(CACHE_DIR, hash.slice(0, 2), `${hash}.html`);
}

export type FetchOptions = {
  /** Ignora o cache e rebaixa a página. */
  refresh?: boolean;
};

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const cachePath = cachePathFor(url);

  if (!options.refresh) {
    try {
      return await readFile(cachePath, "utf8");
    } catch {
      // Cache miss: segue para a rede.
    }
  }

  await throttle();

  const response = await fetch(url, {
    headers: {
      // User-Agent honesto: identifica o projeto e dá um canal de contato para
      // quem administra o site, em vez de fingir ser um navegador.
      "user-agent": env.IMPORTER_USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "pt-BR,pt;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${url} respondeu ${response.status} ${response.statusText}`);
  }

  const body = await response.text();

  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, body, "utf8");

  return body;
}
