import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { openclawConfigSchema } from "@nexu/shared";
import { db } from "../db/index.js";
import { gatewayPools } from "../db/schema/index.js";
import { generatePoolConfig } from "../lib/config-generator.js";

const errorResponseSchema = z.object({
  message: z.string(),
});

const poolIdParam = z.object({
  poolId: z.string(),
});

const getPoolConfigRoute = createRoute({
  method: "get",
  path: "/api/internal/pools/{poolId}/config",
  tags: ["Internal"],
  request: {
    params: poolIdParam,
  },
  responses: {
    200: {
      content: { "application/json": { schema: openclawConfigSchema } },
      description: "Generated OpenClaw config",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Pool not found",
    },
  },
});

const updatePoolBodySchema = z.object({
  podIp: z.string().ip(),
  status: z.enum(["active", "draining", "inactive"]),
});

const updatePoolRoute = createRoute({
  method: "patch",
  path: "/api/internal/pools/{poolId}",
  tags: ["Internal"],
  request: {
    params: poolIdParam,
    body: {
      content: {
        "application/json": { schema: updatePoolBodySchema },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ message: z.string() }),
        },
      },
      description: "Pool updated",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Pool not found",
    },
  },
});

import type { AppBindings } from "../types.js";

export function registerPoolRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(getPoolConfigRoute, async (c) => {
    const { poolId } = c.req.valid("param");
    try {
      const config = await generatePoolConfig(db, poolId);
      return c.json(config, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message.includes("not found")) {
        return c.json({ message }, 404);
      }
      throw error;
    }
  });

  app.openapi(updatePoolRoute, async (c) => {
    const { poolId } = c.req.valid("param");
    const { podIp, status } = c.req.valid("json");

    const result = await db
      .update(gatewayPools)
      .set({
        podIp: podIp,
        status: status,
        lastHeartbeat: new Date().toISOString(),
      })
      .where(eq(gatewayPools.id, poolId))
      .returning({ id: gatewayPools.id });

    if (result.length === 0) {
      return c.json({ message: "Pool not found" }, 404);
    }

    return c.json({ message: "Pool updated" }, 200);
  });
}
