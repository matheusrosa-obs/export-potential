"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UF_OPTIONS, getUfLabel, useUfFilter } from "@/lib/uf-filter";

export default function UfSidebarFilter() {
  const { selectedUf, setSelectedUf } = useUfFilter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const options = useMemo(
    () =>
      UF_OPTIONS.map((option) => ({
        code: option.code,
        label: `${option.code} – ${option.label}`,
        name: option.label,
      })),
    []
  );

  useEffect(() => {
    if (!selectedUf) {
      setQuery("");
      return;
    }
    const found = options.find((opt) => opt.code === selectedUf);
    if (found) {
      setQuery(found.label);
    }
  }, [selectedUf, options]);

  const filtered = useMemo(() => {
    if (query.length === 0) return options;
    const needle = query.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(needle));
  }, [options, query]);

  function selectOption(code: string) {
    setSelectedUf(code);
    setOpen(false);
  }

  function clearSelection() {
    setSelectedUf(null);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    setHighlighted(0);
    setOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectOption(filtered[highlighted].code);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[highlighted] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  return (
    <aside className="rounded-3xl border border-zinc-800 bg-zinc-950/70 p-4 shadow-2xl shadow-black/20 backdrop-blur">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
          Filtro territorial
        </p>
        <h3 className="mt-2 text-lg font-semibold text-zinc-100">
          Selecione a UF
        </h3>
        <p className="mt-2 text-sm text-zinc-400">
          A seleção atual é <span className="text-zinc-100">{getUfLabel(selectedUf)}</span>.
          Os painéis de Visão geral, Produtos e Mercados se atualizam com essa escolha.
        </p>
      </div>
      <div className="relative w-full">
        <div className="relative flex items-center">
          <svg
            className="absolute left-3 text-zinc-500 pointer-events-none"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.currentTarget.select()}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Selecionar UF…"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900/70 py-2.5 pl-9 pr-10 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-colors"
          />

          {query.length > 0 && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                clearSelection();
              }}
              className="absolute right-3 text-zinc-500 hover:text-zinc-200 transition-colors"
              aria-label="Limpar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {open && filtered.length > 0 && (
          <ul
            ref={listRef}
            className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl"
          >
            {filtered.map((opt, i) => (
              <li
                key={opt.code}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectOption(opt.code);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                  i === highlighted
                    ? "bg-blue-600/20 text-zinc-100"
                    : "text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                <span className="inline-flex items-center justify-center h-4 w-4 rounded border border-zinc-600">
                  {selectedUf === opt.code && (
                    <span className="h-2.5 w-2.5 rounded-sm bg-blue-400" />
                  )}
                </span>
                <span className="font-mono text-blue-400 shrink-0">{opt.code}</span>
                <span className="text-zinc-500">–</span>
                <span className="truncate">{opt.name}</span>
              </li>
            ))}
          </ul>
        )}

        {open && filtered.length === 0 && query.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-500 shadow-xl">
            Nenhuma UF encontrada.
          </div>
        )}
      </div>
    </aside>
  );
}