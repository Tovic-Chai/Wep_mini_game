import Enemy from './Enemy.js';

export default class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.group = scene.physics.add.group();
    this.bossGroup = scene.physics.add.group();
    this.spawnTimer = 0;
    this.spawnInterval = 1.0;
    this.maxEnemies = 60;
    this.started = false;
    this.totalSpawned = 0;
  }

  start() { this.started = true; }

  update(dt, gameTime) {
    if (!this.started) return;
    this.spawnInterval = Math.max(0.2, 1.0 - gameTime * 0.0009);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.spawnInterval;
      if (this.group.countActive(true) < this.maxEnemies) this.spawnEnemy(gameTime);
    }

    this.group.children.each(child => {
      if (child.parentRef) child.parentRef.update(dt);
    });
    this.bossGroup.children.each(child => {
      if (child.parentRef) child.parentRef.update(dt);
    });
  }

  // ★ 플레이어 주위 360도 어디서나 스폰 (화면 가장자리 바로 바깥)
  spawnEnemy(gameTime) {
    let type = 'M01';
    if (gameTime > 60)  type = Phaser.Math.RND.pick(['M01', 'M02']);
    if (gameTime > 120) type = Phaser.Math.RND.pick(['M01', 'M02', 'M03']);

    const player = this.scene.player.sprite;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    // 화면 대각선 길이가 약 577px, 안전하게 600px 거리에 스폰
    const distance = 600;
    const x = player.x + Math.cos(angle) * distance;
    const y = player.y + Math.sin(angle) * distance;

    const enemy = new Enemy(this.scene, x, y, type);
    this.group.add(enemy.sprite);
    this.totalSpawned++;
  }

  addBoss(boss) {
    this.bossGroup.add(boss.sprite);
  }

  onEnemyKilled(enemy) {
    if (enemy && enemy.sprite && enemy.sprite.active) enemy.sprite.destroy();
  }

  clearAll() {
    this.group.clear(true, true);
    this.bossGroup.clear(true, true);
  }
}
