import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

/**
 * Assinatura de todo módulo de rota do projeto.
 *
 * É o que faz `request.body`, `request.query` e `request.params` chegarem já
 * tipados a partir do schema Zod declarado na própria rota — sem generics
 * manuais e sem cast. Ver docs/CONVENTIONS.md.
 */
export type RouteModule = FastifyPluginAsyncZod;
