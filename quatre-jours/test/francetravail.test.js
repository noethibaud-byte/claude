import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapOffer, parseSalary, importFranceTravail } from '../src/importers/francetravail.js';
import { openDb } from '../src/db.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/francetravail-search.json', import.meta.url)));

test('convertit les salaires en annuel', () => {
  assert.deepEqual(parseSalary('Annuel de 30000,00 Euros à 35000,00 Euros'), { min: 30000, max: 35000 });
  assert.deepEqual(parseSalary('Mensuel de 2100.0 Euros sur 12 mois'), { min: 25200, max: null });
  assert.deepEqual(parseSalary('Mensuel de 2000 Euros à 2400 Euros sur 13 mois'), { min: 26000, max: 31200 });
  assert.deepEqual(parseSalary('Horaire de 12.5 Euros'), { min: null, max: null });
  assert.deepEqual(parseSalary(undefined), { min: null, max: null });
});

test('ne garde que les offres en semaine de 4 jours', () => {
  const [ok, teletravail] = fixture.resultats.map(mapOffer);
  assert.equal(teletravail, null);
  assert.equal(ok.title, 'Assistant administratif (H/F)');
  assert.equal(ok.city, 'Lyon 03');
  assert.equal(ok.region, 'Auvergne-Rhône-Alpes');
  assert.equal(ok.contract, 'CDI');
  assert.equal(ok.salary_min, 26000);
  assert.match(ok.apply_url, /^https:\/\/candidat\.francetravail\.fr\//);
});

test('importe, met à jour sans doublon et expire', async () => {
  const db = openDb(':memory:');
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes('access_token')) return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
    return new Response(JSON.stringify(fixture), { status: 200 });
  };
  const config = { franceTravailClientId: 'id', franceTravailClientSecret: 'secret' };
  const r1 = await importFranceTravail({ db, config, fetchImpl, log: () => {} });
  assert.equal(r1.created, 1);
  const r2 = await importFranceTravail({ db, config, fetchImpl, log: () => {} });
  assert.equal(r2.created, 0);
  assert.equal(r2.updated, 1);
  assert.equal(db.listPublished().total, 1);

  db.raw.exec(`UPDATE jobs SET last_seen_at = datetime('now', '-5 days')`);
  assert.equal(db.expireJobs(), 1);
  assert.equal(db.listPublished().total, 0);
});
