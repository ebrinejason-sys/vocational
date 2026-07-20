import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  exportToExcel,
  exportToPdf,
  printSection,
  type ExportColumn,
  type ExportRow,
} from '../lib/export';

interface ExportToolbarProps {
  title: string;
  filename: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  printTargetId?: string;
  subtitle?: string;
  className?: string;
}

export default function ExportToolbar({
  title,
  filename,
  columns,
  rows,
  printTargetId,
  subtitle,
  className,
}: ExportToolbarProps) {
  if (!rows.length) return null;

  const base = filename.replace(/\.(pdf|xlsx|csv)$/i, '');

  return (
    <div className={cn('flex flex-wrap items-center gap-2 no-print', className)}>
      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mr-1">Export</span>
      <button
        type="button"
        onClick={() => printSection(printTargetId ?? 'app-print-area', title)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        title="Print"
      >
        <Printer className="w-3.5 h-3.5" />
        Print
      </button>
      <button
        type="button"
        onClick={() => exportToPdf(title, columns, rows, base, subtitle)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        title="Download PDF"
      >
        <FileText className="w-3.5 h-3.5" />
        PDF
      </button>
      <button
        type="button"
        onClick={() => exportToExcel(columns, rows, base)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
        title="Download Excel"
      >
        <FileSpreadsheet className="w-3.5 h-3.5" />
        Excel
      </button>
    </div>
  );
}
