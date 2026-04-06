create table if not exists public.quiz_events (
  id text primary key,
  slug text not null unique,
  name text not null,
  location text not null,
  estimated_minutes integer not null,
  raffle_label text not null,
  intro text not null,
  summary text not null,
  feedback_mode text not null,
  allow_back_navigation boolean not null default true,
  allow_retake boolean not null default true,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quiz_events_estimated_minutes_positive
    check (estimated_minutes > 0),
  constraint quiz_events_feedback_mode_check
    check (feedback_mode in ('final_score_reveal', 'instant_feedback_required'))
);

create table if not exists public.quiz_questions (
  event_id text not null references public.quiz_events (id) on delete cascade,
  id text not null,
  display_order integer not null,
  sponsor text not null,
  prompt text not null,
  selection_mode text not null,
  explanation text,
  sponsor_fact text,
  primary key (event_id, id),
  constraint quiz_questions_display_order_positive
    check (display_order > 0),
  constraint quiz_questions_selection_mode_check
    check (selection_mode in ('single', 'multiple')),
  constraint quiz_questions_event_display_order_unique
    unique (event_id, display_order)
);

create table if not exists public.quiz_question_options (
  event_id text not null,
  question_id text not null,
  id text not null,
  display_order integer not null,
  label text not null,
  is_correct boolean not null default false,
  primary key (event_id, question_id, id),
  constraint quiz_question_options_display_order_positive
    check (display_order > 0),
  constraint quiz_question_options_event_question_display_order_unique
    unique (event_id, question_id, display_order),
  constraint quiz_question_options_question_fk
    foreign key (event_id, question_id)
    references public.quiz_questions (event_id, id)
    on delete cascade
);

alter table public.quiz_events enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_question_options enable row level security;

grant select on table public.quiz_events
  to anon, authenticated, service_role;

grant select on table public.quiz_questions
  to anon, authenticated, service_role;

grant select on table public.quiz_question_options
  to anon, authenticated, service_role;

create policy "published quiz events are readable"
on public.quiz_events
for select
to anon, authenticated
using (published_at is not null);

create policy "published quiz questions are readable"
on public.quiz_questions
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.quiz_events
    where public.quiz_events.id = public.quiz_questions.event_id
      and public.quiz_events.published_at is not null
  )
);

create policy "published quiz options are readable"
on public.quiz_question_options
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.quiz_events
    where public.quiz_events.id = public.quiz_question_options.event_id
      and public.quiz_events.published_at is not null
  )
);

insert into public.quiz_events (
  id,
  slug,
  name,
  location,
  estimated_minutes,
  raffle_label,
  intro,
  summary,
  feedback_mode,
  allow_back_navigation,
  allow_retake,
  published_at
)
values
  (
    'madrona-music-2026',
    'first-sample',
    'Madrona Music in the Playfield',
    'Seattle',
    2,
    'raffle ticket',
    'Answer 6 quick questions, support local sponsors, and earn a raffle ticket.',
    'Move through the quiz with explicit submit on each question and see your score plus the correct answers at the end.',
    'final_score_reveal',
    true,
    true,
    now()
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'sponsor-spotlight',
    'Sponsor Spotlight Challenge',
    'Seattle',
    3,
    'bonus raffle ticket',
    'Choose an answer, submit it, and get it right to unlock quick sponsor facts and finish the challenge.',
    'You must submit the correct answer to move on, and each right answer reveals a sponsor fact before the next question.',
    'instant_feedback_required',
    true,
    true,
    now()
  ),
  (
    'community-checklist-2026',
    'community-checklist',
    'Community Checklist Quiz',
    'Seattle',
    3,
    'sample raffle ticket',
    'Some questions ask you to select all that apply before submitting your answer.',
    'Includes select-all-that-apply questions so we can validate multiple selection with an explicit submit button.',
    'final_score_reveal',
    true,
    true,
    now()
  );

insert into public.quiz_questions (
  event_id,
  id,
  display_order,
  sponsor,
  prompt,
  selection_mode,
  explanation,
  sponsor_fact
)
values
  (
    'madrona-music-2026',
    'q1',
    1,
    'Hi Spot Cafe',
    'Which local spot is sponsoring this neighborhood music series question?',
    'single',
    null,
    'Hi Spot Cafe has been a long-running Madrona neighborhood favorite for brunch and community meetups.'
  ),
  (
    'madrona-music-2026',
    'q2',
    2,
    'Bottlehouse',
    'What kind of experience should this game feel like?',
    'single',
    'The best version feels like a quick neighborhood game, not a long form.',
    null
  ),
  (
    'madrona-music-2026',
    'q3',
    3,
    'Cafe Flora',
    'How many questions should the MVP generally ask attendees?',
    'single',
    'Five to seven questions keeps the experience short while still giving sponsors meaningful visibility.',
    null
  ),
  (
    'madrona-music-2026',
    'q4',
    4,
    'Creature Consignment',
    'What matters most for raffle eligibility in the MVP?',
    'single',
    'Completion matters more than score in the MVP so the flow stays simple and easy to redeem.',
    null
  ),
  (
    'madrona-music-2026',
    'q5',
    5,
    'Central Co-op',
    'How should questions appear in the experience?',
    'single',
    'One visible card at a time keeps the flow readable, fast, and game-like on phones.',
    null
  ),
  (
    'madrona-music-2026',
    'q6',
    6,
    'Glasswing',
    'What should the final screen make obvious?',
    'single',
    null,
    'A strong final verification moment helps volunteers trust the completion without digging through answers.'
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q1',
    1,
    'Bottlehouse',
    'Which answer best describes why sponsors appear inside the quiz experience?',
    'single',
    null,
    'Bottlehouse benefits more from active participation in a community moment than from a passive logo placement.'
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q2',
    2,
    'Central Co-op',
    'What keeps the quiz feeling playable outdoors on a phone?',
    'single',
    null,
    'Central Co-op''s sponsor moment works better when the interface stays legible, large, and thumb-friendly.'
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q3',
    3,
    'Cafe Flora',
    'What should happen after a correct answer in this quiz mode?',
    'single',
    null,
    'A short sponsor fact keeps the moment informative without derailing the pace of the quiz.'
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q4',
    4,
    'Glasswing',
    'What should a wrong answer do in this mode?',
    'single',
    'The player should try again because this mode is designed around getting the answer right before progressing.',
    null
  ),
  (
    'community-checklist-2026',
    'q1',
    1,
    'Madrona Farmers Market',
    'Which behaviors support a strong neighborhood-event quiz experience?',
    'multiple',
    'The strongest experience is clear, mobile-friendly, and easy to finish in the flow of an event.',
    null
  ),
  (
    'community-checklist-2026',
    'q2',
    2,
    'Hi Spot Cafe',
    'What should a single-answer question allow before submission?',
    'single',
    'The user should be able to switch their selected answer before they decide to submit.',
    null
  ),
  (
    'community-checklist-2026',
    'q3',
    3,
    'Central Co-op',
    'Which answers fit a select-all-that-apply question model?',
    'multiple',
    null,
    'Select-all questions are useful when a sponsor wants a slightly richer educational moment without changing the overall site structure.'
  );

