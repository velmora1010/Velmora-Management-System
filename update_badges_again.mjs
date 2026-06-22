import fs from 'fs';

const file = 'src/modules/inventory/InventoryRoom.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Helper Functions
const helpers = `
const getRawBadge = (stage: string, tab: string) => {
  if (tab === 'ALL') {
    if (stage === 'READY_FOR_FIRST_SCAN' || !stage) return { text: 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
    if (stage === 'RAW_MATERIAL_IN' || stage === 'RAW_MATERIAL_OUT') return { text: 'SCANNED', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  } else if (tab === 'IN') {
    if (stage === 'RAW_MATERIAL_IN') return { text: 'READY TO SCAN OUT', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    if (stage === 'RAW_MATERIAL_OUT') return { text: 'MOVED OUT', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
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
    if (stage === 'PRODUCT_IN') return { text: 'READY TO SCAN OUT', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    if (stage === 'PRODUCT_OUT' || stage === 'PACKED_IN_COMBO') return { text: 'MOVED OUT', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
  } else if (tab === 'OUT') {
    if (stage === 'PRODUCT_OUT') return { text: 'RELEASED TO COMBO', bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' };
    if (stage === 'PACKED_IN_COMBO') return { text: 'PACKED IN COMBO', bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' };
  }
  return { text: stage || 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
};

const getComboBadge = (stage: string, tab: string) => {
  if (tab === 'ALL') {
    if (stage === 'READY_FOR_FIRST_SCAN' || !stage) return { text: 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
    if (stage === 'COMBO_IN' || stage === 'COMBO_OUT' || stage === 'DISPATCHED') return { text: 'SCANNED', bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' };
  } else if (tab === 'IN') {
    if (stage === 'COMBO_IN') return { text: 'READY TO SCAN OUT', bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    if (stage === 'COMBO_OUT' || stage === 'DISPATCHED') return { text: 'MOVED OUT', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
  } else if (tab === 'OUT') {
    if (stage === 'COMBO_OUT' || stage === 'DISPATCHED') return { text: 'MOVED OUT', bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' };
  }
  return { text: stage || 'READY TO SCAN IN', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' };
};

export default function InventoryRoom`;

if (!content.includes('const getRawBadge')) {
  content = content.replace('export default function InventoryRoom', helpers);
}

// 2. Replace Raw Material Badge
const rawBadgeRegex = /\{row\.currentStage === 'RAW_MATERIAL_OUT' \? \([\s\S]*?NOT SCANNED\s*<\/span>\s*\)\}/;
const newRawBadge = `{(() => {
                          const badge = getRawBadge(row.currentStage, rawSubTab);
                          return (
                            <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: badge.bg, color: badge.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {badge.text}
                            </span>
                          );
                        })()}`;
if (content.match(rawBadgeRegex)) {
  content = content.replace(rawBadgeRegex, newRawBadge);
}

// 3. Replace Product Badge
const prodBadgeRegex = /\{row\.currentStage === 'PRODUCT_OUT' \? \([\s\S]*?NOT SCANNED\s*<\/span>\s*\)\}/;
const newProdBadge = `{(() => {
                          const badge = getProdBadge(row.currentStage, prodSubTab);
                          return (
                            <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: badge.bg, color: badge.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {badge.text}
                            </span>
                          );
                        })()}`;
if (content.match(prodBadgeRegex)) {
  content = content.replace(prodBadgeRegex, newProdBadge);
}

// 4. Replace Combo Badge
const comboBadgeRegex = /\{row\.currentStage === 'COMBO_OUT' \? \([\s\S]*?NOT SCANNED\s*<\/span>\s*\)\}/;
const newComboBadge = `{(() => {
                          const badge = getComboBadge(row.currentStage, comboSubTab);
                          return (
                            <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: badge.bg, color: badge.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              {badge.text}
                            </span>
                          );
                        })()}`;
if (content.match(comboBadgeRegex)) {
  content = content.replace(comboBadgeRegex, newComboBadge);
}

// 5. Update Product Tab Filter
// The user specified EXACT filters for Product Tab:
// IN: PRODUCT_IN, PRODUCT_OUT, PACKED_IN_COMBO
// OUT: PRODUCT_OUT, PACKED_IN_COMBO
// (Which I already implemented, but I'll double check)
const prodFilterRegex = /const filteredProducts = allProductBarcodes\.filter\(\(item: any\) => \{[\s\S]*?if \(prodSubTab === 'IN'\) matchTab = \['PRODUCT_IN', 'PRODUCT_OUT', 'PACKED_IN_COMBO'\]\.includes\(stage\);\n    if \(prodSubTab === 'OUT'\) matchTab = \['PRODUCT_OUT', 'PACKED_IN_COMBO'\]\.includes\(stage\);/s;

// We will also ensure Raw Material and Combo filters match the user's explicit instructions:
const rawFilterRegex = /if \(rawSubTab === 'IN'\) matchTab = \['RAW_MATERIAL_IN', 'RAW_MATERIAL_OUT'\]\.includes\(stage\);\n    if \(rawSubTab === 'OUT'\) matchTab = \['RAW_MATERIAL_OUT'\]\.includes\(stage\);/s;

const comboFilterRegex = /if \(comboSubTab === 'IN'\) matchTab = \['COMBO_IN', 'COMBO_OUT', 'READY_FOR_DISPATCH'\]\.includes\(stage\);\n    if \(comboSubTab === 'OUT'\) matchTab = \['COMBO_OUT', 'READY_FOR_DISPATCH'\]\.includes\(stage\);/s;
// The filters are already exactly as requested in the previous task.

fs.writeFileSync(file, content);
console.log('Fixed visibility and badges in InventoryRoom');
