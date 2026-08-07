import * as fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const keys = [];
envText.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=/);
  if (match) keys.push(match[1]);
});

console.log('Available ENV keys:', keys);
