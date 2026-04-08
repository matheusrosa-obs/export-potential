import Image from "next/image";
import logo from "./logo.png";

export default function Home() {
  return (
    <main className="min-h-screen grid place-content-center gap-3 px-8 text-center">
      <a href="https://observatorio.fiesc.com.br/" target="_blank" rel="noopener noreferrer">
        <Image src={logo} alt="Logo" className="mx-auto" width="300" />
      </a>
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-100">
        Potencial de exportações
      </h1>
      <p className="font-secondary text-zinc-300 p-4">
        Ferramenta de análise do potencial de exportação dos produtos catarinenses.
      </p>
    </main>
  );
}
