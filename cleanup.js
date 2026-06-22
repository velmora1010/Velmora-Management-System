import fs from 'fs';
import path from 'path';

let removedLogs = 0;
let modifiedFiles = [];

function cleanFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;
    
    let regex = /console\.(log|warn|debug)\s*\(/g;
    let match;
    
    let hasChanges = false;
    
    while ((match = regex.exec(newContent)) !== null) {
        let startIndex = match.index;
        let pCount = 1;
        let i = startIndex + match[0].length;
        let inString = false;
        let stringChar = '';
        let inTemplate = false;
        
        while (i < newContent.length && pCount > 0) {
            let char = newContent[i];
            let prevChar = newContent[i-1];
            
            if (!inString && !inTemplate) {
                if (char === "'" || char === '"') {
                    inString = true;
                    stringChar = char;
                } else if (char === '`') {
                    inTemplate = true;
                } else if (char === '(') {
                    pCount++;
                } else if (char === ')') {
                    pCount--;
                }
            } else if (inString) {
                if (char === stringChar && prevChar !== '\\') {
                    inString = false;
                }
            } else if (inTemplate) {
                if (char === '`' && prevChar !== '\\') {
                    inTemplate = false;
                }
            }
            i++;
        }
        
        if (pCount === 0) {
            let endIndex = i;
            if (newContent[endIndex] === ';') {
                endIndex++;
            }
            
            let startToErase = startIndex;
            while (startToErase > 0 && (newContent[startToErase-1] === ' ' || newContent[startToErase-1] === '\t')) {
                startToErase--;
            }
            
            if (startToErase > 0 && newContent[startToErase-1] === '\n') {
                if (newContent[endIndex] === '\r' && newContent[endIndex+1] === '\n') {
                    endIndex += 2;
                } else if (newContent[endIndex] === '\n') {
                    endIndex++;
                }
            }
            
            newContent = newContent.substring(0, startToErase) + newContent.substring(endIndex);
            regex.lastIndex = startToErase; 
            removedLogs++;
            hasChanges = true;
        } else {
            break;
        }
    }

    if (hasChanges) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        modifiedFiles.push(filePath);
    }
}

function traverse(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            traverse(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            cleanFile(fullPath);
        }
    }
}

// Ensure the target directory exists in the actual project
traverse('d:/Velmora Business Management - react/velmora-react/src');

console.info(JSON.stringify({
    removed: removedLogs,
    files: modifiedFiles
}, null, 2));
