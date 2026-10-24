import { loadConfig } from './config.js';
import { openDb } from './db.js';
import { createMailer } from './mail.js';
import { createApp } from './app.js';

const config = loadConfig();
const db = openDb(config.databasePath);
const mailer = createMailer(config);
const app = createApp({ db, config, mailer });

// Expiration des offres toutes les heures, en plus de l'import quotidien.
setInterval(() => db.expireJobs(), 60 * 60 * 1000).unref();
db.expireJobs();

app.listen(config.port, () => {
  console.log(`Quatre Jours en ligne sur ${config.baseUrl} (port ${config.port})`);
  if (!config.production) console.log('Mode développement : paiements simulés, admin = « admin ».');
});
