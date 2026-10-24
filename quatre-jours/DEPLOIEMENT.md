# Mettre Quatre Jours en ligne avec Railway

Compter environ **1 h 30** au total, en plusieurs fois si besoin. Le site peut être en ligne dès l'étape 5 : les étapes suivantes ajoutent les offres France Travail, les emails, ton nom de domaine, puis le paiement.

**Coûts** : Railway environ 5 $/mois (forfait Hobby), nom de domaine environ 10 €/an. France Travail et Brevo sont gratuits. Stripe prend une commission sur chaque paiement (environ 1,5 % + 0,25 € pour une carte européenne).

> Les noms de menus de Railway, Stripe ou Brevo peuvent changer légèrement. Si tu ne trouves pas un bouton, envoie-moi une capture d'écran.

---

## Étape 1 · Créer le compte Railway (5 min)

1. Va sur **railway.com** et clique sur **Login**, puis **Login with GitHub**. Utilise le compte GitHub qui possède le dépôt `noethibaud-byte/claude`.
2. Choisis le forfait **Hobby** et ajoute une carte bancaire.

## Étape 2 · Créer le projet depuis GitHub (5 min)

1. Clique sur **New Project**, puis **Deploy from GitHub repo**.
2. Autorise Railway à accéder au dépôt **noethibaud-byte/claude** et sélectionne-le.
3. Un premier déploiement démarre et **va échouer** : c'est normal, il manque encore les réglages.

## Étape 3 · Indiquer où se trouve le site (2 min)

Clique sur le service créé, puis sur l'onglet **Settings** :

- **Source › Branch** : `claude/themes-site-rentable-gl5e0p`
- **Source › Root Directory** : `/quatre-jours`

Railway trouve alors le fichier `railway.json` et construit le site avec le `Dockerfile`.

## Étape 4 · Ajouter le disque permanent (2 min)

Sans cette étape, toutes les offres et les abonnés seraient effacés à chaque mise à jour.

1. Sur le service, fais un **clic droit**, ou utilise le bouton **+ Create** du projet, puis choisis **Volume**.
2. **Mount path** : `/app/data`

## Étape 5 · Les variables de base, puis le premier lancement (10 min)

1. Onglet **Settings › Networking** : clique sur **Generate Domain**. Tu obtiens une adresse du type `quatre-jours-production.up.railway.app`.
2. Onglet **Variables**, ajoute :

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `BASE_URL` | l'adresse générée, avec `https://` devant et sans `/` à la fin |
| `DATABASE_PATH` | `/app/data/quatre-jours.db` |
| `SECRET` | une longue suite de lettres et de chiffres au hasard (40 caractères ou plus), à ne communiquer à personne |
| `ADMIN_PASSWORD` | ton mot de passe pour la page `/admin` |
| `ADMIN_EMAIL` | ton email, pour être prévenu des offres payées |
| `LEGAL_NAME`, `LEGAL_ADDRESS`, `LEGAL_SIRET`, `LEGAL_EMAIL` | tes informations de micro-entrepreneur |
| `HOST_NAME` | `Railway Corporation` |
| `HOST_ADDRESS` | l'adresse postale indiquée dans les conditions d'utilisation de Railway |

3. Railway redéploie automatiquement. Quand le statut passe au vert :
   - `https://ton-adresse/healthz` doit afficher **ok** ;
   - `https://ton-adresse/admin` doit demander un mot de passe (identifiant : n'importe lequel ; mot de passe : `ADMIN_PASSWORD`).

À ce stade, le site est en ligne mais vide, et la page « Publier une offre » indique que la publication ouvre bientôt.

## Étape 6 · Brancher les offres France Travail (15 min)

1. Va sur **francetravail.io**, crée un compte partenaire et connecte-toi.
2. Crée une **application** (nom : Quatre Jours, usage : site d'offres d'emploi), puis ajoute-lui l'API **« Offres d'emploi v2 »**.
3. Copie l'**identifiant client** et la **clé secrète** dans les variables Railway :
   - `FT_CLIENT_ID`
   - `FT_CLIENT_SECRET`
4. Lis les conditions d'utilisation de l'API. Le site affiche déjà la source « France Travail » et renvoie vers l'offre d'origine.
5. Après le redéploiement, l'import se lance tout seul (immédiatement s'il est plus de 6 h, sinon le lendemain matin). Dans l'onglet **Deployments › View logs**, tu dois voir une ligne `Import France Travail : … offres en semaine de 4 jours`.

