import { PublicationInput, type PublicationFormat } from "../../schemas/publication";
import { parseOriginalContents } from "./conteudo-original";
import type { RawProduct } from "./parse";

/**
 * Traduz a página crua da Panini para o domínio, validando com Zod antes de
 * devolver. É o portão único de escrita do importador: nada entra no banco sem
 * passar por `PublicationInput.parse`.
 *
 * Rótulos observados na tabela de atributos (2026-09). Mapear por rótulo, e
 * não por posição, é o que mantém isso estável quando a Panini acrescenta ou
 * remove uma linha.
 */
const LABELS = {
  sku: "Referência",
  authors: "Autores",
  year: "Ano de publicação",
  month: "Mês",
  pages: "Quantidade de páginas",
  binding: "Encadernação",
  collection: "Coleção",
  ageRating: "Classificação etária",
  publicationType: "Tipo de publicação",
  originalContents: "Conteúdo original",
  isbn: "ISBN",
} as const;

const MONTHS: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  março: 2,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

/** "Capa dura" → "hardcover". O texto é livre, então casamos por substring. */
function mapFormat(
  binding: string | undefined,
  publicationType: string | undefined,
): PublicationFormat {
  const haystack = `${binding ?? ""} ${publicationType ?? ""}`.toLowerCase();

  if (haystack.includes("omnibus") || haystack.includes("absoluta")) return "omnibus";
  if (haystack.includes("capa dura") || haystack.includes("cartonado")) return "hardcover";
  if (haystack.includes("grampo") || haystack.includes("revista")) return "periodical";
  if (
    haystack.includes("brochura") ||
    haystack.includes("capa cartão") ||
    haystack.includes("capa card")
  )
    return "paperback";

  return "unknown";
}

/**
 * Ano + Mês viram uma data no dia 1. A Panini não publica o dia exato, então
 * fixar no dia 1 é honesto: a ordenação por mês continua correta e ninguém
 * lê aquilo como data de lançamento precisa.
 */
function mapReleasedAt(year: string | undefined, month: string | undefined): Date | undefined {
  if (!year) return undefined;

  const yearNumber = Number(year);
  if (!Number.isInteger(yearNumber) || yearNumber < 1930 || yearNumber > 2100) return undefined;

  const monthIndex = month ? MONTHS[month.toLowerCase().trim()] : undefined;
  return new Date(Date.UTC(yearNumber, monthIndex ?? 0, 1));
}

const VOLUME_PATTERN = /\s*(?:vol\.?|volume)\s*(\d+)\s*$/iu;

/**
 * Nome da linha editorial, a partir do atributo "Coleção".
 *
 * Atenção ao que esse campo NÃO é: em "SUPERMAN POR GEOFF JOHNS VOL. 01" o
 * "VOL. 01" faz parte do nome da coleção e não diz o volume deste produto —
 * a página em questão é a do Vol. 04. Tirar o volume daqui gravava 1 em todo
 * volume da série. O número certo vem do título do produto (ver
 * `volumeFromTitle`).
 */
function mapLine(collection: string | undefined): string | undefined {
  if (!collection) return undefined;
  return titleCase(collection.replace(VOLUME_PATTERN, "").trim());
}

/** "Superman Por Geoff Johns Vol. 04" → 4 */
function volumeFromTitle(title: string): number | undefined {
  const match = VOLUME_PATTERN.exec(title);
  if (match) return Number(match[1]);

  // Periódicos usam número solto no fim: "Jovens Titãs Em Ação 15".
  const trailing = /\s(\d{1,3})$/u.exec(title.trim());
  return trailing ? Number(trailing[1]) : undefined;
}

/**
 * Siglas que precisam sobreviver à normalização de caixa. A Panini escreve os
 * títulos inteiros em caixa alta, então não dá para detectar sigla pela caixa
 * do original — daí a lista explícita.
 */
const ACRONYMS = new Set(["DC", "LJA", "JLA", "DCU", "EUA", "HQ", "HQS", "TPB", "KO", "AD"]);

const MINOR_WORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "a",
  "o",
  "as",
  "os",
  "em",
  "por",
  "com",
  "para",
  "na",
  "no",
]);

/**
 * "SUPERMAN POR GEOFF JOHNS" → "Superman por Geoff Johns".
 *
 * Capitaliza também depois de hífen e barra, senão "MULHER-MARAVILHA" viraria
 * "Mulher-maravilha" e "LJA/VINGADORES" viraria "Lja/vingadores".
 */
function titleCase(value: string): string {
  return value
    .split(/\s+/u)
    .map((word, wordIndex) =>
      // Mantém os separadores internos ao dividir, para reconstruir a palavra.
      word
        .split(/([-/:])/u)
        .map((part, partIndex) => {
          if (/^[-/:]$/u.test(part)) return part;

          const upper = part.toUpperCase();
          if (ACRONYMS.has(upper)) return upper;

          const lower = part.toLowerCase();
          // Palavra menor só fica minúscula se não abre o título nem um segmento.
          if (wordIndex > 0 && partIndex === 0 && MINOR_WORDS.has(lower)) return lower;

          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(""),
    )
    .join(" ");
}

/** Deriva o slug da URL, que já é canônica e estável. */
function slugFromUrl(url: string): string {
  const path = new URL(url).pathname.replace(/^\/+|\/+$/gu, "");
  return path
    .split("/")
    .pop()!
    .replace(/\.html?$/iu, "")
    .toLowerCase();
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^\d]/gu, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function mapToPublication(raw: RawProduct, universe: string): PublicationInput {
  const attr = raw.attributes;
  const line = mapLine(attr[LABELS.collection]);
  const volumeNumber = volumeFromTitle(raw.title);

  // "Autores" vem numa lista única sem separar função, então gravamos os nomes
  // sem `role` em vez de chutar quem é roteirista e quem é desenhista.
  const creators = (attr[LABELS.authors] ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
    .map((name) => ({ name }));

  const candidate = {
    slug: slugFromUrl(raw.url),
    sku: raw.sku ?? attr[LABELS.sku],
    title: raw.title,
    synopsis: raw.description,
    publisher: "Panini",
    universe,
    line,
    volumeNumber,
    format: mapFormat(attr[LABELS.binding], attr[LABELS.publicationType]),
    isbn: attr[LABELS.isbn],
    pages: toNumber(attr[LABELS.pages]),
    priceBRL: raw.priceBRL,
    ageRating: attr[LABELS.ageRating],
    releasedAt: mapReleasedAt(attr[LABELS.year], attr[LABELS.month]),
    coverImage: raw.coverImage,
    originalContents: parseOriginalContents(attr[LABELS.originalContents]),
    creators,
    characters: [],
    source: { name: "panini", url: raw.url, scrapedAt: new Date() },
    // Todo item importado entra na fila de revisão; nada vai direto ao ar.
    reviewStatus: "pending" as const,
  };

  // Portão de validação: se o parse mudou e produziu algo inválido, falha aqui
  // e não no banco.
  return PublicationInput.parse(candidate);
}
