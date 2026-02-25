import type {
  AgentConfig,
  BindingConfig,
  OpenClawConfig,
  SlackAccountConfig,
} from "@nexu/shared";
import { openclawConfigSchema } from "@nexu/shared";
import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  botChannels,
  bots,
  channelCredentials,
  gatewayPools,
} from "../db/schema/index.js";
import { decrypt } from "./crypto.js";

interface ChannelCredentialRow {
  credentialType: string;
  encryptedValue: string;
}

interface ChannelWithBot {
  channelId: string;
  botId: string;
  channelType: string;
  accountId: string;
  status: string | null;
  botSlug: string;
  botName: string;
  botModelId: string | null;
  credentials: ChannelCredentialRow[];
}

export async function generatePoolConfig(
  db: Database,
  poolIdOrName: string,
  gatewayToken?: string,
): Promise<OpenClawConfig> {
  // Try lookup by id first, fall back to poolName
  const pool =
    db.select().from(gatewayPools).where(eq(gatewayPools.id, poolIdOrName)).get() ??
    db.select().from(gatewayPools).where(eq(gatewayPools.poolName, poolIdOrName)).get();

  if (!pool) {
    throw new Error(`Pool ${poolIdOrName} not found`);
  }

  const poolId = pool.id;

  const poolBots = await db
    .select()
    .from(bots)
    .where(eq(bots.poolId, poolId))
    .all();

  const activeBots = poolBots.filter((b) => b.status === "active");

  const channelsWithBots: ChannelWithBot[] = [];

  for (const bot of activeBots) {
    const channels = await db
      .select()
      .from(botChannels)
      .where(eq(botChannels.botId, bot.id))
      .all();

    const connectedChannels = channels.filter(
      (ch) => ch.status === "connected",
    );

    for (const channel of connectedChannels) {
      const creds = await db
        .select({
          credentialType: channelCredentials.credentialType,
          encryptedValue: channelCredentials.encryptedValue,
        })
        .from(channelCredentials)
        .where(eq(channelCredentials.botChannelId, channel.id))
        .all();

      channelsWithBots.push({
        channelId: channel.id,
        botId: bot.id,
        channelType: channel.channelType,
        accountId: channel.accountId,
        status: channel.status,
        botSlug: bot.slug,
        botName: bot.name,
        botModelId: bot.modelId,
        credentials: creds,
      });
    }
  }

  const agentList: AgentConfig[] = activeBots.map((bot, index) => {
    const agent: AgentConfig = {
      id: bot.slug,
      name: bot.name,
    };

    if (index === 0) {
      agent.default = true;
    }

    if (bot.modelId && bot.modelId !== "gpt-4o") {
      agent.model = { primary: bot.modelId };
    }

    return agent;
  });

  const slackAccounts: Record<string, SlackAccountConfig> = {};
  const bindingsList: BindingConfig[] = [];

  for (const ch of channelsWithBots) {
    if (ch.channelType === "slack") {
      const credMap = new Map<string, string>();
      for (const cred of ch.credentials) {
        try {
          credMap.set(cred.credentialType, decrypt(cred.encryptedValue));
        } catch {
          credMap.set(cred.credentialType, "");
        }
      }

      const botToken = credMap.get("botToken") ?? "";
      const signingSecret = credMap.get("signingSecret") ?? "";

      slackAccounts[ch.accountId] = {
        enabled: true,
        botToken,
        signingSecret,
        mode: "http",
        webhookPath: `/slack/events/${ch.accountId}`,
      };

      bindingsList.push({
        agentId: ch.botSlug,
        match: {
          channel: "slack",
          accountId: ch.accountId,
        },
      });
    }
  }

  const config: OpenClawConfig = {
    gateway: {
      port: 18789,
      mode: "local",
      bind: "lan",
      auth: {
        mode: "token",
        token: gatewayToken ?? process.env.GATEWAY_TOKEN ?? "gw-secret-token",
      },
      reload: { mode: "hybrid" },
    },
    agents: {
      list: agentList,
    },
    channels: {},
    bindings: bindingsList,
  };

  if (Object.keys(slackAccounts).length > 0) {
    config.channels.slack = { accounts: slackAccounts };
  }

  const validated = openclawConfigSchema.parse(config);
  return validated;
}
