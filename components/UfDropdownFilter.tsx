"use client";

import { UF_OPTIONS, useUfFilter } from "@/lib/uf-filter";

export default function UfDropdownFilter() {
  const { selectedUf, setSelectedUf } = useUfFilter();

  return (
    <div className="flex items-center gap-2 shrink-0 self-start mt-1">
      <label htmlFor="uf-select" className="text-sm font-medium text-zinc-400 whitespace-nowrap">
        Selecione a UF:
      </label>
      <select
        id="uf-select"
        value={selectedUf ?? "SC"}
        onChange={(e) => setSelectedUf(e.target.value || null)}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-colors cursor-pointer"
      >
        {UF_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.code} – {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
