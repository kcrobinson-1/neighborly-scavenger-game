import { routes } from "../routes";

type LandingPageProps = {
  onNavigate: (path: string) => void;
};

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
            onClick={() => onNavigate(routes.sampleGame)}
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
            <strong>/</strong>
            <p>
              Marketing landing page that explains the product and directs people into a
              live demo.
            </p>
          </div>
          <div className="flow-step">
            <strong>/game/first-sample</strong>
            <p>
              Playable sample game with the full attendee flow, from intro screen to
              verification state.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
