import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseAiDisc } from '../src/systems/ai';
import type { DiscSpec } from '../src/types/models';
import { PUTTER_MAX_FT } from '../src/systems/config';

const baseDiscs: DiscSpec[] = [
  { id: 'p', name: 'Putter', slot: 'putter', speed: 2, glide: 3, turn: 0, fade: 1 },
  { id: 'm', name: 'Mid', slot: 'midrange', speed: 5, glide: 4, turn: 0, fade: 1 },
  { id: 'd', name: 'Driver', slot: 'driver', speed: 10, glide: 5, turn: 0, fade: 1 }
];

test('selects a putter when remainingFt is within PUTTER_MAX_FT', () => {
  const disc = chooseAiDisc(baseDiscs, PUTTER_MAX_FT);
  assert.equal(disc.id, 'p');
});

test('selects a midrange when remainingFt is between PUTTER_MAX_FT and MID_MAX_FT', () => {
  const disc = chooseAiDisc(baseDiscs, PUTTER_MAX_FT + 1);
  assert.equal(disc.id, 'm');
});

test('selects a driver or fairway when remainingFt exceeds MID_MAX_FT', () => {
  const disc = chooseAiDisc(baseDiscs, 300);
  assert.equal(disc.id, 'd');
});

test('falls back to available discs when driver/fairway slots are missing', () => {
  const bag: DiscSpec[] = [
    { id: 'p', name: 'Putter', slot: 'putter', speed: 2, glide: 3, turn: 0, fade: 1 }
  ];
  const disc = chooseAiDisc(bag, 300);
  assert.equal(disc.id, 'p');
});

