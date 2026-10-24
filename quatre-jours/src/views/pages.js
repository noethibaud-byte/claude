import { html, raw, paragraphs, salaryLabel, priceLabel, dateLabel, relativeDays, REMOTE_LABELS, CONTRACTS } from './html.js';
import { REGIONS, regionSlug } from '../regions.js';

const WEEK = ['L', 'M', 'M', 'J', 'V'];

function weekMark() {
  return html`<span class="week" aria-hidden="true">${WEEK.map((d, i) => html`<i class="${i < 4 ? 'on' : ''}">${d}</i>`)}</span>`;
}

export function layout({ title, description, canonical, body, config, head = '', noindex = false }) {
  const fullTitle = title ? `${title} · Quatre Jours` : 'Quatre Jours · Emplois en semaine de 4 jours';
  return html`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
<meta name="description" content="${description || 'Toutes les offres d’emploi en semaine de 4 jours en France, mises à jour chaque jour.'}">
${canonical ? html`<link rel="canonical" href="${config.baseUrl}${canonical}">` : ''}
${noindex ? html`<meta name="robots" content="noindex">` : ''}
<meta property="og:title" content="${fullTitle}">
<meta property="og:site_name" content="Quatre Jours">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
${head}
</head>
<body>
<header class="site">
  <div class="inner">
    <a class="logo" href="/">${weekMark()}<span>Quatre<b>Jours</b></span></a>
    <nav><a href="/#offres">Offres</a><a class="cta" href="/publier">Publier une offre</a></nav>
  </div>
</header>
<main class="inner">${body}</main>
<footer class="site">
  <div class="inner">
    <p><b>Quatre Jours</b> rassemble les offres d’emploi qui proposent une semaine de 4 jours. Les offres importées proviennent de France Travail et renvoient vers l’annonce d’origine.</p>
    <nav><a href="/mentions-legales">Mentions légales</a><a href="/confidentialite">Confidentialité</a><a href="/cgv">Conditions de vente</a><a href="/publier">Recruteurs</a></nav>
  </div>
</footer>
</body>
</html>`;
}

function jobMeta(job) {
  const salary = salaryLabel(job);
  return html`<div class="meta">
    <span>${job.city}</span><span>${job.contract}</span>
    ${job.schedule ? html`<span class="sched">${job.schedule}</span>` : ''}
    ${job.remote !== 'non' ? html`<span>${REMOTE_LABELS[job.remote]}</span>` : ''}
    ${salary ? html`<span class="sal">${salary}</span>` : ''}
  </div>`;
}

export function jobCard(job) {
  return html`<li class="job${job.featured ? ' featured' : ''}">
    <a href="/offre/${job.slug}">
      ${job.featured ? html`<span class="flag">Mise en avant</span>` : ''}
      <h3>${job.title}</h3>
      <p class="company">${job.company}</p>
      ${jobMeta(job)}
      <p class="when">${relativeDays(job.published_at)}${job.source === 'france_travail' ? ' · via France Travail' : ''}</p>
    </a>
  </li>`;
}

function select(name, label, options, current) {
  return html`<label for="f-${name}"><span>${label}</span>
    <select id="f-${name}" name="${name}">
      <option value="">Tous</option>
      ${options.map(([value, text]) => html`<option value="${value}"${value === current ? raw(' selected') : ''}>${text}</option>`)}
    </select></label>`;
}

function pagination(page, pages, filters, basePath) {
  if (pages <= 1) return '';
  const link = (p) => {
    const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), ...(p > 1 ? { page: String(p) } : {}) });
    const s = qs.toString();
    return `${basePath}${s ? `?${s}` : ''}#offres`;
  };
  return html`<nav class="pages" aria-label="Pages">
    ${page > 1 ? html`<a href="${link(page - 1)}">← Précédentes</a>` : html`<span></span>`}
    <span>Page ${page} sur ${pages}</span>
    ${page < pages ? html`<a href="${link(page + 1)}">Suivantes →</a>` : html`<span></span>`}
  </nav>`;
}

export function newsletterBox(message) {
  return html`<aside class="box newsletter" id="newsletter">
    <h2>Les nouvelles offres chaque lundi</h2>
    <p>Un email par semaine avec les offres en semaine de 4 jours publiées depuis 7 jours. Désinscription en un clic.</p>
    ${message ? html`<p class="notice">${message}</p>` : ''}
    <form method="post" action="/newsletter">
      <label for="nl-email" class="sr">Adresse email</label>
      <input id="nl-email" type="email" name="email" required placeholder="vous@exemple.fr" autocomplete="email">
      <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <label class="check"><input type="checkbox" name="consent" value="1" required> J’accepte de recevoir cet email hebdomadaire.</label>
      <button type="submit">Recevoir les offres</button>
    </form>
  </aside>`;
}

