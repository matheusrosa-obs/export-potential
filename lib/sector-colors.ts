const SECTOR_COLOR_MAP: Record<string, string> = {
  "Alimentos e Bebidas": "#6BBE50",
  "Agropecuária": "#1FBDE1",
  "Papel e Celulose": "#CCD274",
  "Construção": "#5F72A1",
  "Equipamentos Elétricos": "#E4863B",
  "Fármacos": "#05B5A0",
  "Fumo": "#5A4A42",
  "Automotivo": "#3A6C9E",
  "Cerâmico": "#AC6142",
  "Indústria Diversa": "#3A814B",
  "Extrativo": "#46606C",
  "Indústria Gráfica": "#EC008C",
  "Madeira e Móveis": "#8A6138",
  "Máquinas e Equipamentos": "#E4863B",
  "Metalmecânica e Metalurgia": "#266563",
  "Óleo, Gás e Eletricidade": "#FBA81A",
  "Produtos Químicos e Plásticos": "#0B416C",
  "Saneamento Básico": "#2BB673",
  "Produção Florestal": "#024814",
  "Tecnologia da Informação e Comunicação": "#4B828B",
  "Têxtil, Confecção, Couro e Calçados": "#F05534",
};

const FALLBACK_COLOR = "#71717a";

export function buildSectorColorMap(sectors: string[]): Record<string, string> {
  return Object.fromEntries(
    sectors.map((s) => [s, SECTOR_COLOR_MAP[s] ?? FALLBACK_COLOR])
  );
}
