import fs from 'fs';

const file = 'src/modules/inventory/InventoryRoom.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update Product Badge
const prodBadgeRegex = /\{row\.currentStage === 'PRODUCT_OUT' \? \([\s\S]*?Stock In\s*<\/span>\s*\)\}/;
const newProdBadge = `{row.currentStage === 'PRODUCT_OUT' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            SCANNED TO INVENTORY OUT
                          </span>
                        ) : row.currentStage === 'PACKED_IN_COMBO' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            PACKED IN COMBO
                          </span>
                        ) : row.currentStage === 'PRODUCT_IN' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            SCANNED TO INVENTORY IN
                          </span>
                        ) : (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            NOT SCANNED
                          </span>
                        )}`;

if (content.match(prodBadgeRegex)) {
  content = content.replace(prodBadgeRegex, newProdBadge);
  console.log("Replaced Product Badge");
}

// 2. Update Combo Badge (which currently wrongly uses PRODUCT_OUT logic)
const comboBadgeRegex = /\{row\.currentStage === 'PRODUCT_OUT' \? \([\s\S]*?\{row\.currentStage \|\| 'READY'\}\s*<\/span>\s*\)\}/;
const newComboBadge = `{row.currentStage === 'COMBO_OUT' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            SCANNED TO INVENTORY OUT
                          </span>
                        ) : row.currentStage === 'DISPATCHED' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            DISPATCHED
                          </span>
                        ) : row.currentStage === 'COMBO_IN' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            SCANNED TO INVENTORY IN
                          </span>
                        ) : (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            NOT SCANNED
                          </span>
                        )}`;

if (content.match(comboBadgeRegex)) {
  content = content.replace(comboBadgeRegex, newComboBadge);
  console.log("Replaced Combo Badge");
}

fs.writeFileSync(file, content);
console.log('Fixed badges in update script.');
