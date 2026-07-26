/**
 * Container-aware viewport hook. Returns the current width bucket so
 * surfaces can branch on real layout space rather than user-agent guesses.
 *
 *   <640   →  'xs'   single column
 *   <1024  →  'sm'   sidebar inline-collapses
 *   <1280  →  'md'   default desktop
 *   ≥1280  →  'lg'   widescreen
 */
import { useEffect, useState } from 'react';

export type ViewportBucket = 'xs' | 'sm' | 'md' | 'lg';

function bucketFor(w: number): ViewportBucket {
  if (w < 640)  return 'xs';
  if (w < 1024) return 'sm';
  if (w < 1280) return 'md';
  return 'lg';
}

export function useViewport(): { width: number; bucket: ViewportBucket; isCompact: boolean } {
  const [width, setWidth] = useState<number>(typeof window === 'undefined' ? 1280 : window.innerWidth);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setWidth(window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  const bucket = bucketFor(width);
  return { width, bucket, isCompact: bucket === 'xs' || bucket === 'sm' };
}
