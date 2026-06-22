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

export default function ViewBarcodeList`;

if (!content.includes('const getRawBadge')) {
  content = content.replace('export default function ViewBarcodeList', helpers);
}

// Replace filters
content = content.replace(
  `if (rawMaterialSubTab === 'IN') matchesStatus = stage === 'RAW_MATERIAL_IN';\n    if (rawMaterialSubTab === 'OUT') matchesStatus = stage === 'RAW_MATERIAL_OUT';`,
  `if (rawMaterialSubTab === 'IN') matchesStatus = ['RAW_MATERIAL_IN', 'RAW_MATERIAL_OUT'].includes(stage);\n    if (rawMaterialSubTab === 'OUT') matchesStatus = stage === 'RAW_MATERIAL_OUT';`
);

content = content.replace(
  `if (comboSubTab === 'IN') matchesStatus = stage === 'COMBO_IN';\n    if (comboSubTab === 'OUT') matchesStatus = stage === 'COMBO_OUT';`,
  `if (b.type === 'PRODUCT') {
      if (comboSubTab === 'IN') matchesStatus = ['PRODUCT_IN', 'PRODUCT_OUT', 'PACKED_IN_COMBO'].includes(stage);
      if (comboSubTab === 'OUT') matchesStatus = ['PRODUCT_OUT', 'PACKED_IN_COMBO'].includes(stage);
    } else {
      if (comboSubTab === 'IN') matchesStatus = ['COMBO_IN', 'COMBO_OUT', 'DISPATCHED'].includes(stage);
      if (comboSubTab === 'OUT') matchesStatus = ['COMBO_OUT', 'DISPATCHED'].includes(stage);
    }`
);

// Replace Badge for Raw Material
const oldRawBadge = `const badgeState = stage.replace(/_/g, ' ');
              const color = getStageColor(stage);
              
              return (
              <div key={b.id} style={{ display: 'flex', flexDirection: 'column', background: '#111827', borderRadius: '16px', border: \`1px solid \${color}40\`, overflow: 'hidden' }}>
                <div style={{ padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  
                  <div id={\`view-barcode-\${b.serial_number}\`}>
                    <Barcode value={b.serial_number} width={1.5} height={50} displayValue={false} margin={0} />
                  </div>
                  <div style={{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', background: \`\${color}20\`, color: color, width: '100%' }}>
                    {badgeState}
                  </div>`;

const newRawBadge = `const badgeInfo = getRawBadge(stage, rawMaterialSubTab);
              
              return (
              <div key={b.id} style={{ display: 'flex', flexDirection: 'column', background: '#111827', borderRadius: '16px', border: \`1px solid \${badgeInfo.color}40\`, overflow: 'hidden' }}>
                <div style={{ padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  
                  <div id={\`view-barcode-\${b.serial_number}\`}>
                    <Barcode value={b.serial_number} width={1.5} height={50} displayValue={false} margin={0} />
                  </div>
                  <div style={{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', background: badgeInfo.bg, color: badgeInfo.color, width: '100%' }}>
                    {badgeInfo.text}
                  </div>`;

content = content.replace(oldRawBadge, newRawBadge);

// Replace Badge for Combo
const oldComboBadge = `const badgeState = stage.replace(/_/g, ' ');
              const color = getStageColor(stage);
              
              return (
              <div key={b.id} style={{ display: 'flex', flexDirection: 'column', background: '#111827', borderRadius: '16px', border: \`1px solid \${color}40\`, overflow: 'hidden' }}>
                <div style={{ padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  
                  <div id={\`view-barcode-\${b.barcode_no || b.batch_id}\`}>
                    <Barcode value={b.barcode_no || b.batch_id} width={1.5} height={50} displayValue={false} margin={0} />
                  </div>
                  <div style={{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', background: \`\${color}20\`, color: color, width: '100%' }}>
                    {badgeState}
                  </div>`;

const newComboBadge = `const badgeInfo = b.type === 'PRODUCT' ? getProdBadge(stage, comboSubTab) : getComboBadge(stage, comboSubTab);
              
              return (
              <div key={b.id} style={{ display: 'flex', flexDirection: 'column', background: '#111827', borderRadius: '16px', border: \`1px solid \${badgeInfo.color}40\`, overflow: 'hidden' }}>
                <div style={{ padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  
                  <div id={\`view-barcode-\${b.barcode_no || b.batch_id}\`}>
                    <Barcode value={b.barcode_no || b.batch_id} width={1.5} height={50} displayValue={false} margin={0} />
                  </div>
                  <div style={{ padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontWeight: 800, fontSize: '11px', textTransform: 'uppercase', background: badgeInfo.bg, color: badgeInfo.color, width: '100%' }}>
                    {badgeInfo.text}
                  </div>`;

content = content.replace(oldComboBadge, newComboBadge);

fs.writeFileSync(file, content);
console.log('Update completed');
