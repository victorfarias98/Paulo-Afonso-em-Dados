"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ReactNode, useEffect, useRef } from "react";

/** Server-rendered content stays readable; scrolling only adds visual emphasis. */
export function HomeScroll({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        desktop: "(min-width: 1024px)",
      },
      (context) => {
        if (!context.conditions?.motion) return;
        const targets = element.querySelectorAll<HTMLElement>("[data-story-reveal]");
        targets.forEach((target) => {
          if (target.closest("details")) return;
          gsap.fromTo(
            target,
            { y: 18 },
            {
              y: 0,
              duration: 0.65,
              ease: "power2.out",
              clearProps: "transform",
              scrollTrigger: { trigger: target, start: "top 92%", once: true },
            },
          );
        });
        if (context.conditions?.desktop) {
          const city = element.querySelector("[data-city-parallax]");
          if (city) {
            gsap.to(city, {
              y: -24,
              ease: "none",
              scrollTrigger: {
                trigger: city,
                start: "top top+=160",
                end: "bottom top",
                scrub: 0.6,
              },
            });
          }
        }
        gsap.fromTo(
          element.querySelector("[data-reading-progress]"),
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: element,
              start: "top top",
              end: "bottom bottom",
              scrub: true,
            },
          },
        );
        // Keyboard navigation should show the destination at its final position immediately.
        const showFocused = (event: FocusEvent) => {
          if (!(event.target instanceof HTMLElement)) return;
          const target = event.target.closest<HTMLElement>("[data-story-reveal]");
          if (target) {
            gsap.killTweensOf(target);
            gsap.set(target, { clearProps: "transform,opacity" });
          }
        };
        let refreshFrame = 0;
        const refreshLayout = () => {
          cancelAnimationFrame(refreshFrame);
          refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
        };
        const resizeObserver = new ResizeObserver(refreshLayout);
        resizeObserver.observe(element);
        const disclosures = element.querySelectorAll("details");
        disclosures.forEach((details) => details.addEventListener("toggle", refreshLayout));
        element.addEventListener("focusin", showFocused);
        return () => {
          element.removeEventListener("focusin", showFocused);
          resizeObserver.disconnect();
          cancelAnimationFrame(refreshFrame);
          disclosures.forEach((details) => details.removeEventListener("toggle", refreshLayout));
        };
      },
      element,
    );
    return () => media.revert();
  }, []);

  return (
    <div ref={root} className="home-story">
      <div data-reading-progress className="home-reading-progress" aria-hidden="true" />
      {children}
    </div>
  );
}
