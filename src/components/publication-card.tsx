import Image from "next/image";

import type { Publication } from "@/server/schemas/publication";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const FORMAT_LABELS: Record<Publication["format"], string> = {
  hardcover: "Capa dura",
  paperback: "Brochura",
  periodical: "Periódico",
  omnibus: "Omnibus",
  unknown: "—",
};

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthYear = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });

export function PublicationCard({ publication }: { publication: Publication }) {
  const issueCount = publication.originalContents.reduce(
    (total, content) => total + (content.issues?.length ?? 0),
    0,
  );

  return (
    <Card className="group overflow-hidden pt-0 transition-shadow hover:shadow-md">
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        {publication.coverImage ? (
          <Image
            src={publication.coverImage}
            alt={`Capa de ${publication.title}`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          // Capa ausente é comum: nem todo registro vem com imagem, e a URL é
          // de terceiro e pode sumir. O placeholder mantém o grid alinhado.
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
            sem capa
          </div>
        )}

        <Badge variant="secondary" className="absolute top-2 right-2 backdrop-blur">
          {FORMAT_LABELS[publication.format]}
        </Badge>
      </div>

      <CardContent className="space-y-2 px-4">
        <h3 className="line-clamp-2 text-sm leading-snug font-semibold" title={publication.title}>
          {publication.title}
        </h3>

        {publication.line && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{publication.line}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {publication.releasedAt && <span>{monthYear.format(publication.releasedAt)}</span>}
          {publication.pages && <span>{publication.pages} pág.</span>}
          {issueCount > 0 && (
            <span>
              {issueCount} {issueCount === 1 ? "edição" : "edições"}
            </span>
          )}
        </div>

        {publication.priceBRL !== undefined && (
          <p className="text-sm font-medium">{currency.format(publication.priceBRL)}</p>
        )}
      </CardContent>
    </Card>
  );
}
