import { useEffect, useRef, useState } from 'react';

/**
 * Плавный счётчик: анимирует число от 0 (или from) до target.
 * Возвращает текущее значение для отрисовки.
 */
export function useCountUp(target: number, duration = 900, from = 0): number {
  const [value, setValue] = useState(from);
  const rafRef = useRef<number>();
  const startRef = useRef<number>();

  useEffect(() => {
    if (typeof window === 'undefined') {
      setValue(target);
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValue(target);
      return;
    }

    const startValue = from;
    const delta = target - startValue;
    startRef.current = undefined;

    const tick = (t: number) => {
      if (startRef.current === undefined) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / duration);
      // easeOutExpo
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setValue(startValue + delta * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setValue(target);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return value;
}

/**
 * Появление при попадании элемента в область видимости.
 * Возвращает ref и флаг visible.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: { threshold?: number; once?: boolean } = {}
): [React.RefObject<T>, boolean] {
  const { threshold = 0.15, once = true } = options;
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) obs.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once]);

  return [ref, visible];
}