export function homePage({ config, result, filters, page, regionCounts, region, newsletterMessage }) {
  const heading = region ? `Emplois en semaine de 4 jours en ${region}` : 'Des emplois en semaine de 4 jours, partout en France';
  const basePath = region ? `/region/${regionSlug(region)}` : '/';
  const body = html`
  <section class="hero">
    <h1>${heading}</h1>
    <p class="lede">${result.total} offre${result.total > 1 ? 's' : ''} où l’on travaille 4 jours par semaine, vérifiées et mises à jour chaque matin.</p>
    <form class="filters" method="get" action="${basePath}" role="search">
      <label for="f-q" class="q"><span>Métier, entreprise, mot-clé</span><input id="f-q" name="q" value="${filters.q || ''}" placeholder="Ex. comptable, développeur, infirmière"></label>
      ${region ? '' : select('region', 'Région', REGIONS.map((r) => [r, r]), filters.region)}
      ${select('contrat', 'Contrat', CONTRACTS.map((c) => [c, c]), filters.contrat)}
      ${select('teletravail', 'Télétravail', Object.entries(REMOTE_LABELS), filters.teletravail)}
      <button type="submit">Rechercher</button>
    </form>
  </section>
  <div class="cols" id="offres">
    <section class="list" aria-label="Offres">
      ${result.rows.length
        ? html`<ul class="jobs">${result.rows.map(jobCard)}</ul>`
        : html`<div class="empty"><h2>Aucune offre ne correspond pour l’instant</h2><p>Essayez d’élargir la recherche, ou inscrivez-vous à l’email hebdomadaire pour être prévenu des nouvelles offres.</p></div>`}
      ${pagination(page, result.pages, filters, basePath)}
    </section>
    <div class="side">
      ${newsletterBox(newsletterMessage)}
      <aside class="box employer">
        <h2>Vous recrutez en semaine de 4 jours ?</h2>
        <p>Votre offre devant des candidats qui cherchent précisément ce rythme. ${priceLabel(config.priceCents)} pour ${config.jobDurationDays} jours, sans abonnement.</p>
        <a class="button" href="/publier">Publier une offre</a>
      </aside>
    </div>
  </div>
  ${regionCounts.length ? html`<section class="regions">
    <h2>Par région</h2>
    <ul>${regionCounts.map((r) => html`<li><a href="/region/${regionSlug(r.region)}">${r.region}</a> <span>${r.n}</span></li>`)}</ul>
  </section>` : ''}`;
  return layout({
    config,
    title: region ? `Semaine de 4 jours en ${region}` : null,
    description: region ? `Offres d’emploi en semaine de 4 jours en ${region}, mises à jour chaque jour.` : null,
    canonical: basePath,
    noindex: Boolean(filters.q || filters.contrat || filters.teletravail || filters.region || page > 1),
    body,
  });
}

const EMPLOYMENT_TYPE = { CDI: 'FULL_TIME', CDD: 'TEMPORARY', Freelance: 'CONTRACTOR', Stage: 'INTERN', Intérim: 'TEMPORARY', Alternance: 'OTHER' };

function jobPostingJsonLd(job, config) {
  const data = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: String(job.description).split(/\n\s*\n/).map((p) => `<p>${p.replace(/[<>&]/g, '')}</p>`).join(''),
    datePosted: (job.published_at || job.created_at).slice(0, 10),
    employmentType: EMPLOYMENT_TYPE[job.contract] || 'OTHER',
    hiringOrganization: { '@type': 'Organization', name: job.company, ...(job.company_url ? { sameAs: job.company_url } : {}) },
    jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.city, ...(job.postal_code ? { postalCode: job.postal_code } : {}), ...(job.region ? { addressRegion: job.region } : {}), addressCountry: 'FR' } },
    url: `${config.baseUrl}/offre/${job.slug}`,
  };
  if (job.expires_at) data.validThrough = job.expires_at.replace(' ', 'T') + 'Z';
  if (job.remote === 'total') data.jobLocationType = 'TELECOMMUTE';
  if (job.salary_min) {
    data.baseSalary = { '@type': 'MonetaryAmount', currency: 'EUR', value: { '@type': 'QuantitativeValue', minValue: job.salary_min, ...(job.salary_max ? { maxValue: job.salary_max } : {}), unitText: 'YEAR' } };
  }
  return raw(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
}

