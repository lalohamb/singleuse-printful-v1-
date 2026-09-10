CREATE TABLE IF NOT EXISTS email_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id    text        NOT NULL,
  to_email     text        NOT NULL,
  subject      text,
  event_type   text        NOT NULL, -- sent, delivered, opened, clicked, bounced, complained
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_email_events" ON email_events;
CREATE POLICY "admin_all_email_events" ON email_events FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_email_events_resend_id ON email_events(resend_id);
CREATE INDEX IF NOT EXISTS idx_email_events_to_email  ON email_events(to_email);
CREATE INDEX IF NOT EXISTS idx_email_events_type      ON email_events(event_type);
