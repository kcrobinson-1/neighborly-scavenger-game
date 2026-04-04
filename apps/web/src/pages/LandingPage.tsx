import { featuredGameSlug, games } from "../data/games";
import { routes } from "../routes";

/** Props for the landing page route. */
type LandingPageProps = {
  onNavigate: (path: string) => void;
};

/** Marketing landing page that introduces the product and sample games. */
export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <section className="landing-layout">
      <header className="landing-hero panel panel-hero">
        <div className="hero-copy">
          <p className="eyebrow">Neighborhood event engagement</p>
          <h1>Turn a sponsor-friendly quiz into a neighborhood raffle moment.</h1>
          <p className="hero-body">
            Neighborly Scavenger Game is a mobile-first event experience for concerts,
            markets, and neighborhood gatherings. Attendees scan, play, and finish in
            under two minutes while sponsors become part of the experience instead of
            just background logos.
          </p>
        </div>
        <div className="hero-actions">
          <button
            className="primary-button"
            onClick={() => onNavigate(routes.game(featuredGameSlug))}
            type="button"
          >
            Play the first sample
          </button>
          <a className="text-link" href="#how-it-works">
            See how it works
          </a>
        </div>
      </header>

      <section className="feature-grid" id="how-it-works">
        <article className="panel feature-card">
          <span className="chip">For organizers</span>
          <h2>Lightweight fundraising without adding booth chaos.</h2>
          <p>
            Organizers configure the event, add sponsored questions, publish a QR code,
            and let the game run with minimal volunteer training.
          </p>
        </article>

        <article className="panel feature-card">
          <span className="chip">For attendees</span>
          <h2>A quick game instead of a long form.</h2>
          <p>
            One question appears at a time, progress is obvious, and the finish screen
            clearly tells people how to redeem their raffle ticket.
          </p>
        </article>

        <article className="panel feature-card">
          <span className="chip">For sponsors</span>
          <h2>Visible inside the experience, not pushed to the margins.</h2>
          <p>
            Sponsors appear inside the game flow in a way that feels local and useful
            instead of interruptive or ad-heavy.
          </p>
        </article>
      </section>

      <section className="panel landing-flow">
        <div className="section-heading">
          <p className="eyebrow">Sample route</p>
          <h2>The product can live on one site.</h2>
        </div>
        <div className="flow-grid">
          <div className="flow-step">
            <strong>{routes.home}</strong>
            <p>
              Marketing landing page that explains the product and directs people into a
              live demo.
            </p>
          </div>
          <div className="flow-step">
            <strong>{routes.game(featuredGameSlug)}</strong>
            <p>
              Playable sample game with the full attendee flow, from intro screen to
              verification state.
            </p>
          </div>
        </div>
      </section>

      <section className="panel sample-games-panel">
        <div className="section-heading">
          <p className="eyebrow">Playable samples</p>
          <h2>Open a demo flow without digging through a long list of cards.</h2>
        </div>
        <div className="sample-games-list">
          {games.map((game) => (
            <article className="sample-game-row" key={game.slug}>
              <div className="sample-game-copy">
                <span className="chip">
                  {game.feedbackMode === "instant_feedback_required"
                    ? "Required correct answers"
                    : "Final score reveal"}
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
                {game.slug === featuredGameSlug ? "Open featured sample" : "Open this sample"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
