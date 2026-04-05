import { featuredGameSlug } from "../data/games";
import { routes } from "../routes";

/** Props for the not-found fallback route. */
type NotFoundPageProps = {
  onNavigate: (path: string) => void;
};

/** Fallback screen for unsupported routes in the sample app. */
export function NotFoundPage({ onNavigate }: NotFoundPageProps) {
  return (
    <section className="not-found-layout panel">
      <span className="chip">Page not found</span>
      <h1>That page isn't available in this demo.</h1>
      <p>
        Go back to the demo overview or jump straight into the attendee flow.
      </p>
      <div className="not-found-actions">
        <button
          className="primary-button"
          onClick={() => onNavigate(routes.home)}
          type="button"
        >
          Go to demo overview
        </button>
        <button
          className="secondary-button"
          onClick={() => onNavigate(routes.game(featuredGameSlug))}
          type="button"
        >
          Open attendee demo
        </button>
      </div>
    </section>
  );
}
