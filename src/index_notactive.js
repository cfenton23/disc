import Phaser from 'phaser';
import MainMenuScene from './scenes/mainMenuScene.js';
import TournamentScene from './scenes/TournamentScene.ts';

const config = {
  type: Phaser.AUTO,
  parent: 'game', // make sure index.html has <div id="game"></div>
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
