import cors from "@fastify/cors";
import Fastify from "fastify";

import { registerBoletoRoutes } from "./modules/boleto/interfaces/http/boletoRoutes.js";
import { getAppConfig } from "./shared/config/appConfig.js";
import { loadEnv } from "./shared/env/loadEnv.js";
import { createLogger } from "./shared/logging/appLogger.js";

const logger = createLogger("server");

loadEnv();

const config = getAppConfig();
const server = Fastify({ logger: true, disableRequestLogging: true });

await server.register(cors, { origin: true });

server.addHook("onRequest", async (request) => {
  logger.info("request.received", {
    requestId: request.id,
    method: request.method,
    url: request.url,
  });
});

server.addHook("onResponse", async (request, reply) => {
  logger.info("request.completed", {
    requestId: request.id,
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
  });
});

server.get("/", async () => {
  return { status: "online", service: "acbr-boleto-api" };
});

await registerBoletoRoutes(server);

try {
  await server.listen({
    port: config.server.port,
    host: "0.0.0.0",
  });

  logger.info("server.started", { port: config.server.port });
} catch (error) {
  logger.error("server.start.failed", error, { port: config.server.port });
  process.exit(1);
}
