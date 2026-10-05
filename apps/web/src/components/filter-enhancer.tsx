"use client";

import { useEffect, useRef } from "react";

const DESKTOP = "(min-width: 1024px)";

/**
 * Melhora o formulário de filtros quando há JavaScript: escolher uma opção já
 * aplica o filtro, sem precisar tocar em "Aplicar". Sem JavaScript o formulário
 * continua funcionando pelo botão.
 */
export function FilterEnhancer() {
  const anchor = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form) return;

    // Navegadores sem ::details-content: abre o painel em telas largas.
    const panel = form.querySelector("details");
    if (panel && window.matchMedia(DESKTOP).matches) panel.open = true;

    const submitOnChange = (event: Event): void => {
      if (event.target instanceof HTMLSelectElement) form.requestSubmit();
    };
    form.addEventListener("change", submitOnChange);
    return () => form.removeEventListener("change", submitOnChange);
  }, []);

  return <span ref={anchor} hidden />;
}
