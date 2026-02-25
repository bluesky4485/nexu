import { createRoute, z } from "@hono/zod-openapi";
import type { OpenAPIHono } from "@hono/zod-openapi";
import {
  channelListResponseSchema,
  channelResponseSchema,
  connectSlackSchema,
} from "@nexu/shared";
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  botChannels,
  bots,
  channelCredentials,
  webhookRoutes,
} from "../db/schema/index.js";
import { encrypt } from "../lib/crypto.js";

import type { AppBindings } from "../types.js";

const errorResponseSchema = z.object({
  message: z.string(),
});

const botIdParam = z.object({
  botId: z.string(),
});

const channelIdParam = z.object({
  botId: z.string(),
  channelId: z.string(),
});

function formatChannel(
  ch: typeof botChannels.$inferSelect,
): z.infer<typeof channelResponseSchema> {
  const config = ch.channelConfig as Record<string, unknown> | null;
  return {
    id: ch.id,
    botId: ch.botId,
    channelType: ch.channelType as "slack",
    accountId: ch.accountId,
    status: (ch.status ?? "pending") as
      | "pending"
      | "connected"
      | "disconnected"
      | "error",
    teamName: (config?.teamName as string) ?? null,
    createdAt: ch.createdAt,
    updatedAt: ch.updatedAt,
  };
}

const connectSlackRoute = createRoute({
  method: "post",
  path: "/v1/bots/{botId}/channels/slack/connect",
  tags: ["Channels"],
  request: {
    params: botIdParam,
    body: { content: { "application/json": { schema: connectSlackSchema } } },
  },
  responses: {
    200: {
      content: { "application/json": { schema: channelResponseSchema } },
      description: "Slack channel connected",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Bot not found",
    },
    409: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Slack already connected",
    },
  },
});

const listChannelsRoute = createRoute({
  method: "get",
  path: "/v1/bots/{botId}/channels",
  tags: ["Channels"],
  request: {
    params: botIdParam,
  },
  responses: {
    200: {
      content: { "application/json": { schema: channelListResponseSchema } },
      description: "Channel list",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Bot not found",
    },
  },
});

const disconnectChannelRoute = createRoute({
  method: "delete",
  path: "/v1/bots/{botId}/channels/{channelId}",
  tags: ["Channels"],
  request: {
    params: channelIdParam,
  },
  responses: {
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Channel disconnected",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

const channelStatusRoute = createRoute({
  method: "get",
  path: "/v1/bots/{botId}/channels/{channelId}/status",
  tags: ["Channels"],
  request: {
    params: channelIdParam,
  },
  responses: {
    200: {
      content: { "application/json": { schema: channelResponseSchema } },
      description: "Channel status",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

export function registerChannelRoutes(app: OpenAPIHono<AppBindings>) {
  app.openapi(connectSlackRoute, async (c) => {
    const { botId } = c.req.valid("param");
    const userId = c.get("userId");
    const input = c.req.valid("json");

    const bot = db
      .select()
      .from(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
      .get();

    if (!bot) {
      return c.json({ message: `Bot ${botId} not found` }, 404);
    }

    const accountId = `slack-${input.teamId}`;

    const existing = db
      .select()
      .from(botChannels)
      .where(
        and(
          eq(botChannels.botId, botId),
          eq(botChannels.channelType, "slack"),
          eq(botChannels.accountId, accountId),
        ),
      )
      .get();

    if (existing) {
      return c.json({ message: "Slack channel already connected" }, 409);
    }

    const channelId = createId();
    const now = new Date().toISOString();

    db.insert(botChannels)
      .values({
        id: channelId,
        botId,
        channelType: "slack",
        accountId,
        status: "connected",
        channelConfig: JSON.stringify({
          teamId: input.teamId,
          teamName: input.teamName ?? null,
        }),
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const botTokenCredId = createId();
    db.insert(channelCredentials)
      .values({
        id: botTokenCredId,
        botChannelId: channelId,
        credentialType: "botToken",
        encryptedValue: encrypt(input.botToken),
        createdAt: now,
      })
      .run();

    const signingSecretCredId = createId();
    db.insert(channelCredentials)
      .values({
        id: signingSecretCredId,
        botChannelId: channelId,
        credentialType: "signingSecret",
        encryptedValue: encrypt(input.signingSecret),
        createdAt: now,
      })
      .run();

    if (bot.poolId) {
      db.insert(webhookRoutes)
        .values({
          id: createId(),
          channelType: "slack",
          externalId: input.teamId,
          poolId: bot.poolId,
          botChannelId: channelId,
          createdAt: now,
        })
        .run();
    }

    const channel = db
      .select()
      .from(botChannels)
      .where(eq(botChannels.id, channelId))
      .get();

    if (!channel) {
      throw new Error("Failed to create channel");
    }

    return c.json(formatChannel(channel), 200);
  });

  app.openapi(listChannelsRoute, async (c) => {
    const { botId } = c.req.valid("param");
    const userId = c.get("userId");

    const bot = db
      .select()
      .from(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
      .get();

    if (!bot) {
      return c.json({ message: `Bot ${botId} not found` }, 404);
    }

    const channels = db
      .select()
      .from(botChannels)
      .where(eq(botChannels.botId, botId))
      .all();

    return c.json({ channels: channels.map(formatChannel) }, 200);
  });

  app.openapi(disconnectChannelRoute, async (c) => {
    const { botId, channelId } = c.req.valid("param");
    const userId = c.get("userId");

    const bot = db
      .select()
      .from(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
      .get();

    if (!bot) {
      return c.json({ message: `Bot ${botId} not found` }, 404);
    }

    const channel = db
      .select()
      .from(botChannels)
      .where(and(eq(botChannels.id, channelId), eq(botChannels.botId, botId)))
      .get();

    if (!channel) {
      return c.json({ message: `Channel ${channelId} not found` }, 404);
    }

    db.delete(webhookRoutes)
      .where(eq(webhookRoutes.botChannelId, channelId))
      .run();

    db.update(botChannels)
      .set({ status: "disconnected", updatedAt: new Date().toISOString() })
      .where(eq(botChannels.id, channelId))
      .run();

    return c.json({ success: true }, 200);
  });

  app.openapi(channelStatusRoute, async (c) => {
    const { botId, channelId } = c.req.valid("param");
    const userId = c.get("userId");

    const bot = db
      .select()
      .from(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
      .get();

    if (!bot) {
      return c.json({ message: `Bot ${botId} not found` }, 404);
    }

    const channel = db
      .select()
      .from(botChannels)
      .where(and(eq(botChannels.id, channelId), eq(botChannels.botId, botId)))
      .get();

    if (!channel) {
      return c.json({ message: `Channel ${channelId} not found` }, 404);
    }

    return c.json(formatChannel(channel), 200);
  });
}
