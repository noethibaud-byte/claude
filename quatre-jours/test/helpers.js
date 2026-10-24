import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { createMailer } from '../src/mail.js';

export async function startApp(env = {}, { fetchImpl } = {}) {
  const config = loadConfig({ NODE_ENV: 'test', DATABASE_PATH: ':memory:', ...env });
  const db = openDb(':memory:');
  const mailer = createMailer(config, { log: () => {} });
  const app = createApp({ db, config, mailer, fetchImpl, log: () => {} });
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  config.baseUrl = base;
  return {
    base, db, config, mailer,
    close: () => new Promise((r) => server.close(r)),
    get: (path, opts = {}) => fetch(base + path, { redirect: 'manual', ...opts }),
    post: (path, form, opts = {}) => fetch(base + path, {
      method: 'POST', redirect: 'manual', body: new URLSearchParams(form),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(opts.headers || {}) },
    }),
  };
}

export const adminAuth = (password = 'admin') => ({ Authorization: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}` });

export const validJob = {
  title: 'Comptable confirmé',
  company: 'Société Test',
  city: 'Nantes',
  postal_code: '44000',
  contract: 'CDI',
  remote: 'partiel',
  schedule: '4 × 8,75 h, vendredi libre',
  salary_min: '34000',
  salary_max: '40000',
  description: 'Nous recherchons une personne pour tenir la comptabilité de nos clients. '.repeat(3),
  apply_url: 'https://example.com/postuler',
  contact_email: 'rh@example.com',
  cgv: '1',
};
