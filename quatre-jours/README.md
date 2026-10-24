# Quatre Jours

Site d'offres d'emploi en **semaine de 4 jours**, en France.

- Les candidats consultent gratuitement les offres, filtrent par région, contrat et télétravail, et reçoivent un email chaque lundi.
- Les recruteurs paient **99 €** pour publier une offre pendant 30 jours (+ 49 € pour la mettre en avant).
- Les offres publiques de France Travail qui mentionnent une semaine de 4 jours sont **importées automatiquement** chaque matin : le site n'est jamais vide, même au lancement.

## Ce qui tourne tout seul

| Tâche | Automatique ? |
|---|---|
| Import des offres France Travail et tri « vraie semaine de 4 jours » | Oui, chaque matin |
| Paiement des recruteurs, facture Stripe | Oui |
| Expiration des offres après 30 jours | Oui |
| Email hebdomadaire aux candidats | Oui, chaque lundi |
| Pages Google (sitemap, données structurées « Google for Jobs ») | Oui |
| Relecture des offres payantes avant publication | **Toi**, 2 minutes par offre sur `/admin` (désactivable avec `AUTO_PUBLISH_PAID=true`) |
| Remboursement si une offre est refusée | **Toi**, depuis le tableau de bord Stripe |

## Lancer le site en local

Il faut Node.js 22.9 ou plus récent.

```bash
npm install
npm run seed:dev   # ajoute 6 offres FICTIVES pour voir le rendu
npm run dev        # http://localhost:3000, admin : http://localhost:3000/admin (mot de passe « admin »)
npm test
```

En local, sans clé Stripe, le paiement est simulé.

## Mise en ligne : la liste à suivre

Le guide pas à pas pour Railway est dans [DEPLOIEMENT.md](DEPLOIEMENT.md). Le site peut démarrer sans Stripe : la publication d'offres reste alors fermée (jamais d'offre gratuite par erreur) et s'ouvre dès que les clés Stripe sont ajoutées.

1. **Statut** : créer une micro-entreprise (gratuit, sur autoentrepreneur.urssaf.fr). Le site affiche « TVA non applicable, art. 293 B du CGI » : à changer si tu dépasses le seuil de franchise de TVA.
2. **Nom de domaine** : par exemple chez OVH ou Gandi (environ 10 €/an).
3. **Hébergement** : n'importe quel hébergeur qui accepte Node.js ou Docker **avec un disque persistant** pour la base SQLite (Railway, Render, Fly.io, ou un petit VPS). Compter 5 à 10 €/mois.
4. **Stripe** : créer un compte, récupérer la clé secrète (`STRIPE_SECRET_KEY`), puis créer un webhook vers `https://ton-domaine/stripe/webhook` avec l'évènement `checkout.session.completed` et copier son secret (`STRIPE_WEBHOOK_SECRET`).
5. **France Travail** : créer un compte sur francetravail.io, créer une application et y ajouter l'API « Offres d'emploi v2 ». Copier l'identifiant et la clé (`FT_CLIENT_ID`, `FT_CLIENT_SECRET`). Relire les conditions d'utilisation de l'API : le site affiche la source et renvoie vers l'offre d'origine.
6. **Emails** : créer un compte Brevo (gratuit jusqu'à 300 emails par jour), récupérer l'accès SMTP (`SMTP_URL`) et authentifier ton domaine (SPF, DKIM) pour ne pas tomber en spam.
7. **Configuration** : copier `.env.example` en `.env` (ou dans les variables de l'hébergeur) et tout remplir, y compris les mentions légales. En production, le site refuse de démarrer s'il manque une clé indispensable.
8. **Tâches automatiques** : rien à configurer. Le serveur lance lui-même l'import France Travail chaque jour dès 6 h et l'email hebdomadaire le lundi dès 7 h (heure de Paris). `npm run import` et `npm run digest` restent disponibles pour un lancement manuel.
9. **Pages légales** : relire `/mentions-legales`, `/confidentialite` et `/cgv`. Ce sont des modèles raisonnables, pas un avis juridique.
10. **Google** : déclarer le site dans Google Search Console et y envoyer `https://ton-domaine/sitemap.xml`.

## Ta routine une fois lancé (1 à 3 h par semaine)

- Relire les offres payantes sur `/admin` et cliquer sur « Publier ».
- Jeter un œil aux offres importées : en retirer une qui serait hors sujet.
- Faire connaître le site : un post LinkedIn par semaine sur la semaine de 4 jours, contacter directement les entreprises qui recrutent dans ce rythme (elles sont dans la liste importée).

## Organisation du code

```
src/server.js              démarrage du serveur
src/app.js                 routes (offres, publication, paiement, newsletter, admin)
src/db.js                  base SQLite intégrée à Node (aucune dépendance native)
src/detect.js              repère les vraies semaines de 4 jours (et écarte « télétravail 4 jours sur 5 »)
src/importers/francetravail.js   import de l'API France Travail
src/stripe.js              paiement Stripe Checkout et vérification des webhooks
src/digest.js              contenu et envoi de l'email hebdomadaire
src/scheduler.js           import quotidien et email du lundi, lancés par le serveur
src/views/                 pages HTML (tout est échappé par défaut)
scripts/                   import, email hebdomadaire, données fictives
```
