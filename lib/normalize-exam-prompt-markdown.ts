/**
 * Coerce AI-generated markdown so remark-gfm can render tables and lists.
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

function stripInlineTags(text: string): string {
  return text.replace(/<[^>]+>/g, "").trim();
}

function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*?>/i.test(text);
}

function convertHtmlTables(text: string): string {
  return text.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, body) => {
    const rows: string[][] = [];

    for (const tr of body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells: string[] = [];
      for (const cell of tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
        cells.push(
          decodeBasicHtmlEntities(stripInlineTags(cell[1].replace(/<br\s*\/?>/gi, " "))),
        );
      }
      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length === 0) return "";

    const columnCount = Math.max(...rows.map((row) => row.length));
    const lines = rows.map((row) => {
      while (row.length < columnCount) row.push("");
      return formatTableRow(row.slice(0, columnCount));
    });
    lines.splice(1, 0, buildSeparator(columnCount));
    return `\n\n${lines.join("\n")}\n\n`;
  });
}

/** Convert common HTML tags from model output into GFM markdown. */
function coerceHtmlToMarkdown(source: string): string {
  if (!looksLikeHtml(source)) return source;

  let text = convertHtmlTables(source);
  text = text.replace(/<br\s*\/?>/gi, "\n");

  for (let level = 6; level >= 1; level -= 1) {
    text = text.replace(
      new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi"),
      (_, content) =>
        `\n\n${"#".repeat(level)} ${decodeBasicHtmlEntities(stripInlineTags(content))}\n\n`,
    );
  }

  text = text.replace(
    /<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_, __, content) => `**${decodeBasicHtmlEntities(stripInlineTags(content))}**`,
  );
  text = text.replace(
    /<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_, __, content) => `*${decodeBasicHtmlEntities(stripInlineTags(content))}*`,
  );
  text = text.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => {
    const body = decodeBasicHtmlEntities(stripInlineTags(content));
    return body ? `\n\n${body}\n\n` : "\n\n";
  });
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, content) => {
    const body = decodeBasicHtmlEntities(stripInlineTags(content));
    return body ? `\n- ${body}` : "";
  });
  text = text.replace(/<\/?(ul|ol|div|span|tbody|thead)[^>]*>/gi, "\n");
  text = text.replace(/<\/?(tr|td|th)[^>]*>/gi, " ");
  text = text.replace(/<[^>]+>/g, "");
  text = decodeBasicHtmlEntities(text);
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

/** Split markdown table rows that were collapsed onto one line by the model. */
function expandInlineTableRows(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.includes("|") || !/\|\s*\|/.test(trimmed)) {
    return [line];
  }

  const parts = trimmed.split(/\s\|\s\|\s/);
  if (parts.length < 2) return [line];

  const rows: string[] = [];
  for (const part of parts) {
    let row = part.trim();
    if (!row) continue;
    if (!row.startsWith("|")) row = `| ${row}`;
    if (!row.endsWith("|")) row = `${row} |`;
    rows.push(row);
  }

  return rows.length > 1 ? rows : [line];
}

function expandInlineTables(text: string): string {
  const output: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    output.push(...expandInlineTableRows(line));
  }
  return output.join("\n");
}

/** Normalize tables, HTML, and strip accidental code-fence wrappers from markdown content. */
export function normalizeExamPromptMarkdown(source: string): string {
  let text = stripCodeFenceWrapper(source);
  text = coerceHtmlToMarkdown(text);
  text = expandInlineTables(text);

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
