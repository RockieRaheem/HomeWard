-- HomeWard user-data isolation migration
-- Run once in Supabase SQL Editor before deploying the scoped backend.
-- Existing unowned demo records are intentionally not assigned to any profile.

ALTER TABLE wallets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id, created_at ASC);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('payment', 'goal', 'tip')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('MTN', 'AIRTEL')),
  relationship TEXT NOT NULL DEFAULT 'Family',
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_recipients_user_id ON recipients(user_id, created_at DESC);
ALTER TABLE recipients ADD COLUMN IF NOT EXISTS monthly_plan_usdc NUMERIC(20,7);

CREATE TABLE IF NOT EXISTS circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, recipient_id UUID REFERENCES recipients(id) ON DELETE SET NULL,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL, recurring_amount_usdc NUMERIC(20,7) NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'Family support', status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_circles_user_id ON circles(user_id, created_at DESC);


-- After the scoped backend is deployed and this migration has run, make ownership mandatory.
-- Do this only after confirming every real record has an owner:
-- ALTER TABLE wallets ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE goals ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE chat_sessions ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE chat_messages ALTER COLUMN user_id SET NOT NULL;
