update public.game_events
set
  entitlement_label = 'reward ticket',
  intro = 'Answer 6 quick questions, support local sponsors, and earn a reward ticket.',
  summary = 'Move through the game with explicit submit on each question and see your score plus the correct answers at the end.'
where id = 'madrona-music-2026';

update public.game_events
set entitlement_label = 'bonus reward ticket'
where id = 'madrona-sponsor-spotlight-2026';

update public.game_events
set
  name = 'Community Checklist Game',
  entitlement_label = 'sample reward ticket'
where id = 'community-checklist-2026';

update public.game_questions
set prompt = 'What matters most for reward eligibility in the MVP?'
where event_id = 'madrona-music-2026' and id = 'q4';

update public.game_questions
set prompt = 'Which answer best describes why sponsors appear inside the game experience?'
where event_id = 'madrona-sponsor-spotlight-2026' and id = 'q1';

update public.game_questions
set prompt = 'What keeps the game feeling playable outdoors on a phone?'
where event_id = 'madrona-sponsor-spotlight-2026' and id = 'q2';

update public.game_questions
set
  prompt = 'What should happen after a correct answer in this game mode?',
  sponsor_fact = 'A short sponsor fact keeps the moment informative without derailing the pace of the game.'
where event_id = 'madrona-sponsor-spotlight-2026' and id = 'q3';

update public.game_questions
set prompt = 'Which behaviors support a strong neighborhood-event game experience?'
where event_id = 'community-checklist-2026' and id = 'q1';

update public.game_question_options
set label = 'Finishing the game'
where event_id = 'madrona-music-2026' and question_id = 'q4' and id = 'a';

update public.game_question_options
set label = 'To replace the reward entirely'
where event_id = 'madrona-sponsor-spotlight-2026' and question_id = 'q1' and id = 'b';

update public.game_question_options
set label = 'End the game immediately'
where event_id = 'madrona-sponsor-spotlight-2026' and question_id = 'q4' and id = 'c';
