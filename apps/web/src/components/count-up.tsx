"use client";

import { gsap } from "gsap";
import { useEffect, useRef } from "react";

const MOTION_OK = "(prefers-reduced-motion: no-preference)";

/**
 * Conta de zero até o valor quando a página abre. O texto final já vem pronto
 * do servidor: sem JavaScript, ou com movimento reduzido, ele simplesmente aparece.
 * `decimals` é o número de casas mostradas durante a contagem.
 */
export function CountUp({
  value,
  decimals = 0,
  children,
}: {
  value: number;
  decimals?: number;
  /** O texto final, exatamente como deve ficar. */
  children: string;
}) {
  const element = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const target = element.current;
    if (!target) return;

    const media = gsap.matchMedia();
    media.add(MOTION_OK, () => {
      const counter = { current: 0 };
      const format = (amount: number): string =>
        amount.toLocaleString("pt-BR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      const tween = gsap.to(counter, {
        current: value,
        duration: 1.4,
        ease: "power3.out",
        onUpdate: () => {
          target.textContent = format(counter.current);
        },
        onComplete: () => {
          target.textContent = children;
        },
      });
      return () => {
        tween.kill();
        target.textContent = children;
      };
    });
    return () => media.revert();
  }, [value, decimals, children]);

  return (
    <span ref={element} className="tabular-nums">
      {children}
    </span>
  );
}
