// Paleta em harmonia com as cores de categoria do mapa:
//   Muito Alto #ff7171 · Alto #ffae00 · Médio-Alto #ffdf6f · Médio #54f394 · Baixo #85d7d4
const SECTOR_COLOR_MAP: Record<string, string> = {
  "Alimentos e Bebidas":                    "#7ee8a2", // laranja-quente
  "Agropecuária":                           "#ff8c42", // verde-claro
  "Papel e Celulose":                       "#c8e668", // amarelo-verde
  "Construção":                             "#7b8cde", // azul-índigo
  "Equipamentos Elétricos":                 "#ffd166", // âmbar
  "Fármacos":                               "#4ecdc4", // ciano-médio
  "Fumo":                                   "#9b8ea0", // cinza-lilás
  "Automotivo":                             "#4a9eff", // azul-médio
  "Cerâmico":                               "#e07b54", // terracota
  "Indústria Diversa":                      "#52d9a0", // verde-esmeralda
  "Extrativo":                              "#7da7b8", // azul-aço
  "Indústria Gráfica":                      "#ff6eb4", // rosa-quente
  "Madeira e Móveis":                       "#c49a6c", // marrom-quente
  "Máquinas e Equipamentos":                "#ff4f4f", // vermelho-vivo
  "Metalmecânica e Metalurgia":             "#45bcd8", // ciano-céu
  "Óleo, Gás e Eletricidade":               "#ffc233", // amarelo-dourado
  "Produtos Químicos e Plásticos":          "#a78bfa", // violeta-suave
  "Saneamento Básico":                      "#40d9b5", // verde-água
  "Produção Florestal":                     "#5cb85c", // verde-floresta
  "Tecnologia da Informação e Comunicação": "#c084fc", // lilás
  "Têxtil, Confecção, Couro e Calçados":    "#f9667a", // rosa-coral
};

const FALLBACK_COLOR = "#85d7d4";

const DEFAULT_TREEMAP_PALETTE = [
  ...new Set(Object.values(SECTOR_COLOR_MAP)),
  FALLBACK_COLOR,
];

type BuildCategoricalColorMapOptions = {
  overrides?: Record<string, string>;
  palette?: string[];
  fallbackColor?: string;
};

function normalizeKey(key: string): string {
  return key.trim();
}

function stableHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function buildCategoricalColorMap(
  keys: string[],
  options: BuildCategoricalColorMapOptions = {}
): Record<string, string> {
  const overrides = options.overrides ?? {};
  const palette =
    options.palette && options.palette.length > 0
      ? options.palette
      : DEFAULT_TREEMAP_PALETTE;
  const fallbackColor = options.fallbackColor ?? FALLBACK_COLOR;

  const uniqueKeys = Array.from(
    new Set(keys.map(normalizeKey).filter((key) => key.length > 0))
  ).sort((a, b) => a.localeCompare(b));

  const result: Record<string, string> = {};

  for (const key of uniqueKeys) {
    const overrideColor = overrides[key];
    if (overrideColor) {
      result[key] = overrideColor;
      continue;
    }

    if (palette.length === 0) {
      result[key] = fallbackColor;
      continue;
    }

    const colorIndex = stableHash(key) % palette.length;
    result[key] = palette[colorIndex] ?? fallbackColor;
  }

  return result;
}

export function buildSectorColorMap(sectors: string[]): Record<string, string> {
  return buildCategoricalColorMap(sectors, {
    overrides: SECTOR_COLOR_MAP,
    palette: DEFAULT_TREEMAP_PALETTE,
    fallbackColor: FALLBACK_COLOR,
  });
}
