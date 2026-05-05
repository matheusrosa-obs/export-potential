"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type UfCode =
  | "AC"
  | "AL"
  | "AP"
  | "AM"
  | "BA"
  | "CE"
  | "DF"
  | "ES"
  | "GO"
  | "MA"
  | "MT"
  | "MS"
  | "MG"
  | "PA"
  | "PB"
  | "PR"
  | "PE"
  | "PI"
  | "RJ"
  | "RN"
  | "RS"
  | "RO"
  | "RR"
  | "SC"
  | "SP"
  | "SE"
  | "TO";

export type UfOption = {
  code: UfCode;
  label: string;
  region: string;
};

export const UF_OPTIONS: UfOption[] = [
  { code: "AC", label: "Acre", region: "Norte" },
  { code: "AL", label: "Alagoas", region: "Nordeste" },
  { code: "AP", label: "Amapá", region: "Norte" },
  { code: "AM", label: "Amazonas", region: "Norte" },
  { code: "BA", label: "Bahia", region: "Nordeste" },
  { code: "CE", label: "Ceará", region: "Nordeste" },
  { code: "DF", label: "Distrito Federal", region: "Centro-Oeste" },
  { code: "ES", label: "Espírito Santo", region: "Sudeste" },
  { code: "GO", label: "Goiás", region: "Centro-Oeste" },
  { code: "MA", label: "Maranhão", region: "Nordeste" },
  { code: "MT", label: "Mato Grosso", region: "Centro-Oeste" },
  { code: "MS", label: "Mato Grosso do Sul", region: "Centro-Oeste" },
  { code: "MG", label: "Minas Gerais", region: "Sudeste" },
  { code: "PA", label: "Pará", region: "Norte" },
  { code: "PB", label: "Paraíba", region: "Nordeste" },
  { code: "PR", label: "Paraná", region: "Sul" },
  { code: "PE", label: "Pernambuco", region: "Nordeste" },
  { code: "PI", label: "Piauí", region: "Nordeste" },
  { code: "RJ", label: "Rio de Janeiro", region: "Sudeste" },
  { code: "RN", label: "Rio Grande do Norte", region: "Nordeste" },
  { code: "RS", label: "Rio Grande do Sul", region: "Sul" },
  { code: "RO", label: "Rondônia", region: "Norte" },
  { code: "RR", label: "Roraima", region: "Norte" },
  { code: "SC", label: "Santa Catarina", region: "Sul" },
  { code: "SP", label: "São Paulo", region: "Sudeste" },
  { code: "SE", label: "Sergipe", region: "Nordeste" },
  { code: "TO", label: "Tocantins", region: "Norte" },
];

export function getUfLabel(uf: string | null | undefined): string {
  if (!uf) return "Selecione uma UF";

  const normalized = uf.trim().toUpperCase();
  const option = UF_OPTIONS.find((item) => item.code === normalized);
  return option ? `${option.code} - ${option.label}` : normalized;
}

export function applyUfFilter(params: URLSearchParams, uf: string | null): void {
  if (uf) {
    params.set("filter[sg_uf]", uf);
  }
}

type UfFilterContextValue = {
  selectedUf: string | null;
  setSelectedUf: (uf: string | null) => void;
};

const UfFilterContext = createContext<UfFilterContextValue | null>(null);

export function UfFilterProvider({ children }: { children: ReactNode }) {
  const [selectedUf, setSelectedUf] = useState<string | null>("SC");

  const value = useMemo(
    () => ({ selectedUf, setSelectedUf }),
    [selectedUf]
  );

  return <UfFilterContext.Provider value={value}>{children}</UfFilterContext.Provider>;
}

export function useUfFilter(): UfFilterContextValue {
  const context = useContext(UfFilterContext);
  if (!context) {
    throw new Error("useUfFilter must be used within UfFilterProvider.");
  }
  return context;
}

export function useSelectedUf(): string | null {
  return useUfFilter().selectedUf;
}
