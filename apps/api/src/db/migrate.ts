import Database from "better-sqlite3";

export function migrate(dbUrl?: string) {
  const databaseUrl = dbUrl ?? process.env.DATABASE_URL ?? "file:./nexu.db";
  const dbPath = databaseUrl.replace(/^file:/, "");

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = OFF");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS bots (
      pk INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      system_prompt TEXT,
      model_id TEXT DEFAULT 'gpt-4o',
      agent_config TEXT DEFAULT '{}',
      tools_config TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      pool_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS bots_user_slug_idx ON bots(user_id, slug);

    CREATE TABLE IF NOT EXISTS bot_channels (
      pk INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      bot_id TEXT NOT NULL,
      channel_type TEXT NOT NULL,
      account_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      channel_config TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS bot_channels_uniq_idx ON bot_channels(bot_id, channel_type, account_id);

    CREATE TABLE IF NOT EXISTS channel_credentials (
      pk INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      bot_channel_id TEXT NOT NULL,
      credential_type TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS cred_uniq_idx ON channel_credentials(bot_channel_id, credential_type);

    CREATE TABLE IF NOT EXISTS gateway_pools (
      pk INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      pool_name TEXT NOT NULL UNIQUE,
      pool_type TEXT DEFAULT 'shared',
      max_bots INTEGER DEFAULT 50,
      current_bots INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      config_version INTEGER DEFAULT 0,
      pod_ip TEXT,
      last_heartbeat TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      pk INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      auth_user_id TEXT NOT NULL UNIQUE,
      plan TEXT DEFAULT 'free',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_metrics (
      pk INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      bot_id TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      message_count INTEGER DEFAULT 0,
      token_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gateway_assignments (
      pk INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      bot_id TEXT NOT NULL UNIQUE,
      pool_id TEXT NOT NULL,
      assigned_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_routes (
      pk INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      channel_type TEXT NOT NULL,
      external_id TEXT NOT NULL,
      pool_id TEXT NOT NULL,
      bot_channel_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS webhook_routes_uniq_idx ON webhook_routes(channel_type, external_id);
  `);

  console.log("Database migrated successfully");
  sqlite.close();
}
