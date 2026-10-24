// Offres FICTIVES pour voir le site en local. Refusé en production.
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { regionFromPostalCode } from '../src/regions.js';

const config = loadConfig();
if (config.production) {
  console.error('seed:dev est réservé au développement.');
  process.exit(1);
}
const db = openDb(config.databasePath);
const desc = (role) => `Exemple fictif généré pour le développement.\n\nNous recherchons une personne pour le poste de ${role}. L'équipe travaille du lundi au jeudi, le vendredi est libre pour tout le monde, sans baisse de salaire.\n\nProfil : autonomie, goût du travail en équipe, envie d'un rythme qui laisse du temps pour vivre.`;
const samples = [
  ['Développeuse ou développeur back-end', 'Exemple Logiciels', 'Lyon', '69003', 'CDI', '4 × 8,75 h, vendredi libre', 'partiel', 48000, 55000, true],
  ['Chargé·e de clientèle', 'Exemple Assurances', 'Bordeaux', '33000', 'CDI', '32 h sur 4 jours', 'non', 28000, 31000, false],
  ['Technicien·ne de maintenance', 'Exemple Industrie', 'Rennes', '35000', 'CDI', '4 × 9 h', 'non', 30000, 34000, false],
  ['Comptable', 'Exemple Conseil', 'Nantes', '44000', 'CDI', 'Lundi au jeudi, 35 h', 'partiel', 34000, 40000, false],
  ['Infirmier·e coordinateur·rice', 'Exemple Santé', 'Lille', '59000', 'CDD', '4 jours de 8 h 45', 'non', 32000, null, false],
  ['Product designer', 'Exemple Studio', 'Paris', '75011', 'CDI', '4 jours, mercredi libre', 'total', 50000, 60000, false],
];
for (const [title, company, city, postal, contract, schedule, remote, min, max, featured] of samples) {
  const job = db.createJob({
    source: 'direct', title, company, city, postal_code: postal, region: regionFromPostalCode(postal), contract, schedule,
    remote, salary_min: min, salary_max: max, description: desc(title), apply_url: 'https://example.com/postuler',
    contact_email: 'recruteur@example.com', featured, status: 'pending_review',
  });
  db.publish(job.id, config.jobDurationDays);
}
console.log(`${samples.length} offres fictives ajoutées dans ${config.databasePath}.`);
db.close();
