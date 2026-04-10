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
  "Máquinas e Equipamentos":               "#ff4f4f", // vermelho-vivo
  "Metalmecânica e Metalurgia":            "#45bcd8", // ciano-céu
  "Óleo, Gás e Eletricidade":              "#ffc233", // amarelo-dourado
  "Produtos Químicos e Plásticos":          "#a78bfa", // violeta-suave
  "Saneamento Básico":                      "#40d9b5", // verde-água
  "Produção Florestal":                     "#5cb85c", // verde-floresta
  "Tecnologia da Informação e Comunicação": "#c084fc", // lilás
  "Têxtil, Confecção, Couro e Calçados":   "#f9667a", // rosa-coral
};

const FALLBACK_COLOR = "#85d7d4";

export function buildSectorColorMap(sectors: string[]): Record<string, string> {
  return Object.fromEntries(
    sectors.map((s) => [s, SECTOR_COLOR_MAP[s] ?? FALLBACK_COLOR])
  );
}
