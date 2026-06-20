CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id      UUID NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
  message     TEXT NOT NULL,
  type        VARCHAR(50) NOT NULL DEFAULT 'flagged_content',
  read        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_job_id  ON notifications(job_id);