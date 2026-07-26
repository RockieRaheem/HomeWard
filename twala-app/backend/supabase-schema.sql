-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql/new)

-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Wallet
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  public_key TEXT NOT NULL,
  secret_key TEXT NOT NULL,
  is_funded BOOLEAN DEFAULT false,
  balance_usdc NUMERIC(20,7) DEFAULT 0,
  balance_xlm NUMERIC(20,7) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Goals with milestones as JSONB
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  target_amount_ugx NUMERIC(20,0) NOT NULL,
  saved_amount_ugx NUMERIC(20,0) DEFAULT 0,
  target_date TIMESTAMPTZ,
  category TEXT DEFAULT 'other',
  milestones JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions with optional goal link
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  type TEXT NOT NULL CHECK (type IN ('sent', 'received')),
  amount_usdc NUMERIC(20,7) NOT NULL,
  amount_ugx NUMERIC(20,0),
  rate NUMERIC(10,2),
  recipient_name TEXT DEFAULT '',
  recipient_phone TEXT DEFAULT '',
  recipient_network TEXT DEFAULT '',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  purpose TEXT DEFAULT '',
  stellar_tx_hash TEXT DEFAULT '',
  stellar_operation_id TEXT DEFAULT '',
  kotani_reference_id TEXT DEFAULT '',
  kotani_status TEXT DEFAULT '',
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat sessions (conversations)
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_message_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages linked to a session
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('payment', 'goal', 'tip')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('MTN', 'AIRTEL')),
  relationship TEXT NOT NULL DEFAULT 'Family',
  nickname TEXT,
  monthly_plan_usdc NUMERIC(20,7),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE circles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  recipient_id UUID REFERENCES recipients(id) ON DELETE SET NULL,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  recurring_amount_usdc NUMERIC(20,7) NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'Family support',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_circles_user_id ON circles(user_id, created_at DESC);


-- Exchange rates (cached)
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usdc_to_ugx NUMERIC(10,2) NOT NULL,
  usd_to_ugx NUMERIC(10,2) NOT NULL,
  change_24h NUMERIC(5,2) DEFAULT 0,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_kotani_ref ON transactions(kotani_reference_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at ASC);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_sessions_last_message_at ON chat_sessions(last_message_at DESC);
CREATE INDEX idx_goals_status ON goals(status);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id, created_at DESC);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id, last_message_at DESC);

-- Migration for existing databases (run if columns don't exist):
-- ALTER TABLE wallets ADD COLUMN IF NOT EXISTS balance_usdc NUMERIC(20,7) DEFAULT 0;
-- ALTER TABLE wallets ADD COLUMN IF NOT EXISTS balance_xlm NUMERIC(20,7) DEFAULT 0;

-- User profiles (PIN-based auth, like M-Pesa)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_phone ON profiles(phone);

-- Disable RLS for all tables (single-user demo app)
ALTER TABLE wallets DISABLE ROW LEVEL SECURITY;
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
