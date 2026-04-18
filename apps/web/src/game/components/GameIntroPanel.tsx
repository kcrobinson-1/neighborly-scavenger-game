/** Intro panel for the pre-game state before the player starts an attempt. */
import type { GameConfig } from "../../data/games";

/** Props for the pre-game intro panel. */
type GameIntroPanelProps = {
  game: GameConfig;
  isStartingSession: boolean;
  onStart: () => void | Promise<void>;
  startError: string | null;
};

/** Intro panel shown before the player starts a game attempt. */
export function GameIntroPanel({
  game,
  isStartingSession,
  onStart,
  startError,
}: GameIntroPanelProps) {
  const modeDescription =
    game.feedbackMode === "instant_feedback_required"
      ? "Answer correctly to unlock the next question and a quick sponsor fact."
      : "See your score after the last question.";

  return (
    <section className="panel intro-panel">
      <span className="chip">About {game.estimatedMinutes} minutes</span>
      <h2>Finish to earn your {game.entitlementLabel}</h2>
      <p>{game.intro}</p>
      <ul className="intro-list">
        <li>No sign-in</li>
        <li>One question on screen at a time</li>
        <li>{modeDescription}</li>
      </ul>
      {startError ? (
        <div className="feedback-banner feedback-banner-error" role="status">
          <strong>Can't start the game right now.</strong>
          <p>{startError}</p>
        </div>
      ) : null}
      <button
        className="primary-button"
        disabled={isStartingSession}
        onClick={() => {
          void onStart();
        }}
        type="button"
      >
        {isStartingSession ? "Getting your game ready..." : "Start game"}
      </button>
    </section>
  );
}
