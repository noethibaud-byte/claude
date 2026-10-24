import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'direct',          -- 'direct' (offre payante) ou 'france_travail'
  external_id TEXT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  company_url TEXT,
  city TEXT NOT NULL,
  postal_code TEXT,
  region TEXT,
  contract TEXT NOT NULL,
  schedule TEXT,                                  -- ex. « 4 × 8,75 h », « 32 h sur 4 jours »
  remote TEXT NOT NULL DEFAULT 'non',             -- 'non', 'partiel', 'total'
  salary_min INTEGER,
  salary_max INTEGER,
  description TEXT NOT NULL,
  apply_url TEXT,
  apply_email TEXT,
  contact_email TEXT,                             -- email privé de l'employeur
  status TEXT NOT NULL DEFAULT 'pending_payment', -- pending_payment, pending_review, published, rejected, expired, closed
  featured INTEGER NOT NULL DEFAULT 0,
  manage_token TEXT,
  stripe_session_id TEXT,
  amount_cents INTEGER,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT,
  expires_at TEXT,
  last_seen_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_external ON jobs(source, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status, featured, published_at);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  unsubscribed_at TEXT
);
`;

export function token() {
  return randomBytes(24).toString('base64url');
}

export function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'offre';
}

const PUBLIC_FILTERS = {
  q: (v) => ({ sql: `(title LIKE ? OR company LIKE ? OR description LIKE ?)`, args: [`%${v}%`, `%${v}%`, `%${v}%`] }),
  region: (v) => ({ sql: `region = ?`, args: [v] }),
  contrat: (v) => ({ sql: `contract = ?`, args: [v] }),
  teletravail: (v) => ({ sql: `remote = ?`, args: [v] }),
};

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);

  const stmt = (sql) => db.prepare(sql);

  function uniqueSlug(base) {
    let slug = base;
    for (let i = 2; stmt('SELECT 1 FROM jobs WHERE slug = ?').get(slug); i++) slug = `${base}-${i}`;
    return slug;
  }

  return {
    raw: db,

    createJob(job) {
      const slug = uniqueSlug(slugify(`${job.title} ${job.company} ${job.city}`));
      const manageToken = job.source === 'direct' || !job.source ? token() : null;
      const r = stmt(`INSERT INTO jobs
        (slug, source, external_id, title, company, company_url, city, postal_code, region, contract, schedule,
         remote, salary_min, salary_max, description, apply_url, apply_email, contact_email, status, featured,
         manage_token, amount_cents, published_at, expires_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        slug, job.source || 'direct', job.external_id ?? null, job.title, job.company, job.company_url ?? null,
        job.city, job.postal_code ?? null, job.region ?? null, job.contract, job.schedule ?? null,
        job.remote || 'non', job.salary_min ?? null, job.salary_max ?? null, job.description,
        job.apply_url ?? null, job.apply_email ?? null, job.contact_email ?? null,
        job.status || 'pending_payment', job.featured ? 1 : 0, manageToken, job.amount_cents ?? null,
        job.published_at ?? null, job.expires_at ?? null, job.last_seen_at ?? null,
      );
      return this.getJob(Number(r.lastInsertRowid));
    },

    getJob(id) {
      return stmt('SELECT * FROM jobs WHERE id = ?').get(id);
    },
    getJobBySlug(slug) {
      return stmt('SELECT * FROM jobs WHERE slug = ?').get(slug);
    },
    getJobByManageToken(t) {
      return stmt('SELECT * FROM jobs WHERE manage_token = ?').get(t);
    },
    getJobByExternal(source, externalId) {
      return stmt('SELECT * FROM jobs WHERE source = ? AND external_id = ?').get(source, externalId);
    },

    setStripeSession(id, sessionId) {
      stmt('UPDATE jobs SET stripe_session_id = ? WHERE id = ?').run(sessionId, id);
    },

    // Appelé par le webhook Stripe (ou directement en développement). Idempotent.
    markPaid(id, { autoPublish, durationDays }) {
      const job = this.getJob(id);
      if (!job || job.status !== 'pending_payment') return job;
      stmt(`UPDATE jobs SET paid_at = datetime('now'), status = 'pending_review' WHERE id = ?`).run(id);
      if (autoPublish) return this.publish(id, durationDays);
      return this.getJob(id);
    },

    publish(id, durationDays) {
      stmt(`UPDATE jobs SET status = 'published', published_at = datetime('now'),
            expires_at = datetime('now', ?) WHERE id = ?`).run(`+${durationDays} days`, id);
      return this.getJob(id);
    },
    setStatus(id, status) {
      stmt('UPDATE jobs SET status = ? WHERE id = ?').run(status, id);
      return this.getJob(id);
    },
    setFeatured(id, featured) {
      stmt('UPDATE jobs SET featured = ? WHERE id = ?').run(featured ? 1 : 0, id);
    },

    // Offres importées : création ou mise à jour, selon l'identifiant d'origine.
    upsertImported(job) {
      const existing = this.getJobByExternal(job.source, job.external_id);
      if (existing) {
        stmt(`UPDATE jobs SET title = ?, company = ?, city = ?, postal_code = ?, region = ?, contract = ?,
              schedule = ?, salary_min = ?, salary_max = ?, description = ?, apply_url = ?,
              last_seen_at = datetime('now'),
              status = CASE WHEN status = 'expired' THEN 'published' ELSE status END
              WHERE id = ?`).run(
          job.title, job.company, job.city, job.postal_code ?? null, job.region ?? null, job.contract,
          job.schedule ?? null, job.salary_min ?? null, job.salary_max ?? null, job.description,
          job.apply_url ?? null, existing.id,
        );
        return { job: this.getJob(existing.id), created: false };
      }
      const created = this.createJob({
        ...job,
        status: 'published',
        published_at: job.published_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
        last_seen_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      });
      return { job: created, created: true };
    },

    expireJobs({ importedStaleDays = 3 } = {}) {
      const a = stmt(`UPDATE jobs SET status = 'expired'
        WHERE status = 'published' AND source = 'direct' AND expires_at < datetime('now')`).run();
      const b = stmt(`UPDATE jobs SET status = 'expired'
        WHERE status = 'published' AND source != 'direct' AND last_seen_at < datetime('now', ?)`).run(`-${importedStaleDays} days`);
      return Number(a.changes) + Number(b.changes);
    },

    listPublished({ filters = {}, page = 1, perPage = 30 } = {}) {
      const where = [`status = 'published'`];
      const args = [];
      for (const [key, build] of Object.entries(PUBLIC_FILTERS)) {
        const value = filters[key];
        if (value) {
          const f = build(value);
          where.push(f.sql);
          args.push(...f.args);
        }
      }
      const clause = where.join(' AND ');
      const total = stmt(`SELECT COUNT(*) AS n FROM jobs WHERE ${clause}`).get(...args).n;
      const rows = stmt(`SELECT * FROM jobs WHERE ${clause}
        ORDER BY featured DESC, published_at DESC, id DESC LIMIT ? OFFSET ?`).all(...args, perPage, (page - 1) * perPage);
      return { rows, total, pages: Math.max(1, Math.ceil(total / perPage)) };
    },

    regionCounts() {
      return stmt(`SELECT region, COUNT(*) AS n FROM jobs WHERE status = 'published' AND region IS NOT NULL
        GROUP BY region ORDER BY n DESC`).all();
    },

    listByStatus(status, limit = 200) {
      return stmt(`SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?`).all(status, limit);
    },

    publishedSince(days) {
      return stmt(`SELECT * FROM jobs WHERE status = 'published' AND published_at >= datetime('now', ?)
        ORDER BY featured DESC, published_at DESC`).all(`-${days} days`);
    },

    allPublishedSlugs() {
      return stmt(`SELECT slug, published_at FROM jobs WHERE status = 'published'`).all();
    },

    stats() {
      return stmt(`SELECT
        (SELECT COUNT(*) FROM jobs WHERE status = 'published') AS published,
        (SELECT COUNT(*) FROM jobs WHERE status = 'published' AND source = 'direct') AS direct,
        (SELECT COUNT(*) FROM jobs WHERE status = 'pending_review') AS pending,
        (SELECT COALESCE(SUM(amount_cents), 0) FROM jobs WHERE paid_at IS NOT NULL) AS revenue_cents,
        (SELECT COUNT(*) FROM subscribers WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL) AS subscribers`).get();
    },

    addSubscriber(email) {
      const existing = stmt('SELECT * FROM subscribers WHERE email = ?').get(email);
      if (existing) {
        if (existing.unsubscribed_at) {
          stmt('UPDATE subscribers SET unsubscribed_at = NULL, confirmed_at = NULL WHERE id = ?').run(existing.id);
        }
        return stmt('SELECT * FROM subscribers WHERE id = ?').get(existing.id);
      }
      stmt('INSERT INTO subscribers (email, token) VALUES (?, ?)').run(email, token());
      return stmt('SELECT * FROM subscribers WHERE email = ?').get(email);
    },
    confirmSubscriber(t) {
      const r = stmt(`UPDATE subscribers SET confirmed_at = COALESCE(confirmed_at, datetime('now')), unsubscribed_at = NULL
        WHERE token = ?`).run(t);
      return Number(r.changes) > 0;
    },
    unsubscribe(t) {
      const r = stmt(`UPDATE subscribers SET unsubscribed_at = datetime('now') WHERE token = ?`).run(t);
      return Number(r.changes) > 0;
    },
    activeSubscribers() {
      return stmt(`SELECT * FROM subscribers WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL`).all();
    },

    close() {
      db.close();
    },
  };
}
