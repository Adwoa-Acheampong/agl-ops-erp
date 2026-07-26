export type ExcelColumn<Row> = {
  header: string;
  value: (row: Row) => string | number | boolean | null | undefined;
};

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function cellValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return '';
  return value;
}

export async function exportRowsToXlsx<Row>(
  filename: string,
  sheetName: string,
  rows: Row[],
  columns: ExcelColumn<Row>[],
) {
  const XLSX = await import('xlsx');
  const header = columns.map((c) => c.header);
  const body = rows.map((row) => columns.map((c) => cellValue(c.value(row))));
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31) || 'Export');
  const fullName = filename.endsWith('.xlsx') ? filename : `${filename}-${stamp()}.xlsx`;
  XLSX.writeFile(wb, fullName);
}
