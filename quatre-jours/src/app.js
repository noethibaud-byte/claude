import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { paymentsEnabled } from './config.js';
import { REGIONS, regionFromPostalCode, regionFromSlug, regionSlug } from './regions.js';
import { createCheckoutSession, verifyWebhook } from './stripe.js';
import { CONTRACTS, REMOTE_LABELS, priceLabel } from './views/html.js';
import { homePage, jobPage, postPage, managePage, messagePage, notFoundPage } from './views/pages.js';
import { adminPage } from './views/admin.js';
import { mentionsPage, privacyPage, cgvPage } from './views/legal.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function httpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const intOrNull = (v) => {
  const n = Number.parseInt(str(v).replace(/\s/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function validateJob(body) {
  const v = {
    title: str(body.title), company: str(body.company), company_url: str(body.company_url),
    city: str(body.city), postal_code: str(body.postal_code).toUpperCase(), contract: str(body.contract),
    remote: str(body.remote) || 'non', schedule: str(body.schedule), salary_min: str(body.salary_min),
    salary_max: str(body.salary_max), description: str(body.description), apply_url: str(body.apply_url),
    apply_email: str(body.apply_email), contact_email: str(body.contact_email), featured: body.featured === '1',
  };
  const e = {};
  const len = (key, min, max, label) => {
    if (v[key].length < min) e[key] = `${label} : au moins ${min} caractères.`;
    else if (v[key].length > max) e[key] = `${label} : ${max} caractères au maximum.`;
  };
  len('title', 3, 120, 'Intitulé');
  len('company', 2, 100, 'Entreprise');
  len('city', 2, 80, 'Ville');
  len('schedule', 3, 80, 'Organisation');
  len('description', 100, 10000, 'Description');
  if (!/^(\d{5}|2[AB]\d{3})$/.test(v.postal_code) || !regionFromPostalCode(v.postal_code)) e.postal_code = 'Code postal français à 5 chiffres.';
  if (!CONTRACTS.includes(v.contract)) e.contract = 'Choisissez un type de contrat.';
  if (!REMOTE_LABELS[v.remote]) v.remote = 'non';
  const min = intOrNull(v.salary_min), max = intOrNull(v.salary_max);
  if (v.salary_min && !min) e.salary_min = 'Montant annuel en euros, sans décimales.';
  if (v.salary_max && !max) e.salary_max = 'Montant annuel en euros, sans décimales.';
  if (min && max && max < min) e.salary_max = 'Le maximum doit être supérieur au minimum.';
  if (min && min < 5000) e.salary_min = 'Indiquez un salaire annuel (par exemple 32000), pas mensuel.';
  const companyUrl = v.company_url ? httpUrl(v.company_url) : null;
  if (v.company_url && !companyUrl) e.company_url = 'Adresse web complète, commençant par https://';
  const applyUrl = v.apply_url ? httpUrl(v.apply_url) : null;
  if (v.apply_url && !applyUrl) e.apply_url = 'Adresse web complète, commençant par https://';
  if (v.apply_email && !EMAIL_RE.test(v.apply_email)) e.apply_email = 'Adresse email invalide.';
  if (!v.apply_url && !v.apply_email) e.apply_url = 'Indiquez un lien ou un email pour recevoir les candidatures.';
  if (!EMAIL_RE.test(v.contact_email)) e.contact_email = 'Adresse email invalide.';
  if (body.cgv !== '1') e.cgv = 'Vous devez accepter les conditions de vente.';

  const job = {
    source: 'direct', title: v.title, company: v.company, company_url: companyUrl, city: v.city,
    postal_code: v.postal_code, region: regionFromPostalCode(v.postal_code), contract: v.contract,
    schedule: v.schedule, remote: v.remote, salary_min: min, salary_max: max, description: v.description,
    apply_url: applyUrl, apply_email: v.apply_email || null, contact_email: v.contact_email, featured: v.featured,
  };
  return { values: v, errors: e, job };
}

function rateLimiter({ max, windowMs }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const list = (hits.get(req.ip) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      res.status(429).send('Trop de tentatives. Réessayez dans quelques minutes.');
      return;
    }
    list.push(now);
    hits.set(req.ip, list);
    if (hits.size > 10000) hits.clear();
    next();
  };
}

export function createApp({ db, config, mailer, fetchImpl = fetch, log = console.log }) {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const csrfToken = createHmac('sha256', config.secret).update('admin-csrf').digest('base64url');
  const send = (res, page, status = 200) => res.status(status).type('html').send(String(page));
  const notFound = (res) => send(res, notFoundPage({ config }), 404);
  const manageUrl = (job) => `${config.baseUrl}/offre/gerer/${job.manage_token}`;

  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'none'; form-action 'self' https://checkout.stripe.com; frame-ancestors 'none'; base-uri 'none'",
    });
    next();
  });

  // Le webhook Stripe a besoin du corps brut pour vérifier la signature : déclaré avant le parseur de formulaires.
  app.post('/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    let event;
    try {
      event = verifyWebhook(req.body.toString('utf8'), req.get('stripe-signature'), config.stripeWebhookSecret);
    } catch (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (event.type === 'checkout.session.completed' && event.data?.object?.payment_status === 'paid') {
      const session = event.data.object;
      const job = db.getJob(Number(session.metadata?.job_id));
      if (job && job.stripe_session_id === session.id) await onPaid(job);
    }
    res.json({ received: true });
  });

  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.static(PUBLIC_DIR, { maxAge: config.production ? '7d' : 0 }));

  async function notifySafely(message) {
    try {
      await mailer.send(message);
    } catch (err) {
      log(`Échec d'envoi d'email à ${message.to} : ${err.message}`);
    }
  }

  async function onPaid(job) {
    const before = job.status;
    const updated = db.markPaid(job.id, { autoPublish: config.autoPublishPaid, durationDays: config.jobDurationDays });
    if (before !== 'pending_payment') return updated;
    if (config.adminEmail) {
      await notifySafely({
        to: config.adminEmail,
        subject: `Nouvelle offre payée : ${job.title}`,
        text: `${job.company} · ${job.city}\nÀ relire : ${config.baseUrl}/admin`,
      });
    }
    if (updated.status === 'published') await notifyPublished(updated);
    return updated;
  }

  async function notifyPublished(job) {
    if (job.source !== 'direct' || !job.contact_email) return;
    await notifySafely({
      to: job.contact_email,
      subject: `Votre offre « ${job.title} » est en ligne`,
      text: `Bonjour,\n\nVotre offre est en ligne : ${config.baseUrl}/offre/${job.slug}\n\nElle restera visible ${config.jobDurationDays} jours. Pour la retirer quand le poste est pourvu : ${manageUrl(job)}\n\nL'équipe Quatre Jours`,
    });
  }

  function readFilters(query) {
    return {
      q: str(query.q).slice(0, 80),
      region: REGIONS.includes(query.region) ? query.region : '',
      contrat: CONTRACTS.includes(query.contrat) ? query.contrat : '',
      teletravail: REMOTE_LABELS[query.teletravail] ? query.teletravail : '',
    };
  }
  const pageNumber = (query) => Math.min(1000, Math.max(1, Number.parseInt(query.page, 10) || 1));

  const newsletterMessages = {
    ok: 'Presque fini : confirmez votre inscription grâce au lien envoyé par email.',
    invalid: 'Adresse email invalide, ou case de consentement non cochée.',
  };

  app.get('/', (req, res) => {
    const filters = readFilters(req.query);
    const page = pageNumber(req.query);
    const result = db.listPublished({ filters, page });
    send(res, homePage({ config, result, filters, page, regionCounts: db.regionCounts(), newsletterMessage: newsletterMessages[req.query.nl] }));
  });

  app.get('/region/:slug', (req, res) => {
    const region = regionFromSlug(req.params.slug);
    if (!region) return notFound(res);
    const filters = { ...readFilters(req.query), region };
    const page = pageNumber(req.query);
    const result = db.listPublished({ filters, page });
    send(res, homePage({ config, result, filters: { ...filters, region: '' }, page, region, regionCounts: db.regionCounts(), newsletterMessage: newsletterMessages[req.query.nl] }));
  });

  app.get('/offre/:slug', (req, res) => {
    const job = db.getJobBySlug(req.params.slug);
    if (!job || !['published', 'expired', 'closed'].includes(job.status)) return notFound(res);
    send(res, jobPage({ config, job, newsletterMessage: newsletterMessages[req.query.nl] }));
  });

  // ---------- Recruteurs ----------
  const postLimiter = rateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

  app.get('/publier', (req, res) => send(res, postPage({ config, values: { contract: 'CDI', remote: 'non' } })));

  app.post('/publier', postLimiter, async (req, res, next) => {
    try {
      if (str(req.body.website)) return res.redirect(303, '/'); // pot de miel anti-robots
      const { values, errors, job } = validateJob(req.body);
      if (Object.keys(errors).length) return send(res, postPage({ config, values, errors }), 422);

      const created = db.createJob({ ...job, amount_cents: config.priceCents + (job.featured ? config.featuredPriceCents : 0) });
      await notifySafely({
        to: created.contact_email,
        subject: `Votre offre « ${created.title} » sur Quatre Jours`,
        text: `Bonjour,\n\nVoici le lien pour suivre, payer ou retirer votre offre :\n${manageUrl(created)}\n\nL'équipe Quatre Jours`,
      });
      await startPayment(res, created);
    } catch (err) {
      next(err);
    }
  });

  async function startPayment(res, job) {
    if (!paymentsEnabled(config)) {
      await onPaid(job);
      return res.redirect(303, `/publier/merci/${job.manage_token}`);
    }
    const session = await createCheckoutSession({ config, job, fetchImpl });
    db.setStripeSession(job.id, session.id);
    res.redirect(303, session.url);
  }

  app.get('/publier/merci/:token', (req, res) => {
    const job = db.getJobByManageToken(req.params.token);
    if (!job) return notFound(res);
    const message = job.status === 'pending_payment'
      ? 'Merci ! Le paiement est en cours de confirmation par Stripe. Actualisez cette page dans une minute.'
      : 'Merci, votre paiement est confirmé.';
    send(res, managePage({ config, job, message, paymentsOn: paymentsEnabled(config) }));
  });

  app.get('/offre/gerer/:token', (req, res) => {
    const job = db.getJobByManageToken(req.params.token);
    if (!job) return notFound(res);
    send(res, managePage({ config, job, paymentsOn: paymentsEnabled(config) }));
  });

  app.post('/offre/gerer/:token/payer', async (req, res, next) => {
    try {
      const job = db.getJobByManageToken(req.params.token);
      if (!job) return notFound(res);
      if (job.status !== 'pending_payment') return res.redirect(303, `/offre/gerer/${job.manage_token}`);
      await startPayment(res, job);
    } catch (err) {
      next(err);
    }
  });

  app.post('/offre/gerer/:token/retirer', (req, res) => {
    const job = db.getJobByManageToken(req.params.token);
    if (!job) return notFound(res);
    if (job.status === 'published') db.setStatus(job.id, 'closed');
    send(res, managePage({ config, job: db.getJob(job.id), message: 'Offre retirée. Merci et bon recrutement !', paymentsOn: paymentsEnabled(config) }));
  });

  // ---------- Email hebdomadaire ----------
  const newsletterLimiter = rateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

  app.post('/newsletter', newsletterLimiter, async (req, res, next) => {
    try {
      const back = (code) => {
        const ref = req.get('referer');
        let path = '/';
        try { if (ref && new URL(ref).origin === new URL(config.baseUrl).origin) path = new URL(ref).pathname; } catch { /* lien externe ignoré */ }
        res.redirect(303, `${path}?nl=${code}#newsletter`);
      };
      if (str(req.body.website)) return back('ok');
      const email = str(req.body.email).toLowerCase();
      if (!EMAIL_RE.test(email) || email.length > 200 || req.body.consent !== '1') return back('invalid');
      const sub = db.addSubscriber(email);
      if (!sub.confirmed_at) {
        await notifySafely({
          to: email,
          subject: 'Confirmez votre inscription à Quatre Jours',
          text: `Bonjour,\n\nPour recevoir chaque lundi les nouvelles offres en semaine de 4 jours, confirmez votre inscription :\n${config.baseUrl}/newsletter/confirmer/${sub.token}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
        });
      }
      back('ok');
    } catch (err) {
      next(err);
    }
  });

  app.get('/newsletter/confirmer/:token', (req, res) => {
    const ok = db.confirmSubscriber(req.params.token);
    send(res, messagePage({
      config,
      title: ok ? 'Inscription confirmée' : 'Lien invalide',
      text: ok ? 'Vous recevrez les nouvelles offres chaque lundi matin.' : 'Ce lien de confirmation n’est pas valide.',
      link: { href: '/', label: 'Voir les offres' },
    }), ok ? 200 : 404);
  });

  // GET affiche une confirmation (les antivirus de messagerie ouvrent les liens), POST désinscrit (RFC 8058).
  app.get('/newsletter/desinscription/:token', (req, res) => {
    send(res, messagePage({ config, title: 'Se désinscrire', text: 'Vous ne recevrez plus l’email hebdomadaire.', button: 'Confirmer la désinscription' }));
  });
  app.post('/newsletter/desinscription/:token', (req, res) => {
    db.unsubscribe(req.params.token);
    send(res, messagePage({ config, title: 'Désinscription confirmée', text: 'Vous ne recevrez plus l’email hebdomadaire.', link: { href: '/', label: 'Voir les offres' } }));
  });

  // ---------- Administration ----------
  function requireAdmin(req, res, next) {
    const header = req.get('authorization') || '';
    const [, encoded] = header.split(' ');
    const password = encoded ? Buffer.from(encoded, 'base64').toString('utf8').split(':').slice(1).join(':') : '';
    const a = Buffer.from(createHmac('sha256', config.secret).update(password).digest('hex'));
    const b = Buffer.from(createHmac('sha256', config.secret).update(config.adminPassword).digest('hex'));
    if (config.adminPassword && timingSafeEqual(a, b)) return next();
    res.set('WWW-Authenticate', 'Basic realm="Quatre Jours admin", charset="UTF-8"').status(401).send('Authentification requise');
  }

  app.get('/admin', requireAdmin, (req, res) => {
    const status = ['pending_review', 'published', 'pending_payment', 'rejected', 'expired'].includes(req.query.statut) ? req.query.statut : 'pending_review';
    send(res, adminPage({ config, status, jobs: db.listByStatus(status), stats: db.stats(), csrf: csrfToken, message: str(req.query.message) }));
  });

  app.post('/admin/offre/:id/:action', requireAdmin, async (req, res, next) => {
    try {
      const given = Buffer.from(str(req.body.csrf));
      const expected = Buffer.from(csrfToken);
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return res.status(403).send('Jeton invalide');
      const job = db.getJob(Number(req.params.id));
      if (!job) return notFound(res);
      let message = '';
      if (req.params.action === 'publier') {
        await notifyPublished(db.publish(job.id, config.jobDurationDays));
        message = 'Offre publiée.';
      } else if (req.params.action === 'refuser') {
        db.setStatus(job.id, 'rejected');
        message = job.paid_at && job.status !== 'published' ? `Offre refusée. Pensez à rembourser ${priceLabel(job.amount_cents || 0)} dans Stripe et à prévenir ${job.contact_email}.` : 'Offre retirée.';
      } else if (req.params.action === 'vedette') {
        db.setFeatured(job.id, !job.featured);
        message = job.featured ? 'Mise en avant retirée.' : 'Offre mise en avant.';
      } else {
        return notFound(res);
      }
      res.redirect(303, `/admin?statut=${job.status}&message=${encodeURIComponent(message)}`);
    } catch (err) {
      next(err);
    }
  });

  // ---------- Pages fixes et référencement ----------
  app.get('/mentions-legales', (req, res) => send(res, mentionsPage(config)));
  app.get('/confidentialite', (req, res) => send(res, privacyPage(config)));
  app.get('/cgv', (req, res) => send(res, cgvPage(config)));

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nDisallow: /offre/gerer/\nDisallow: /publier/merci/\nSitemap: ${config.baseUrl}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (req, res) => {
    const urls = [
      `${config.baseUrl}/`,
      `${config.baseUrl}/publier`,
      ...db.regionCounts().map((r) => `${config.baseUrl}/region/${regionSlug(r.region)}`),
      ...db.allPublishedSlugs().map((j) => `${config.baseUrl}/offre/${j.slug}`),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u.replace(/&/g, '&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`;
    res.type('application/xml').send(xml);
  });

  app.use((req, res) => notFound(res));

  app.use((err, req, res, _next) => {
    log(err);
    send(res, messagePage({ config, title: 'Une erreur est survenue', text: 'Réessayez dans un instant. Si le problème continue, écrivez-nous.', link: { href: '/', label: 'Retour à l’accueil' } }), 500);
  });

  return app;
}
