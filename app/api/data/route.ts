import { NextResponse } from "next/server";
import { listAvailableDatasets } from "@/lib/parquet-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSchema = searchParams.get("includeSchema") === "1";

    const datasets = await listAvailableDatasets({ includeSchema });

    return NextResponse.json({
      datasets,
      count: datasets.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
