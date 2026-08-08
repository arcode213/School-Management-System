import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query from React.
 *
 * The portal's layout is mostly decided in CSS, but a handful of decisions are
 * behavioural rather than visual — whether the sidebar is a drawer that closes
 * after you pick a screen, or a rail that stays put — and those have to be known
 * to the component, not just to the stylesheet.
 *
 * The initial value is read synchronously so the first paint is already correct;
 * rendering the desktop shell for one frame on a phone shows up as the sidebar
 * flashing across the screen on every load.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);

    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind's `lg` breakpoint — the width at which the sidebar stops being a drawer. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)');
