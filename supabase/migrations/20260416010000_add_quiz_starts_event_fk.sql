-- Enforce referential integrity on quiz_starts.event_id so that only rows
-- referencing a real quiz event can be recorded. Without this constraint,
-- the issue-session endpoint (which is origin-gated but not authenticated)
-- could be used to write start rows for arbitrary event IDs, polluting the
-- analytics funnel denominator.
--
-- ON DELETE CASCADE is consistent with quiz_questions and quiz_question_options
-- and ensures orphaned start rows are cleaned up if an event is hard-deleted.
alter table public.quiz_starts
  add constraint quiz_starts_event_id_fkey
    foreign key (event_id) references public.quiz_events (id)
    on delete cascade;
