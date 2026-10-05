"use client";

import { gsap } from "gsap";
import { type ReactNode, useEffect, useRef } from "react";

const MOTION_OK = "(prefers-reduced-motion: no-preference)";

/**
 * Faz as barras dos gráficos crescerem quando entram na tela, uma única vez.
 * Elementos com `data-grow="x"` crescem da esquerda; com `data-grow="y"`, de
 * baixo. Sem JavaScript, ou com movimento reduzido, já aparecem no tamanho final.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;

    const media = gsap.matchMedia();
    media.add(MOTION_OK, () => {
      const groups = gsap.utils.toArray<HTMLElement>("[data-grow-group]", element);
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer.unobserve(entry.target);
            const bars = entry.target.querySelectorAll<HTMLElement>("[data-grow]");
            gsap.to(bars, {
              scaleX: 1,
              scaleY: 1,
              duration: 0.9,
              ease: "expo.out",
              stagger: 0.06,
              clearProps: "transform",
            });
          }
        },
        { threshold: 0.35 },
      );

      const collapse = (group: HTMLElement, axis: "x" | "y"): void => {
        const bars = group.querySelectorAll<HTMLElement>(`[data-grow="${axis}"]`);
        if (bars.length === 0) return;
        gsap.set(
          bars,
          axis === "x"
            ? { scaleX: 0, transformOrigin: "left center" }
            : { scaleY: 0, transformOrigin: "center bottom" },
        );
      };
      for (const group of groups) {
        collapse(group, "x");
        collapse(group, "y");
        observer.observe(group);
      }
      return () => {
        observer.disconnect();
        const bars = element.querySelectorAll<HTMLElement>("[data-grow]");
        gsap.killTweensOf(bars);
        gsap.set(bars, { clearProps: "transform,transformOrigin" });
      };
    });
    return () => media.revert();
  }, []);

  return (
    <div ref={root} className={className}>
      {children}
    </div>
  );
}
