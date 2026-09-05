"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__todas__";

/**
 * Busca e filtro por linha editorial.
 *
 * O estado mora na URL, não em memória: assim o resultado é compartilhável,
 * sobrevive ao refresh e o botão de voltar funciona. A página é Server
 * Component e relê os searchParams a cada navegação.
 */
export function SearchFilters({ lines }: { lines: string[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const currentLine = searchParams.get("line") ?? ALL;

  function navigate(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    // Qualquer mudança de filtro volta para a primeira página; manter a
    // paginação antiga costuma cair numa página vazia.
    params.delete("page");
    startTransition(() => router.push(`/?${params.toString()}`));
  }

  // Debounce da busca: sem isso cada tecla dispararia uma navegação e uma
  // consulta ao banco.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (query === current) return;

    const timer = setTimeout(() => {
      navigate((params) => {
        if (query) params.set("q", query);
        else params.delete("q");
      });
    }, 350);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row" data-pending={isPending ? "" : undefined}>
      <Input
        type="search"
        placeholder="Buscar por título..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className="sm:max-w-xs"
        aria-label="Buscar publicações por título"
      />

      <Select
        value={currentLine}
        onValueChange={(value) =>
          navigate((params) => {
            if (value === ALL) params.delete("line");
            else params.set("line", value);
          })
        }
      >
        <SelectTrigger className="sm:w-64" aria-label="Filtrar por linha editorial">
          <SelectValue placeholder="Todas as linhas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas as linhas</SelectItem>
          {lines.map((line) => (
            <SelectItem key={line} value={line}>
              {line}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
