export const DEFAULT_TOOLTIP_MAX_CHARS_PER_LINE = 44;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function splitTooltipLines(
  text: string,
  maxChars = DEFAULT_TOOLTIP_MAX_CHARS_PER_LINE
): string[] {
  const safeMaxChars = Math.max(8, Math.floor(maxChars));
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [""];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (word.length > safeMaxChars) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = "";
      }
      for (let i = 0; i < word.length; i += safeMaxChars) {
        lines.push(word.slice(i, i + safeMaxChars));
      }
      continue;
    }

    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (candidate.length > safeMaxChars) {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    } else {
      currentLine = candidate;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

export function wrapTooltipText(
  text: string,
  maxChars = DEFAULT_TOOLTIP_MAX_CHARS_PER_LINE
): string {
  return splitTooltipLines(text, maxChars).map(escapeHtml).join("<br/>");
}

export function formatTooltipTitle(
  text: string,
  maxChars = DEFAULT_TOOLTIP_MAX_CHARS_PER_LINE
): string {
  return `<strong>${wrapTooltipText(text, maxChars)}</strong>`;
}
