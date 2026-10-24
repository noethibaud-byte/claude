// Toute la configuration vient des variables d'environnement (voir .env.example).

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const config = {
    production,
    port: int(env.PORT, 3000),
    baseUrl: (env.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
    databasePath: env.DATABASE_PATH || 'data/quatre-jours.db',
    secret: env.SECRET || (production ? '' : 'dev-secret-a-changer'),
    adminPassword: env.ADMIN_PASSWORD || (production ? '' : 'admin'),
    adminEmail: env.ADMIN_EMAIL || '',

    priceCents: int(env.PRICE_CENTS, 9900),
    featuredPriceCents: int(env.FEATURED_PRICE_CENTS, 4900),
    jobDurationDays: int(env.JOB_DURATION_DAYS, 30),
    autoPublishPaid: env.AUTO_PUBLISH_PAID === 'true',

    stripeSecretKey: env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',

    smtpUrl: env.SMTP_URL || '',
    mailFrom: env.MAIL_FROM || 'Quatre Jours <bonjour@quatre-jours.fr>',

    franceTravailClientId: env.FT_CLIENT_ID || '',
    franceTravailClientSecret: env.FT_CLIENT_SECRET || '',

    legal: {
      name: env.LEGAL_NAME || '[Votre nom ou raison sociale]',
      address: env.LEGAL_ADDRESS || '[Votre adresse]',
      siret: env.LEGAL_SIRET || '[Votre numéro SIRET]',
      email: env.LEGAL_EMAIL || '[Votre email de contact]',
      hostName: env.HOST_NAME || '[Nom de l’hébergeur]',
      hostAddress: env.HOST_ADDRESS || '[Adresse de l’hébergeur]',
    },
  };

  if (production) {
    const missing = [];
    if (!config.secret) missing.push('SECRET');
    if (!config.adminPassword) missing.push('ADMIN_PASSWORD');
    if (!env.BASE_URL) missing.push('BASE_URL');
    if (!config.stripeSecretKey) missing.push('STRIPE_SECRET_KEY');
    if (!config.stripeWebhookSecret) missing.push('STRIPE_WEBHOOK_SECRET');
    if (missing.length) {
      throw new Error(`Variables d'environnement manquantes en production : ${missing.join(', ')}`);
    }
  }
  return config;
}

// Sans clé Stripe (développement uniquement), les offres sont considérées comme payées.
export function paymentsEnabled(config) {
  return Boolean(config.stripeSecretKey);
}