export function jobPage({ config, job, newsletterMessage }) {
  const live = job.status === 'published';
  const applyHref = job.apply_url || (job.apply_email ? `mailto:${job.apply_email}?subject=${encodeURIComponent(`Candidature : ${job.title}`)}` : null);
  const body = html`
  <p class="crumbs"><a href="/">Toutes les offres</a>${job.region ? html` · <a href="/region/${regionSlug(job.region)}">${job.region}</a>` : ''}</p>
  <div class="cols">
    <article class="offer">
      ${!live ? html`<p class="notice warn">Cette offre n’est plus en ligne.</p>` : ''}
      <h1>${job.title}</h1>
      <p class="company">${job.company_url ? html`<a href="${job.company_url}" rel="nofollow noopener" target="_blank">${job.company}</a>` : job.company}</p>
      ${jobMeta(job)}
      <p class="when">Publiée le ${dateLabel(job.published_at)}${job.source === 'france_travail' ? ' · Source : France Travail' : ''}</p>
      ${live && applyHref ? html`<p><a class="button big" href="${applyHref}" rel="nofollow noopener" target="_blank">${job.source === 'france_travail' ? 'Voir l’offre et postuler sur France Travail' : 'Postuler'}</a></p>` : ''}
      <div class="desc">${paragraphs(job.description)}</div>
      ${live && applyHref ? html`<p><a class="button" href="${applyHref}" rel="nofollow noopener" target="_blank">Postuler</a></p>` : ''}
    </article>
    <div class="side">${newsletterBox(newsletterMessage)}</div>
  </div>`;
  return layout({
    config,
    title: `${job.title} · ${job.company} · ${job.city}`,
    description: `${job.title} chez ${job.company} à ${job.city}, en semaine de 4 jours. ${job.contract}.`,
    canonical: `/offre/${job.slug}`,
    noindex: !live,
    head: live ? jobPostingJsonLd(job, config) : '',
    body,
  });
}

function field(name, label, { type = 'text', value = '', required = false, hint = '', attrs = '', error } = {}) {
  return html`<label for="p-${name}" class="field${error ? ' has-error' : ''}"><span>${label}${required ? '' : html` <em>facultatif</em>`}</span>
    <input id="p-${name}" name="${name}" type="${type}" value="${value ?? ''}"${required ? raw(' required') : ''} ${raw(attrs)}>
    ${hint ? html`<small>${hint}</small>` : ''}${error ? html`<small class="error">${error}</small>` : ''}</label>`;
}

export function postPage({ config, values = {}, errors = {} }) {
  const v = values;
  const body = html`
  <section class="hero narrow">
    <h1>Publier une offre en semaine de 4 jours</h1>
    <p class="lede">${priceLabel(config.priceCents)} pour ${config.jobDurationDays} jours en ligne, sans abonnement. Votre offre est relue avant publication, en général sous 24 h ouvrées.</p>
  </section>
  ${Object.keys(errors).length ? html`<p class="notice warn">Quelques champs sont à corriger avant de continuer.</p>` : ''}
  <form class="post" method="post" action="/publier" novalidate>
    <fieldset><legend>Le poste</legend>
      ${field('title', 'Intitulé du poste', { value: v.title, required: true, attrs: 'maxlength="120"', error: errors.title })}
      <div class="row">
        <label for="p-contract" class="field${errors.contract ? ' has-error' : ''}"><span>Contrat</span>
          <select id="p-contract" name="contract" required>${CONTRACTS.map((c) => html`<option${c === v.contract ? raw(' selected') : ''}>${c}</option>`)}</select></label>
        <label for="p-remote" class="field"><span>Télétravail</span>
          <select id="p-remote" name="remote">${Object.entries(REMOTE_LABELS).map(([k, t]) => html`<option value="${k}"${k === v.remote ? raw(' selected') : ''}>${t}</option>`)}</select></label>
      </div>
      ${field('schedule', 'Organisation de la semaine de 4 jours', { value: v.schedule, required: true, attrs: 'maxlength="80" placeholder="Ex. 4 × 8,75 h, vendredi libre"', hint: 'Les candidats veulent savoir comment la semaine est organisée : heures par jour, jour libre fixe ou tournant.', error: errors.schedule })}
      <div class="row">
        ${field('salary_min', 'Salaire annuel brut minimum (€)', { type: 'number', value: v.salary_min, attrs: 'min="0" step="500" placeholder="32000"', error: errors.salary_min })}
        ${field('salary_max', 'Salaire annuel brut maximum (€)', { type: 'number', value: v.salary_max, attrs: 'min="0" step="500" placeholder="38000"', error: errors.salary_max })}
      </div>
      <label for="p-description" class="field${errors.description ? ' has-error' : ''}"><span>Description du poste</span>
        <textarea id="p-description" name="description" rows="12" required maxlength="10000">${v.description || ''}</textarea>
        <small>Missions, profil recherché, avantages. Les offres discriminatoires (âge, sexe, origine…) sont refusées, comme l’impose le Code du travail.</small>
        ${errors.description ? html`<small class="error">${errors.description}</small>` : ''}</label>
    </fieldset>
    <fieldset><legend>L’entreprise et le lieu</legend>
      <div class="row">
        ${field('company', 'Nom de l’entreprise', { value: v.company, required: true, attrs: 'maxlength="100"', error: errors.company })}
        ${field('company_url', 'Site web', { type: 'url', value: v.company_url, attrs: 'placeholder="https://"', error: errors.company_url })}
      </div>
      <div class="row">
        ${field('city', 'Ville', { value: v.city, required: true, attrs: 'maxlength="80"', error: errors.city })}
        ${field('postal_code', 'Code postal', { value: v.postal_code, required: true, attrs: 'maxlength="5" inputmode="numeric" pattern="[0-9AB]{5}"', error: errors.postal_code })}
      </div>
    </fieldset>
    <fieldset><legend>Candidatures</legend>
      <div class="row">
        ${field('apply_url', 'Lien pour postuler', { type: 'url', value: v.apply_url, attrs: 'placeholder="https://"', error: errors.apply_url })}
        ${field('apply_email', 'Ou email de réception des candidatures', { type: 'email', value: v.apply_email, error: errors.apply_email })}
      </div>
      ${field('contact_email', 'Votre email (facture et gestion de l’offre, non publié)', { type: 'email', value: v.contact_email, required: true, error: errors.contact_email })}
    </fieldset>
    <fieldset class="pay"><legend>Options</legend>
      <label class="check"><input type="checkbox" name="featured" value="1"${v.featured ? raw(' checked') : ''}> Mettre l’offre en avant en tête de liste et dans l’email hebdomadaire (+ ${priceLabel(config.featuredPriceCents)})</label>
      <label class="check${errors.cgv ? ' has-error' : ''}"><input type="checkbox" name="cgv" value="1" required> <span>J’accepte les <a href="/cgv" target="_blank">conditions de vente</a>.</span></label>
      ${errors.cgv ? html`<small class="error">${errors.cgv}</small>` : ''}
      <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button type="submit" class="big">Continuer vers le paiement</button>
      <small>Paiement sécurisé par Stripe. TVA non applicable, art. 293 B du CGI.</small>
    </fieldset>
  </form>`;
  return layout({ config, title: 'Publier une offre', canonical: '/publier', body });
}

