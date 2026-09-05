import { Suspense } from "react";

import { listEditorialLines, listPublications } from "@/server/repositories/publications";
import { PublicationListQuery } from "@/server/schemas/publication";
import { CatalogPagination } from "@/components/catalog-pagination";
import { PublicationCard } from "@/components/publication-card";
import { SearchFilters } from "@/components/search-filters";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Listagem do catálogo.
 *
 * Server Component chamando o repositório **direto**, sem passar por HTTP: uma
 * requisição do servidor para a própria API seria uma volta inútil pela rede.
 * As rotas Fastify em /api continuam existindo para clientes externos, para o
 * importador e para o Swagger — não para o próprio front. Ver
 * docs/ARCHITECTURE.md.
 */
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

async function Catalog({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  // O mesmo schema que valida a rota HTTP valida os searchParams aqui — uma
  // definição só, e `?page=abc` na URL não quebra a página.
  const parsed = PublicationListQuery.safeParse({ ...searchParams, limit: PAGE_SIZE });
  const query = parsed.success ? parsed.data : PublicationListQuery.parse({ limit: PAGE_SIZE });

  const [result, lines] = await Promise.all([listPublications(query), listEditorialLines()]);

  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.line) params.set("line", query.line);

  return (
    <>
      <SiteHeader total={result.total} />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <SearchFilters lines={lines} />

        {result.items.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
            <p className="text-sm">Nenhuma publicação encontrada.</p>
            <p className="mt-1 text-xs">
              Se o banco estiver vazio, rode <code className="font-mono">pnpm db:seed</code>.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {result.items.map((publication) => (
              <PublicationCard key={publication.id} publication={publication} />
            ))}
          </div>
        )}

        <CatalogPagination page={result.page} totalPages={result.totalPages} params={params} />
      </main>
    </>
  );
}

function CatalogSkeleton() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <Skeleton className="h-9 w-full sm:max-w-xs" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton key={index} className="aspect-[2/3] w-full" />
          ))}
        </div>
      </main>
    </>
  );
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const resolved = await searchParams;

  // searchParams pode trazer arrays (?line=a&line=b); ficamos com o primeiro.
  const flat = Object.fromEntries(
    Object.entries(resolved).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  );

  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <Catalog searchParams={flat} />
    </Suspense>
  );
}
