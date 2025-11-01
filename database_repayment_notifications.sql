-- ========================================
-- REPAYMENT NOTIFICATION SYSTEM TABLES
-- ========================================

-- Settings table: Stores notification settings per owner-tenant pair
CREATE TABLE IF NOT EXISTS repayment_notification_settings (
  tenant_user_id UUID REFERENCES app_user(user_id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES app_user(user_id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  lead_days SMALLINT NOT NULL CHECK (lead_days >= 0 AND lead_days <= 31),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_user_id, owner_user_id)
);

CREATE INDEX IF NOT EXISTS idx_repayment_notification_settings_owner 
  ON repayment_notification_settings(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_repayment_notification_settings_tenant 
  ON repayment_notification_settings(tenant_user_id);

-- Helper table: Links notifications to repayments (prevents duplicates)
CREATE TABLE IF NOT EXISTS notification_repayment (
  notification_id UUID PRIMARY KEY REFERENCES notification(notification_id) ON DELETE CASCADE,
  repayment_id UUID REFERENCES repayment(repayment_id) ON DELETE CASCADE,
  UNIQUE(repayment_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_repayment_repayment_id 
  ON notification_repayment(repayment_id);

-- Updated_at trigger for repayment_notification_settings
CREATE OR REPLACE FUNCTION update_repayment_notification_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_repayment_notification_settings_updated_at'
  ) THEN
    CREATE TRIGGER trg_repayment_notification_settings_updated_at
      BEFORE UPDATE ON repayment_notification_settings
      FOR EACH ROW
      EXECUTE FUNCTION update_repayment_notification_settings_updated_at();
  END IF;
END $$;

COMMENT ON TABLE repayment_notification_settings IS 'Settings for repayment notifications per owner-tenant pair';
COMMENT ON TABLE notification_repayment IS 'Links notifications to repayments to prevent duplicates';

