// Repère les offres qui proposent réellement une semaine de 4 jours.
// Le piège principal : « télétravail 4 jours sur 5 » ou « présentiel 4 jours par semaine »,
// qui parlent du lieu de travail et non du nombre de jours travaillés.

const PATTERNS = [
  /semaine\s+(?:de\s+|en\s+)?(?:4|quatre)\s*(?:jours|j)\b/i,
  /(?:4|quatre)\s+jours\s+(?:de\s+travail\s+|travaill[ée]s\s+)?(?:par|\/|sur\s+la)\s*semaine/i,
  /\b4\s*j\s*\/\s*sem(?:aine)?\b/i,
  /(?:4|quatre)\s+jours\s+travaill[ée]s/i,
  /(?:4|quatre)\s+jours\s+sur\s+(?:5|cinq)\b/i,
  /\b(?:32|35)\s*h(?:eures)?\s+(?:sur|en)\s+(?:4|quatre)\s+jours/i,
  /\b4\s*[x×]\s*\d{1,2}(?:[,.]\d{1,2}\s*h|\s*h(?:\d{2})?)\b/i, // « 4 × 8,75 h », « 4x9h », « 4 x 8h45 »
];

// Mots qui, juste avant la mention, indiquent qu'on parle du lieu de travail.
const LOCATION_CONTEXT = /(t[ée]l[ée]\s*-?\s*travail|remote|distanciel|pr[ée]sentiel|sur\s+site|au\s+bureau|en\s+agence|d[ée]placements?|sur\s+la\s+route|en\s+itin[ée]rance)[^.\n]{0,25}$/i;
const LOCATION_AFTER = /^[^.\n]{0,20}(t[ée]l[ée]\s*-?\s*travail|remote|en\s+distanciel|en\s+pr[ée]sentiel|sur\s+site|au\s+bureau)/i;

export function detectFourDayWeek(text) {
  const source = String(text || '');
  for (const pattern of PATTERNS) {
    const re = new RegExp(pattern.source, 'gi');
    let m;
    while ((m = re.exec(source))) {
      const before = source.slice(Math.max(0, m.index - 60), m.index);
      const after = source.slice(m.index + m[0].length, m.index + m[0].length + 40);
      if (LOCATION_CONTEXT.test(before) || LOCATION_AFTER.test(after)) continue;
      return { match: true, phrase: m[0].trim(), snippet: excerpt(source, m.index, m[0].length) };
    }
  }
  return { match: false };
}

function excerpt(text, index, length) {
  const start = Math.max(0, index - 70);
  const end = Math.min(text.length, index + length + 70);
  return (start > 0 ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
}
