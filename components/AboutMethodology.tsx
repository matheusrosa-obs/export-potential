"use client";

import { BlockMath, InlineMath } from "react-katex";

type AboutComponent = {
  id: string;
  title: string;
  intuition: string;
};

const aboutComponents: AboutComponent[] = [
  {
    id: "oferta",
    title: "Oferta",
    intuition:
      "Estima o montante de exportações que Santa Catarina consegue ofertar para cada produto com base em seu histórico e em projeções.",
  },
  {
    id: "demanda",
    title: "Demanda",
    intuition:
      "Estima as importações ao nível do par mercado-produto com base em dados históricos e projeções para a evolução da demanda.",
  },
  {
    id: "facilidade",
    title: "Facilidade de comércio",
    intuition:
      "Estima o quanto Santa Catarina consegue transformar oportunidades teóricas em comércio efetivo, a partir do contraste entre o comércio previsto pelo modelo e o comércio realizado.",
  },
];

export default function AboutMethodology() {
  return (
    <>
      <div className="grid grid-cols-4">
        <h3 className="text-lg font-semibold text-zinc-100 col-span-4">
          Metodologia
        </h3>
        <p className="font-secondary col-span-3 text-zinc-300 mt-3">
          O índice combina três dimensões independentes - oferta, demanda e facilidade de comércio - para estimar, em dólares,
          o quanto Santa Catarina potencialmente pode exportar para cada par mercado-produto.
        </p>
        <p className="font-secondary col-span-3 text-zinc-300 mt-3">
          A referência principal da metodologia é o indicador "Export Potential Index (EPI)", desenvolvido pelo International Trade Centre (ITC).
        </p>
      </div>

      <div className="w-full mt-5">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-10 items-stretch">
          <div className="xl:col-span-1 h-full flex flex-col gap-6">
            {aboutComponents.map((component) => (
              <article
                key={component.id}
                className="rounded-2xl border border-[#0077fc]/35 bg-zinc-900/60 p-5 flex-1"
              >
                <h4 className="text-base font-semibold text-zinc-100">
                  {component.title}
                </h4>
                <p className="font-secondary text-sm text-zinc-300 mt-3 leading-relaxed">
                  {component.intuition}
                </p>
              </article>
            ))}
          </div>

          <aside className="xl:col-span-1 h-full rounded-2xl bg-zinc-900/60 p-5 flex flex-col">
            <p className="font-secondary text-sm text-zinc-300 mt-2">
              O índice final é construído a partir da interação multiplicativa dos componentes.
            </p>

            <div className="mt-4 flex-1 flex flex-col gap-3">
              <div className="rounded-xl border border-[#0077fc]/30 bg-zinc-900/45 p-4 flex-1">
                <h5 className="text-sm font-semibold text-zinc-100">
                  Potencial total
                </h5>
                <div className="text-zinc-100 overflow-x-auto rounded-md bg-zinc-900/60 px-2 py-2 mt-3">
                  <BlockMath math="P_{jk} = Oferta_{SC,k} \cdot Demanda_{jk} \cdot E_j" />
                  <p className="font-secondary text-xs text-zinc-300 mt-2">
                    onde <InlineMath math="P_{jk}" /> é o potencial total do produto k para o país j e <InlineMath math="E_j" /> é a facilidade de comércio com o país j.
                  </p>
                  <p className="font-secondary text-xs text-zinc-300 mt-1">
                    O potencial total é reescalado para o horizonte total da capacidade de oferta projetada, mantendo a coerência entre os valores.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#0077fc]/30 bg-zinc-900/45 p-4 flex-1">
                <h5 className="text-sm font-semibold text-zinc-100">
                  Potencial nao realizado
                </h5>
                <div className="text-zinc-100 overflow-x-auto rounded-md bg-zinc-900/60 px-2 py-2 mt-3">
                  <BlockMath math="U_{jk} = \max\left(P_{jk} - B_{jk}, 0\right)" />
                  <p className="font-secondary text-xs text-zinc-300 mt-2">
                    onde <InlineMath math="U_{jk}" /> é o potencial não realizado de exportações catarinenses do
                    produto k para o país j e <InlineMath math="B_{jk}" /> é o valor das exportações realizadas no par mercado-produto.
                    Caso <InlineMath math="B_{jk} > P_{jk}" />, o potencial não realizado é zero.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        <p className="font-secondary text-sm text-zinc-300 mt-5">
          A metodologia completa pode ser consultada{" "}
          <a
            href="#"
            className="text-[#0077fc] underline underline-offset-4 transition-colors hover:text-[#5eb0ff]"
          >
            aqui
          </a>
          {" "}(em construção).
        </p>
      </div>
    </>
  );
}
