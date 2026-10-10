import ExcelJS from 'exceljs';
import {
  getReportExportSpec,
  getReportKpis,
  toExportRow,
  buildFileBase,
  buildDocRef,
} from './reportExportModel.js';

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
const HEADER_FONT = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
const ALT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
const THIN_BORDER = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

function cellValue(col, row) {
  const v = row[col.key];
  if (v === null || v === undefined) return '';
  if (col.fmt === 'money' || col.fmt === 'int' || col.fmt === 'percent') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (v instanceof Date) return v;
  return String(v);
}

function applyNumberFormat(cell, col) {
  if (col.fmt === 'money') cell.numFmt = '\u20B1#,##0.00';
  else if (col.fmt === 'int') cell.numFmt = '#,##0';
  else if (col.fmt === 'percent') cell.numFmt = '0.0"%"';
}

function describeFilters(filters = {}) {
  const parts = [];
  if (filters.grouping) parts.push(`Grouping: ${filters.grouping}`);
  if (filters.paymentMethodFilter && filters.paymentMethodFilter !== 'All') parts.push(`Payment: ${filters.paymentMethodFilter}`);
  if (filters.roomFilter) parts.push(`Room ID: ${filters.roomFilter}`);
  if (filters.itemClassification && filters.itemClassification !== 'All') parts.push(`Classification: ${filters.itemClassification}`);
  if (filters.statusFilter && filters.statusFilter !== 'All') parts.push(`Status: ${filters.statusFilter}`);
  if (filters.discountFilter && filters.discountFilter !== 'ALL') parts.push(`Discount: ${filters.discountFilter}`);
  if (filters.movementTypeFilter && filters.movementTypeFilter !== 'ALL') parts.push(`Movement: ${filters.movementTypeFilter}`);
  if (filters.fulfillmentStatusFilter && filters.fulfillmentStatusFilter !== 'ALL') parts.push(`Fulfillment: ${filters.fulfillmentStatusFilter}`);
  return parts.length ? parts.join(' | ') : 'Standard Operations';
}

/**
 * Genuine .xlsx export: Summary + Details sheets, formatted headers,
 * native numbers/currency, autofilter + frozen header row.
 */
export async function exportReportExcel({ report, subTab, rows, reportData, filters }) {
  const spec = getReportExportSpec(report, subTab);
  const safeRows = (rows || []).map((r) => toExportRow(report, subTab, r));
  const kpis = getReportKpis(report, subTab, reportData);
  const fileBase = buildFileBase(report, subTab, filters?.dateFrom, filters?.dateTo);
  const docRef = buildDocRef(report);
  const generatedAt = new Date().toLocaleString('en-US');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PCC Home Suite Home';
  wb.created = new Date();

  // --- Summary sheet ---
  const summary = wb.addWorksheet('Summary');
  summary.columns = [{ width: 24 }, { width: 70 }];
  const titleRow = summary.addRow([spec.title]);
  titleRow.font = { bold: true, size: 14, color: { argb: 'FF1E3A8A' } };
  summary.addRow(['PCC Home Suite Home — Property & Pension House Management']);
  summary.addRow(['Document Ref', docRef]);
  summary.addRow(['Reporting Period', `${filters?.dateFrom || ''} to ${filters?.dateTo || ''}`]);
  summary.addRow(['Date Generated', generatedAt]);
  summary.addRow(['Filter Criteria', describeFilters(filters)]);
  summary.addRow(['Records Exported', safeRows.length]);
  summary.addRow([]);
  const kHead = summary.addRow(['Key Metrics', 'Value']);
  kHead.font = HEADER_FONT;
  kHead.fill = HEADER_FILL;
  kpis.forEach((k) => {
    summary.addRow([k.label, `${k.value}${k.sub ? ` (${k.sub})` : ''}`]);
  });

  // --- Details sheet ---
  const details = wb.addWorksheet('Details');
  details.columns = spec.columns.map((c) => ({ width: c.width }));
  const headerRow = details.addRow(spec.columns.map((c) => c.header));
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 22;

  safeRows.forEach((row, idx) => {
    const excelRow = details.addRow(spec.columns.map((c) => cellValue(c, row)));
    excelRow.eachCell((cell, colNumber) => {
      const col = spec.columns[colNumber - 1];
      cell.border = THIN_BORDER;
      cell.alignment = {
        vertical: 'middle',
        wrapText: true,
        horizontal: col.align === 'right' ? 'right' : col.align === 'center' ? 'center' : 'left',
      };
      applyNumberFormat(cell, col);
      if (idx % 2 === 1) cell.fill = ALT_FILL;
    });
  });

  if (safeRows.length > 0) {
    details.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: spec.columns.length },
    };
  }
  details.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileBase}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { fileName: `${fileBase}.xlsx`, count: safeRows.length };
}
