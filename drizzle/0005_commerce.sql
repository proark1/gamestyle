CREATE TABLE commerce_profiles (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  coins INTEGER NOT NULL DEFAULT 0 CHECK (coins >= 0),
  look TEXT NOT NULL DEFAULT '{}',
  import_key TEXT,
  created INTEGER NOT NULL
);

CREATE TABLE commerce_coin_ledger (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  delta INTEGER NOT NULL CHECK (delta != 0),
  created INTEGER NOT NULL,
  PRIMARY KEY (account_id, reference)
);

-- The ledger insertion and balance change are inseparable on SQLite and D1.
CREATE TRIGGER commerce_coin_balance AFTER INSERT ON commerce_coin_ledger
BEGIN
  UPDATE commerce_profiles SET coins = coins + NEW.delta WHERE account_id = NEW.account_id;
END;

CREATE TABLE commerce_grants (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('starter', 'legacy', 'coins', 'purchase')),
  reference TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  created INTEGER NOT NULL,
  PRIMARY KEY (account_id, item_id, source, reference, environment)
);

-- A deleted account's transaction remains consumed, without retaining its identity.
CREATE TABLE commerce_transactions (
  provider TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  environment TEXT NOT NULL CHECK (environment IN ('live', 'sandbox')),
  owner_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  offer_id TEXT NOT NULL,
  grants TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'revoked')),
  created INTEGER NOT NULL,
  PRIMARY KEY (provider, transaction_id, environment)
);
CREATE INDEX commerce_transactions_owner_idx ON commerce_transactions(owner_id);
