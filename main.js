import Phaser from 'phaser';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scene: {
    preload,
    create,
    update
  }
};

function preload() {
  // load assets here if needed
}

function create() {
  this.add.text(100, 100, 'Hello Phaser!', { fontSize: '32px', fill: '#fff' });
}

function update() {}

new Phaser.Game(config);
