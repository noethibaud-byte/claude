// Import quotidien des offres France Travail, puis expiration des offres périmées.
// À lancer chaque matin (cron ou tâche planifiée de l'hébergeur) : npm run import
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { importFranceTravail } from '../src/importers/francetravail.js';

const config = loadConfig();
const db = openDb(config.databasePath);
try {
  const r = await importFranceTravail({ db, config });
  const expired = db.expireJobs();
  console.log(`Import terminé : ${r.fetched} offres lues, ${r.matched} en semaine de 4 jours, ${r.created} nouvelles, ${r.updated} mises à jour, ${expired} expirées.`);
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  db.close();
}
