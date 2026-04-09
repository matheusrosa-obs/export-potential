"use client";

import { useEffect, useRef, useState } from "react";
import { getCountryName } from "@/lib/country-names-pt";

type CountryOption = {
  iso3: string;
  label: string;
};

type Props = {
  onSelect: (iso3: string | null) => void;
  defaultISO3?: string;
};

export default function CountrySearch({ onSelect, defaultISO3 }: Props) {
  const [options, setOptions] = useState<CountryOption[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [selected, setSelected] = useState<CountryOption | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    fetch(
      "/api/data/epi_monetary_sc_country?columns=importer&limit=5000&sortBy=importer&sortDirection=asc"
    )
      .then((res) => res.json())
      .then((json) => {
        const rows = json.rows as { importer: string }[];
        const seen = new Set<string>();
        const opts: CountryOption[] = [];
        for (const row of rows) {
          if (!seen.has(row.importer)) {
            seen.add(row.importer);
            const name = getCountryName(row.importer);
            opts.push({ iso3: row.importer, label: `${row.importer} – ${name}` });
          }
        }
        // Sort by country name in Portuguese
        opts.sort((a, b) => getCountryName(a.iso3).localeCompare(getCountryName(b.iso3), "pt"));
        setOptions(opts);

        if (defaultISO3) {
          const def = opts.find((o) => o.iso3 === defaultISO3);
          if (def) {
            setSelected(def);
            setQuery(def.label);
            onSelect(def.iso3);
          }
        }
      })
      .catch(() => {});
  }, []);

  const filtered =
    query.length === 0
      ? []
      : options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase())
        );

  function selectOption(opt: CountryOption) {
    setSelected(opt);
    setQuery(opt.label);
    setOpen(false);
    onSelect(opt.iso3);
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
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.currentTarget.select()}
          onFocus={() => query.length > 0 && !selected && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Filtrar por código ISO ou nome do país…"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-900/70 py-2.5 pl-9 pr-10 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-colors"
        />

        {query.length > 0 && (
          <button
            onMouseDown={(e) => { e.preventDefault(); clearSelection(); }}
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
              key={opt.iso3}
              onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-baseline gap-2 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                i === highlighted
                  ? "bg-blue-600/20 text-zinc-100"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <span className="font-mono text-blue-400 shrink-0">{opt.iso3}</span>
              <span className="text-zinc-400">–</span>
              <span className="truncate">{getCountryName(opt.iso3)}</span>
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
          Nenhum país encontrado.
        </div>
      )}
    </div>
  );
}
