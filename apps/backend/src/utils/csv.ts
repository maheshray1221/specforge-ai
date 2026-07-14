function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  const text = Array.isArray(value) ? value.join("; ") : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const header = columns.map(escapeCsvCell).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsvCell(row[column])).join(","));

  return [header, ...body].join("\n");
}
