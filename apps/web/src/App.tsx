import { LandingPage } from "./pages/LandingPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SampleGamePage } from "./pages/SampleGamePage";
import { routes } from "./routes";
import { usePathnameNavigation } from "./usePathnameNavigation";

function App() {
  const { pathname, navigate } = usePathnameNavigation();

  let content;

  if (pathname === routes.home) {
    content = <LandingPage onNavigate={navigate} />;
  } else if (pathname === routes.sampleGame) {
    content = <SampleGamePage onNavigate={navigate} />;
  } else {
    content = <NotFoundPage onNavigate={navigate} />;
  }

  return (
    <main className="site-shell">
      <section className="backdrop" aria-hidden="true" />
      {content}
    </main>
  );
}

export default App;
