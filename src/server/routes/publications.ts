import { z } from "zod";

import {
  createPublication,
  deletePublication,
  findPublicationBySlug,
  listEditorialLines,
  listPublications,
  updatePublication,
} from "../repositories/publications";
import {
  Publication,
  PublicationInput,
  PublicationList,
  PublicationListQuery,
  PublicationPatch,
} from "../schemas/publication";
import type { RouteModule } from "../types";

const SlugParams = z.object({ slug: z.string().min(1) });

const ErrorResponse = z.object({
  error: z.string(),
  message: z.string(),
  details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});

const publicationRoutes: RouteModule = async (app) => {
  app.get(
    "/publications",
    {
      schema: {
        tags: ["publications"],
        summary: "Lista publicações com paginação e filtros",
        querystring: PublicationListQuery,
        response: { 200: PublicationList },
      },
    },
    async (request) => listPublications(request.query),
  );

  app.get(
    "/publications/lines",
    {
      schema: {
        tags: ["publications"],
        summary: "Linhas editoriais distintas presentes no catálogo",
        response: { 200: z.array(z.string()) },
      },
    },
    async () => listEditorialLines(),
  );

  app.get(
    "/publications/:slug",
    {
      schema: {
        tags: ["publications"],
        summary: "Detalhe de uma publicação",
        params: SlugParams,
        response: { 200: Publication, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const publication = await findPublicationBySlug(request.params.slug);
      if (!publication) {
        return reply.status(404).send({
          error: "NotFound",
          message: `Publicação "${request.params.slug}" não encontrada.`,
        });
      }
      return publication;
    },
  );

  app.post(
    "/publications",
    {
      schema: {
        tags: ["publications"],
        summary: "Cria uma publicação",
        body: PublicationInput,
        response: { 201: Publication, 400: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request, reply) => {
      const publication = await createPublication(request.body);
      return reply.status(201).send(publication);
    },
  );

  app.patch(
    "/publications/:slug",
    {
      schema: {
        tags: ["publications"],
        summary: "Atualiza parcialmente uma publicação",
        params: SlugParams,
        body: PublicationPatch,
        response: { 200: Publication, 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const publication = await updatePublication(request.params.slug, request.body);
      if (!publication) {
        return reply.status(404).send({
          error: "NotFound",
          message: `Publicação "${request.params.slug}" não encontrada.`,
        });
      }
      return publication;
    },
  );

  app.delete(
    "/publications/:slug",
    {
      schema: {
        tags: ["publications"],
        summary: "Remove uma publicação",
        params: SlugParams,
        response: { 204: z.null(), 404: ErrorResponse },
      },
    },
    async (request, reply) => {
      const removed = await deletePublication(request.params.slug);
      if (!removed) {
        return reply.status(404).send({
          error: "NotFound",
          message: `Publicação "${request.params.slug}" não encontrada.`,
        });
      }
      return reply.status(204).send(null);
    },
  );
};

export default publicationRoutes;
