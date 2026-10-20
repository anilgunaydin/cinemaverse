/**
 * Kucuk, bagimliliksiz CSV yardimcilari (saf fonksiyonlar).
 * Excel uyumu icin UTF-8 BOM'u cagiran taraf ekler.
 */

export function toCsv(
  rows: Record<string, string | number | boolean | null | undefined>[],
  columns?: string[],
): string {
  if (rows.length === 0) {
    return columns ? `${columns.map(escapeCell).join(",")}\r\n` : "";
  }
  const cols = columns ?? Object.keys(rows[0]);
  const lines = [cols.map(escapeCell).join(",")];
  for (const row of rows) {
    lines.push(
      cols
        .map((col) => escapeCell(row[col] === undefined ? null : row[col]))
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}

function escapeCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** RFC 4180 uyumlu basit CSV ayristirici. */
export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (inQuotes) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      cell += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      index += 1;
      continue;
    }
    if (char === "\r") {
      index += 1;
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      index += 1;
      continue;
    }
    cell += char;
    index += 1;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.trim().length > 0));
}

/** CSV metnini {baslik: deger} nesnelerine cevirir. */
export function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const object: Record<string, string> = {};
    headers.forEach((header, index) => {
      object[header] = row[index] ?? "";
    });
    return object;
  });
}
