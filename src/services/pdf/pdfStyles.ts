import { StyleSheet } from '@react-pdf/renderer';

// Register standard fonts for a professional look
// For a robust production app, you might want to load fonts from a URL,
// but the built-in Helvetica works perfectly for print-safe business docs.

export const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a', // Dark grey for softer contrast than pure black
    backgroundColor: '#ffffff',
  },
  
  // ── Header Section ──
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 20,
  },
  companyBranding: {
    flexDirection: 'column',
  },
  companyName: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    marginBottom: 4,
  },
  companyDetails: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.4,
  },
  poMetaContainer: {
    alignItems: 'flex-end',
  },
  documentTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  metaGrid: {
    flexDirection: 'column',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  metaLabel: {
    fontFamily: 'Helvetica-Bold',
    color: '#4b5563',
    marginRight: 8,
    width: 70,
    textAlign: 'right',
  },
  metaValue: {
    width: 100,
    textAlign: 'right',
  },

  // ── Entities Section (Vendor / Shipping) ──
  entitiesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 20,
  },
  entityBlock: {
    flex: 1,
  },
  entityTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  entityText: {
    fontSize: 10,
    lineHeight: 1.4,
    color: '#1a1a1a',
  },
  
  // ── Table Section ──
  table: {
    width: '100%',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: '#374151',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  tableCell: {
    fontSize: 9,
    color: '#1a1a1a',
  },
  
  // Column Widths (Must equal 100%)
  colNo: { width: '5%', textAlign: 'center' },
  colItem: { width: '35%', paddingRight: 4 },
  colQty: { width: '10%', textAlign: 'right' },
  colPrice: { width: '15%', textAlign: 'right' },
  colGST: { width: '15%', textAlign: 'right' },
  colTotal: { width: '20%', textAlign: 'right' },

  // ── Totals Section ──
  totalsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 40,
  },
  totalsBox: {
    width: '40%',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  totalRowGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    borderTopWidth: 2,
    borderTopColor: '#000000',
    marginTop: 2,
  },
  totalLabel: {
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
  },
  totalValue: {
    textAlign: 'right',
  },
  grandTotalLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: '#000000',
  },
  grandTotalValue: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
    color: '#000000',
    textAlign: 'right',
  },

  // ── Signature Section ──
  signatureContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    marginBottom: 40,
  },
  signatureBlock: {
    width: '40%',
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginBottom: 8,
    height: 40, // Space for signature
  },
  signatureText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    color: '#000000',
  },

  // ── Footer Section ──
  footerContainer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
  termsTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginBottom: 4,
    color: '#374151',
  },
  termsText: {
    fontSize: 8,
    color: '#6b7280',
    lineHeight: 1.4,
  },
  pageNumber: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    fontSize: 8,
    color: '#9ca3af',
  },
});
