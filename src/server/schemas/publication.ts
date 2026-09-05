import { z } from "zod";

/**
 * Formato físico da publicação. A Panini descreve isso em português livre
 * ("Capa dura", "Brochura", "Grampo"), então o mapeamento fica no importador
 * e o domínio guarda o valor normalizado.
 */
export const PublicationFormat = z.enum([
  "hardcover", // Capa dura
  "paperback", // Brochura / capa cartão
  "periodical", // Revista mensal, grampo
  "omnibus", // Encadernados gigantes (Omnibus, Absoluta)
  "unknown",
]);
export type PublicationFormat = z.infer<typeof PublicationFormat>;

export const CreatorRole = z.enum(["writer", "artist", "inker", "colorist", "letterer", "cover"]);
export type CreatorRole = z.infer<typeof CreatorRole>;

export const Creator = z.object({
  name: z.string().min(1),
  /** A Panini lista "Autores" sem separar função, então isso costuma vir vazio. */
  role: CreatorRole.optional(),
});
export type Creator = z.infer<typeof Creator>;

/**
 * Uma entrada do conteúdo original compilado no volume, extraída do campo
 * "Fonte" da página de produto.
 *
 *   "Action Comics (1938) 855-857"
 *   → { raw, series: "Action Comics", volumeYear: 1938, issues: [855, 856, 857] }
 *
 * `raw` é obrigatório e todo o resto é opcional de propósito: o parser acerta
 * a maioria dos casos, mas quando ele falha a gente ainda registra a string
 * crua em vez de perder o dado. Reprocessar depois é só rodar o parser de novo
 * em cima de `raw`.
 */
export const OriginalContent = z.object({
  raw: z.string().min(1),
  series: z.string().min(1).optional(),
  volumeYear: z.number().int().min(1930).max(2100).optional(),
  issues: z.array(z.number().int().min(0)).optional(),
  /** "Annual", "Special", "One-Shot" e afins, quando identificável. */
  qualifier: z.string().min(1).optional(),
});
export type OriginalContent = z.infer<typeof OriginalContent>;

export const ReviewStatus = z.enum(["pending", "approved", "rejected"]);
export type ReviewStatus = z.infer<typeof ReviewStatus>;

/** Campos do domínio, sem os metadados que o Mongo adiciona. */
export const PublicationCore = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug deve ser kebab-case minúsculo"),
  /** Referência da Panini (ex.: "ASMGJ004"). Chave de dedupe do importador. */
  sku: z.string().min(1).optional(),

  title: z.string().min(1),
  subtitle: z.string().min(1).optional(),
  synopsis: z.string().optional(),

  publisher: z.string().min(1).default("Panini"),
  /** Selo/editora original: "DC Comics", "Marvel", "Image"... */
  universe: z.string().min(1).optional(),
  /** Linha editorial brasileira: "DC Millennium", "Lendas do Universo DC". */
  line: z.string().min(1).optional(),
  volumeNumber: z.number().int().min(0).optional(),

  format: PublicationFormat.default("unknown"),
  isbn: z.string().min(10).optional(),
  pages: z.number().int().min(1).optional(),
  priceBRL: z.number().min(0).optional(),
  /** "Livre", "10 anos", "12 anos", "16 anos", "18 anos". */
  ageRating: z.string().min(1).optional(),
  releasedAt: z.coerce.date().optional(),

  coverImage: z.url().optional(),

  originalContents: z.array(OriginalContent).default([]),
  creators: z.array(Creator).default([]),
  characters: z.array(z.string().min(1)).default([]),

  source: z
    .object({
      name: z.string().min(1),
      url: z.url(),
      scrapedAt: z.coerce.date(),
    })
    .optional(),

  reviewStatus: ReviewStatus.default("pending"),
});

/** Payload aceito na criação (POST). */
export const PublicationInput = PublicationCore;
export type PublicationInput = z.infer<typeof PublicationInput>;

/** Payload aceito na atualização parcial (PATCH). */
export const PublicationPatch = PublicationCore.partial();
export type PublicationPatch = z.infer<typeof PublicationPatch>;

/** Documento como sai da API. */
export const Publication = PublicationCore.extend({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Publication = z.infer<typeof Publication>;

export const PublicationListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  /** Busca textual em título e subtítulo. */
  q: z.string().min(1).optional(),
  line: z.string().min(1).optional(),
  universe: z.string().min(1).optional(),
  format: PublicationFormat.optional(),
  reviewStatus: ReviewStatus.optional(),
  sort: z.enum(["releasedAt", "-releasedAt", "title", "-title"]).default("-releasedAt"),
});
export type PublicationListQuery = z.infer<typeof PublicationListQuery>;

export const PublicationList = z.object({
  items: z.array(Publication),
  page: z.number().int(),
  limit: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});
export type PublicationList = z.infer<typeof PublicationList>;