insert into public.quiz_question_options (
  event_id,
  question_id,
  id,
  display_order,
  label,
  is_correct
)
values
  ('madrona-music-2026', 'q1', 'a', 1, 'Hi Spot Cafe', true),
  ('madrona-music-2026', 'q1', 'b', 2, 'Space Needle', false),
  ('madrona-music-2026', 'q1', 'c', 3, 'Pike Place Fish Throwers', false),
  ('madrona-music-2026', 'q2', 'a', 1, 'A long signup form', false),
  ('madrona-music-2026', 'q2', 'b', 2, 'A quick neighborhood game', true),
  ('madrona-music-2026', 'q2', 'c', 3, 'A coupon checkout flow', false),
  ('madrona-music-2026', 'q3', 'a', 1, '1 or 2', false),
  ('madrona-music-2026', 'q3', 'b', 2, '5 to 7', true),
  ('madrona-music-2026', 'q3', 'c', 3, '15 to 20', false),
  ('madrona-music-2026', 'q4', 'a', 1, 'Finishing the quiz', true),
  ('madrona-music-2026', 'q4', 'b', 2, 'Sharing on social media', false),
  ('madrona-music-2026', 'q4', 'c', 3, 'Creating an account', false),
  ('madrona-music-2026', 'q5', 'a', 1, 'All visible on one long page', false),
  ('madrona-music-2026', 'q5', 'b', 2, 'One card at a time', true),
  ('madrona-music-2026', 'q5', 'c', 3, 'Inside pop-up windows', false),
  ('madrona-music-2026', 'q6', 'a', 1, 'That the attendee is officially done', true),
  ('madrona-music-2026', 'q6', 'b', 2, 'That there are hidden bonus levels', false),
  ('madrona-music-2026', 'q6', 'c', 3, 'That they must check their email first', false),
  (
    'madrona-sponsor-spotlight-2026',
    'q1',
    'a',
    1,
    'To interrupt players with ads',
    false
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q1',
    'b',
    2,
    'To replace the raffle entirely',
    false
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q1',
    'c',
    3,
    'To feel integrated into the neighborhood event',
    true
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q2',
    'a',
    1,
    'Long paragraphs and tiny controls',
    false
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q2',
    'b',
    2,
    'Large tap targets and one clear choice at a time',
    true
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q2',
    'c',
    3,
    'Multiple popups per question',
    false
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q3',
    'a',
    1,
    'Show a quick confirmation and sponsor fact before continuing',
    true
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q3',
    'b',
    2,
    'Jump straight to the homepage',
    false
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q3',
    'c',
    3,
    'Require an email address before moving on',
    false
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q4',
    'a',
    1,
    'Move on anyway without feedback',
    false
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q4',
    'b',
    2,
    'Prompt the player to try again',
    true
  ),
  (
    'madrona-sponsor-spotlight-2026',
    'q4',
    'c',
    3,
    'End the quiz immediately',
    false
  ),
  (
    'community-checklist-2026',
    'q1',
    'a',
    1,
    'Large tap targets',
    true
  ),
  (
    'community-checklist-2026',
    'q1',
    'b',
    2,
    'Tiny multi-column forms',
    false
  ),
  (
    'community-checklist-2026',
    'q1',
    'c',
    3,
    'Visible progress',
    true
  ),
  (
    'community-checklist-2026',
    'q1',
    'd',
    4,
    'Short completion time',
    true
  ),
  (
    'community-checklist-2026',
    'q2',
    'a',
    1,
    'Lock the first tap immediately',
    false
  ),
  (
    'community-checklist-2026',
    'q2',
    'b',
    2,
    'Change the selected answer before pressing submit',
    true
  ),
  (
    'community-checklist-2026',
    'q2',
    'c',
    3,
    'Force a page reload between choices',
    false
  ),
  (
    'community-checklist-2026',
    'q3',
    'a',
    1,
    'Allow multiple active selections',
    true
  ),
  (
    'community-checklist-2026',
    'q3',
    'b',
    2,
    'Use one explicit submit button',
    true
  ),
  (
    'community-checklist-2026',
    'q3',
    'c',
    3,
    'Advance instantly after every tap',
    false
  );
