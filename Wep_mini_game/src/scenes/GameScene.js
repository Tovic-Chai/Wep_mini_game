import Player from '../entities/Player.js';
import EnemyManager from '../entities/EnemyManager.js';
import Boss from '../entities/Boss.js';
import UI from '../ui/UI.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  create() {
    // ★ 뱀서라이크: 거대 월드 + 플레이어 추적 카메라
    const WORLD = 4000;
    this.physics.world.setBounds(-WORLD / 2, -WORLD / 2, WORLD, WORLD);

    // 배경: 화면에 고정된 tileSprite (카메라 스크롤 기반으로 별이 흘러가는 효과)
    this.bgFar  = this.add.tileSprite(480, 320, 960, 640, 'bg_space_far')
      .setScrollFactor(0).setDepth(-3);
    this.bgMid  = this.add.tileSprite(480, 320, 960, 640, 'bg_space_mid')
      .setScrollFactor(0).setDepth(-2);
    this.bgNear = this.add.tileSprite(480, 320, 960, 640, 'bg_space_near')
      .setScrollFactor(0).setDepth(-1);

    // 플레이어를 월드 중앙에 배치
    this.player = new Player(this, 0, 0);
    this.enemyManager = new EnemyManager(this);
    this.ui = new UI(this, this.player);

    // ★ 카메라가 플레이어를 부드럽게 따라감
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(-WORLD / 2, -WORLD / 2, WORLD, WORLD);

    this.gameTime = 0;
    this.spawnedMiniBosses = 0;
    this.boss = null;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SHIFT,R,SPACE');

    this.enemyManager.start();
  }

  update(time, delta) {
    const dt = delta / 1000;
    this.gameTime += dt;

    // ★ 배경이 카메라 이동에 따라 자연스럽게 흘러가는 시차 효과
    // 멀리 있는 별은 천천히, 가까운 별은 빠르게 흘러서 입체감 부여
    const cam = this.cameras.main;
    this.bgFar.tilePositionX  = cam.scrollX * 0.3;
    this.bgFar.tilePositionY  = cam.scrollY * 0.3;
    this.bgMid.tilePositionX  = cam.scrollX * 0.6;
    this.bgMid.tilePositionY  = cam.scrollY * 0.6;
    this.bgNear.tilePositionX = cam.scrollX * 1.0;
    this.bgNear.tilePositionY = cam.scrollY * 1.0;

    this.player.update(dt, this.cursors, this.keys);
    this.enemyManager.update(dt, this.gameTime);

    if (this.spawnedMiniBosses < 1 && this.gameTime >= 120) this.spawnMiniBoss(1);
    if (this.spawnedMiniBosses < 2 && this.gameTime >= 270) this.spawnMiniBoss(2);
    if (this.spawnedMiniBosses < 3 && this.gameTime >= 420) this.spawnMiniBoss(3);

    if (!this.boss && this.gameTime >= 540) this.spawnMainBoss();

    this.ui.update(this.gameTime);
  }

  spawnMiniBoss(index) {
    this.spawnedMiniBosses++;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const boss = new Boss(this, px, py - 280, 'mini' + index);
    this.enemyManager.addBoss(boss);
    boss.on('defeated', (skill) => {
      this.player.acquireSkill(skill);
      this.ui.showSkillAcquired(skill);
    });
  }

  spawnMainBoss() {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    this.boss = new Boss(this, px, py - 320, 'final');
    this.enemyManager.addBoss(this.boss);
    this.boss.on('defeated', () => this.ui.showResult(true, this.gameTime, this.player));
  }
}
