-- FGuP3nYfPfL: Push-Notifications bei lang laufenden Timern.
-- Der Watchdog merkt sich den Zeitpunkt der letzten Warn-Push pro Timer,
-- damit (a) die 60-min-Warnung nur einmal feuert und (b) die 90-min-
-- Wiederholungen einen sauberen 5-min-Rhythmus haben — unabhaengig vom
-- Tick-Intervall des Schedulers.
ALTER TABLE live_timers
  ADD COLUMN IF NOT EXISTS last_warning_push_at timestamptz;
