import { z } from "zod";

import { connectionState, connectToDatabase } from "../db";
import type { RouteModule } from "../types";

const HealthResponse = z.object({
  status: z.enum(["ok", "degraded"]),
  db: z.enum(["disconnected", "connected", "connecting", "disconnecting"]),
  uptimeSeconds: z.number(),
});

const healthRoutes: RouteModule = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["health"],
        summary: "Estado do serviço e da conexão com o banco",
        response: { 200: HealthResponse, 503: HealthResponse },
      },
    },
    async (request, reply) => {
      try {
        await connectToDatabase();
      } catch (error) {
        request.log.warn({ err: error }, "health check não conseguiu conectar ao banco");
      }

      const db = connectionState();
      const healthy = db === "connected";

      return reply.status(healthy ? 200 : 503).send({
        status: healthy ? ("ok" as const) : ("degraded" as const),
        db,
        uptimeSeconds: Math.round(process.uptime()),
      });
    },
  );
};

export default healthRoutes;
