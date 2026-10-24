// Modèles de pages légales. À relire et compléter avant la mise en ligne (voir README).

import { html, priceLabel } from './html.js';
import { layout } from './pages.js';

function page(config, title, sections) {
  const body = html`<article class="legal">
    <h1>${title}</h1>
    ${sections.map(([h, ...ps]) => html`<h2>${h}</h2>${ps.map((p) => html`<p>${p}</p>`)}`)}
  </article>`;
  return layout({ config, title, body, canonical: null });
}

export function mentionsPage(config) {
  const l = config.legal;
  return page(config, 'Mentions légales', [
    ['Éditeur du site', `${l.name}, entrepreneur individuel. Adresse : ${l.address}. SIRET : ${l.siret}. Contact : ${l.email}.`, `Directeur de la publication : ${l.name}.`],
    ['Hébergement', `${l.hostName}, ${l.hostAddress}.`],
    ['Offres d’emploi', 'Les offres payantes sont rédigées par les recruteurs, qui en sont responsables. Les offres importées proviennent de l’API publique de France Travail et renvoient vers l’annonce d’origine.'],
  ]);
}

export function privacyPage(config) {
  const l = config.legal;
  return page(config, 'Politique de confidentialité', [
    ['Responsable du traitement', `${l.name}, ${l.email}.`],
    ['Données collectées', 'Email hebdomadaire : votre adresse email, la date d’inscription et de confirmation. Recruteurs : les informations de l’offre et votre email de contact. Les paiements sont traités par Stripe : nous ne voyons jamais vos coordonnées bancaires.'],
    ['Finalités et bases légales', 'Envoi de l’email hebdomadaire (consentement). Publication des offres et facturation (exécution du contrat et obligations comptables).'],
    ['Durée de conservation', 'Adresses email : jusqu’à la désinscription. Données de facturation : 10 ans, comme l’exige le Code de commerce. Offres expirées : 12 mois.'],
    ['Destinataires', 'Prestataire d’envoi d’emails, Stripe pour le paiement, hébergeur. Aucune donnée n’est vendue.'],
    ['Vos droits', `Accès, rectification, suppression, opposition : écrivez à ${l.email}. Vous pouvez aussi saisir la CNIL (cnil.fr).`],
    ['Cookies', 'Ce site n’utilise aucun cookie publicitaire ni de mesure d’audience nécessitant votre consentement.'],
  ]);
}

export function cgvPage(config) {
  return page(config, 'Conditions générales de vente', [
    ['Objet', 'Les présentes conditions encadrent la publication d’offres d’emploi payantes sur Quatre Jours par des professionnels.'],
    ['Prix', `Publication d’une offre pendant ${config.jobDurationDays} jours : ${priceLabel(config.priceCents)}. Option de mise en avant : ${priceLabel(config.featuredPriceCents)}. TVA non applicable, art. 293 B du CGI. Paiement par carte via Stripe, à la commande.`],
    ['Relecture et refus', 'Chaque offre est relue avant publication. Une offre peut être refusée si elle ne propose pas de semaine de 4 jours, si elle est discriminatoire au sens de l’article L1132-1 du Code du travail, trompeuse, ou sans lien avec un emploi réel. En cas de refus, le paiement est intégralement remboursé.'],
    ['Durée et retrait', 'L’offre reste en ligne pendant la durée achetée. Le recruteur peut la retirer à tout moment depuis son lien de gestion, sans remboursement de la période restante.'],
    ['Responsabilité', 'Le recruteur garantit l’exactitude de son offre et le respect du droit du travail. Quatre Jours ne garantit pas un nombre de candidatures.'],
    ['Droit applicable', 'Droit français. En cas de litige, une solution amiable sera recherchée avant toute action.'],
  ]);
}
