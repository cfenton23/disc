// src/index.ts
// Bootstraps Phaser with our two scenes. Kept small and obvious for troubleshooting.

import Phaser from 'phaser';
import MainMenuScene from './scenes/mainMenuScene';
import TournamentScene from './scenes/TournamentScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b1b0e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1920,
    height: 1080
  },
  scene: [MainMenuScene, TournamentScene]
};

new Phaser.Game(config);

