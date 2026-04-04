import { useEffect, useState } from "react";
import { normalizePathname } from "./routes";

export function usePathnameNavigation() {
  const [pathname, setPathname] = useState(() =>
    normalizePathname(window.location.pathname),
  );

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePathname(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const navigate = (path: string) => {
    const nextPath = normalizePathname(path);

    if (nextPath !== pathname) {
      window.history.pushState({}, "", nextPath);
      setPathname(nextPath);
    }

    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return {
    pathname,
    navigate,
  };
}