const STATUS_TEXT = {
  pending_payment: ['En attente de paiement', 'Le paiement n’a pas encore été reçu.'],
  pending_review: ['En cours de relecture', 'Paiement reçu. Votre offre sera relue et mise en ligne sous 24 h ouvrées. Vous recevrez un email à ce moment-là.'],
  published: ['En ligne', 'Votre offre est visible par les candidats.'],
  rejected: ['Refusée', 'Votre offre n’a pas été acceptée. Nous vous avons écrit pour expliquer pourquoi.'],
  expired: ['Expirée', 'La durée de publication est terminée.'],
  closed: ['Pourvue', 'Vous avez retiré cette offre.'],
};

export function managePage({ config, job, message, paymentsOn }) {
  const [label, text] = STATUS_TEXT[job.status] || [job.status, ''];
  const body = html`
  <section class="hero narrow">
    <p class="kicker">Gestion de votre offre</p>
    <h1>${job.title}</h1>
    <p class="lede">${job.company} · ${job.city}</p>
  </section>
  ${message ? html`<p class="notice">${message}</p>` : ''}
  <div class="box status">
    <p><span class="pill pill-${job.status}">${label}</span></p>
    <p>${text}</p>
    ${job.status === 'published' ? html`<p>En ligne jusqu’au ${dateLabel(job.expires_at)} · <a href="/offre/${job.slug}">Voir l’offre</a></p>` : ''}
    ${job.status === 'pending_payment' ? html`<form method="post" action="/offre/gerer/${job.manage_token}/payer"><button type="submit">${paymentsOn ? 'Payer et publier' : 'Valider (mode développement, sans paiement)'}</button></form>` : ''}
    ${job.status === 'published' ? html`<form method="post" action="/offre/gerer/${job.manage_token}/retirer"><button type="submit" class="secondary">Le poste est pourvu : retirer l’offre</button></form>` : ''}
  </div>
  <p class="small">Gardez ce lien : il permet de suivre et de retirer votre offre. Il vous a aussi été envoyé par email.</p>`;
  return layout({ config, title: 'Gestion de votre offre', noindex: true, body });
}

export function messagePage({ config, title, text, link, button }) {
  const body = html`<section class="hero narrow"><h1>${title}</h1><p class="lede">${text}</p>
    ${button ? html`<form method="post"><button type="submit">${button}</button></form>` : ''}
    ${link ? html`<p><a class="button" href="${link.href}">${link.label}</a></p>` : ''}</section>`;
  return layout({ config, title, noindex: true, body });
}

export function notFoundPage({ config }) {
  return messagePage({ config, title: 'Page introuvable', text: 'Cette offre a peut-être été retirée ou le lien est incomplet.', link: { href: '/', label: 'Voir toutes les offres' } });
}
