
CREATE TABLE IF NOT EXISTS signal_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol       text NOT NULL,
  timeframe    text NOT NULL,
  signal_type  text NOT NULL,
  confidence   numeric(5,4),
  entry        numeric(18,8),
  sl           numeric(18,8),
  tp1          numeric(18,8),
  source       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE signal_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_alerts" ON signal_alerts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "insert_alerts" ON signal_alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_alerts" ON signal_alerts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_alerts" ON signal_alerts FOR DELETE TO authenticated USING (true);
