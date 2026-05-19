-- FclpRr066St: Timer-Start verschiebt Task in 'doing', merkt sich die
-- vorherige Spalte. Bei Stop wird die Aufgabe zurueck in die alte Spalte
-- gesetzt (falls aktuell noch in 'doing').
ALTER TABLE live_timers
  ADD COLUMN IF NOT EXISTS previous_column text;
