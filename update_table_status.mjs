import fs from 'fs';

const file = 'src/modules/inventory/InventoryRoom.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /<span style=\{\{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba\(16, 185, 129, 0\.1\)', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0\.5px' \}\}>\s*Stock In\s*<\/span>/;

const newBlock = `{row.currentStage === 'RAW_MATERIAL_OUT' ? (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Released to Production
                          </span>
                        ) : (
                          <span style={{ padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Stock In
                          </span>
                        )}`;

if (content.match(regex)) {
  content = content.replace(regex, newBlock);
} else {
  console.log('Regex not found!');
}

fs.writeFileSync(file, content);
console.log('Updated table status');
