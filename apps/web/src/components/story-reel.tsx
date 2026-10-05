"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BuildingsIcon,
  DatabaseIcon,
  XIcon,
} from "@phosphor-icons/react";
import { gsap } from "gsap";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export interface StorySlide {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  metric: string;
  metricLabel: string;
  image?: string;
  imageAlt?: string;
  icon?: "update" | "organization";
  href: string;
  sourceLabel: string;
  sourceHref: string;
  tone: "blue" | "navy" | "aqua" | "sand";
}

const displayText = (value: string): string => value.replace(/\s*[–—]\s*/g, ", ");

export function StoryReel({ stories }: { stories: StorySlide[] }) {
  const [active, setActive] = useState<number | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const viewer = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const gesture = useRef({ x: 0, y: 0, active: false });
  const story = active === null ? null : stories[active];

  const closeStories = useCallback(() => {
    setActive(null);
    requestAnimationFrame(() => opener.current?.focus());
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (next === active) return;
      if (!stage.current) return setActive(next);
      gsap.to(stage.current, {
        autoAlpha: 0,
        x: next > (active ?? 0) ? -28 : 28,
        duration: 0.18,
        ease: "power2.in",
        onComplete: () => setActive(next),
      });
    },
    [active],
  );

  useEffect(() => {
    if (active === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeStories();
      if (event.key === "ArrowRight" && active < stories.length - 1) goTo(active + 1);
      if (event.key === "ArrowLeft" && active > 0) goTo(active - 1);
      if (event.key !== "Tab" || !viewer.current) return;
      const controls = viewer.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keydown);
    };
  }, [active, closeStories, goTo, stories.length]);

  useEffect(() => {
    if (active === null || !stage.current) return;
    gsap.fromTo(
      stage.current,
      { autoAlpha: 0, x: 28, scale: 0.985 },
      { autoAlpha: 1, x: 0, scale: 1, duration: 0.46, ease: "power3.out" },
    );
  }, [active]);

  if (stories.length === 0) return null;

  return (
    <section className="story-reel" aria-labelledby="stories-title">
      <div className="story-reel-heading">
        <div>
          <p className="story-kicker">P.A Stories</p>
          <h2 id="stories-title">Veja o que mudou em Paulo Afonso</h2>
        </div>
        <p>Abra um círculo para ver o número e a fonte.</p>
      </div>
      <ol className="story-bubbles" data-lenis-prevent-touch>
        {stories.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={(event) => {
                opener.current = event.currentTarget;
                setActive(index);
              }}
              aria-label={`Abrir: ${displayText(item.title)}`}
            >
              <span className={`story-bubble story-tone-${item.tone}`}>
                {item.image ? (
                  <Image src={item.image} alt="" width={96} height={96} />
                ) : item.icon === "organization" ? (
                  <BuildingsIcon size={28} aria-hidden="true" />
                ) : (
                  <DatabaseIcon size={28} aria-hidden="true" />
                )}
              </span>
              <strong>{displayText(item.title)}</strong>
            </button>
          </li>
        ))}
      </ol>

      {story && active !== null && (
        <div
          ref={viewer}
          className="story-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={displayText(story.title)}
        >
          <div
            className="story-progress"
            aria-label={`História ${active + 1} de ${stories.length}`}
          >
            {stories.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index <= active ? "is-seen" : ""}
                onClick={() => goTo(index)}
                aria-label={`Ir para história ${index + 1}`}
              />
            ))}
          </div>
          <button
            ref={closeButton}
            type="button"
            className="story-close"
            onClick={closeStories}
            aria-label="Fechar P.A Stories"
          >
            <XIcon size={24} aria-hidden="true" />
          </button>
          <div
            ref={stage}
            className={`story-stage story-tone-${story.tone}`}
            aria-live="polite"
            onPointerDown={(event) => {
              if ((event.target as HTMLElement).closest("a, button")) return;
              gesture.current = { x: event.clientX, y: event.clientY, active: true };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!gesture.current.active || !stage.current) return;
              const deltaX = event.clientX - gesture.current.x;
              const deltaY = event.clientY - gesture.current.y;
              if (Math.abs(deltaX) <= Math.abs(deltaY)) return;
              gsap.set(stage.current, { x: deltaX * 0.22 });
            }}
            onPointerUp={(event) => {
              if (!gesture.current.active) return;
              const deltaX = event.clientX - gesture.current.x;
              const deltaY = event.clientY - gesture.current.y;
              gesture.current.active = false;
              if (Math.abs(deltaX) > 52 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
                if (deltaX < 0 && active < stories.length - 1) return goTo(active + 1);
                if (deltaX > 0 && active > 0) return goTo(active - 1);
              }
              gsap.to(stage.current, { x: 0, duration: 0.25, ease: "power3.out" });
            }}
            onPointerCancel={() => {
              gesture.current.active = false;
              gsap.to(stage.current, { x: 0, duration: 0.25, ease: "power3.out" });
            }}
          >
            <div className="story-stage-visual">
              {story.image ? (
                <Image
                  src={story.image}
                  alt={story.imageAlt ?? ""}
                  fill
                  sizes="(max-width: 639px) 100vw, 30rem"
                  priority
                />
              ) : (
                <div className="story-stage-icon" aria-hidden="true">
                  {story.icon === "organization" ? (
                    <BuildingsIcon size={72} />
                  ) : (
                    <DatabaseIcon size={72} />
                  )}
                </div>
              )}
            </div>
            <div className="story-stage-copy" data-lenis-prevent>
              <p className="story-eyebrow">{displayText(story.eyebrow)}</p>
              <h3>{displayText(story.title)}</h3>
              <p className="story-summary">{displayText(story.summary)}</p>
              <div className="story-metric">
                <strong>{story.metric}</strong>
                <span>{displayText(story.metricLabel)}</span>
              </div>
              <div className="story-audit">
                <span>De onde veio</span>
                <Link href={story.sourceHref}>{displayText(story.sourceLabel)}</Link>
              </div>
              <Link href={story.href} className="story-open-link">
                Ver registros <ArrowRightIcon size={20} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="story-controls">
            <button
              type="button"
              onClick={() => goTo(active - 1)}
              disabled={active === 0}
              aria-label="História anterior"
            >
              <ArrowLeftIcon size={24} aria-hidden="true" />
            </button>
            <span className="story-position">
              <span>
                {active + 1} / {stories.length}
              </span>
              <small>Arraste para o lado</small>
            </span>
            <button
              type="button"
              onClick={() => goTo(active + 1)}
              disabled={active === stories.length - 1}
              aria-label="Próxima história"
            >
              <ArrowRightIcon size={24} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
