import type { QueryFilter } from "mongoose";

import { connectToDatabase } from "../db";
import { Publication as PublicationModel, type PublicationDoc } from "../models/Publication";
import type {
  Publication,
  PublicationInput,
  PublicationListQuery,
  PublicationPatch,
} from "../schemas/publication";

/**
 * Converte o documento do Mongo para o formato que a API expõe: `_id` vira
 * `id` string e o `__v` some. Sempre chamado sobre resultados de `.lean()`,
 * então não há hidratação de documento Mongoose no caminho de leitura.
 */
type LeanPublication = PublicationDoc & {
  _id: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function toPublication(doc: LeanPublication): Publication {
  const { _id, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

function buildFilter(query: PublicationListQuery): QueryFilter<PublicationDoc> {
  const filter: QueryFilter<PublicationDoc> = {};

  if (query.q) filter.$text = { $search: query.q };
  if (query.line) filter.line = query.line;
  if (query.universe) filter.universe = query.universe;
  if (query.format) filter.format = query.format;
  if (query.reviewStatus) filter.reviewStatus = query.reviewStatus;

  return filter;
}

function buildSort(sort: PublicationListQuery["sort"]): Record<string, 1 | -1> {
  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;
  return { [field]: descending ? -1 : 1 };
}

export async function listPublications(query: PublicationListQuery) {
  await connectToDatabase();

  const filter = buildFilter(query);
  const skip = (query.page - 1) * query.limit;

  // countDocuments em paralelo com a busca: são consultas independentes e
  // esperar uma pela outra só somaria latência.
  const [items, total] = await Promise.all([
    PublicationModel.find(filter)
      .sort(buildSort(query.sort))
      .skip(skip)
      .limit(query.limit)
      .lean<LeanPublication[]>()
      .exec(),
    PublicationModel.countDocuments(filter).exec(),
  ]);

  return {
    items: items.map(toPublication),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function findPublicationBySlug(slug: string): Promise<Publication | null> {
  await connectToDatabase();
  const doc = await PublicationModel.findOne({ slug }).lean<LeanPublication>().exec();
  return doc ? toPublication(doc) : null;
}

export async function createPublication(input: PublicationInput): Promise<Publication> {
  await connectToDatabase();
  const created = await PublicationModel.create(input);
  return toPublication(created.toObject() as unknown as LeanPublication);
}

export async function updatePublication(
  slug: string,
  patch: PublicationPatch,
): Promise<Publication | null> {
  await connectToDatabase();
  const doc = await PublicationModel.findOneAndUpdate(
    { slug },
    { $set: patch },
    // `new: true` foi deprecado no Mongoose 9 em favor de `returnDocument`.
    { returnDocument: "after", runValidators: true },
  )
    .lean<LeanPublication>()
    .exec();
  return doc ? toPublication(doc) : null;
}

export async function deletePublication(slug: string): Promise<boolean> {
  await connectToDatabase();
  const result = await PublicationModel.deleteOne({ slug }).exec();
  return result.deletedCount > 0;
}

/**
 * Upsert usado pelo importador. A chave é o SKU da Panini quando existe, com
 * fallback no slug — é o que torna a importação idempotente: rodar duas vezes
 * atualiza os mesmos documentos em vez de duplicar o catálogo.
 *
 * `reviewStatus` fica de fora do $set para não rebaixar para "pending" algo
 * que você já revisou e aprovou manualmente.
 */
export async function upsertPublication(
  input: PublicationInput,
): Promise<{ publication: Publication; created: boolean }> {
  await connectToDatabase();

  const key: QueryFilter<PublicationDoc> = input.sku ? { sku: input.sku } : { slug: input.slug };
  const { reviewStatus, ...updatable } = input;

  const result = await PublicationModel.findOneAndUpdate(
    key,
    {
      $set: updatable,
      $setOnInsert: { reviewStatus },
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
      // Precisamos do metadata para saber se foi criação ou atualização.
      includeResultMetadata: true,
    },
  ).exec();

  const doc = result.value;
  if (!doc) throw new Error(`Upsert não retornou documento para ${input.slug}`);

  return {
    publication: toPublication(doc.toObject() as unknown as LeanPublication),
    created: !result.lastErrorObject?.updatedExisting,
  };
}

export async function countPublications(): Promise<number> {
  await connectToDatabase();
  return PublicationModel.countDocuments().exec();
}

/** Linhas editoriais distintas, para os filtros da listagem. */
export async function listEditorialLines(): Promise<string[]> {
  await connectToDatabase();
  const lines = await PublicationModel.distinct("line").exec();
  return lines.filter((line): line is string => typeof line === "string" && line.length > 0).sort();
}
