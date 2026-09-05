import type { FastifyError, FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import mongoose, { Error as MongooseError } from "mongoose";

/**
 * O driver vem de `mongoose.mongo`, não de `import { MongoServerError } from
 * "mongodb"`. O Mongoose traz a própria cópia do driver (~7.5) e o pnpm a
 * mantém separada da que está no topo do projeto — importar do topo daria
 * outra classe, e o `instanceof` nunca casaria, transformando todo erro de
 * chave duplicada num 500.
 */
const { MongoServerError } = mongoose.mongo;

/**
 * Handler de erro único para toda a API. Sem ele, uma violação de índice único
 * viraria um 500 genérico e o cliente não saberia que o problema é um slug
 * repetido.
 *
 * Formato de resposta padronizado: { error, message, details? }.
 */
async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    // Guardado antes das checagens de instanceof abaixo, que estreitam `error`
    // e escondem as propriedades de FastifyError no fim da função.
    const statusCode = error.statusCode ?? 500;
    const name = error.name || "InternalServerError";
    const message = error.message;

    // Payload não bate com o schema Zod da rota.
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Os dados enviados não passaram na validação.",
        // fastify-type-provider-zod v7 achata o ZodIssue: o caminho vem em
        // `instancePath` no formato "/originalContents/0/raw".
        details: error.validation.map((entry) => ({
          path: entry.instancePath.replace(/^\//u, "").replace(/\//gu, ".") || "(raiz)",
          message: entry.message ?? "valor inválido",
        })),
      });
    }

    // A resposta não bate com o schema declarado: é bug nosso, não do cliente.
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, "resposta não bate com o schema declarado");
      return reply.status(500).send({
        error: "ResponseSerializationError",
        message: "A resposta gerada não corresponde ao schema da rota.",
      });
    }

    if (error instanceof MongooseError.ValidationError) {
      return reply.status(400).send({
        error: "ValidationError",
        message: error.message,
        details: Object.entries(error.errors).map(([path, err]) => ({
          path,
          message: err.message,
        })),
      });
    }

    // FastifyError declara `code: string` e o driver usa número, então a
    // interseção dos dois tipos exige normalizar antes de comparar.
    if (error instanceof MongoServerError && Number(error.code) === 11000) {
      // `keyPattern` é `any` no driver; tipar antes evita propagar o any.
      const keyPattern = error.keyPattern as Record<string, unknown> | undefined;
      const field = Object.keys(keyPattern ?? {}).join(", ") || "campo único";
      return reply.status(409).send({
        error: "DuplicateKey",
        message: `Já existe uma publicação com o mesmo ${field}.`,
      });
    }

    // Erro de conexão com o banco: 503, não 500 — é infraestrutura, e o cliente
    // pode tentar de novo.
    if (error instanceof MongooseError.MongooseServerSelectionError) {
      request.log.error({ err: error }, "não foi possível conectar ao MongoDB");
      return reply.status(503).send({
        error: "DatabaseUnavailable",
        message: "Banco de dados indisponível. Rode `pnpm db:up` e tente de novo.",
      });
    }

    if (statusCode >= 500) request.log.error({ err: error }, "erro não tratado");

    return reply.status(statusCode).send({
      error: name,
      // Mensagem de erro interno não vaza para o cliente: pode conter detalhe
      // de conexão, caminho de arquivo ou trecho de query.
      message: statusCode >= 500 ? "Erro interno no servidor." : message,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send({
      error: "NotFound",
      message: `Rota ${request.method} ${request.url} não existe.`,
    });
  });
}

export default fp(errorHandlerPlugin, { name: "error-handler" });
