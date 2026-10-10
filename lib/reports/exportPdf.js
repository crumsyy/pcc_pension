import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import {
  getReportExportSpec,
  getReportKpis,
  toExportRow,
  buildFileBase,
  buildDocRef,
  peso,
} from './reportExportModel.js';

const BLUE = '#1e3a8a';

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 8, fontFamily: 'Helvetica', color: '#0f172a' },
  letterheadRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#cbd5e1', paddingBottom: 8, marginBottom: 8 },
  brandName: { fontSize: 13, fontWeight: 'bold', color: BLUE, textTransform: 'uppercase' },
  brandSub: { fontSize: 7, color: '#0d9488', textTransform: 'uppercase', marginTop: 2 },
  brandContact: { fontSize: 6.5, color: '#64748b', marginTop: 2 },
  refBox: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', padding: 5, fontSize: 6.5 },
  refCode: { fontWeight: 'bold', color: BLUE, fontSize: 7 },
  docTitle: { fontSize: 11, fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase', marginVertical: 6 },
  metaBox: { backgroundColor: '#f8fafc', borderLeftWidth: 3, borderLeftColor: BLUE, borderTopWidth: 1, borderTopColor: '#e2e8f0', borderRightWidth: 1, borderRightColor: '#e2e8f0', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: 6, marginBottom: 8 },
  metaRow: { flexDirection: 'row', marginBottom: 2 },
  metaLabel: { width: 110, fontSize: 6.5, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase' },
  metaVal: { fontSize: 7, fontWeight: 'bold' },
  kpiGrid: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  kpiCard: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderLeftWidth: 3, padding: 5 },
  kpiLabel: { fontSize: 6, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' },
  kpiValue: { fontSize: 8.5, fontWeight: 'bold', marginVertical: 2 },
  kpiSub: { fontSize: 6, color: '#94a3b8' },
  tableHeader: { flexDirection: 'row', backgroundColor: BLUE },
  th: { color: '#ffffff', fontWeight: 'bold', fontSize: 6.2, textTransform: 'uppercase', padding: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  td: { padding: 3.5, fontSize: 6.8 },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.5, color: '#94a3b8' },
  signoff: { marginTop: 16 },
  signoffTitle: { fontSize: 7, fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 3, marginBottom: 8 },
  signoffGrid: { flexDirection: 'row', gap: 30 },
  signoffBox: { flex: 1, fontSize: 7 },
  signoffLine: { borderTopWidth: 1, borderTopColor: '#334155', marginTop: 28, paddingTop: 4 },
  endMark: { textAlign: 'center', fontSize: 7, fontWeight: 'bold', color: '#94a3b8', marginTop: 12 },
  clause: { fontSize: 6, color: '#94a3b8', textAlign: 'center', marginTop: 4 },
  emptyBox: { borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', padding: 16, textAlign: 'center', fontSize: 8, color: '#64748b' },
});

function formatCell(col, row) {
  const v = row[col.key];
  if (v === null || v === undefined || v === '') return '-';
  if (col.fmt === 'money') return peso(v);
  if (col.fmt === 'int') return Number(v).toLocaleString('en-US');
  if (col.fmt === 'percent') return `${v}%`;
  return String(v);
}

function describeFilters(filters = {}) {
  const parts = [];
  if (filters.grouping) parts.push(`Grouping: ${filters.grouping}`);
  if (filters.paymentMethodFilter && filters.paymentMethodFilter !== 'All') parts.push(`Payment: ${filters.paymentMethodFilter}`);
  if (filters.itemClassification && filters.itemClassification !== 'All') parts.push(`Classification: ${filters.itemClassification}`);
  if (filters.statusFilter && filters.statusFilter !== 'All') parts.push(`Status: ${filters.statusFilter}`);
  if (filters.discountFilter && filters.discountFilter !== 'ALL') parts.push(`Discount: ${filters.discountFilter}`);
  if (filters.movementTypeFilter && filters.movementTypeFilter !== 'ALL') parts.push(`Movement: ${filters.movementTypeFilter}`);
  if (filters.fulfillmentStatusFilter && filters.fulfillmentStatusFilter !== 'ALL') parts.push(`Fulfillment: ${filters.fulfillmentStatusFilter}`);
  return parts.length ? parts.join(' | ') : 'Standard Operations';
}

export function ReportDocument({ report, subTab, rows, reportData, filters }) {
  const spec = getReportExportSpec(report, subTab);
  const safeRows = (rows || []).map((r) => toExportRow(report, subTab, r));
  const kpis = getReportKpis(report, subTab, reportData);
  const docRef = buildDocRef(report);
  const generatedAt = new Date().toLocaleString('en-US');
  const colCount = spec.columns.length;
  const small = colCount > 8;
  const borders = ['#2563eb', '#16a34a', '#dc2626', '#7c3aed'];

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Letterhead
      React.createElement(
        View,
        { style: styles.letterheadRow },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.brandName }, 'PCC Home Suite Home'),
          React.createElement(Text, { style: styles.brandSub }, 'Property & Pension House Management Operations'),
          React.createElement(Text, { style: styles.brandContact }, 'National Highway, Brgy. Dadiangas East, General Santos City, 9500'),
          React.createElement(Text, { style: styles.brandContact }, 'Tel: (083) 552-8888 | info@pcchomesuite.com')
        ),
        React.createElement(
          View,
          { style: styles.refBox },
          React.createElement(Text, null, 'OFFICIAL DOCUMENT REF'),
          React.createElement(Text, { style: styles.refCode }, docRef),
          React.createElement(Text, { style: { marginTop: 3, fontWeight: 'bold', color: '#16a34a' } }, 'CONFIDENTIAL / INTERNAL')
        )
      ),
      React.createElement(Text, { style: styles.docTitle }, spec.title),
      // Meta
      React.createElement(
        View,
        { style: styles.metaBox },
        React.createElement(View, { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, 'Reporting Period:'),
          React.createElement(Text, { style: styles.metaVal }, `${filters?.dateFrom || ''} to ${filters?.dateTo || ''}`)),
        React.createElement(View, { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, 'Date Generated:'),
          React.createElement(Text, { style: styles.metaVal }, generatedAt)),
        React.createElement(View, { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, 'Filter Criteria:'),
          React.createElement(Text, { style: styles.metaVal }, describeFilters(filters))),
        React.createElement(View, { style: styles.metaRow },
          React.createElement(Text, { style: styles.metaLabel }, 'Records:'),
          React.createElement(Text, { style: styles.metaVal }, `${safeRows.length} record(s)`))
      ),
      // KPIs
      React.createElement(
        View,
        { style: styles.kpiGrid },
        ...kpis.map((k, i) =>
          React.createElement(
            View,
            { key: i, style: { ...styles.kpiCard, borderLeftColor: borders[i % borders.length] } },
            React.createElement(Text, { style: styles.kpiLabel }, k.label.toUpperCase()),
            React.createElement(Text, { style: styles.kpiValue }, String(k.value)),
            React.createElement(Text, { style: styles.kpiSub }, String(k.sub || ''))
          )
        )
      ),
      // Table or empty
      safeRows.length === 0
        ? React.createElement(View, { style: styles.emptyBox },
            React.createElement(Text, null, 'No records match the selected filters for this period.'))
        : React.createElement(
            View,
            null,
            React.createElement(
              View,
              { style: styles.tableHeader, fixed: true },
              ...spec.columns.map((c, i) =>
                React.createElement(Text, {
                  key: i,
                  style: { ...styles.th, flex: 1, textAlign: c.align, fontSize: small ? 5.8 : 6.2 },
                }, c.header)
              )
            ),
            ...safeRows.map((row, ri) =>
              React.createElement(
                View,
                {
                  key: ri,
                  style: { ...styles.tableRow, backgroundColor: ri % 2 === 1 ? '#f8fafc' : '#ffffff' },
                  wrap: false,
                },
                ...spec.columns.map((c, ci) =>
                  React.createElement(Text, {
                    key: ci,
                    style: { ...styles.td, flex: 1, textAlign: c.align, fontSize: small ? 6.2 : 6.8 },
                  }, formatCell(c, row))
                )
              )
            )
          ),
      // Sign-off
      React.createElement(
        View,
        { style: styles.signoff },
        React.createElement(Text, { style: styles.signoffTitle }, 'Administrative Audit & Verification Sign-Off'),
        React.createElement(
          View,
          { style: styles.signoffGrid },
          React.createElement(View, { style: styles.signoffBox },
            React.createElement(Text, null, 'Certified Correct & Prepared By:'),
            React.createElement(View, { style: styles.signoffLine },
              React.createElement(Text, { style: { fontWeight: 'bold' } }, 'System Administrator'),
              React.createElement(Text, { style: { color: '#64748b' } }, 'Front Office & Administrative Operations'))),
          React.createElement(View, { style: styles.signoffBox },
            React.createElement(Text, null, 'Audited & Approved By:'),
            React.createElement(View, { style: styles.signoffLine },
              React.createElement(Text, { style: { fontWeight: 'bold' } }, 'General Manager / Auditor'),
              React.createElement(Text, { style: { color: '#64748b' } }, 'Property Administration & Financial Oversight')))
        ),
        React.createElement(Text, { style: styles.endMark }, '*** END OF REPORT — CONFIDENTIAL ***')
      ),
      // Footer with page numbers
      React.createElement(
        View,
        { style: styles.footer, fixed: true },
        React.createElement(Text, null, docRef),
        React.createElement(Text, { render: ({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}` })
      )
    )
  );
}

/** Professional native PDF export (no screenshots, no window.print). */
export async function exportReportPdf({ report, subTab, rows, reportData, filters }) {
  const fileBase = buildFileBase(report, subTab, filters?.dateFrom, filters?.dateTo);
  const doc = React.createElement(ReportDocument, { report, subTab, rows, reportData, filters });
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileBase}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { fileName: `${fileBase}.pdf`, count: (rows || []).length };
}
