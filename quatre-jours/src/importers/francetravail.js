// Import des offres publiques de France Travail (API « Offres d'emploi v2 »).
// Identifiants gratuits à demander sur https://francetravail.io (application « Offres d'emploi v2 »).

import { detectFourDayWeek } from '../detect.js';
import { regionFromPostalCode, regionFromDepartment } from '../regions.js';

const TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire';
const SEARCH_URL = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search';
const SCOPE = 'api_offresdemploiv2 o2dsoffre';

export const SEARCH_KEYWORDS = ['semaine 4 jours', '4 jours par semaine', 'semaine de quatre jours', '4 jours travailles'];

const CONTRACTS = { CDI: 'CDI', CDD: 'CDD', MIS: 'Intérim', SAI: 'CDD', LIB: 'Freelance', FRA: 'Freelance', CCE: 'Freelance', DIN: 'CDI' };

export async function fetchToken({ clientId, clientSecret, fetchImpl = fetch }) {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret, scope: SCOPE }),
  });
  if (!res.ok) throw new Error(`France Travail : authentification refusée (${res.status})`);
  const data = await res.json();
  return data.access_token;
}

export async function searchOffers({ accessToken, keywords, maxResults = 450, fetchImpl = fetch }) {
  const offers = [];
  for (let start = 0; start < maxResults; start += 150) {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('motsCles', keywords);
    url.searchParams.set('range', `${start}-${Math.min(start + 149, maxResults - 1)}`);
    url.searchParams.set('publieeDepuis', '31');
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
    if (res.status === 204) break;
    if (!res.ok && res.status !== 206) throw new Error(`France Travail : recherche « ${keywords} » en échec (${res.status})`);
    const data = await res.json();
    const batch = data.resultats || [];
    offers.push(...batch);
    if (res.status !== 206 || batch.length < 150) break;
  }
  return offers;
}

// « Annuel de 30000,00 Euros à 35000,00 Euros », « Mensuel de 2100.0 Euros sur 12 mois »…
export function parseSalary(label) {
  if (!label) return { min: null, max: null };
  const nums = [...String(label).matchAll(/(\d[\d\s]*(?:[.,]\d+)?)\s*Euros?/gi)]
    .map((m) => Number.parseFloat(m[1].replace(/\s/g, '').replace(',', '.')))
    .filter(Number.isFinite);
  if (!nums.length) return { min: null, max: null };
  let factor = 1;
  if (/mensuel/i.test(label)) {
    const months = Number.parseFloat((label.match(/sur\s+(\d+(?:[.,]\d+)?)\s+mois/i) || [])[1]?.replace(',', '.') || '12');
    factor = months;
  } else if (/horaire/i.test(label)) {
    return { min: null, max: null }; // un taux horaire ne se compare pas à un salaire annuel
  }
  const values = nums.map((n) => Math.round(n * factor));
  return { min: Math.min(...values), max: values.length > 1 ? Math.max(...values) : null };
}

function cleanCity(lieu) {
  if (lieu?.commune && lieu?.libelle) {
    // « 69 - LYON 03 » → « Lyon 03 »
    const name = lieu.libelle.replace(/^\s*\w{2,3}\s*-\s*/, '');
    return titleCase(name);
  }
  return titleCase(lieu?.libelle || 'France');
}

function titleCase(s) {
  return String(s).toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());
}

export function mapOffer(offer) {
  const text = `${offer.intitule || ''}\n${offer.description || ''}\n${offer.dureeTravailLibelle || ''}\n${offer.complementExercice || ''}`;
  const detection = detectFourDayWeek(text);
  if (!detection.match) return null;

  const postal = offer.lieuTravail?.codePostal || null;
  const dep = (offer.lieuTravail?.libelle || '').match(/^\s*(\w{2,3})\s*-/)?.[1];
  const salary = parseSalary(offer.salaire?.libelle);
  return {
    source: 'france_travail',
    external_id: String(offer.id),
    title: offer.intitule?.trim() || 'Offre d’emploi',
    company: offer.entreprise?.nom?.trim() || 'Entreprise non communiquée',
    company_url: offer.entreprise?.url || null,
    city: cleanCity(offer.lieuTravail),
    postal_code: postal,
    region: regionFromPostalCode(postal) || regionFromDepartment(dep),
    contract: CONTRACTS[offer.typeContrat] || 'Autre',
    schedule: detection.phrase,
    remote: 'non',
    salary_min: salary.min,
    salary_max: salary.max,
    description: String(offer.description || '').trim(),
    apply_url: offer.origineOffre?.urlOrigine || `https://candidat.francetravail.fr/offres/recherche/detail/${encodeURIComponent(offer.id)}`,
    published_at: (offer.dateCreation || '').slice(0, 19).replace('T', ' ') || null,
  };
}

export async function importFranceTravail({ db, config, fetchImpl = fetch, log = console.log }) {
  if (!config.franceTravailClientId || !config.franceTravailClientSecret) {
    throw new Error('FT_CLIENT_ID et FT_CLIENT_SECRET sont nécessaires pour importer les offres France Travail.');
  }
  const accessToken = await fetchToken({ clientId: config.franceTravailClientId, clientSecret: config.franceTravailClientSecret, fetchImpl });
  const seen = new Set();
  const result = { fetched: 0, matched: 0, created: 0, updated: 0 };
  for (const keywords of SEARCH_KEYWORDS) {
    const offers = await searchOffers({ accessToken, keywords, fetchImpl });
    for (const offer of offers) {
      if (seen.has(offer.id)) continue;
      seen.add(offer.id);
      result.fetched++;
      const job = mapOffer(offer);
      if (!job) continue;
      result.matched++;
      const { created } = db.upsertImported(job);
      created ? result.created++ : result.updated++;
    }
    log(`« ${keywords} » : ${offers.length} offres reçues`);
  }
  return result;
}
