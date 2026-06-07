import Enemy from './Enemy.js';

export default class EnemyManager {
  constructor(scene) {
    this.scene = scene;
    this.group = scene.physics.add.group();
    this.bossGroup = scene.physics.add.group();
    this.spawnTimer = 0;
    this.spawnInterval = 0.75;
    this.maxEnemies = 140;
    this.started = false;
    this.totalSpawned = 0;
  }

  start() { this.started = true; }

  update(dt, gameTime) {
    if (!this.started) return;
    // 시간이 지날수록 더 빠르게 생성
    this.spawnInterval = Math.max(0.12, 0.75 - gameTime * 0.0012);
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

    // 1분 이후: M02 등장
    if (gameTime > 60) {
      type = Phaser.Math.RND.pick(['M01', 'M02']);
    }

    // 2분 이후: M03 등장
    if (gameTime > 120) {
      type = Phaser.Math.RND.pick(['M01', 'M02', 'M03']);
    }

    // 3분 이후: M04, M05 등장
    if (gameTime > 180) {
      type = Phaser.Math.RND.pick(['M01', 'M02', 'M03', 'M04', 'M05']);
    }

    // 4분 이후: M06 등장
    if (gameTime > 240) {
      type = Phaser.Math.RND.pick(['M02', 'M03', 'M04', 'M05', 'M06']);
    }

    // 5분 이후: M07 등장
    if (gameTime > 300) {
      type = Phaser.Math.RND.pick(['M03', 'M04', 'M05', 'M06', 'M07']);
    }

    // 6분 이후: M08 등장
    if (gameTime > 360) {
      type = Phaser.Math.RND.pick(['M04', 'M05', 'M06', 'M07', 'M08']);
    }

    const player = this.scene.player.sprite;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);

    // 화면 밖에서 등장
    const distance = 600;
    const x = player.x + Math.cos(angle) * distance;
    const y = player.y + Math.sin(angle) * distance;

    const enemy = new Enemy(this.scene, x, y, type, gameTime);
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
