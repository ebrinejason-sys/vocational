import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Receipt } from '../types';

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

/** Export rows as a Word-compatible document (.doc HTML). */
export function exportToWord(
  title: string,
  columns: ExportColumn[],
  rows: ExportRow[],
  filename: string,
  subtitle?: string,
) {
  const header = columns.map((c) => `<th>${c.label}</th>`).join('');
  const body = rows.map((row) => {
    const cells = columns.map((c) => `<td>${cellValue(row, c.key)}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body>
    <h1>${title}</h1>
    ${subtitle ? `<p>${subtitle}</p>` : ''}
    <table border="1" cellpadding="4" cellspacing="0"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
  </body></html>`;
  downloadBlob(new Blob([html], { type: 'application/msword' }), filename.endsWith('.doc') ? filename : `${filename}.doc`);
}

/** Generate and download a printable PDF receipt (admin-only feature). */
export function generateReceiptPdf(receipt: Receipt) {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a5' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Street Children Ministry', margin, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Official Receipt', margin, 25);

  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.6);
  doc.line(margin, 29, pageWidth - margin, 29);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Receipt No: ${receipt.receiptNumber}`, margin, 37);
  doc.text(
    `Date: ${new Date(receipt.issuedAt).toLocaleDateString()}`,
    pageWidth - margin,
    37,
    { align: 'right' },
  );
  doc.setTextColor(0);

  const rows: [string, string][] = [
    ['Received from', receipt.payerName],
    ['Amount', `${receipt.currencyCode} ${receipt.amount.toFixed(2)}`],
    ['For', receipt.category ?? receipt.description ?? '—'],
  ];
  if (receipt.description && receipt.description !== receipt.category) {
    rows.push(['Description', receipt.description]);
  }
  if (receipt.notes) rows.push(['Notes', receipt.notes]);

  autoTable(doc, {
    startY: 44,
    body: rows,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: { top: 3, bottom: 3, left: 0, right: 4 } },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32, textColor: [80, 80, 80] },
      1: { cellWidth: pageWidth - margin * 2 - 32 },
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    'This is a system-generated receipt from the VTMS finance module.',
    margin,
    finalY + 12,
  );

  doc.save(`receipt-${receipt.receiptNumber}.pdf`);
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
