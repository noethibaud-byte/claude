// Mini-moteur de gabarits : tout ce qui est interpolé est échappé, sauf ce qui passe par raw().

class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

export const raw = (value) => new Raw(String(value));

export function escape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function render(value) {
  if (value === null || value === undefined || value === false) return '';
  if (Array.isArray(value)) return value.map(render).join('');
  if (value instanceof Raw) return value.value;
  return escape(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  values.forEach((v, i) => { out += render(v) + strings[i + 1]; });
  return new Raw(out);
}

// Texte brut saisi par un employeur ou importé → paragraphes HTML sûrs.
export function paragraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => html`<p>${raw(escape(p).replace(/\n/g, '<br>'))}</p>`);
}

const euro = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export function salaryLabel(job) {
  const k = (n) => `${euro.format(Math.round(n / 1000))} k€`;
  if (job.salary_min && job.salary_max) return `${k(job.salary_min)} – ${k(job.salary_max)}`;
  if (job.salary_min) return `dès ${k(job.salary_min)}`;
  return null;
}

export function priceLabel(cents) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function dateLabel(sqlDate) {
  if (!sqlDate) return '';
  const d = new Date(sqlDate.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? '' : dateFmt.format(d);
}

export function relativeDays(sqlDate, now = Date.now()) {
  if (!sqlDate) return '';
  const d = new Date(sqlDate.replace(' ', 'T') + 'Z');
  const days = Math.floor((now - d.getTime()) / 86400000);
  if (days <= 0) return 'aujourd’hui';
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} jours`;
  return dateLabel(sqlDate);
}

export const REMOTE_LABELS = { non: 'Sur site', partiel: 'Télétravail partiel', total: 'Télétravail complet' };
export const CONTRACTS = ['CDI', 'CDD', 'Freelance', 'Alternance', 'Stage', 'Intérim'];
