import * as cheerio from "cheerio";

/**
 * Extração da página de produto da Panini (Magento 2).
 *
 * A página não expõe JSON-LD, então os dados saem da tabela
 * `#product-attribute-specs-table`. O detalhe que importa: o rótulo de cada
 * linha vive no atributo `data-th` do próprio `<td>`, não num `<th>` — e é por
 * isso que mapeamos **por rótulo**, nunca por posição. A Panini adiciona e
 * remove linhas conforme o produto (nem todo volume tem "Conteúdo original"),
 * então indexar por posição quebraria em silêncio.
 *
 * Estrutura observada em 2026-09 (ver docs/IMPORTER.md):
 *
 *   <td class="col data" data-th="Referência">ASMGJ004</td>
 *   <td class="col data" data-th="Conteúdo original"><p><i>Action Comics (1938) 855-857</i></p></td>
 */

/** Dados crus da página, antes de qualquer normalização de domínio. */
export type RawProduct = {
  url: string;
  title: string;
  /** Todos os pares rótulo → valor da tabela, preservados como vieram. */
  attributes: Record<string, string>;
  priceBRL?: number;
  coverImage?: string;
  sku?: string;
  description?: string;
};

function clean(text: string): string {
  return text.replace(/ /gu, " ").replace(/\s+/gu, " ").trim();
}

export function parseProductPage(html: string, url: string): RawProduct {
  const $ = cheerio.load(html);

  const attributes: Record<string, string> = {};
  $("#product-attribute-specs-table td[data-th]").each((_, el) => {
    const label = clean($(el).attr("data-th") ?? "");
    const value = clean($(el).text());
    if (label && value) attributes[label] = value;
  });

  // O preço aparece em três lugares; meta[itemprop] é o mais estável e já vem
  // com ponto decimal, sem o "R$" e sem a vírgula do texto visível.
  const rawPrice =
    $('meta[itemprop="price"]').attr("content") ??
    $("[data-price-amount]").first().attr("data-price-amount");
  const priceBRL = rawPrice ? Number(rawPrice) : undefined;

  const description = clean(
    $(".product.attribute.description").first().text() ||
      $('meta[property="og:description"]').attr("content") ||
      "",
  );

  return {
    url,
    title: clean($("h1").first().text()),
    attributes,
    ...(priceBRL !== undefined && Number.isFinite(priceBRL) ? { priceBRL } : {}),
    ...(getCoverImage($) ? { coverImage: getCoverImage($) } : {}),
    ...(clean($('[itemprop="sku"]').first().text())
      ? { sku: clean($('[itemprop="sku"]').first().text()) }
      : {}),
    ...(description ? { description } : {}),
  };
}

/**
 * A capa é servida por um CloudFront, não pelo domínio da Panini, e a URL
 * termina num sufixo de tamanho (`-S265-FWEBP` = 265px de largura). Trocamos
 * por uma largura maior, já que a listagem usa cards grandes.
 */
function getCoverImage($: cheerio.CheerioAPI): string | undefined {
  const raw = $('meta[property="og:image"]').attr("content");
  if (!raw) return undefined;
  return raw.replace(/-S\d+-F/u, "-S800-F");
}

/**
 * Extrai as URLs de produto de uma página de listagem de categoria.
 * O Magento marca cada card com `.product-item-link`.
 */
export function parseListingPage(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $("a.product-item-link, .product-item-info a.product").each((_, el) => {
    const href = $(el).attr("href");
    if (href?.startsWith("https://")) urls.add(href.split("?")[0]);
  });

  return [...urls];
}

/** Lê o total de produtos declarado pelo Magento ("Produtos 1-12 de 1726"). */
export function parseTotalCount(html: string): number | undefined {
  const $ = cheerio.load(html);
  const text = clean($(".toolbar-amount").first().text());
  const match = /de\s+(\d+)/iu.exec(text);
  return match ? Number(match[1]) : undefined;
}
