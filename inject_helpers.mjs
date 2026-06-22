import fs from 'fs';

const file = 'src/modules/inventory/view-barcode/ViewBarcodeList.tsx';
let content = fs.readFileSync(file, 'utf8');

const helpers = `
const getRawBadge = (stage: string, tab: string) => {
  if (tab === 'ALL') {
    if (stage === 'READY_FOR_FIRST_SCAN' || !stage) return { text: 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
    if (stage === 'RAW_MATERIAL_IN' || stage === 'RAW_MATERIAL_OUT') return { text: 'SCANNED', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  } else if (tab === 'IN') {
    if (stage === 'RAW_MATERIAL_IN') return { text: 'SCANNED', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
    if (stage === 'RAW_MATERIAL_OUT') return { text: 'SCANNED', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  } else if (tab === 'OUT') {
    if (stage === 'RAW_MATERIAL_OUT') return { text: 'RELEASED TO PRODUCT', bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' };
  }
  return { text: stage || 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
};

const getProdBadge = (stage: string, tab: string) => {
  if (tab === 'ALL') {
    if (stage === 'READY_FOR_FIRST_SCAN' || !stage) return { text: 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
    if (stage === 'PRODUCT_IN' || stage === 'PRODUCT_OUT' || stage === 'PACKED_IN_COMBO') return { text: 'SCANNED', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  } else if (tab === 'IN') {
    if (stage === 'PRODUCT_IN' || stage === 'PRODUCT_OUT' || stage === 'PACKED_IN_COMBO') return { text: 'SCANNED', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  } else if (tab === 'OUT') {
    if (stage === 'PRODUCT_OUT') return { text: 'RELEASED TO COMBO', bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' };
    if (stage === 'PACKED_IN_COMBO') return { text: 'PACKED IN COMBO', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  }
  return { text: stage || 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
};

const getComboBadge = (stage: string, tab: string) => {
  if (tab === 'ALL') {
    if (stage === 'READY_FOR_FIRST_SCAN' || !stage) return { text: 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
    if (stage === 'COMBO_IN' || stage === 'COMBO_OUT' || stage === 'DISPATCHED') return { text: 'SCANNED', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  } else if (tab === 'IN') {
    if (stage === 'COMBO_IN' || stage === 'COMBO_OUT' || stage === 'DISPATCHED') return { text: 'SCANNED', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  } else if (tab === 'OUT') {
    if (stage === 'COMBO_OUT' || stage === 'DISPATCHED') return { text: 'MOVED OUT', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
  }
  return { text: stage || 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
};

const ViewBarcode = () => {`;

if (!content.includes('const getRawBadge')) {
  content = content.replace('const ViewBarcode = () => {', helpers);
  fs.writeFileSync(file, content);
  console.log('Successfully injected helper functions into ViewBarcodeList');
} else {
  console.log('Helpers already injected!');
}
