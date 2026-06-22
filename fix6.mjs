import fs from 'fs';
const file = 'src/modules/inventory/InventoryRoom.tsx';
let content = fs.readFileSync(file, 'utf8');

// The issue is around line 512.
// Let's replace the whole section from </table></div>)} to {activeTab === 'product'
const regex = /<\/table>\s*<\/div>\s*\)}\s*<\/div>\s*<\/>\s*\)}\s*\{activeTab === 'product' && \(/;
if (regex.test(content)) {
  console.log('Found first pattern');
  content = content.replace(regex, `</table>
            </div>
          </>
        )}
      </div>

      {activeTab === 'product' && (`);
} else {
  // Let's try a broader regex if the previous one doesn't match
  const regex2 = /<\/table>\s*<\/div>\s*\)}\s*<\/div>\s*<\/>\s*\)}/;
  if (regex2.test(content)) {
    console.log('Found second pattern');
    content = content.replace(regex2, `</table>
            </div>
          </>
        )}
      </div>`);
  } else {
    // Let's just fix it manually using split
    console.log('Using split approach');
    let lines = content.split('\n');
    let newLines = [];
    let skip = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('</table>') && lines[i+1] && lines[i+1].includes('</div>') && lines[i+2] && lines[i+2].includes(')}')) {
            // Found the end of the raw material table.
            if (lines[i+3] && lines[i+3].trim() === '' && lines[i+4] && lines[i+4].includes('</div>') && lines[i+5] && lines[i+5].includes('</>') && lines[i+6] && lines[i+6].includes(')}')) {
                newLines.push('              </table>');
                newLines.push('            </div>');
                newLines.push('          </>');
                newLines.push('        )}');
                newLines.push('      </div>');
                i += 6; // skip the bad lines
                continue;
            }
        }
        newLines.push(lines[i]);
    }
    content = newLines.join('\n');
  }
}

fs.writeFileSync(file, content);
console.log('Fixed syntax errors');
