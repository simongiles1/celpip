/**
 * Coerce AI-generated examPrompt markdown so remark-gfm can render tables and lists.
 */

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  return (trimmed.match(/\|/g)?.length ?? 0) >= 2;
}

function isTableSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return false;
  return /-/.test(trimmed) && /^[\|\s:\-+*]+$/.test(trimmed);
}

function splitTableCells(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function countColumns(row: string): number {
  return splitTableCells(row).length;
}

function formatTableRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function buildSeparator(columnCount: number): string {
  return formatTableRow(Array.from({ length: columnCount }, () => "---"));
}

function normalizeTableBlock(lines: string[]): string[] {
  if (lines.length === 0) return [];

  const headerCells = splitTableCells(lines[0]);
  const columnCount = Math.max(1, headerCells.length);
  const normalized: string[] = [formatTableRow(headerCells)];

  let index = 1;
  if (index < lines.length && isTableSeparatorLine(lines[index])) {
    normalized.push(buildSeparator(columnCount));
    index += 1;
  } else {
    normalized.push(buildSeparator(columnCount));
  }

  for (; index < lines.length; index++) {
    const line = lines[index];
    if (isTableSeparatorLine(line)) {
      normalized.push(buildSeparator(columnCount));
      continue;
    }
    if (!isTableRow(line)) continue;

    const cells = splitTableCells(line);
    while (cells.length < columnCount) cells.push("");
    normalized.push(formatTableRow(cells.slice(0, columnCount)));
  }

  return normalized;
}

function stripCodeFenceWrapper(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return text;
  return trimmed
    .replace(/^```(?:markdown|md)?\s*\r?\n?/i, "")
    .replace(/\r?\n?```\s*$/i, "")
    .trim();
}

/** Normalize tables and strip accidental code-fence wrappers from exam prompts. */
export function normalizeExamPromptMarkdown(source: string): string {
  let text = stripCodeFenceWrapper(source);
  const lines = text.split(/\r?\n/);
  const output: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/^\s{4,}/, "");

    if (!isTableRow(line)) {
      output.push(line);
      continue;
    }

    const tableLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i].replace(/^\s{4,}/, "");
      if (isTableRow(current) || isTableSeparatorLine(current)) {
        tableLines.push(current);
        i += 1;
        continue;
      }
      break;
    }
    i -= 1;

    if (output.length > 0 && output[output.length - 1].trim() !== "") {
      output.push("");
    }
    output.push(...normalizeTableBlock(tableLines));
  }

  return output.join("\n").trim();
}
