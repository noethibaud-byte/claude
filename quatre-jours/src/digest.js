import { html, salaryLabel } from './views/html.js';

const MAX_JOBS = 25;

export function buildDigest({ config, jobs, subscriber }) {
  const list = jobs.slice(0, MAX_JOBS);
  const unsubscribe = `${config.baseUrl}/newsletter/desinscription/${subscriber.token}`;
  const line = (j) => [j.title, j.company, j.city, j.contract, j.schedule, salaryLabel(j)].filter(Boolean).join(' · ');
  const text = [
    `${jobs.length} nouvelle${jobs.length > 1 ? 's' : ''} offre${jobs.length > 1 ? 's' : ''} en semaine de 4 jours cette semaine.`,
    '',
    ...list.map((j) => `${j.featured ? '★ ' : ''}${line(j)}\n${config.baseUrl}/offre/${j.slug}\n`),
    jobs.length > MAX_JOBS ? `Et ${jobs.length - MAX_JOBS} autres sur ${config.baseUrl}\n` : '',
    `Se désinscrire : ${unsubscribe}`,
  ].join('\n');
  const body = html`<div style="font-family:system-ui,sans-serif;max-width:600px;margin:auto;color:#1e1b16">
    <h1 style="font-size:22px">${jobs.length} nouvelle${jobs.length > 1 ? 's' : ''} offre${jobs.length > 1 ? 's' : ''} en semaine de 4 jours</h1>
    ${list.map((j) => html`<p style="margin:0 0 16px;padding:12px;border:1px solid ${j.featured ? '#2b7a3d' : '#e8e1d0'}">
      <a href="${config.baseUrl}/offre/${j.slug}" style="color:#2b7a3d;font-weight:600;font-size:16px">${j.title}</a><br>
      <span style="color:#6e665a">${[j.company, j.city, j.contract, j.schedule, salaryLabel(j)].filter(Boolean).join(' · ')}</span></p>`)}
    ${jobs.length > MAX_JOBS ? html`<p><a href="${config.baseUrl}">Voir les ${jobs.length - MAX_JOBS} autres offres</a></p>` : ''}
    <p style="color:#6e665a;font-size:12px">Vous recevez cet email car vous êtes inscrit à Quatre Jours. <a href="${unsubscribe}">Se désinscrire</a></p>
  </div>`;
  return {
    to: subscriber.email,
    subject: `${jobs.length} nouvelle${jobs.length > 1 ? 's' : ''} offre${jobs.length > 1 ? 's' : ''} en semaine de 4 jours`,
    text,
    html: String(body),
    headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
  };
}
