"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { applyUfFilter, useSelectedUf } from "@/lib/uf-filter";

type ProductOption = {
  sh6: string;
  description: string;
  label: string;
};

type Props = {
  importer: string | null;
  selectedSH6: string | null;
  onSelect: (sh6: string | null) => void;
};

export default function MarketProductSearch({ importer, selectedSH6, onSelect }: Props) {
  const selectedUf = useSelectedUf();
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [selected, setSelected] = useState<ProductOption | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Ref so the effect always calls the latest onSelect without it being a dep
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!importer) {
      setOptions([]);
      setSelected(null);
      setQuery("");
      setOpen(false);
      onSelectRef.current(null);
      return;
    }

    setOptions([]);
    setSelected(null);
    setQuery("");
    setOpen(false);
    onSelectRef.current(null);

    const params = new URLSearchParams({
      columns: "sh6,product_description_br",
      limit: "5000",
      "filter[importer]": importer,
    });
    applyUfFilter(params, selectedUf);

    fetch(`/api/data/epi_monetary_ufs?${params.toString()}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error ?? `Erro HTTP ${res.status}`);
        }
        return json;
      })
      .then((json) => {
        const rows = json.rows as { sh6: string; product_description_br: string }[];
        const seen = new Set<string>();
        const opts: ProductOption[] = [];

        for (const row of rows) {
          if (seen.has(row.sh6)) continue;
          seen.add(row.sh6);
          opts.push({
            sh6: row.sh6,
            description: row.product_description_br,
            label: `${row.sh6} – ${row.product_description_br}`,
          });
        }

        setOptions(opts);
      })
      .catch(() => {
        setOptions([]);
      });
  }, [importer, selectedUf]);

  useEffect(() => {
    if (!selectedSH6) {
      setSelected(null);
      setQuery("");
      return;
    }

    const found = options.find((o) => o.sh6 === selectedSH6);
    if (found) {
      setSelected(found);
      setQuery(found.label);
      return;
    }

    setSelected({ sh6: selectedSH6, description: "", label: selectedSH6 });
    setQuery(selectedSH6);
  }, [selectedSH6, options]);

  const filtered = useMemo(() => {
    if (query.length === 0) return [];
    return options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  }, [options, query]);

  function selectOption(opt: ProductOption) {
    setSelected(opt);
    setQuery(opt.label);
    setOpen(false);
    onSelect(opt.sh6);
  }

  function clearSelection() {
    setSelected(null);
    setQuery("");
    setOpen(false);
    onSelect(null);
    inputRef.current?.focus();
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setQuery(value);
    setSelected(null);
    setHighlighted(0);
    setOpen(value.length > 0);
    if (value.length === 0) onSelect(null);
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
      selectOption(filtered[highlighted]);
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
    <div className="relative w-full max-w-2xl">
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
          disabled={!importer}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.currentTarget.select()}
          onFocus={() => query.length > 0 && !selected && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={
            importer
              ? "Filtrar por SH6 ou descrição do produto…"
              : "Selecione um país para habilitar o filtro SH6…"
          }
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/70 py-2.5 pl-9 pr-10 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        />

        {query.length > 0 && importer && (
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
          {filtered.slice(0, 100).map((opt, i) => (
            <li
              key={opt.sh6}
              onMouseDown={(e) => {
                e.preventDefault();
                selectOption(opt);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-baseline gap-2 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                i === highlighted
                  ? "bg-blue-600/20 text-zinc-100"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <span className="font-mono text-blue-400 shrink-0">{opt.sh6}</span>
              <span className="text-zinc-400">–</span>
              <span className="truncate">{opt.description}</span>
            </li>
          ))}
          {filtered.length > 100 && (
            <li className="px-4 py-2 text-xs text-zinc-500 italic border-t border-zinc-800">
              {filtered.length - 100} resultados adicionais — refine a busca.
            </li>
          )}
        </ul>
      )}

      {open && filtered.length === 0 && query.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-500 shadow-xl">
          Nenhum produto encontrado para o país selecionado.
        </div>
      )}
    </div>
  );
}
