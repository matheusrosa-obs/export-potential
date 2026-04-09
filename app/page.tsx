"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import logo from "./logo.png";
import TreemapSC from "@/components/TreemapSC";
import BarChartSC from "@/components/BarChartSC";
import WorldMapSC from "@/components/WorldMapSC";

export default function Home() {
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const heroRef = useRef<HTMLElement>(null);
  const sectionButtons = [
    { label: "Visão geral", targetId: "section-2" },
    { label: "Produtos", targetId: "section-3" },
    { label: "Mercados", targetId: "section-4" },
    { label: "Sobre", targetId: "section-5" },
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
      <main id="section-hero" ref={heroRef} className="min-h-screen grid place-content-center gap-3 px-8 text-center relative">
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
        <div className="-mt-4 flex flex-wrap justify-center gap-3">
          {sectionButtons.map(({ label, targetId }, index) => (
            <button
              key={targetId}
              onClick={() => scrollToSection(targetId)}
              style={{ "--nav-delay": `${index * 1.2}s` } as CSSProperties}
              className="hero-nav-btn rounded-full px-5 py-2 text-sm font-medium text-zinc-200"
            >
              <span>{label}</span>
            </button>
          ))}
        </div>

        // Botão de rolagem para a próxima seção.
        <button
          onClick={scrollToNext}
          aria-label="Rolar para baixo"
          className="absolute bottom-20 left-1/2 -translate-x-1/2 text-zinc-400 hover:text-zinc-100 transition-colors animate-bounce"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </main>

      // ############################################################################
      // Visão geral, apresentação básica dos dados agregados.
      // ############################################################################
      <section id="section-2" className="relative min-h-screen grid content-start justify-items-start gap-3 px-60 py-20 text-left">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Visão geral
        </h2>
        <p className="font-secondary text-zinc-300">
          Produtos e países com maior potencial para as exportações.
        </p>
        <div className="w-full mt-2 gap-10 grid grid-cols-5">
          <div className="col-span-3">
            <TreemapSC selectedSectors={selectedSectors} />
          </div>
          <div className="col-span-2">
            <BarChartSC selectedSectors={selectedSectors} onSectorClick={handleSectorClick} />
          </div>
        </div>
        <div className="w-full mt-4 p-4">
          <WorldMapSC />
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
      // Produtos, filtro por SH6 e detalhamento do potencial não realizado.
      // ############################################################################
      <section id="section-3" className="relative min-h-screen grid content-start justify-items-start gap-3 px-60 text-left">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Produtos
        </h2>
        <p className="font-secondary text-zinc-300">
          Detalhamento do potencial de exportação dos produtos catarinenses, de acordo com os principais importadores.
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
      // Mercados, filtro por país e detalhamento do potencial por produto.
      // ############################################################################
      <section id="section-4" className="relative min-h-screen grid content-start justify-items-start gap-3 px-60 text-left">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Mercados
        </h2>
        <p className="font-secondary text-zinc-300">
          Detalhamento dos importadores de maior potencial para Santa Catarina, de acordo com os produtos demandados.
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
      // Sobre, com informações metodológicas, referências e usabilidade.
      // ############################################################################
      <section id="section-5" className="relative min-h-screen grid content-start justify-items-start gap-3 px-60 text-left">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Sobre
        </h2>
        <p className="font-secondary text-zinc-300">
          Informações metodológicas, referências e usabilidade do sistema.
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
    </>
  );
}
