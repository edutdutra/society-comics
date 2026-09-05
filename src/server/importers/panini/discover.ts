import { fetchText } from "../http";
import { parseListingPage, parseTotalCount } from "./parse";

/**
 * Descoberta das URLs de produto.
 *
 * O robots.txt da Panini bloqueia a navegação facetada (`collection=`,
 * `author=`, `month=`, `year=`) mas libera as páginas de categoria e o
 * parâmetro de paginação `p=`. Então paginamos a categoria, que é o caminho
 * sancionado — nunca os filtros.
 *
 * Categorias conhecidas em https://panini.com.br/sitemap.xml
 */
export const CATEGORIES = {
  dc: { path: "/dc-comics", universe: "DC Comics" },
  marvel: { path: "/marvel", universe: "Marvel Comics" },
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

const BASE_URL = "https://panini.com.br";
/** Máximo que o Magento aceita por página nesta loja. */
const PAGE_SIZE = 36;

export type DiscoverOptions = {
  category: CategoryKey;
  /** Para de descobrir ao atingir este número de URLs. */
  limit?: number;
  refresh?: boolean;
};

export async function discoverProductUrls(options: DiscoverOptions): Promise<string[]> {
  const { path } = CATEGORIES[options.category];
  const found: string[] = [];
  const seen = new Set<string>();

  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${BASE_URL}${path}?p=${page}&product_list_limit=${PAGE_SIZE}`;
    const html = await fetchText(url, { refresh: options.refresh });

    if (page === 1) {
      const total = parseTotalCount(html);
      if (total) totalPages = Math.ceil(total / PAGE_SIZE);
    }

    const urls = parseListingPage(html);
    // Página sem produtos significa que passamos do fim da paginação; insistir
    // só geraria requisições inúteis.
    if (urls.length === 0) break;

    for (const productUrl of urls) {
      if (seen.has(productUrl)) continue;
      seen.add(productUrl);
      found.push(productUrl);
      if (options.limit && found.length >= options.limit) return found;
    }

    page += 1;
  }

  return found;
}
