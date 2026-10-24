import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createMailer } from './mail.js';
import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';

const config = loadConfig();
const db = openDb(config.databasePath);
const mailer = createMailer(config);
const app = createApp({ db, config, mailer });

if (config.scheduler) {
  startScheduler({ db, config, mailer });
} else {
  // Sans planificateur, on expire quand même les offres périmées toutes les heures.
  setInterval(() => db.expireJobs(), 60 * 60 * 1000).unref();
  db.expireJobs();
}

app.listen(config.port, () => {
  console.log(`Quatre Jours en ligne sur ${config.baseUrl} (port ${config.port})`);
  if (!config.production) console.log('Mode développement : paiements simulés, admin = « admin ».');
  if (config.production && !config.stripeSecretKey) console.log('Stripe non configuré : la publication d’offres est fermée.');
  if (config.scheduler && !config.franceTravailClientId) console.log('FT_CLIENT_ID absent : pas d’import France Travail.');
});
