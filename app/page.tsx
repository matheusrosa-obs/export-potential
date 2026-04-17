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
import AboutMethodology from "@/components/AboutMethodology";
import AboutUsability from "@/components/AboutUsability";

const DEFAULT_MARKET_SH6 = "840999";

export default function Home() {
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedSH6, setSelectedSH6] = useState<string | null>("020714");
  const [selectedImporter, setSelectedImporter] = useState<string | null>("USA");
  const [selectedMarketSH6, setSelectedMarketSH6] = useState<string | null>(DEFAULT_MARKET_SH6);
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
    setSelectedMarketSH6(DEFAULT_MARKET_SH6);
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

  return (
    <>
      // ############################################################################
      // Página inicial com logo, título, descrição, cards e botão de rolagem.
      // ############################################################################
      <main id="section-hero" ref={heroRef} className="min-h-[92vh] grid place-content-center gap-3 px-8 -mt-10 text-center relative">
        <a href="https://observatorio.fiesc.com.br/" target="_blank" rel="noopener noreferrer">
          <Image src={logo} alt="Logo" className="mx-auto" width="300" />
        </a>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-100">
          Potencial de exportações
        </h1>
        <p className="font-secondary text-zinc-300 px-4 pt-3">
          Ferramenta de análise do potencial de exportação dos produtos catarinenses.
        </p>

        // Botões de navegação para as seções principais.
        <div className="-mt-3 mx-auto grid w-full max-w-5xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

        // Botão de rolagem para a próxima seção.
        <button
          onClick={scrollToNext}
          aria-label="Rolar para baixo"
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-zinc-400 hover:text-zinc-100 transition-colors animate-bounce"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </main>

      // ############################################################################
      // Visão geral, apresentação básica dos dados agregados.
      // ############################################################################
      <section id="section-2" className="relative min-h-[88vh] grid content-start justify-items-start gap-3 px-60 pt-12 pb-8 text-left">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Visão geral
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
          <div className="col-span-2">
          </div>
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
      
      // ############################################################################
      // Produtos, filtro por SH6 e detalhamento do potencial não realizado.
      // ############################################################################
      <section id="section-3" className="relative min-h-[88vh] grid content-start justify-items-start gap-3 px-60 pt-12 pb-8 text-left">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Produtos
        </h2>
        <p className="font-secondary text-zinc-300 py-3">
          Detalhamento do potencial de exportação dos produtos catarinenses, de acordo com os principais importadores.
        </p>

        <div className="w-[calc(50%-12px)] mb-6">
          <ProductSearch onSelect={setSelectedSH6} defaultSH6="020714" />
        </div>

        <div className="w-full grid grid-cols-20 gap-8">
          <div className="col-span-9">
            <ProductBarChart sh6={selectedSH6} />
          </div>
          <div className="col-span-11">
            <GlobalMarketTable sh6={selectedSH6} />
          </div>
        </div>

        <div className="w-full mt-4 p-4">
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
      // ############################################################################
      // Mercados, filtro por país e detalhamento do potencial por produto.
      // ############################################################################
      <section id="section-4" className="relative min-h-[88vh] grid content-start justify-items-start gap-3 px-60 pt-12 pb-8 text-left">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Mercados e competidores
        </h2>
        <p className="font-secondary text-zinc-300 py-3">
          Detalhamento dos importadores de maior potencial para Santa Catarina, de acordo com os produtos demandados. Detalhe dos competidores nos mercados-alvo.
        </p>

        <div className="w-full grid grid-cols-2 gap-4 mt-2">
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
      // ############################################################################
      // Sobre, com informações metodológicas, referências e usabilidade.
      // ############################################################################
      <section id="section-5" className="relative min-h-[88vh] grid content-start justify-items-start gap-3 px-60 pt-12 pb-8 text-left">
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
