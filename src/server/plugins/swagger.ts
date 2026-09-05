import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

/**
 * OpenAPI gerado a partir dos mesmos schemas Zod que validam as rotas — não há
 * documentação escrita à mão para sair de sincronia com o código.
 *
 * UI em /api/docs.
 */
async function swaggerPlugin(app: FastifyInstance) {
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Society Comics API",
        description:
          "Catálogo de quadrinhos publicados no Brasil pela Panini. " +
          "Servida por Fastify rodando dentro da API interna do Next.",
        version: "0.1.0",
      },
      servers: [{ url: "http://localhost:3000", description: "Desenvolvimento" }],
      tags: [
        { name: "health", description: "Diagnóstico" },
        { name: "publications", description: "Volumes publicados" },
      ],
    },
    transform: jsonSchemaTransform,
  });

  // O prefixo precisa começar com /api: o catch-all do Next só repassa esse
  // caminho para a bridge, então /docs sozinho nunca chegaria ao Fastify.
  await app.register(fastifySwaggerUi, {
    routePrefix: "/api/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });
}

export default fp(swaggerPlugin, { name: "swagger" });
