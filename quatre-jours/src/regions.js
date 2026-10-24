import { slugify } from './db.js';

export const REGIONS = [
  'Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse',
  'Grand Est', 'Hauts-de-France', 'Île-de-France', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie',
  'Pays de la Loire', "Provence-Alpes-Côte d'Azur", 'Guadeloupe', 'Martinique', 'Guyane', 'La Réunion', 'Mayotte',
];

const BY_DEPARTMENT = {
  'Auvergne-Rhône-Alpes': ['01', '03', '07', '15', '26', '38', '42', '43', '63', '69', '73', '74'],
  'Bourgogne-Franche-Comté': ['21', '25', '39', '58', '70', '71', '89', '90'],
  Bretagne: ['22', '29', '35', '56'],
  'Centre-Val de Loire': ['18', '28', '36', '37', '41', '45'],
  Corse: ['20', '2A', '2B'],
  'Grand Est': ['08', '10', '51', '52', '54', '55', '57', '67', '68', '88'],
  'Hauts-de-France': ['02', '59', '60', '62', '80'],
  'Île-de-France': ['75', '77', '78', '91', '92', '93', '94', '95'],
  Normandie: ['14', '27', '50', '61', '76'],
  'Nouvelle-Aquitaine': ['16', '17', '19', '23', '24', '33', '40', '47', '64', '79', '86', '87'],
  Occitanie: ['09', '11', '12', '30', '31', '32', '34', '46', '48', '65', '66', '81', '82'],
  'Pays de la Loire': ['44', '49', '53', '72', '85'],
  "Provence-Alpes-Côte d'Azur": ['04', '05', '06', '13', '83', '84'],
  Guadeloupe: ['971'],
  Martinique: ['972'],
  Guyane: ['973'],
  'La Réunion': ['974'],
  Mayotte: ['976'],
};

const DEPARTMENT_TO_REGION = Object.fromEntries(
  Object.entries(BY_DEPARTMENT).flatMap(([region, deps]) => deps.map((d) => [d, region])),
);

export function regionFromPostalCode(postalCode) {
  const code = String(postalCode || '').trim().toUpperCase();
  if (!/^(\d{5}|2[AB]\d{3})$/.test(code)) return null;
  if (code.startsWith('97')) return DEPARTMENT_TO_REGION[code.slice(0, 3)] || null;
  return DEPARTMENT_TO_REGION[code.slice(0, 2)] || null;
}

export function regionFromDepartment(dep) {
  return DEPARTMENT_TO_REGION[String(dep || '').toUpperCase()] || null;
}

export const regionSlug = (region) => slugify(region);
export const regionFromSlug = (slug) => REGIONS.find((r) => regionSlug(r) === slug) || null;
