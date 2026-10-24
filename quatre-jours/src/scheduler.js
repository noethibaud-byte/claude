// Tâches récurrentes lancées par le serveur lui-même : pas de cron à configurer chez l'hébergeur.
// Import France Travail chaque jour dès 6 h, email hebdomadaire le lundi dès 7 h (heure de Paris).
// Les dates de dernière exécution sont gardées en base : un redémarrage ne provoque ni oubli ni doublon.

import { importFranceTravail } from './importers/francetravail.js';
import { sendDigest } from './digest.js';

const WEEKDAYS = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function parisTime(date = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short',
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: WEEKDAYS[parts.weekday] };
}

export function dueTasks(now, { lastImport, lastDigest, importRetryAfter }, { canImport, nowMs = Date.now() }) {
  const tasks = [];
  if (canImport && now.hour >= 6 && lastImport !== now.day && !(importRetryAfter && Number(importRetryAfter) > nowMs)) tasks.push('import');
  if (now.weekday === 1 && now.hour >= 7 && lastDigest !== now.day) tasks.push('digest');
  return tasks;
}

export function startScheduler({ db, config, mailer, log = console.log, intervalMs = 5 * 60 * 1000 }) {
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      db.expireJobs();
      const now = parisTime();
      const tasks = dueTasks(now, {
        lastImport: db.getMeta('last_import_day'),
        lastDigest: db.getMeta('last_digest_day'),
        importRetryAfter: db.getMeta('import_retry_after'),
      }, { canImport: Boolean(config.franceTravailClientId && config.franceTravailClientSecret) });

      if (tasks.includes('import')) {
        try {
          const r = await importFranceTravail({ db, config, log });
          db.setMeta('last_import_day', now.day);
          log(`Import France Travail : ${r.matched} offres en semaine de 4 jours (${r.created} nouvelles, ${r.updated} mises à jour).`);
        } catch (err) {
          db.setMeta('import_retry_after', Date.now() + 60 * 60 * 1000);
          log(`Import France Travail en échec, nouvel essai dans 1 h : ${err.message}`);
        }
        db.expireJobs();
      }
      if (tasks.includes('digest')) {
        db.setMeta('last_digest_day', now.day); // noté avant l'envoi : mieux vaut un oubli qu'un double envoi
        await sendDigest({ db, mailer, config, log });
      }
    } catch (err) {
      log(`Tâche planifiée en échec : ${err.message}`);
    } finally {
      running = false;
    }
  }

  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return { tick, stop: () => clearInterval(timer) };
}
