-- HomeWard privacy-preserving transfer verification migration.
-- This stores only HMAC commitments and policy metadata. Do not store names,
-- phone numbers, transfer prompts, or raw AI output in these columns.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recipient_commitment TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS safety_audit_hash TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS safety_policy_version TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS safety_flags JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_transactions_recipient_commitment
  ON transactions(recipient_commitment);
