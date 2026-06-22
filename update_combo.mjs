import fs from 'fs';

const file = 'src/modules/inventory/combos/CreateCombo.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /const getProductAvailable = \(code: string\) => \{[\s\S]*?const stockMap = \{\s*'1B': getProductAvailable\('1B'\),\s*'1Y': getProductAvailable\('1Y'\),\s*'1P': getProductAvailable\('1P'\),\s*'1S': getProductAvailable\('1S'\)\s*\};/g;

const replacement = `const normalizeProductCode = (item: any) => {
    const name = String(item.productName || item.product_name || "").toLowerCase();
    const code = String(item.productCode || item.product_code || item.variantCode || "").toUpperCase();

    if (code) return code;

    if (name.includes("liquid a") || name.includes("blue") || name.includes("1b")) return "1B";
    if (name.includes("liquid y") || name.includes("yellow") || name.includes("1y")) return "1Y";
    if (name.includes("fabric") || name.includes("pink") || name.includes("1p")) return "1P";
    if (name.includes("sponge") || name.includes("1s")) return "1S";

    return "";
  };

  const getProductAvailable = (code: string) => {
    return stockMap[code as keyof typeof stockMap] || 0;
  };

  const releasedProducts = (inventoryService as any).getProductsReleasedToCombo?.() || [];
  
  const stockMap: Record<string, number> = releasedProducts.reduce((acc: any, item: any) => {
    if (item.status === "PACKED_IN_COMBO" || item.status === "PACKED" || item.status === "DISPATCHED") return acc;

    const code = normalizeProductCode(item);
    if (!code) return acc;

    acc[code] = (acc[code] || 0) + Number(item.quantity || 1);
    return acc;
  }, { '1B': 0, '1Y': 0, '1P': 0, '1S': 0 });`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync(file, content);
  console.log("Successfully updated CreateCombo stock calculation");
} else {
  console.log("Regex did not match");
}
