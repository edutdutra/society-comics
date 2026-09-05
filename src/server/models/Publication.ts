import { model, models, Schema, type Model } from "mongoose";
import type { z } from "zod";

import type { PublicationCore } from "../schemas/publication";

/**
 * Tipo do documento derivado do schema Zod, não escrito à mão.
 *
 * Esta é a mitigação da duplicação Mongoose/Zod descrita em
 * docs/adr/0002-mongoose-mais-zod.md: o Zod continua sendo a fonte de verdade,
 * e tipar o Model com o tipo inferido dele faz o TypeScript acusar qualquer
 * divergência em tempo de compilação, em vez de em runtime na gravação.
 */
export type PublicationDoc = z.infer<typeof PublicationCore>;

const CreatorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["writer", "artist", "inker", "colorist", "letterer", "cover"],
    },
  },
  { _id: false },
);

const OriginalContentSchema = new Schema(
  {
    raw: { type: String, required: true, trim: true },
    series: { type: String, trim: true },
    volumeYear: { type: Number, min: 1930, max: 2100 },
    issues: { type: [Number], default: undefined },
    qualifier: { type: String, trim: true },
  },
  { _id: false },
);

const SourceSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    scrapedAt: { type: Date, required: true },
  },
  { _id: false },
);

const PublicationSchema = new Schema<PublicationDoc>(
  {
    slug: { type: String, required: true, trim: true, lowercase: true },
    sku: { type: String, trim: true },

    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    synopsis: { type: String },

    publisher: { type: String, required: true, default: "Panini", trim: true },
    universe: { type: String, trim: true },
    line: { type: String, trim: true },
    volumeNumber: { type: Number, min: 0 },

    format: {
      type: String,
      enum: ["hardcover", "paperback", "periodical", "omnibus", "unknown"],
      default: "unknown",
      required: true,
    },
    isbn: { type: String, trim: true },
    pages: { type: Number, min: 1 },
    priceBRL: { type: Number, min: 0 },
    ageRating: { type: String, trim: true },
    releasedAt: { type: Date },

    coverImage: { type: String, trim: true },

    originalContents: { type: [OriginalContentSchema], default: [] },
    creators: { type: [CreatorSchema], default: [] },
    characters: { type: [String], default: [] },

    source: { type: SourceSchema },

    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "publications",
  },
);

// `slug` é a identidade pública; `sku` é a chave de dedupe do importador, mas
// nem toda publicação tem uma (cadastro manual), daí o sparse.
PublicationSchema.index({ slug: 1 }, { unique: true });
PublicationSchema.index({ sku: 1 }, { unique: true, sparse: true });
// Busca textual em português: o Mongo aplica stemming e stop words de pt.
PublicationSchema.index(
  { title: "text", subtitle: "text", synopsis: "text" },
  { default_language: "portuguese", weights: { title: 10, subtitle: 5, synopsis: 1 } },
);
PublicationSchema.index({ line: 1, volumeNumber: 1 });
PublicationSchema.index({ releasedAt: -1 });

/**
 * O HMR do Next reavalia este módulo a cada edição, e `model()` lança
 * OverwriteModelError se o nome já foi registrado. Reaproveitar o model já
 * compilado é o padrão para Mongoose dentro do Next.
 */
export const Publication: Model<PublicationDoc> =
  (models.Publication as Model<PublicationDoc> | undefined) ??
  model<PublicationDoc>("Publication", PublicationSchema);
