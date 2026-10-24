// Envoi manuel de l'email hebdomadaire (le serveur l'envoie déjà seul chaque lundi) : npm run digest
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { createMailer } from '../src/mail.js';
import { sendDigest } from '../src/digest.js';

const config = loadConfig();
const db = openDb(config.databasePath);
try {
  await sendDigest({ db, mailer: createMailer(config), config });
} finally {
  db.close();
}
