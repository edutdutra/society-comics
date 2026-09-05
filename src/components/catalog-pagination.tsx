import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type Props = {
  page: number;
  totalPages: number;
  /** searchParams atuais, para preservar busca e filtro ao trocar de página. */
  params: URLSearchParams;
};

/** Janela de páginas em volta da atual, sem listar as 144 de uma vez. */
function pageWindow(page: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export function CatalogPagination({ page, totalPages, params }: Props) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const next = new URLSearchParams(params.toString());
    if (target === 1) next.delete("page");
    else next.set("page", String(target));
    const query = next.toString();
    return query ? `/?${query}` : "/";
  };

  return (
    <Pagination>
      <PaginationContent>
        {page > 1 && (
          <PaginationItem>
            <PaginationPrevious href={href(page - 1)} />
          </PaginationItem>
        )}

        {pageWindow(page, totalPages).map((target) => (
          <PaginationItem key={target}>
            <PaginationLink href={href(target)} isActive={target === page}>
              {target}
            </PaginationLink>
          </PaginationItem>
        ))}

        {page < totalPages && (
          <PaginationItem>
            <PaginationNext href={href(page + 1)} />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
