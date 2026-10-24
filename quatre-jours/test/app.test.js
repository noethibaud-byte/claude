import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, adminAuth, validJob } from './helpers.js';
import { signForTest } from '../src/stripe.js';
import { validateJob } from '../src/app.js';

async function csrfFrom(t) {
  const page = await (await t.get('/admin', { headers: adminAuth() })).text();
  return page.match(/name="csrf" value="([^"]+)"/)?.[1];
}

test('validation du formulaire de publication', () => {
  assert.deepEqual(validateJob(validJob).errors, {});
  const { errors } = validateJob({ ...validJob, postal_code: '1234', apply_url: '', salary_min: '2500', cgv: '', company_url: 'javascript:alert(1)' });
  assert.ok(errors.postal_code && errors.apply_url && errors.salary_min && errors.cgv && errors.company_url);
});

test('parcours complet en développement : publication, relecture, mise en ligne', async () => {
  const t = await startApp();
  try {
    const res = await t.post('/publier', validJob);
    assert.equal(res.status, 303);
    const manage = res.headers.get('location');
    assert.match(manage, /^\/publier\/merci\//);

    const job = t.db.listByStatus('pending_review')[0];
    assert.equal(job.title, 'Comptable confirmé');
    assert.equal(job.region, 'Pays de la Loire');
    assert.equal(job.amount_cents, 9900);
    assert.equal((await t.get(`/offre/${job.slug}`)).status, 404, 'invisible avant relecture');
    assert.ok(t.mailer.sent.some((m) => m.to === 'rh@example.com' && m.text.includes('/offre/gerer/')));

    assert.equal((await t.get('/admin')).status, 401);
    const csrf = await csrfFrom(t);
    assert.equal((await t.post(`/admin/offre/${job.id}/publier`, { csrf: 'faux' }, { headers: adminAuth() })).status, 403);
    assert.equal((await t.post(`/admin/offre/${job.id}/publier`, { csrf }, { headers: adminAuth() })).status, 303);

    const page = await (await t.get(`/offre/${job.slug}`)).text();
    assert.match(page, /"@type":"JobPosting"/);
    assert.match(page, /4 × 8,75 h/);
    const home = await (await t.get('/')).text();
    assert.match(home, /Comptable confirmé/);
    assert.match(await (await t.get('/region/pays-de-la-loire')).text(), /Comptable confirmé/);
    assert.match(await (await t.get('/sitemap.xml')).text(), new RegExp(job.slug));
    assert.ok(t.mailer.sent.some((m) => m.subject.includes('est en ligne')));

    const retire = await t.post(`/offre/gerer/${job.manage_token}/retirer`, {});
    assert.equal(retire.status, 200);
    assert.doesNotMatch(await (await t.get('/')).text(), /Comptable confirmé/);
  } finally {
    await t.close();
  }
});

test('les champs saisis sont échappés', async () => {
  const t = await startApp();
  try {
    await t.post('/publier', { ...validJob, title: '<script>alert(1)</script> Poste' });
    const job = t.db.listByStatus('pending_review')[0];
    t.db.publish(job.id, 30);
    const page = await (await t.get(`/offre/${job.slug}`)).text();
    assert.doesNotMatch(page, /<script>alert/);
    assert.match(page, /&lt;script&gt;alert/);
  } finally {
    await t.close();
  }
});

test('paiement Stripe : redirection vers Checkout puis webhook signé', async () => {
  const stripeCalls = [];
  const fetchImpl = async (url, init) => {
    stripeCalls.push({ url: String(url), body: String(init.body) });
    return new Response(JSON.stringify({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' }), { status: 200 });
  };
  const t = await startApp({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_test' }, { fetchImpl });
  try {
    const res = await t.post('/publier', { ...validJob, featured: '1' });
    assert.equal(res.headers.get('location'), 'https://checkout.stripe.com/c/pay/cs_test_123');
    const params = new URLSearchParams(stripeCalls[0].body);
    assert.equal(params.get('line_items[0][price_data][unit_amount]'), '9900');
    assert.equal(params.get('line_items[1][price_data][unit_amount]'), '4900');

    const job = t.db.listByStatus('pending_payment')[0];
    assert.equal(job.amount_cents, 14800);
    const event = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_test_123', payment_status: 'paid', metadata: { job_id: String(job.id) } } } });

    const forged = await fetch(`${t.base}/stripe/webhook`, { method: 'POST', body: event, headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signForTest(event, 'mauvais') } });
    assert.equal(forged.status, 400);
    assert.equal(t.db.getJob(job.id).status, 'pending_payment');

    const ok = await fetch(`${t.base}/stripe/webhook`, { method: 'POST', body: event, headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signForTest(event, 'whsec_test') } });
    assert.equal(ok.status, 200);
    assert.equal(t.db.getJob(job.id).status, 'pending_review');
    assert.ok(t.db.getJob(job.id).paid_at);
  } finally {
    await t.close();
  }
});

test('email hebdomadaire : inscription, confirmation, désinscription', async () => {
  const t = await startApp();
  try {
    const refused = await t.post('/newsletter', { email: 'a@example.com' });
    assert.match(refused.headers.get('location'), /nl=invalid/);
    const res = await t.post('/newsletter', { email: 'A@Example.com', consent: '1' });
    assert.match(res.headers.get('location'), /nl=ok/);
    const mail = t.mailer.sent.find((m) => m.to === 'a@example.com');
    const confirmPath = new URL(mail.text.match(/https?:\/\/\S+/)[0]).pathname;
    assert.equal(t.db.activeSubscribers().length, 0);
    assert.equal((await t.get(confirmPath)).status, 200);
    const [sub] = t.db.activeSubscribers();
    assert.equal(sub.email, 'a@example.com');
    await t.get(`/newsletter/desinscription/${sub.token}`);
    assert.equal(t.db.activeSubscribers().length, 1, 'un simple GET ne désinscrit pas');
    await t.post(`/newsletter/desinscription/${sub.token}`, {});
    assert.equal(t.db.activeSubscribers().length, 0);
  } finally {
    await t.close();
  }
});

test('la production refuse de démarrer sans configuration', async () => {
  const { loadConfig } = await import('../src/config.js');
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /SECRET.*ADMIN_PASSWORD/);
});

test('en production sans Stripe, la publication est fermée', async () => {
  const t = await startApp({ NODE_ENV: 'production', SECRET: 's', ADMIN_PASSWORD: 'p', BASE_URL: 'https://exemple.fr', SCHEDULER: 'false' });
  try {
    assert.equal((await t.get('/')).status, 200);
    assert.equal((await t.get('/healthz')).status, 200);
    assert.equal((await t.get('/publier')).status, 503);
    assert.equal((await t.post('/publier', validJob)).status, 503);
    assert.equal(t.db.listByStatus('pending_review').length, 0);
  } finally {
    await t.close();
  }
});
