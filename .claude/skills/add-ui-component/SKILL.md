---
name: add-ui-component
description: Adiciona ou customiza componentes de interface no projeto. Use quando pedirem uma tela, um componente novo, um componente do shadcn, ou mudanças de layout e estilo.
---

# Componentes de interface

## Onde cada coisa vive

| Pasta | O quê | Editar à mão? |
|---|---|---|
| `src/components/ui/` | Gerado pelo `shadcn add` | **Não** |
| `src/components/` | Composições do projeto | Sim |
| `src/app/` | Páginas e layouts | Sim |

Para customizar um componente do shadcn, **componha por cima** em `src/components/`, não edite o
gerado — um `shadcn add` futuro sobrescreveria a mudança. `src/components/ui/` está no
`.prettierignore` e nos ignores do ESLint por isso.

## Adicionando um componente do shadcn

```bash
pnpm dlx shadcn@latest add <nome> --yes
```

O projeto usa **base radix, preset nova**. Já instalados: `button` `card` `badge` `input` `table`
`skeleton` `dialog` `sonner` `select` `separator` `pagination`.

## Server Component é o padrão

`"use client"` só quando houver estado, efeito ou manipulador de evento. Na prática: se o componente
só renderiza dados, deixe no servidor.

**Server Components chamam o repositório direto:**

```tsx
import { listPublications } from "@/server/repositories/publications";

export default async function Page() {
  const result = await listPublications(query);
}
```

Nunca `fetch("http://localhost:3000/api/...")` do servidor — é uma volta pela rede para buscar dados
que estão a uma chamada de função. As rotas HTTP existem para clientes externos.

## Estado de filtro mora na URL

Busca, filtro e paginação vão em `searchParams`, não em `useState`. Assim o resultado é
compartilhável, sobrevive ao refresh e o botão voltar funciona.

`search-filters.tsx` é a referência: componente cliente que só faz `router.push` com os params
atualizados, e a página relê. Note o debounce na busca — sem ele cada tecla dispara uma consulta ao
banco.

Valide os `searchParams` com o **mesmo schema Zod** que valida a rota HTTP (`PublicationListQuery`),
para que `?page=abc` não quebre a página.

## Imagens

Capas vêm do CloudFront da Panini, já liberado em `next.config.ts`. Use `next/image` com `fill` e
`sizes`, e **sempre um fallback** — a URL é de terceiro e pode sumir. Ver `publication-card.tsx`.

Domínio novo de imagem exige entrada em `images.remotePatterns`.

## Estilo

Tailwind 4 com as variáveis de tema do shadcn. Use os tokens semânticos (`bg-background`,
`text-muted-foreground`, `border`) em vez de cores fixas — é o que faz o modo escuro funcionar
quando for ligado.

O Prettier ordena as classes automaticamente; não se preocupe com a ordem.

## Verificar

```bash
pnpm check
pnpm dev
```
