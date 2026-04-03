import { useState } from "react";
import { demoEvent } from "./data/demoEvent";

type Answers = Record<string, string>;

function App() {
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

  const questions = demoEvent.questions;
  const currentQuestion = questions[currentIndex];
  const isComplete = started && currentIndex >= questions.length;
  const progressValue = ((currentIndex + 1) / questions.length) * 100;

  const answerCount = Object.keys(answers).length.toString().padStart(2, "0");
  const completionCode = `MMP-${answerCount}${demoEvent.id.slice(-2).toUpperCase()}`;

  const handleStart = () => {
    setStarted(true);
    setCurrentIndex(0);
  };

  const handleAnswerSelect = (questionId: string, optionId: string) => {
    setAnswers((current) => ({
      ...current,
      [questionId]: optionId,
    }));

    setCurrentIndex((index) => index + 1);
  };

  const handleReset = () => {
    setStarted(false);
    setCurrentIndex(0);
    setAnswers({});
  };

  return (
    <main className="shell">
      <section className="backdrop" aria-hidden="true" />
      <section className="app-card">
        <header className="topbar">
          <div>
            <p className="eyebrow">{demoEvent.location} neighborhood event</p>
            <h1>{demoEvent.name}</h1>
          </div>
          {started && !isComplete ? (
            <div className="progress-copy" aria-live="polite">
              Question {currentIndex + 1} of {questions.length}
            </div>
          ) : null}
        </header>

        {!started ? (
          <section className="panel intro-panel">
            <span className="chip">Under {demoEvent.estimatedMinutes} minutes</span>
            <h2>Win a {demoEvent.raffleLabel}</h2>
            <p>{demoEvent.intro}</p>
            <ul className="intro-list">
              <li>No login</li>
              <li>One question at a time</li>
              <li>Show the final screen to the volunteer table</li>
            </ul>
            <button className="primary-button" onClick={handleStart} type="button">
              Start the game
            </button>
          </section>
        ) : null}

        {started && !isComplete ? (
          <>
            <div
              className="progress-track"
              aria-hidden="true"
            >
              <div className="progress-fill" style={{ width: `${progressValue}%` }} />
            </div>
            <section className="panel question-panel">
              <p className="sponsor-label">Sponsored by {currentQuestion.sponsor}</p>
              <h2>{currentQuestion.prompt}</h2>
              <div className="options" role="list" aria-label="Answer options">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option.id}
                    className="option-button"
                    onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {isComplete ? (
          <section className="panel completion-panel">
            <span className="chip chip-success">Officially complete</span>
            <h2>Show this screen to the volunteer table</h2>
            <p>
              You finished the neighborhood game and earned your {demoEvent.raffleLabel}.
            </p>
            <div className="token-block">
              <span className="token-label">Verification code</span>
              <strong>{completionCode}</strong>
              <span className="token-meta">Prototype proof state for in-person redemption</span>
            </div>
            <button className="secondary-button" onClick={handleReset} type="button">
              Restart demo
            </button>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default App;
