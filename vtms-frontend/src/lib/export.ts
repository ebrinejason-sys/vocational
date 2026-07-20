import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ExportColumn {
  key: string;
  label: string;
}

export type ExportRow = Record<string, string | number | null | undefined>;

function cellValue(row: ExportRow, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return '';
  return String(v);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export rows as a CSV file (opens in Excel). */
export function exportToExcel(
  columns: ExportColumn[],
  rows: ExportRow[],
  filename: string,
) {
  const sheetRows = rows.map((row) => {
    const out: Record<string, string> = {};
    columns.forEach((col) => {
      out[col.label] = cellValue(row, col.key);
    });
    return out;
  });
  const worksheet = XLSX.utils.json_to_sheet(sheetRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** Export rows as a PDF table. */
export function exportToPdf(
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[],
  filename: string,
  subtitle?: string,
) {
  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 22);
    doc.setTextColor(0);
  }

  autoTable(doc, {
    startY: subtitle ? 26 : 22,
    head: [columns.map((c) => c.label)],
    body: rows.map((row) => columns.map((c) => cellValue(row, c.key))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [13, 148, 136] },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** Open the browser print dialog for a page section. */
export function printSection(elementId: string, title?: string) {
  const el = document.getElementById(elementId);
  if (!el) {
    window.print();
    return;
  }

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    window.print();
    return;
  }

  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
    .map((node) => node.outerHTML)
    .join('\n');

  printWindow.document.write(`<!DOCTYPE html><html><head>
    <title>${title ?? 'Print'}</title>
    ${styles}
    <style>
      body { padding: 24px; font-family: system-ui, sans-serif; color: #111; }
      @media print { body { padding: 0; } }
      .no-print { display: none !important; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
      th { background: #f3f4f6; }
    </style>
  </head><body>
    ${title ? `<h1 style="font-size:18px;margin:0 0 8px">${title}</h1>` : ''}
    ${el.innerHTML}
  </body></html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
}
