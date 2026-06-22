import fs from 'fs';

const file = 'src/modules/inventory/production/ProductionBatchDetail.tsx';
let content = fs.readFileSync(file, 'utf8');

const normalizeHelper = `
const normalizeMaterialKey = (name: string) => String(name || "").trim().toLowerCase();
`;

if (!content.includes('const normalizeMaterialKey =')) {
  // Let's just insert it before ProductionBatchDetail component
  content = content.replace('const ProductionBatchDetail = () => {', normalizeHelper + '\nconst ProductionBatchDetail = () => {');
}

// Replace stock lookup
const countRegex = /const avail = productionStock\[i\.material_name\]\?\.availableKg \|\| 0;/g;
content = content.replace(countRegex, 'const avail = productionStock[normalizeMaterialKey(i.material_name)]?.availableKg || 0;');

const mapRegex = /const avail = productionStock\[ing\.material_name\]\?\.availableKg \|\| 0;/g;
content = content.replace(mapRegex, 'const avail = productionStock[normalizeMaterialKey(ing.material_name)]?.availableKg || 0;');

fs.writeFileSync(file, content);
console.log('ProductionBatchDetail updated with normalization');
