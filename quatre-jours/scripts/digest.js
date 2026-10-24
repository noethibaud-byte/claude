// Email hebdomadaire des nouvelles offres. À lancer chaque lundi matin : npm run digest
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { createMailer } from '../src/mail.js';
import { buildDigest } from '../src/digest.js';

const config = loadConfig();
const db = openDb(config.databasePath);
const mailer = createMailer(config);
try {
  const jobs = db.publishedSince(7);
  const subscribers = db.activeSubscribers();
  if (!jobs.length) {
    console.log('Aucune nouvelle offre cette semaine : pas d’envoi.');
  } else {
    let sent = 0;
    for (const sub of subscribers) {
      try {
        await mailer.send(buildDigest({ config, jobs, subscriber: sub }));
        sent++;
      } catch (err) {
        console.error(`Échec pour ${sub.email} : ${err.message}`);
      }
    }
    console.log(`Email envoyé à ${sent} abonné(s) sur ${subscribers.length}, ${jobs.length} offre(s).`);
  }
} finally {
  db.close();
}
