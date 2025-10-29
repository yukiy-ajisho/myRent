-- ========================================
-- NOTIFICATION SYSTEM TABLES
-- ========================================

-- Main notification table (generic for all notification types)
CREATE TABLE notification (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_user(user_id) NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('urgent', 'important', 'info')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  action_label TEXT,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notification_user_unread 
  ON notification(user_id, is_read, created_at DESC);

CREATE INDEX idx_notification_type 
  ON notification(type);

-- Loan notification specific data
CREATE TABLE notification_loan (
  notification_id UUID PRIMARY KEY REFERENCES notification(notification_id) ON DELETE CASCADE,
  loan_id UUID REFERENCES loan(loan_id),
  owner_id UUID REFERENCES app_user(user_id),
  tenant_id UUID REFERENCES app_user(user_id),
  property_id UUID REFERENCES property(property_id),
  amount DECIMAL NOT NULL,
  owner_name TEXT,
  tenant_name TEXT,
  property_name TEXT
);

CREATE INDEX idx_notification_loan_loan_id 
  ON notification_loan(loan_id);

-- Repayment notification specific data
CREATE TABLE notification_repayment (
  notification_id UUID PRIMARY KEY REFERENCES notification(notification_id) ON DELETE CASCADE,
  repayment_id UUID REFERENCES repayment(repayment_id),
  owner_id UUID REFERENCES app_user(user_id),
  tenant_id UUID REFERENCES app_user(user_id),
  property_id UUID REFERENCES property(property_id),
  amount DECIMAL NOT NULL,
  owner_name TEXT,
  tenant_name TEXT,
  repayment_date TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notification_repayment_repayment_id 
  ON notification_repayment(repayment_id);

COMMENT ON TABLE notification IS 'Generic notification table for all notification types';
COMMENT ON TABLE notification_loan IS 'Loan-specific notification data';
COMMENT ON TABLE notification_repayment IS 'Repayment-specific notification data';

