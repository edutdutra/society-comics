import { handleWithFastify } from "@/server/bridge";

/**
 * Única rota do Next para toda a API. Tudo sob /api é repassado ao Fastify
 * pela bridge — não crie outros route handlers aqui: rotas novas se registram
 * em src/server/routes/ (ver docs/CONVENTIONS.md).
 */

// Fastify e Mongoose são Node puro; o runtime edge não serve.
export const runtime = "nodejs";
// A API lê o banco a cada requisição — cache estático quebraria a listagem.
export const dynamic = "force-dynamic";

export const GET = handleWithFastify;
export const POST = handleWithFastify;
export const PUT = handleWithFastify;
export const PATCH = handleWithFastify;
export const DELETE = handleWithFastify;
export const HEAD = handleWithFastify;
export const OPTIONS = handleWithFastify;
