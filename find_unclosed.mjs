import fs from 'fs';
const file = 'src/modules/inventory/InventoryRoom.tsx';
let content = fs.readFileSync(file, 'utf8');

// Parse JSX tags naively
const tagRegex = /<\/?([a-zA-Z0-9\.]+)(?:\s+[^>]+?)?\/?>/g;
let stack = [];
let match;
while ((match = tagRegex.exec(content)) !== null) {
    if (match[0].endsWith('/>')) continue; // self closing
    if (match[0].startsWith('</')) {
        let last = stack.pop();
        if (!last || last.tag !== match[1]) {
            console.log(`Mismatch at index ${match.index}: expected </${last ? last.tag : 'NONE'}>, found ${match[0]}`);
            console.log(`Context: ${content.substring(match.index - 50, match.index + 50)}`);
            break;
        }
    } else {
        stack.push({tag: match[1], index: match.index});
    }
}
console.log('Unclosed tags remaining on stack:');
stack.forEach(s => {
    console.log(`<${s.tag}> at index ${s.index}`);
    console.log(`Context: ${content.substring(s.index - 20, s.index + 50).replace(/\n/g, ' ')}`);
});
