const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== 'dist') walk(dirPath, callback);
    } else {
      if (f.endsWith('.tsx') || f.endsWith('.ts')) {
        callback(dirPath);
      }
    }
  });
}

function refactorFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // We are replacing alert(...) with toast.success(...) or toast.error(...)
  // We use a regex to find alert( ... )
  // This is a naive regex but works for single line alerts mostly.
  let hasChanges = false;
  
  // match alert('something') or alert(`something`)
  const alertRegex = /alert\((.*?)\)/g;

  content = content.replace(alertRegex, (match, inner) => {
    hasChanges = true;
    let lowerInner = inner.toLowerCase();
    // determine if error or success
    if (lowerInner.includes('success') || lowerInner.includes('copied') || lowerInner.includes('download') || lowerInner.includes('started')) {
      return `toast.success(${inner})`;
    } else {
      // default to error since most alerts are validation failures
      return `toast.error(${inner})`;
    }
  });

  if (hasChanges) {
    // Add import if missing
    if (!content.includes("import toast from 'react-hot-toast'")) {
      // Find the last import
      const importMatches = [...content.matchAll(/^import .* from .*$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const index = lastImport.index + lastImport[0].length;
        content = content.slice(0, index) + "\nimport toast from 'react-hot-toast';" + content.slice(index);
      } else {
        content = "import toast from 'react-hot-toast';\n" + content;
      }
    }
    fs.writeFileSync(filePath, content);
    console.log(`Refactored alerts in: ${filePath}`);
  }
}

walk(path.join(__dirname, 'src'), refactorFile);
console.log('Done refactoring alerts.');
