import Link from "next/link";

export function SiteHeader({ total }: { total?: number }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight">Society Comics</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            catálogo Panini · DC Comics
          </span>
        </Link>

        {total !== undefined && (
          <span className="text-xs text-muted-foreground">
            {total} {total === 1 ? "publicação" : "publicações"}
          </span>
        )}
      </div>
    </header>
  );
}
