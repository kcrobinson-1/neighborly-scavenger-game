export type AnswerOption = {
  id: string;
  label: string;
};

export type Question = {
  id: string;
  sponsor: string;
  prompt: string;
  options: AnswerOption[];
};

export type EventContent = {
  id: string;
  name: string;
  location: string;
  estimatedMinutes: number;
  raffleLabel: string;
  intro: string;
  questions: Question[];
};

export const demoEvent: EventContent = {
  id: "madrona-music-2026",
  name: "Madrona Music in the Playfield",
  location: "Seattle",
  estimatedMinutes: 2,
  raffleLabel: "raffle ticket",
  intro: "Answer 6 quick questions, support local sponsors, and earn a raffle ticket.",
  questions: [
    {
      id: "q1",
      sponsor: "Hi Spot Cafe",
      prompt: "Which local spot is sponsoring this neighborhood music series question?",
      options: [
        { id: "a", label: "Hi Spot Cafe" },
        { id: "b", label: "Space Needle" },
        { id: "c", label: "Pike Place Fish Throwers" },
      ],
    },
    {
      id: "q2",
      sponsor: "Bottlehouse",
      prompt: "What kind of experience should this game feel like?",
      options: [
        { id: "a", label: "A long signup form" },
        { id: "b", label: "A quick neighborhood game" },
        { id: "c", label: "A coupon checkout flow" },
      ],
    },
    {
      id: "q3",
      sponsor: "Cafe Flora",
      prompt: "How many questions should the MVP generally ask attendees?",
      options: [
        { id: "a", label: "1 or 2" },
        { id: "b", label: "5 to 7" },
        { id: "c", label: "15 to 20" },
      ],
    },
    {
      id: "q4",
      sponsor: "Creature Consignment",
      prompt: "What matters most for raffle eligibility in the MVP?",
      options: [
        { id: "a", label: "Finishing the quiz" },
        { id: "b", label: "Sharing on social media" },
        { id: "c", label: "Creating an account" },
      ],
    },
    {
      id: "q5",
      sponsor: "Central Co-op",
      prompt: "How should questions appear in the experience?",
      options: [
        { id: "a", label: "All visible on one long page" },
        { id: "b", label: "One card at a time" },
        { id: "c", label: "Inside pop-up windows" },
      ],
    },
    {
      id: "q6",
      sponsor: "Glasswing",
      prompt: "What should the final screen make obvious?",
      options: [
        { id: "a", label: "That the attendee is officially done" },
        { id: "b", label: "That there are hidden bonus levels" },
        { id: "c", label: "That they must check their email first" },
      ],
    },
  ],
};
