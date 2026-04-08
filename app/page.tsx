"use client";

import Image from "next/image";
import logo from "./logo.png";
import TreemapSC from "@/components/TreemapSC";

export default function Home() {
  function scrollToNext() {
    document.getElementById("section-2")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      // ############################################################################
      // Página inicial com logo, título, descrição, cards e botão de rolagem.
      // ############################################################################
      <main className="min-h-screen grid place-content-center gap-3 px-8 text-center relative">
        <a href="https://observatorio.fiesc.com.br/" target="_blank" rel="noopener noreferrer">
          <Image src={logo} alt="Logo" className="mx-auto" width="300" />
        </a>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-100">
          Potencial de exportações
        </h1>
        <p className="font-secondary text-zinc-300 p-4">
          Ferramenta de análise do potencial de exportação dos produtos catarinenses.
        </p>

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
      <section id="section-2" className="min-h-screen grid content-start justify-items-start gap-3 px-60 py-20 text-left">
        <h2 className="text-3xl font-semibold tracking-tight text-zinc-100">
          Agregado de Santa Catarina
        </h2>
        <p className="font-secondary text-zinc-300">
          Produtos e países com maior potencial para as exportações.
        </p>
        <div className="w-full mt-4">
          <TreemapSC />
        </div>
      </section>
    </>
  );
}
