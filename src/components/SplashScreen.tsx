// 스플래시: Lottie 순차 재생 후 .splash.hide 전환, onDone 콜백.
import { useState, useRef, useEffect } from 'react';
import { SPLASH_ITEMS } from '../config.js';

const SPLASH_SHOWN_KEY = 'splashShown';

export function SplashScreen({ onDone }: { onDone?: () => void }) {
  const [index, setIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<{ destroy(): void } | null>(null);

  const items = SPLASH_ITEMS;
  const isComplete = index >= items.length;

  useEffect(() => {
    if (isComplete || !items.length) return;
    const item = items[index];
    const container = containerRef.current;
    if (!container) return;
    if (typeof window.lottie !== 'undefined') {
      try {
        animRef.current = window.lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop: false,
          autoplay: true,
          path: item.path,
        });
      } catch (_) {}
    }
    const t = setTimeout(() => setIndex((i) => i + 1), item.duration ?? 1000);
    return () => {
      clearTimeout(t);
      if (animRef.current) {
        try {
          animRef.current.destroy();
        } catch (_) {}
        animRef.current = null;
      }
    };
  }, [index, isComplete, items]);

  useEffect(() => {
    if (!isComplete || !items.length) return;
    try {
      sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');
    } catch (_) {}
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      onDone?.();
      return;
    }
    wrapper.classList.add('opacity-0', 'pointer-events-none');
    const handleTransitionEnd = () => onDone?.();
    wrapper.addEventListener('transitionend', handleTransitionEnd, { once: true });
    return () => wrapper.removeEventListener('transitionend', handleTransitionEnd);
  }, [isComplete, items.length, onDone]);

  useEffect(() => {
    if (!items.length) onDone?.();
  }, [items.length, onDone]);

  if (!items.length) return null;

  return (
    <div
      ref={wrapperRef}
      className="fixed inset-0 z-[9999] bg-white transition-opacity duration-[250ms] ease-out"
      aria-hidden="true"
    >
      <div className="absolute inset-0 h-full w-full">
        {!isComplete && (
          <div className="absolute inset-0 flex h-full w-full items-center justify-center">
            <div
              ref={containerRef}
              className="flex h-full w-full min-h-0 min-w-0 items-center justify-center"
            />
          </div>
        )}
      </div>
    </div>
  );
}
