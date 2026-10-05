"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-prose">
      <h1 className="font-display text-3xl font-medium">Não foi possível carregar esta página</h1>
      <p className="mt-3 text-suave">
        Houve uma falha ao consultar nossa base de dados. As fontes oficiais não foram afetadas.
        Tente de novo em instantes.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-azul px-5 py-2.5 font-semibold text-fundo hover:bg-azul-forte"
      >
        Tentar novamente
      </button>
    </div>
  );
}
