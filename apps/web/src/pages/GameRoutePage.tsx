import { type ReactNode, useEffect, useState } from "react";
import { featuredGameSlug, type GameConfig } from "../data/games";
import { loadPublishedGameBySlug } from "../lib/gameContentApi";
import { GamePage } from "./GamePage";
import { routes } from "../routes";

type GameRoutePageProps = {
  onNavigate: (path: string) => void;
  slug: string;
};

type GameRouteState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { game: GameConfig; status: "ready" }
  | { message: string; status: "error" };

function RouteStateShell(
  {
    title,
    body,
    actions,
    chip,
    onNavigateHome,
  }: {
    actions: ReactNode;
    body: string;
    chip: string;
    onNavigateHome: () => void;
    title: string;
  },
) {
  return (
    <section className="game-layout">
      <nav className="sample-nav">
        <button
          className="text-link"
          onClick={onNavigateHome}
          type="button"
        >
          Back to demo overview
        </button>
      </nav>

      <section className="app-card">
        <header className="topbar">
          <div>
            <p className="eyebrow">Published event route</p>
            <h1>{title}</h1>
          </div>
        </header>
        <section className="panel">
          <span className="chip">{chip}</span>
          <p>{body}</p>
          <div className="not-found-actions">{actions}</div>
        </section>
      </section>
    </section>
  );
}

/** Resolves a route slug into published content before rendering the game shell. */
export function GameRoutePage({ onNavigate, slug }: GameRoutePageProps) {
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<GameRouteState>({ status: "loading" });

  const retryLoadingGame = () => {
    setState({ status: "loading" });
    setReloadToken((value) => value + 1);
  };

  useEffect(() => {
    let isCancelled = false;

    void loadPublishedGameBySlug(slug)
      .then((game) => {
        if (isCancelled) {
          return;
        }

        if (!game) {
          setState({ status: "unavailable" });
          return;
        }

        setState({
          game,
          status: "ready",
        });
      })
      .catch((error: unknown) => {
        if (!isCancelled) {
          setState({
            message:
              error instanceof Error
                ? error.message
                : "We couldn't load this game event right now.",
            status: "error",
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [reloadToken, slug]);

  if (state.status === "ready") {
    return <GamePage game={state.game} key={state.game.id} onNavigate={onNavigate} />;
  }

  if (state.status === "loading") {
    return (
      <RouteStateShell
        actions={
          <button className="secondary-button" disabled type="button">
            Loading event...
          </button>
        }
        body="Loading the published event content for this route."
        chip="Loading event"
        onNavigateHome={() => onNavigate(routes.home)}
        title="Preparing game"
      />
    );
  }

  if (state.status === "unavailable") {
    return (
      <RouteStateShell
        actions={
          <button
            className="primary-button"
            onClick={() => onNavigate(routes.home)}
            type="button"
          >
            Go to demo overview
          </button>
        }
        body="This event link isn't available right now."
        chip="Event unavailable"
        onNavigateHome={() => onNavigate(routes.home)}
        title="This game isn't available right now."
      />
    );
  }

  return (
    <RouteStateShell
      actions={
        <>
          <button
            className="primary-button"
            onClick={retryLoadingGame}
            type="button"
          >
            Retry loading game
          </button>
          {slug !== featuredGameSlug ? (
            <button
              className="secondary-button"
              onClick={() => onNavigate(routes.game(featuredGameSlug))}
              type="button"
            >
              Open attendee demo
            </button>
          ) : null}
        </>
      }
      body={state.message}
      chip="Load error"
      onNavigateHome={() => onNavigate(routes.home)}
      title="This game couldn't load right now."
    />
  );
}
