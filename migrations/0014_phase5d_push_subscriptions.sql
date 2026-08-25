PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS push_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint_hash TEXT NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  manage_token_hash TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL,
  title_region TEXT NOT NULL CHECK (title_region IN ('HK', 'TW', 'CN')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  disabled_at TEXT
);

CREATE TABLE IF NOT EXISTS push_subscription_shows (
  subscription_id INTEGER NOT NULL,
  show_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (subscription_id, show_id),
  FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (show_id) REFERENCES shows(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  scheduled_for TEXT,
  sent_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_code TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  UNIQUE (subscription_id, kind, entity_key)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_last_seen ON push_subscriptions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_subscription_shows_show ON push_subscription_shows(show_id, subscription_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status_schedule ON notification_deliveries(status, scheduled_for);
