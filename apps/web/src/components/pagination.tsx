import Link from "next/link";

type Props = {
  page: number;
  total: number;
  pageSize: number;
  /** Endereço de cada página, já com os filtros ativos. */
  hrefFor: (page: number) => string;
};

export function Pagination({ page, total, pageSize, hrefFor }: Props) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage === 1) return null;

  return (
    <nav aria-label="Páginas" className="mt-8 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className="link font-medium">
          Página anterior
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-suave">
        Página {page} de {lastPage}
      </p>
      {page < lastPage ? (
        <Link href={hrefFor(page + 1)} rel="next" className="link font-medium">
          Próxima página
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
