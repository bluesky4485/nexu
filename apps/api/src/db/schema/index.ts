import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const bots = sqliteTable(
  "bots",
  {
    pk: integer("pk").primaryKey({ autoIncrement: true }),
    id: text("id").notNull().unique(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    systemPrompt: text("system_prompt"),
    modelId: text("model_id").default("gpt-4o"),
    agentConfig: text("agent_config", { mode: "json" }).default("{}"),
    toolsConfig: text("tools_config", { mode: "json" }).default("{}"),
    status: text("status").default("active"),
    poolId: text("pool_id"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex("bots_user_slug_idx").on(table.userId, table.slug)],
);

export const botChannels = sqliteTable(
  "bot_channels",
  {
    pk: integer("pk").primaryKey({ autoIncrement: true }),
    id: text("id").notNull().unique(),
    botId: text("bot_id").notNull(),
    channelType: text("channel_type").notNull(),
    accountId: text("account_id").notNull(),
    status: text("status").default("pending"),
    channelConfig: text("channel_config", { mode: "json" }).default("{}"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    updatedAt: text("updated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("bot_channels_uniq_idx").on(
      table.botId,
      table.channelType,
      table.accountId,
    ),
  ],
);

export const channelCredentials = sqliteTable(
  "channel_credentials",
  {
    pk: integer("pk").primaryKey({ autoIncrement: true }),
    id: text("id").notNull().unique(),
    botChannelId: text("bot_channel_id").notNull(),
    credentialType: text("credential_type").notNull(),
    encryptedValue: text("encrypted_value").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("cred_uniq_idx").on(table.botChannelId, table.credentialType),
  ],
);

export const gatewayPools = sqliteTable("gateway_pools", {
  pk: integer("pk").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  poolName: text("pool_name").notNull().unique(),
  poolType: text("pool_type").default("shared"),
  maxBots: integer("max_bots").default(50),
  currentBots: integer("current_bots").default(0),
  status: text("status").default("pending"),
  configVersion: integer("config_version").default(0),
  podIp: text("pod_ip"),
  lastHeartbeat: text("last_heartbeat"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const gatewayAssignments = sqliteTable("gateway_assignments", {
  pk: integer("pk").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  botId: text("bot_id").notNull().unique(),
  poolId: text("pool_id").notNull(),
  assignedAt: text("assigned_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const users = sqliteTable("users", {
  pk: integer("pk").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  authUserId: text("auth_user_id").notNull().unique(),
  plan: text("plan").default("free"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const usageMetrics = sqliteTable("usage_metrics", {
  pk: integer("pk").primaryKey({ autoIncrement: true }),
  id: text("id").notNull().unique(),
  botId: text("bot_id").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  messageCount: integer("message_count").default(0),
  tokenCount: integer("token_count").default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const webhookRoutes = sqliteTable(
  "webhook_routes",
  {
    pk: integer("pk").primaryKey({ autoIncrement: true }),
    id: text("id").notNull().unique(),
    channelType: text("channel_type").notNull(),
    externalId: text("external_id").notNull(),
    poolId: text("pool_id").notNull(),
    botChannelId: text("bot_channel_id").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("webhook_routes_uniq_idx").on(
      table.channelType,
      table.externalId,
    ),
  ],
);
