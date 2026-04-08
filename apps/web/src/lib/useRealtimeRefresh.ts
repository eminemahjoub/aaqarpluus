import * as React from "react";

/**
 * Returns a monotonically increasing number that bumps whenever
 * the tab regains focus or becomes visible. Used to trigger re-fetching.
 */
export function useRealtimeRefresh(_options?: { tables?: string[] }) {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const bump = () => setTick((t) => t + 1);

    const onFocus = () => bump();
    const onVisibility = () => {
      if (document.visibilityState === "visible") bump();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return tick;
}
