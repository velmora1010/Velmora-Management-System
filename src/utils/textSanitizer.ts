/**
 * Safely decodes HTML/XML character entities (such as &#xA0;, &nbsp;, &#160;, &amp;, etc.)
 * and normalizes whitespace without mutating database records or altering legitimate text.
 */
export function decodeHtmlEntities(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw);
  if (!str) return '';

  // 1. Decode hexadecimal numeric entities (e.g. &#xA0;, &#xa0;, &#x20;)
  str = str.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    try {
      const code = parseInt(hex, 16);
      if (code === 0xA0 || code === 0x20) return ' '; // Non-breaking space / space -> regular space
      if (code === 0x2D || code === 0x2013 || code === 0x2014) return '-'; // dashes
      return String.fromCharCode(code);
    } catch {
      return match;
    }
  });

  // 2. Decode decimal numeric entities (e.g. &#160;, &#38;, &#39;, &#8211;, &#8212;)
  str = str.replace(/&#([0-9]+);/g, (match, dec) => {
    try {
      const code = parseInt(dec, 10);
      if (code === 160 || code === 32) return ' '; // Non-breaking space -> regular space
      if (code === 8211 || code === 8212) return '-'; // en-dash / em-dash
      return String.fromCharCode(code);
    } catch {
      return match;
    }
  });

  // 3. Named HTML entities
  str = str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ndash;/gi, '-')
    .replace(/&mdash;/gi, '-')
    .replace(/&hellip;/gi, '…');

  // 4. Unicode non-breaking space (\u00A0)
  str = str.replace(/\u00A0/g, ' ');

  // 5. Mojibake repair for mis-decoded UTF-8 dashes
  str = str
    .replace(/\u00e2\u0080\u0094/g, '-')
    .replace(/\u00e2\u0080\u0093/g, '-')
    .replace(/â€”/g, '-')
    .replace(/â€“/g, '-');

  return str;
}
