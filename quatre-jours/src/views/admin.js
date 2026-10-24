import { html, priceLabel, dateLabel, salaryLabel } from './html.js';
import { layout } from './pages.js';

const TABS = [
  ['pending_review', 'À relire'],
  ['published', 'En ligne'],
  ['pending_payment', 'Non payées'],
  ['rejected', 'Refusées'],
  ['expired', 'Expirées'],
];

function actions(job, csrf) {
  const btn = (action, label, cls = '') => html`<form method="post" action="/admin/offre/${job.id}/${action}">
    <input type="hidden" name="csrf" value="${csrf}"><button type="submit" class="${cls}">${label}</button></form>`;
  const list = [];
  if (job.status === 'pending_review' || job.status === 'rejected' || job.status === 'expired') list.push(btn('publier', 'Publier'));
  if (job.status === 'pending_review' || job.status === 'published') list.push(btn('refuser', job.status === 'published' ? 'Retirer' : 'Refuser', 'secondary'));
  if (job.status === 'published') list.push(btn('vedette', job.featured ? 'Retirer la mise en avant' : 'Mettre en avant', 'secondary'));
  return list;
}

export function adminPage({ config, status, jobs, stats, csrf, message }) {
  const body = html`
  <section class="hero narrow"><h1>Administration</h1></section>
  ${message ? html`<p class="notice">${message}</p>` : ''}
  <dl class="stats">
    <div><dt>Offres en ligne</dt><dd>${stats.published}</dd></div>
    <div><dt>Dont offres payantes</dt><dd>${stats.direct}</dd></div>
    <div><dt>À relire</dt><dd>${stats.pending}</dd></div>
    <div><dt>Chiffre d’affaires total</dt><dd>${priceLabel(stats.revenue_cents)}</dd></div>
    <div><dt>Abonnés à l’email</dt><dd>${stats.subscribers}</dd></div>
  </dl>
  <nav class="tabs">${TABS.map(([key, label]) => html`<a href="/admin?statut=${key}"${key === status ? html` aria-current="page"` : ''}>${label}</a>`)}</nav>
  ${jobs.length ? html`<ul class="admin-jobs">${jobs.map((job) => html`<li>
    <div class="head">
      <div>
        <h3><a href="/offre/${job.slug}" target="_blank">${job.title}</a></h3>
        <p>${job.company} · ${job.city} · ${job.contract}${job.schedule ? ` · ${job.schedule}` : ''}${salaryLabel(job) ? ` · ${salaryLabel(job)}` : ''}</p>
        <p class="small">${job.source === 'direct' ? `Offre payante${job.amount_cents ? ` (${priceLabel(job.amount_cents)})` : ''} · ${job.contact_email || ''}` : 'Importée de France Travail'} · créée le ${dateLabel(job.created_at)}${job.featured ? ' · mise en avant' : ''}</p>
      </div>
      <div class="actions">${actions(job, csrf)}</div>
    </div>
    ${status === 'pending_review' ? html`<details><summary>Lire la description</summary><pre>${job.description}</pre></details>` : ''}
  </li>`)}</ul>` : html`<p class="empty">Rien dans cette liste.</p>`}`;
  return layout({ config, title: 'Administration', noindex: true, body });
}
