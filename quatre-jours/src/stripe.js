// Appels Stripe minimaux, sans SDK : création d'une session Checkout et vérification des webhooks.

import { createHmac, timingSafeEqual } from 'node:crypto';

export async function createCheckoutSession({ config, job, fetchImpl = fetch }) {
  const lines = [{ name: `Offre d'emploi 30 jours : ${job.title}`, amount: config.priceCents }];
  if (job.featured) lines.push({ name: 'Mise en avant en tête de liste', amount: config.featuredPriceCents });

  const params = new URLSearchParams({
    mode: 'payment',
    locale: 'fr',
    client_reference_id: String(job.id),
    'metadata[job_id]': String(job.id),
    success_url: `${config.baseUrl}/publier/merci/${job.manage_token}`,
    cancel_url: `${config.baseUrl}/offre/gerer/${job.manage_token}`,
    'invoice_creation[enabled]': 'true',
    'invoice_creation[invoice_data][footer]': 'TVA non applicable, art. 293 B du CGI',
  });
  if (job.contact_email) params.set('customer_email', job.contact_email);
  lines.forEach((line, i) => {
    params.set(`line_items[${i}][quantity]`, '1');
    params.set(`line_items[${i}][price_data][currency]`, 'eur');
    params.set(`line_items[${i}][price_data][unit_amount]`, String(line.amount));
    params.set(`line_items[${i}][price_data][product_data][name]`, line.name.slice(0, 250));
  });

  const res = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.stripeSecretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe : ${data.error?.message || res.status}`);
  return data;
}

export function verifyWebhook(rawBody, header, secret, { toleranceSeconds = 300, now = Date.now() } = {}) {
  if (!header || !secret) throw new Error('Signature Stripe absente');
  const parts = Object.groupBy(header.split(',').map((p) => p.split('=')), ([k]) => k);
  const timestamp = Number(parts.t?.[0]?.[1]);
  const signatures = (parts.v1 || []).map(([, v]) => v);
  if (!timestamp || !signatures.length) throw new Error('Signature Stripe mal formée');
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) throw new Error('Signature Stripe expirée');

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  const valid = signatures.some((sig) => {
    const given = Buffer.from(sig, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!valid) throw new Error('Signature Stripe invalide');
  return JSON.parse(rawBody);
}

export function signForTest(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}
