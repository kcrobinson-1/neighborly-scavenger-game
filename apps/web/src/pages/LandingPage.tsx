import { useEffect, useState } from "react";
import { featuredGameSlug } from "../data/games";
import {
  listPublishedGameSummaries,
  type PublishedGameSummary,
} from "../lib/gameContentApi";
import { routes } from "../routes";

/** Props for the landing page route. */
type LandingPageProps = {
  onNavigate: (path: string) => void;
};

/** Demo overview page that introduces the product and sample routes. */
export function LandingPage({ onNavigate }: LandingPageProps) {
  const [games, setGames] = useState<PublishedGameSummary[]>([]);
  const [gamesLoadError, setGamesLoadError] = useState<string | null>(null);
  const [isLoadingGames, setIsLoadingGames] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const retryLoadingGames = () => {
    setIsLoadingGames(true);
    setGamesLoadError(null);
    setReloadToken((value) => value + 1);
  };

  useEffect(() => {
    let isCancelled = false;

    void listPublishedGameSummaries()
      .then((summaries) => {
        if (!isCancelled) {
          setGames(summaries);
        }
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setGames([]);
          setGamesLoadError(
            error instanceof Error
              ? error.message
              : "We couldn't load the published demo events right now.",
          );
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingGames(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [reloadToken]);

  const featuredGame = games.find((game) => game.slug === featuredGameSlug);
  const canOpenFeaturedDemo = Boolean(featuredGame) && !isLoadingGames && !gamesLoadError;

  return (
    <section className="landing-layout">
      <header className="landing-hero panel panel-hero">
        <div className="hero-copy">
          <p className="eyebrow">Product demo</p>
          <h1>See how a two-minute neighborhood game becomes an easy reward check-in.</h1>
          <p className="hero-body">
            This overview is for organizers, sponsors, volunteers, and teammates
            previewing the product. In the live experience, attendees should land
            directly in the game. Here, you can open demo flows and review the full
            attendee journey from start to volunteer-table handoff.
          </p>
        </div>
        <div className="hero-actions">
          <button
            className="primary-button"
            disabled={!canOpenFeaturedDemo}
            onClick={() => onNavigate(routes.game(featuredGameSlug))}
            type="button"
          >
            {isLoadingGames ? "Loading attendee demo..." : "Try the attendee demo"}
          </button>
          <a className="text-link" href="#how-it-works">
            Jump to demo routes
          </a>
        </div>
      </header>

      <section className="feature-grid" id="how-it-works">
        <article className="panel feature-card">
          <span className="chip">For organizers</span>
          <h2>Sell a sponsor moment, not just logo space.</h2>
          <p>
            The copy should make the value proposition obvious: scan the code, answer a
            few questions, and send people to the volunteer table with clear proof of
            completion.
          </p>
        </article>

        <article className="panel feature-card">
          <span className="chip">For attendees</span>
          <h2>Understand the experience at a glance.</h2>
          <p>
            The text stays short, the time commitment is clear, and every step explains
            what happens next without feeling like a form.
          </p>
        </article>

        <article className="panel feature-card">
          <span className="chip">For volunteers</span>
          <h2>Verify a finish in a few seconds.</h2>
          <p>
            The completion wording and proof state should let a volunteer confirm the
            finish quickly and keep the line moving.
          </p>
        </article>
      </section>

      <section className="panel landing-flow">
        <div className="section-heading">
          <p className="eyebrow">Demo routes</p>
          <h2>In the live product, attendees skip this overview.</h2>
        </div>
        <div className="flow-grid">
          <div className="flow-step">
            <strong>{routes.home}</strong>
            <p>
              Use this page to preview the concept and choose the demo flow you want to
              review.
            </p>
          </div>
          <div className="flow-step">
            <strong>{routes.game(featuredGameSlug)}</strong>
            <p>
              This route shows the attendee experience: short intro, one question at a
              time, and a volunteer-ready finish.
            </p>
          </div>
        </div>
      </section>

      <section className="panel sample-games-panel">
        <div className="section-heading">
          <p className="eyebrow">Playable demos</p>
          <h2>Open the flow you want to review.</h2>
        </div>
        {isLoadingGames ? (
          <p>Loading the published demo events for this overview.</p>
        ) : null}
        {gamesLoadError ? (
          <div className="not-found-actions">
            <p>{gamesLoadError}</p>
            <button
              className="secondary-button"
              onClick={retryLoadingGames}
              type="button"
            >
              Retry loading demos
            </button>
          </div>
        ) : null}
        {!isLoadingGames && !gamesLoadError && games.length === 0 ? (
          <p>No published demo events are available right now.</p>
        ) : null}
        {!isLoadingGames && !gamesLoadError && games.length > 0 ? (
          <div className="sample-games-list">
            {games.map((game) => (
              <article className="sample-game-row" key={game.slug}>
                <div className="sample-game-copy">
                  <span className="chip">
                    {game.feedbackMode === "instant_feedback_required"
                      ? "Must answer correctly"
                      : "Score at the end"}
                  </span>
                  <div className="sample-game-heading">
                    <h3>{game.name}</h3>
                    <p>{game.summary}</p>
                  </div>
                </div>
                <button
                  className="secondary-button sample-game-button"
                  onClick={() => onNavigate(routes.game(game.slug))}
                  type="button"
                >
                  {game.slug === featuredGameSlug ? "Try featured demo" : "Try this demo"}
                </button>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  );
}
