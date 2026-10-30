import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Coluna some em telas estreitas (< 768 px). */
    esconderNoCelular?: boolean;
    numerica?: boolean;
  }
}

interface Props<T> {
  dados: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  colunas: ColumnDef<T, any>[];
  legenda: string;
  getRowId?: (linha: T) => string;
  aoClicar?: (linha: T) => void;
  rotuloLinha?: (linha: T) => string;
  selecionada?: string | null;
  busca?: boolean;
  ordenacaoInicial?: SortingState;
  vazio?: string;
}

export function DataTable<T>({
  dados,
  colunas,
  legenda,
  getRowId,
  aoClicar,
  rotuloLinha,
  selecionada,
  busca = false,
  ordenacaoInicial = [],
  vazio = 'Nenhum registro.',
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>(ordenacaoInicial);
  const [filtro, setFiltro] = useState('');
  const tabela = useReactTable({
    data: dados,
    columns: colunas,
    state: { sorting, globalFilter: filtro },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFiltro,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const teclaLinha = (e: KeyboardEvent, linha: T) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      aoClicar?.(linha);
    }
  };

  const linhas = tabela.getRowModel().rows;

  return (
    <div>
      {busca && (
        <div className="relative mb-3 max-w-xs">
          <Search
            size={14}
            aria-hidden
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar"
            aria-label={`Buscar em ${legenda}`}
            className="h-8 w-full rounded border border-border bg-surface pl-8 pr-2 text-sm text-text placeholder:text-muted"
          />
        </div>
      )}
      <div className="-mx-5 overflow-x-auto md:-mx-6">
        <table className="w-full text-sm">
          <caption className="sr-only">{legenda}</caption>
          <thead>
            {tabela.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-surface-2">
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta;
                  const ord = h.column.getIsSorted();
                  const podeOrdenar = h.column.getCanSort();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={
                        ord === 'asc' ? 'ascending' : ord === 'desc' ? 'descending' : undefined
                      }
                      className={`whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-muted first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6 ${
                        meta?.numerica ? 'text-right' : 'text-left'
                      } ${meta?.esconderNoCelular ? 'hidden md:table-cell' : ''}`}
                    >
                      {podeOrdenar ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={`inline-flex items-center gap-1 hover:text-text ${meta?.numerica ? 'flex-row-reverse' : ''}`}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {ord === 'asc' ? (
                            <ArrowUp size={12} aria-hidden />
                          ) : ord === 'desc' ? (
                            <ArrowDown size={12} aria-hidden />
                          ) : (
                            <ChevronsUpDown size={12} aria-hidden className="opacity-50" />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={colunas.length} className="py-6 text-center text-sm text-muted">
                  {vazio}
                </td>
              </tr>
            )}
            {linhas.map((row) => {
              const sel = selecionada != null && row.id === selecionada;
              const clicavel = !!aoClicar;
              return (
                <tr
                  key={row.id}
                  tabIndex={clicavel ? 0 : undefined}
                  aria-selected={clicavel ? sel : undefined}
                  aria-label={clicavel && rotuloLinha ? rotuloLinha(row.original) : undefined}
                  onClick={clicavel ? () => aoClicar(row.original) : undefined}
                  onKeyDown={clicavel ? (e) => teclaLinha(e, row.original) : undefined}
                  className={`border-b border-border last:border-0 ${clicavel ? 'cursor-pointer hover:bg-surface-2' : ''} ${
                    sel ? 'bg-surface-2' : ''
                  }`}
                >
                  {row.getVisibleCells().map((c) => {
                    const meta = c.column.columnDef.meta;
                    return (
                      <td
                        key={c.id}
                        className={`px-3 py-3 align-middle first:pl-5 last:pr-5 md:first:pl-6 md:last:pr-6 ${
                          meta?.numerica ? 'tabular whitespace-nowrap text-right' : ''
                        } ${meta?.esconderNoCelular ? 'hidden md:table-cell' : ''}`}
                      >
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
