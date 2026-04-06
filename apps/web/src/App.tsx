import type { ReactNode } from "react";
import { LandingPage } from "./pages/LandingPage";
import { GameRoutePage } from "./pages/GameRoutePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { matchGamePath, routes } from "./routes";
import { usePathnameNavigation } from "./usePathnameNavigation";

/** Resolves the pathname to the page component that should be rendered. */
function getPageContent(pathname: string, navigate: (path: string) => void): ReactNode {
  if (pathname === routes.home) {
    return <LandingPage onNavigate={navigate} />;
  }

  const matchedGame = matchGamePath(pathname);

  if (!matchedGame) {
    return <NotFoundPage onNavigate={navigate} />;
  }

  return <GameRoutePage key={matchedGame.slug} onNavigate={navigate} slug={matchedGame.slug} />;
}

/** Root application shell for the web prototype. */
function App() {
  const { pathname, navigate } = usePathnameNavigation();
  const content = getPageContent(pathname, navigate);

  return (
    <main className="site-shell">
      <section className="backdrop" aria-hidden="true" />
      {content}
    </main>
  );
}

export default App;
