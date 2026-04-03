
CREATE TABLE public.notification_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type TEXT NOT NULL,
  recipient_user_id UUID NOT NULL REFERENCES public.app_users(id),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  resend_id TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  triggered_by UUID REFERENCES public.app_users(id),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

COMMENT ON TABLE notification_log IS 'Append-only log of all email notifications sent by ValiTrack. Never updated or deleted. triggered_by is NULL for cron-triggered notifications.';
COMMENT ON COLUMN notification_log.triggered_by IS 'The user whose action triggered this notification. NULL for cron/scheduled notifications.';

CREATE INDEX idx_notification_log_dedup 
  ON notification_log (notification_type, recipient_user_id, created_at);

CREATE INDEX idx_notification_log_recipient 
  ON notification_log (recipient_user_id, created_at DESC);

ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notification_log FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Super users can view all notifications"
  ON notification_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_user'::app_role));
