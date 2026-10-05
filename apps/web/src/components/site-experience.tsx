"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const INTRO_KEY = "paulo-afonso-em-dados:intro-seen";

/** Smooth scroll and a short branded entrance, progressively enhanced after hydration. */
export function SiteExperience() {
  const pathname = usePathname();
  const intro = useRef<HTMLDivElement>(null);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({
      anchors: { offset: -84 },
      autoRaf: false,
      autoToggle: true,
      respectReducedMotion: true,
      stopInertiaOnNavigate: true,
    });
    const update = () => ScrollTrigger.update();
    const tick = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.refresh();
    return () => {
      lenis.off("scroll", update);
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.sessionStorage.getItem(INTRO_KEY)) return;
    window.sessionStorage.setItem(INTRO_KEY, "true");
    setShowIntro(true);
  }, []);

  useEffect(() => {
    const element = intro.current;
    if (!showIntro || !element) return;
    const timeline = gsap.timeline({ onComplete: () => setShowIntro(false) });
    timeline
      .fromTo(
        element.querySelector("[data-intro-mark]"),
        { autoAlpha: 0, scale: 0.72, rotate: -8 },
        { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.55, ease: "back.out(1.6)" },
      )
      .fromTo(
        element.querySelector("[data-intro-copy]"),
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.38, ease: "power3.out" },
        "-=0.25",
      )
      .to(element.querySelector("[data-intro-progress]"), {
        scaleX: 1,
        duration: 0.72,
        ease: "power2.inOut",
      })
      .to(element, { yPercent: -100, duration: 0.72, ease: "power4.inOut" }, "+=0.08");
    return () => {
      timeline.kill();
    };
  }, [showIntro]);

  useEffect(() => {
    ScrollTrigger.refresh();
  }, [pathname]);

  if (!showIntro) return null;
  return (
    <div ref={intro} className="site-intro" aria-hidden="true">
      <div className="site-intro-content">
        <Image
          data-intro-mark
          src="/brand/paulo-afonso-em-dados-mark.png"
          alt=""
          width={384}
          height={384}
          priority
        />
        <div data-intro-copy>
          <p>Paulo Afonso</p>
          <strong>em Dados</strong>
        </div>
      </div>
      <div className="site-intro-track">
        <span data-intro-progress />
      </div>
      <p className="site-intro-note">Organizando os dados da cidade</p>
    </div>
  );
}
