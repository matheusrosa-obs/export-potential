"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import logo from "./logo.png";
import TreemapSC from "@/components/TreemapSC";
import BarChartSC from "@/components/BarChartSC";
import WorldMapSC from "@/components/WorldMapSC";
import ProductSearch from "@/components/ProductSearch";
import ProductBarChart from "@/components/ProductBarChart";
import CountrySearch from "@/components/CountrySearch";
import CountryBarChart from "@/components/CountryBarChart";
import GlobalMarketTable from "@/components/GlobalMarketTable";
import ProductWorldMap from "@/components/ProductWorldMap";
import MarketProductSearch from "@/components/MarketProductSearch";
import MarketCompetitorTable from "@/components/MarketCompetitorTable";
import MarketCompetitorTreemap from "@/components/MarketCompetitorTreemap";
import MarketFlightsGLMap from "@/components/MarketFlightsGLMap";
import AboutMethodology from "@/components/AboutMethodology";
import AboutUsability from "@/components/AboutUsability";
import UfDropdownFilter from "@/components/UfDropdownFilter";
import { UfFilterProvider, applyUfFilter, getUfLabel, useSelectedUf } from "@/lib/uf-filter";

function HomeContent() {
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedSH6, setSelectedSH6] = useState<string | null>(null);
  const [selectedImporter, setSelectedImporter] = useState<string | null>("USA");
  const [selectedMarketSH6, setSelectedMarketSH6] = useState<string | null>(null);
  const [ufTopSH6, setUfTopSH6] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const sectionButtons = [
    {
      label: "Visão geral",
      subtitle: "Panorama com produtos e países de maior potencial.",
      targetId: "section-2",
    },
    {
      label: "Produtos",
      subtitle: "Detalhamento por SH6 e principais importadores.",
      targetId: "section-3",
    },
    {
      label: "Mercados",
      subtitle: "Países com maior demanda para o portfólio catarinense.",
      targetId: "section-4",
    },
    {
      label: "Sobre",
      subtitle: "Metodologia, referências e orientações de uso.",
      targetId: "section-5",
    },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setShowBackToTop(!entry.isIntersecting),
      { threshold: 0 }
    );
    if (heroRef.current) observer.observe(heroRef.current);
    return () => observer.disconnect();
  }, []);

  function handleSectorClick(sector: string) {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    );
  }

  function handleResetSectorFilters() {
    setSelectedSectors([]);
  }

  function handleImporterSelect(importer: string | null) {
    setSelectedImporter(importer);
    setSelectedMarketSH6(ufTopSH6);
  }

  function scrollToNext() {
    document.getElementById("section-2")?.scrollIntoView({ behavior: "smooth" });
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function scrollToSection(targetId: string) {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const selectedUf = useSelectedUf();
  const ufContentKey = selectedUf ?? "BR";

  useEffect(() => {
    let cancelled = false;

    const fetchTopSh6 = async (params: URLSearchParams) => {
      const res = await fetch(`/api/data/epi_monetary_ufs_sh6?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || json.error) return null;
      return (json.rows?.[0]?.sh6 as string | null) ?? null;
    };

    const loadTopSh6 = async () => {
      const exportParams = new URLSearchParams({
        columns: "sh6,bilateral_exports_uf_sh6",
        limit: "1",
        sortBy: "bilateral_exports_uf_sh6",
        sortDirection: "desc",
      });
      applyUfFilter(exportParams, selectedUf);

      let sh6 = await fetchTopSh6(exportParams);

      if (!sh6) {
        const fallbackParams = new URLSearchParams({
          columns: "sh6",
          limit: "1",
          sortBy: "potential_value",
          sortDirection: "desc",
        });
        applyUfFilter(fallbackParams, selectedUf);
        sh6 = await fetchTopSh6(fallbackParams);
      }

      if (cancelled) return;
      setUfTopSH6(sh6);
      setSelectedSH6(sh6);
      setSelectedMarketSH6(sh6);
    };

    void loadTopSh6();
    return () => {
      cancelled = true;
    };
  }, [selectedUf]);

  return (
    <>
      <main id="section-hero" ref={heroRef} className="relative min-h-screen w-full grid place-content-center gap-3 px-8 -mt-10 text-center">
        <a href="https://observatorio.fiesc.com.br/" target="_blank" rel="noopener noreferrer">
          <Image src={logo} alt="Logo" className="mx-auto" width="300" />
        </a>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-100">
          Potencial de exportações
        </h1>
        <p className="font-secondary text-zinc-300 px-4 pt-3">
          Ferramenta de análise do potencial de exportação dos produtos catarinenses.
        </p>

        <div className="flex justify-center mt-1">
          <UfDropdownFilter />
        </div>

        <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-3">
          {sectionButtons.map(({ label, subtitle, targetId }, index) => (
            <button
              key={targetId}
              onClick={() => scrollToSection(targetId)}
              style={{ "--nav-delay": `${index * 1.2}s` } as CSSProperties}
              className="hero-nav-btn w-full rounded-2xl px-5 py-4 text-left"
            >
              <span className="hero-nav-title">{label}</span>

              <span className="hero-nav-subtitle">{subtitle}</span>
            </button>
          ))}
        </div>

        <button
          onClick={scrollToNext}
          aria-label="Rolar para baixo"
          className="absolute bottom-1 left-1/2 -translate-x-1/2 text-zinc-400 hover:text-zinc-100 transition-colors animate-bounce"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </main>

      <div className="w-full px-10 lg:px-16 xl:px-24 pb-10">
        <div className="mx-auto w-full max-w-[1500px]">
          <section key={`overview-${ufContentKey}`} id="section-2" className="relative w-full grid content-start justify-items-start gap-3 pt-10 pb-8 text-left scroll-mt-6">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
              Visão geral em {getUfLabel(selectedUf)}
            </h2>
            <p className="font-secondary text-zinc-300">
              Produtos e países com maior potencial para as exportações.
            </p>

            <div className="w-full mt-2 gap-10 grid grid-cols-6">
              <div className="col-span-4">
                <TreemapSC selectedSectors={selectedSectors} />
              </div>
              <div className="col-span-2">
                <BarChartSC
                  selectedSectors={selectedSectors}
                  onSectorClick={handleSectorClick}
                  onResetFilters={handleResetSectorFilters}
                />
              </div>
            </div>

            <div className="w-full mt-3 gap-10 grid grid-cols-6">
              <div className="col-span-4">
                <p className="font-secondary text-sm text-zinc-300">
                  O gráfico de áreas mostra os <b>produtos de maior potencial de exportação</b> em Santa Catarina,
                  enquanto o gráfico de barras agrega o potencial por <b>setor econômico</b>.
                </p>
                <p className="font-secondary text-sm mt-3 text-zinc-300">
                  É possível filtrar o gráfico de áreas ao clicar nas barras setoriais, inclusive com seleção múltipla para comparar setores.
                </p>
              </div>
              <div className="col-span-2" />
            </div>

            <div className="w-full">
              <WorldMapSC />
            </div>

            <p className="font-secondary text-sm mt-3 text-zinc-300">
              O mapa mostra os <b>países com maior potencial de exportação</b> para Santa Catarina.
            </p>

            <p className="font-secondary text-sm text-zinc-300">
              Os valores potenciais estimados foram <b>categorizados</b> para uma visualização mais intuitiva. É possível filtrar o mapa pela categoria a partir da legenda.
            </p>

            <button
              onClick={scrollToTop}
              aria-label="Voltar ao topo"
              className={`fixed bottom-8 right-8 text-zinc-400 hover:text-zinc-100 transition-colors animate-bounce ${showBackToTop ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
          </section>

          <section key={`products-${ufContentKey}`} id="section-3" className="relative w-full grid content-start justify-items-start gap-3 pt-5 pb-5 text-left scroll-mt-6">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
              Produtos
            </h2>
            <p className="font-secondary text-zinc-300 py-3">
              Detalhamento do potencial de exportação dos produtos catarinenses, de acordo com os principais importadores.
            </p>

            <div className="w-[calc(50%-12px)] mb-6">
              <ProductSearch onSelect={setSelectedSH6} selectedSH6={selectedSH6} />
            </div>

            <div className="w-full grid grid-cols-20 gap-8">
              <div className="col-span-9">
                <ProductBarChart sh6={selectedSH6} />
              </div>
              <div className="col-span-11">
                <GlobalMarketTable sh6={selectedSH6} />
              </div>
            </div>

            <p className="font-secondary text-zinc-300">
              O gráfico de barras permite a identificação direita do <b>potencial realizado</b> e <b>potencial não realizado</b> para os produtos nos mercados importadores.
            </p>

            <p className="font-secondary text-zinc-300">
              A tabela complementa o gráfico ao fornecer <b>detalhes do mercado mundial</b> do produto selecionado.
            </p>

            <div className="w-full mt-4">
              <ProductWorldMap sh6={selectedSH6} />
            </div>

            <button
              onClick={scrollToTop}
              aria-label="Voltar ao topo"
              className={`fixed bottom-8 right-8 text-zinc-400 hover:text-zinc-100 transition-colors animate-bounce ${showBackToTop ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
          </section>

          <section key={`markets-${ufContentKey}`} id="section-4" className="relative w-full grid content-start justify-items-start gap-3 pt-5 text-left scroll-mt-6">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
              Mercados e competidores
            </h2>
            <p className="font-secondary text-zinc-300 py-3">
              Detalhamento dos importadores de maior potencial para Santa Catarina, de acordo com os produtos demandados. Detalhe dos competidores nos mercados-alvo.
            </p>

            <div className="w-full grid grid-cols-2 mt-2">
              <CountrySearch onSelect={handleImporterSelect} defaultISO3="USA" />
              <MarketProductSearch
                importer={selectedImporter}
                selectedSH6={selectedMarketSH6}
                onSelect={setSelectedMarketSH6}
              />
            </div>

            <div className="w-full grid grid-cols-20 gap-6 mt-3">
              <div className="col-span-9 flex flex-col gap-4">
                <CountryBarChart
                  importer={selectedImporter}
                  selectedSH6={selectedMarketSH6}
                  onSH6Select={setSelectedMarketSH6}
                />
              </div>
              <div className="col-span-11 h-[800px] flex flex-col gap-4">
                <div className="h-[392px]">
                  <MarketCompetitorTable
                    importer={selectedImporter}
                    sh6={selectedMarketSH6}
                  />
                </div>
                <div className="h-[392px]">
                  <MarketCompetitorTreemap
                    importer={selectedImporter}
                    sh6={selectedMarketSH6}
                  />
                </div>
              </div>
            </div>

            <p className="font-secondary text-zinc-300">
              O gráfico de barras permite a identificação direita do <b>potencial realizado</b> e <b>potencial não realizado</b> para os produtos nos mercados importadores.
            </p>

            <p className="font-secondary text-zinc-300">
              A tabela e o gráfico de áreas complementam o gráfico ao fornecer <b>detalhes dos competidores</b> no mercado importador selecionado.
            </p>

            <p className="font-secondary text-zinc-300">
              A identificação dos competidores permite uma análise mais aprofundada, aproximando a compreensão sobre o <b>cenário competitivo</b> e o <b>perfil dos produtos</b> demandados.
            </p>

            <div className="w-full mt-2">
              <MarketFlightsGLMap
                importer={selectedImporter}
                sh6={selectedMarketSH6}
              />
            </div>

            <p className="font-secondary text-zinc-300 -mt-8">
              Para o produto filtrado, o mapa mostra os <b>fluxos comerciais</b> entre os exportadores e o importador selecionado.
            </p>

            <button
              onClick={scrollToTop}
              aria-label="Voltar ao topo"
              className={`fixed bottom-8 right-8 text-zinc-400 hover:text-zinc-100 transition-colors animate-bounce ${showBackToTop ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
          </section>
        </div>
      </div>

      <section id="section-5" className="relative w-full grid content-start justify-items-start gap-3 px-10 lg:px-16 xl:px-24 pt-5 pb-5 text-left scroll-mt-6">
        <div className="mx-auto w-full max-w-[1500px]">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
            Sobre
          </h2>
          <p className="font-secondary text-zinc-300 mt-3">
            Informações metodológicas, referências e usabilidade do sistema.
          </p>

          <div className="w-full mt-5">
            <AboutMethodology />

            <AboutUsability />

            <a href="https://observatorio.fiesc.com.br/" target="_blank" rel="noopener noreferrer">
              <Image src={logo} alt="Logo" className="mx-auto mt-8" width="300" />
            </a>
          </div>
        </div>

        <button
          onClick={scrollToTop}
          aria-label="Voltar ao topo"
          className={`fixed bottom-8 right-8 text-zinc-400 hover:text-zinc-100 transition-colors animate-bounce ${showBackToTop ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 15l-6-6-6 6" />
          </svg>
        </button>
      </section>
    </>
  );
}

export default function Home() {
  return (
    <UfFilterProvider>
      <HomeContent />
    </UfFilterProvider>
  );
}
