import BootScene from './scenes/BootScene.js';
import GameScene from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 960,
  height: 640,
  backgroundColor: '#000011',
  physics: { default: 'arcade', arcade: { debug: false } },
  scene: [BootScene, GameScene]
};

window.game = new Phaser.Game(config);