## Étape 7 · Les emails avec Brevo (15 min)

1. Crée un compte gratuit sur **brevo.com**.
2. Va dans **SMTP & API › SMTP** et génère une **clé SMTP**.
3. Ajoute dans Railway :
   - `SMTP_URL` = `smtp://IDENTIFIANT:CLE_SMTP@smtp-relay.brevo.com:587`. Remplace l'identifiant et la clé par ceux affichés par Brevo. Si la clé contient des caractères spéciaux comme `@` ou `/`, envoie-moi un message et je te dirai comment l'écrire.
   - `MAIL_FROM` = `Quatre Jours <bonjour@ton-domaine.fr>`
4. Tant que ton domaine n'est pas authentifié chez Brevo (étape 8), les emails risquent d'arriver en spam.

## Étape 8 · Ton nom de domaine (20 min, plus le temps de propagation)

1. Achète le domaine, par exemple `quatre-jours.fr` chez OVH ou Gandi. Vérifie d'abord qu'il est libre.
2. Dans Railway, va dans **Settings › Networking › Custom Domain** et saisis ton domaine. Railway affiche un enregistrement DNS (un CNAME) à créer chez ton registrar.
3. Une fois le domaine actif, change `BASE_URL` pour `https://ton-domaine.fr`.
4. Dans Brevo, va dans **Expéditeurs et domaines** et authentifie le domaine : ajoute chez ton registrar les enregistrements DNS proposés (SPF, DKIM, DMARC).

## Étape 9 · Ouvrir la publication payante avec Stripe (20 min)

1. Crée un compte sur **stripe.com** et active-le avec ton SIRET et ton IBAN.
2. **Teste d'abord en mode test** (interrupteur « Mode test » dans Stripe) :
   - **Développeurs › Clés API** : copie la clé secrète `sk_test_…` dans `STRIPE_SECRET_KEY` ;
   - **Développeurs › Webhooks › Ajouter un endpoint** : URL `https://ton-domaine.fr/stripe/webhook`, évènement `checkout.session.completed`. Copie le **secret de signature** `whsec_…` dans `STRIPE_WEBHOOK_SECRET`.
3. Publie une offre de test sur ton site et paie avec la carte `4242 4242 4242 4242` (date future, n'importe quel code). L'offre doit apparaître dans `/admin`, onglet **À relire**.
4. Quand tout fonctionne, refais la même chose en **mode réel**, avec des clés `sk_live_…` et un nouveau webhook, et remplace les deux variables.

## Étape 10 · Être visible sur Google (10 min)

1. Va sur **Google Search Console** et ajoute ton domaine.
2. Dans **Sitemaps**, envoie `https://ton-domaine.fr/sitemap.xml`.
3. Les offres sont balisées pour **Google for Jobs** : elles peuvent apparaître dans le module emploi de Google, en général après quelques jours ou quelques semaines.

---

## En cas de problème

- **Le déploiement échoue** : ouvre **Deployments › View logs** et envoie-moi les dernières lignes. Ne recopie jamais les valeurs de `SECRET`, `ADMIN_PASSWORD` ni les clés.
- **« Variables d'environnement manquantes en production »** : le message donne le nom de la variable à ajouter.
- **Le site a perdu ses données après une mise à jour** : le volume n'est pas monté sur `/app/data` (étape 4).
