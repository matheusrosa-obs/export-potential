"use client";

export default function AboutUsability() {
  return (
    <>
      <h3 className="text-lg font-semibold text-zinc-100 col-span-4 mt-8">
        Usabilidade
      </h3>

      <p className="font-secondary col-span-3 text-zinc-300 mt-3">
        A plataforma permite diferentes insights sobre o potencial de exportação de Santa Catarina.
      </p>

      <p className="font-secondary col-span-3 text-zinc-300 mt-3">
        Cada página permite uma análise específica, porém a interação entre as informações de cada página é recomendada para uma compreensão mais ampla.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <article className="rounded-2xl border border-[#54f394]/35 bg-zinc-900/60 p-5">
          <h4 className="text-base font-semibold text-zinc-100">Geral</h4>
          <p className="font-secondary text-sm text-zinc-300 mt-3 leading-relaxed">
            Permite identificar o panorama agregado do potencial de exportações de Santa Catarina,
            destacando setores, produtos e mercados de maior potencial.
          </p>
        </article>

        <article className="rounded-2xl border border-[#54f394]/35 bg-zinc-900/60 p-5">
          <h4 className="text-base font-semibold text-zinc-100">Produtos</h4>
          <p className="font-secondary text-sm text-zinc-300 mt-3 leading-relaxed">
            Permite identificar mercados potenciais por produto SH6, explorando o potencial total, o volume de exportações e o potencial não realizado.
          </p>
        </article>

        <article className="rounded-2xl border border-[#54f394]/35 bg-zinc-900/60 p-5">
          <h4 className="text-base font-semibold text-zinc-100">Mercados</h4>
          <p className="font-secondary text-sm text-zinc-300 mt-3 leading-relaxed">
            Permite detalhar, por país importador, quais produtos concentram maior oportunidade
            e como se distribui a concorrência entre os principais competidores no mercado-alvo.
          </p>
        </article>
      </div>
    </>
  );
}
