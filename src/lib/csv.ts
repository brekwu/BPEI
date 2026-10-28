export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0) return "";
  const cols = headers ?? Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = typeof v === "string" ? v : String(v);
    if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const head = cols.join(";");
  const body = rows.map((r) => cols.map((c) => esc((r as any)[c])).join(";")).join("\n");
  return `${head}\n${body}\n`;
}

export function downloadCsv(filename: string, csv: string) {
  const bom = "\uFEFF"; // Excel UTF-8
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}