import fs from 'fs';
const file = 'src/modules/inventory/InventoryRoom.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `      <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        {/* RAW MATERIAL TAB */}`;

const replacementStr = `      </>
      )}

      <div style={{ background: '#111827', borderRadius: '16px', border: '1px solid #263244', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        {/* RAW MATERIAL TAB */}`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, replacementStr);
  fs.writeFileSync(file, content);
  console.log('Fixed missing closing tag for raw_material tab');
} else {
  console.log('Target string not found');
}
