import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectFourDayWeek } from '../src/detect.js';

const yes = [
  'Poste en semaine de 4 jours, vendredi libre.',
  'Organisation : 4 jours par semaine (35 h).',
  'Rythme 4j/semaine',
  'Semaine de quatre jours possible après la période d’essai.',
  '35h sur 4 jours',
  'Horaires : 4 x 8h45',
  'Nous travaillons 4 jours sur 5 avec un salaire maintenu.',
  '4 jours travaillés, du lundi au jeudi.',
];
const no = [
  'Télétravail 4 jours par semaine possible.',
  'Télétravail possible 4 jours sur 5.',
  'Présentiel 4 jours sur 5 à l’agence.',
  'Poste à pourvoir sous 4 jours.',
  '4 jours par semaine en télétravail.',
  'Semaine de 35 heures, du lundi au vendredi.',
];

test('reconnaît les vraies semaines de 4 jours', () => {
  for (const text of yes) assert.equal(detectFourDayWeek(text).match, true, text);
});

test('ignore le télétravail et le présentiel', () => {
  for (const text of no) assert.equal(detectFourDayWeek(text).match, false, text);
});
