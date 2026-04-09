import { NextResponse } from "next/server";
import {
  DEFAULT_LIMIT,
  DatasetNotFoundError,
  InvalidQueryError,
  MAX_LIMIT,
  queryDataset,
} from "@/lib/parquet-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseColumns(input: string | null): string[] | undefined {
  if (!input) {
    return undefined;
  }

  const columns = input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return columns.length > 0 ? columns : undefined;
}

function parsePositiveInt(input: string | null, fallback: number): number {
  if (!input) {
    return fallback;
  }

  const parsed = Number(input);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidQueryError(`Valor invalido: '${input}'.`);
  }

  return parsed;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ dataset: string }> },
) {
  try {
    const { dataset } = await context.params;
    const { searchParams } = new URL(request.url);

    const limit = Math.min(
      parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT),
      MAX_LIMIT,
    );
    const offset = parsePositiveInt(searchParams.get("offset"), 0);
    const includeTotal = searchParams.get("includeTotal") === "1";

    const sortBy = searchParams.get("sortBy") ?? undefined;
    const sortDirection =
      searchParams.get("sortDirection")?.toLowerCase() === "desc"
        ? "desc"
        : "asc";

    // Parse filter[col]=val query params
    const filters: Record<string, string> = {};
    for (const [key, value] of searchParams.entries()) {
      const match = key.match(/^filter\[(.+)\]$/);
      if (match) filters[match[1]] = value;
    }

    const data = await queryDataset({
      datasetId: dataset,
      columns: parseColumns(searchParams.get("columns")),
      limit,
      offset,
      includeTotal,
      sortBy,
      sortDirection,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof DatasetNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof InvalidQueryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erro inesperado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
