import { useEffect, useState } from "react";

export type Route = "home" | "map" | "ranking" | "mission" | "vision" | "method";
const ROUTES: Route[] = ["home", "map", "ranking", "mission", "vision", "method"];

function read(): { route: Route; param?: string } {
  const [r, param] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { route: ROUTES.includes(r as Route) ? (r as Route) : "home", param };
}

/** Tiny hash router: #/map, #/map/<tambon-id>, #/ranking … works on any static host. */
export function useRoute() {
  const [state, setState] = useState(read);
  useEffect(() => {
    const on = () => {
      setState(read());
      document.querySelector(".main")?.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return state;
}

export const href = (route: Route, param?: string) => `#/${route}${param ? `/${param}` : ""}`;
