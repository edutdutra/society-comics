import type { OriginalContent } from "../../schemas/publication";

/**
 * Parser do atributo "Conteúdo original" das páginas de produto da Panini.
 *
 * É esse campo que diz quais edições americanas foram compiladas no volume
 * brasileiro — o dado que, de outra forma, seria trabalhoso de levantar à mão.
 *
 * Gramática observada (ver docs/IMPORTER.md):
 *
 *   entrada   := parte (";" parte)*
 *   parte     := série [qualificador] "(" ano ")" faixa?
 *   faixa     := número ("-" número)? ("," faixa)*
 *
 * Exemplo real, de superman-por-geoff-johns-vol-04:
 *   "Action Comics (1938) 855-857; Action Comics Annual (1987) 10"
 *
 * Princípio de projeto: **nunca perder dado**. Toda parte vira uma entrada com
 * `raw` preenchido, e os campos estruturados só aparecem quando o parser tem
 * certeza. Isso permite reprocessar depois — basta rodar o parser de novo em
 * cima de `raw`, sem re-baixar nada do site.
 */

/** Sufixos que a Panini anexa ao nome da série e que não fazem parte dele. */
const QUALIFIERS = [
  "Annual",
  "Special",
  "Specials",
  "One-Shot",
  "One Shot",
  "Giant",
  "Extra",
  "Anual",
  "Especial",
];

const PART_PATTERN = new RegExp(
  [
    "^(?<series>.+?)", // nome da série, não guloso
    `(?:\\s+(?<qualifier>${QUALIFIERS.join("|")}))?`, // qualificador opcional
    "\\s*\\((?<year>\\d{4})\\)", // ano do volume, entre parênteses
    "\\s*(?<issues>[\\d\\s,\\-–—/&]+)?$", // faixa de edições, opcional
  ].join(""),
  "iu",
);

/** "855-857" → [855, 856, 857] ; "1-3, 5" → [1, 2, 3, 5] */
function parseIssueRange(raw: string): number[] {
  const issues = new Set<number>();

  // Separadores usados de forma intercambiável nas páginas.
  for (const chunk of raw.split(/[,/&]/u)) {
    const segment = chunk.trim();
    if (!segment) continue;

    // Hífen comum, en dash e em dash aparecem todos.
    const range = /^(\d+)\s*[-–—]\s*(\d+)$/u.exec(segment);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      // Faixa invertida ou absurda indica parse errado: descarta os números e
      // deixa só o `raw` da entrada falar, em vez de gravar lixo.
      if (start > end || end - start > 500) continue;
      for (let n = start; n <= end; n += 1) issues.add(n);
      continue;
    }

    if (/^\d+$/u.test(segment)) issues.add(Number(segment));
  }

  return [...issues].sort((a, b) => a - b);
}

/**
 * Nem toda entrada traz o ano entre parênteses — "Batman: Dark Patterns 7-12"
 * e "JLA/Avengers 3" aparecem assim. Sem este segundo padrão, essas perderiam
 * as edições e sobraria só o `raw`.
 */
const PART_PATTERN_NO_YEAR = new RegExp(
  [
    "^(?<series>.+?)",
    `(?:\\s+(?<qualifier>${QUALIFIERS.join("|")}))?`,
    "\\s+(?<issues>\\d+(?:\\s*[-–—]\\s*\\d+)?(?:\\s*[,/&]\\s*\\d+(?:\\s*[-–—]\\s*\\d+)?)*)$",
  ].join(""),
  "iu",
);

function parsePart(raw: string): OriginalContent {
  const trimmed = raw.trim();
  const match = PART_PATTERN.exec(trimmed) ?? PART_PATTERN_NO_YEAR.exec(trimmed);

  // Sem match, ainda registramos a string crua: dado parcial é melhor que nada.
  if (!match?.groups) return { raw: trimmed };

  const { series, qualifier, year, issues } = match.groups;
  const parsedIssues = issues ? parseIssueRange(issues) : [];
  const seriesName = series?.trim();

  return {
    raw: trimmed,
    ...(seriesName ? { series: seriesName } : {}),
    ...(year ? { volumeYear: Number(year) } : {}),
    ...(qualifier ? { qualifier: qualifier.trim() } : {}),
    ...(parsedIssues.length > 0 ? { issues: parsedIssues } : {}),
  };
}

/**
 * Converte o valor bruto de "Conteúdo original" numa lista estruturada.
 * Devolve lista vazia quando o campo não existe ou está em branco.
 */
export function parseOriginalContents(value: string | undefined | null): OriginalContent[] {
  if (!value) return [];

  const normalized = value
    .replace(/ /gu, " ") // nbsp, comum no HTML colado da Panini
    .replace(/\s+/gu, " ")
    .trim();

  if (!normalized) return [];

  return normalized
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(parsePart);
}
