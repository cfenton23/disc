/**
 * EventBus: thin wrapper over Phaser.Events.EventEmitter.
 * Event names used:
 * TOURNAMENT_START, HOLE_START, TURN_START,
 * THROW_AIM_CHANGED, THROW_POWER_STARTED, THROW_POWER_COMMITTED, THROW_RESOLVED,
 * SHOT_END, HOLE_END, ROUND_END, LEADERBOARD_UPDATED, BAG_CHANGED
 */
import Phaser from 'phaser';

export class EventBus extends Phaser.Events.EventEmitter {}

