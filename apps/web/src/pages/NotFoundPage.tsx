import { routes } from "../routes";

type NotFoundPageProps = {
  onNavigate: (path: string) => void;
};

export function NotFoundPage({ onNavigate }: NotFoundPageProps) {
  return (
    <section className="not-found-layout panel">
      <span className="chip">Page not found</span>
      <h1>This route is not part of the sample site yet.</h1>
      <p>
        Head back to the product overview or jump straight into the sample game.
      </p>
      <div className="not-found-actions">
        <button
          className="primary-button"
          onClick={() => onNavigate(routes.home)}
          type="button"
        >
          Go home
        </button>
        <button
          className="secondary-button"
          onClick={() => onNavigate(routes.sampleGame)}
          type="button"
        >
          Open the sample game
        </button>
      </div>
    </section>
  );
}
