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
        const hero = element.querySelector<HTMLElement>(".home-hero");
        if (hero) {
          const heroIntro = hero.querySelectorAll<HTMLElement>("[data-hero-reveal]");
          const city = hero.querySelector<HTMLElement>("[data-city-parallax]");
          const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
          intro
            .fromTo(
              heroIntro,
              { autoAlpha: 0, y: 26 },
              {
                autoAlpha: 1,
                y: 0,
                duration: 0.72,
                stagger: 0.065,
                clearProps: "opacity,visibility,transform",
              },
            )
            .fromTo(
              city?.querySelector("img") ?? [],
              { scale: 1.08 },
              { scale: 1, duration: 1.15, ease: "power2.out", clearProps: "transform" },
              0.08,
            );
        }
        const sections = element.querySelectorAll<HTMLElement>("[data-story-section]");
        sections.forEach((section) => {
          const targets = Array.from(
            section.querySelectorAll<HTMLElement>("[data-story-reveal]"),
          ).filter((target) => !target.closest("details"));
          if (targets.length === 0) return;
          gsap.fromTo(
            targets,
            { autoAlpha: 0, y: 28 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.68,
              stagger: 0.055,
              ease: "power3.out",
              clearProps: "opacity,visibility,transform",
              scrollTrigger: { trigger: section, start: "top 88%", once: true },
            },
          );
        });
        if (context.conditions?.desktop) {
          const city = element.querySelector<HTMLElement>("[data-city-parallax]");
          if (city) {
            const cityImage = city.querySelector("img");
            if (cityImage) {
              gsap.to(cityImage, {
                yPercent: -7,
                scale: 1.035,
                ease: "none",
                scrollTrigger: {
                  trigger: city,
                  start: "top bottom-=120",
                  end: "bottom top",
                  scrub: 0.8,
                },
              });
            }
          }
          element.querySelectorAll<HTMLElement>(".home-section").forEach((section, index) => {
            if (index % 2 === 0 || section.closest("details")) return;
            gsap.fromTo(
              section,
              { y: 18 },
              {
                y: -12,
                ease: "none",
                scrollTrigger: {
                  trigger: section,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: 1.1,
                },
              },
            );
          });
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
