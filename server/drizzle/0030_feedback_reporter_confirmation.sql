-- FTKnjlXNVlH: Reporter-Bestaetigung nach Resolve.
-- Wenn ein Feedback als 'done' markiert wird, soll der Einreicher bestaetigen
-- koennen, dass es wirklich so umgesetzt ist wie gewuenscht ('confirmed') oder
-- dass es noch nicht passt ('rejected' -> Feedback springt zurueck auf 'open').
-- reporter_confirmation = NULL bedeutet: noch ausstehend (nur relevant bei done).

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS reporter_confirmation text
    CHECK (reporter_confirmation IN ('confirmed', 'rejected'));

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS reporter_confirmation_note text;

ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS reporter_confirmed_at timestamptz;
