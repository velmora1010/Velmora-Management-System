import fs from 'fs';

let content;

// localInventoryService.ts
content = fs.readFileSync('src/services/localInventoryService.ts', 'utf8');
content = content.replace(/toLoc = 'PRODUCTION_AVAILABLE';/g, "/* toLoc = 'PRODUCTION_AVAILABLE'; */");
content = content.replace(/toLoc = 'COMBO_AVAILABLE';/g, "/* toLoc = 'COMBO_AVAILABLE'; */");
content = content.replace(/toLoc = 'DISPATCH_AVAILABLE';/g, "/* toLoc = 'DISPATCH_AVAILABLE'; */");

fs.writeFileSync('src/services/localInventoryService.ts', content);
