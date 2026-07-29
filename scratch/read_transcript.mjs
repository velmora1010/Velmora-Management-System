import fs from 'fs';
import readline from 'readline';

async function searchLog() {
  const logPath = 'C:/Users/certa/.gemini/antigravity/brain/a331148b-f361-4b8b-8bb2-7f6757eda3f4/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('CommandLine') && (line.includes('ALTER') || line.includes('sql') || line.includes('supabase') || line.includes('migration'))) {
      console.log(line);
    }
  }
}

searchLog();
