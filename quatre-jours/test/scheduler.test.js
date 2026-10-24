import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parisTime, dueTasks } from '../src/scheduler.js';

test('heure de Paris, été comme hiver', () => {
  assert.deepEqual(parisTime(new Date('2026-07-06T04:30:00Z')), { day: '2026-07-06', hour: 6, weekday: 1 });
  assert.deepEqual(parisTime(new Date('2026-12-06T23:30:00Z')), { day: '2026-12-07', hour: 0, weekday: 1 });
});

test('import une fois par jour dès 6 h, email le lundi dès 7 h', () => {
  const monday8 = { day: '2026-10-26', hour: 8, weekday: 1 };
  assert.deepEqual(dueTasks(monday8, {}, { canImport: true }), ['import', 'digest']);
  assert.deepEqual(dueTasks(monday8, { lastImport: '2026-10-26', lastDigest: '2026-10-26' }, { canImport: true }), []);
  assert.deepEqual(dueTasks({ ...monday8, hour: 5 }, {}, { canImport: true }), []);
  assert.deepEqual(dueTasks({ day: '2026-10-27', hour: 9, weekday: 2 }, { lastImport: '2026-10-26' }, { canImport: true }), ['import']);
  assert.deepEqual(dueTasks(monday8, {}, { canImport: false }), ['digest']);
  assert.deepEqual(dueTasks(monday8, { importRetryAfter: String(2e12) }, { canImport: true, nowMs: 1e12 }), ['digest']);
});
