import PassiveWeapon from './PassiveWeapon.js';

/**
 * 자동 공격 드론 무기
 * 플레이어 주변을 따라다니며 가까운 적에게 총알을 자동 발사한다.
 */
export default class DroneWeapon extends PassiveWeapon {
  constructor(scene, player) {
    super(scene, player, 'drone');

    this.drones = [];
    this.bullets = [];

    this._ensureTextures();
    this.applyLevelStats();
    this._syncDrones();
  }

  applyLevelStats() {
    const STATS = [
      null,
      { damage: 12, count: 1, cooldown: 0.85, bulletSpeed: 430, range: 520, orbitRadius: 45 }, // Lv1
      { damage: 18, count: 1, cooldown: 0.70, bulletSpeed: 470, range: 580, orbitRadius: 50 }, // Lv2
      { damage: 24, count: 2, cooldown: 0.65, bulletSpeed: 510, range: 640, orbitRadius: 58 }, // Lv3
      { damage: 34, count: 2, cooldown: 0.52, bulletSpeed: 560, range: 700, orbitRadius: 65 }, // Lv4
      { damage: 48, count: 3, cooldown: 0.42, bulletSpeed: 620, range: 780, orbitRadius: 74 }, // Lv5
    ];

    const s = STATS[this.level];

    this.damage = s.damage;
    this.droneCount = s.count;
    this.cooldown = s.cooldown;
    this.bulletSpeed = s.bulletSpeed;
    this.range = s.range;
    this.orbitRadius = s.orbitRadius;

    if (this.drones) {
      this._syncDrones();
    }
  }

  update(dt) {
    super.update(dt);

    this._updateDronePositions(dt);
    this._updateBullets(dt);
  }

  fire() {
    this._syncDrones();

    this.drones.forEach(drone => {
      if (!drone.sprite || !drone.sprite.active) return;

      const target = this._findNearestEnemy(
        drone.sprite.x,
        drone.sprite.y,
        this.range
      );

      if (!target) return;

      this._shootBullet(drone.sprite.x, drone.sprite.y, target);
    });
  }

  _syncDrones() {
    if (!this.drones) return;

    while (this.drones.length < this.droneCount) {
      const sprite = this.scene.add.image(
        this.player.sprite.x,
        this.player.sprite.y,
        'drone_core'
      );

      sprite.setDepth(13);
      sprite.setScale(1);

      this.drones.push({
        sprite,
        angleOffset: 0
      });
    }

    while (this.drones.length > this.droneCount) {
      const drone = this.drones.pop();

      if (drone.sprite && drone.sprite.active) {
        drone.sprite.destroy();
      }
    }

    const total = this.drones.length;

    this.drones.forEach((drone, i) => {
      drone.angleOffset = (Math.PI * 2 / total) * i;
    });
  }

  _updateDronePositions(dt) {
    const me = this.player.sprite;

    const time = this.scene.time.now / 1000;

    this.drones.forEach((drone, i) => {
      if (!drone.sprite || !drone.sprite.active) return;

      const angle = time * 2.4 + drone.angleOffset;

      const targetX = me.x + Math.cos(angle) * this.orbitRadius;
      const targetY = me.y + Math.sin(angle) * this.orbitRadius;

      drone.sprite.x = targetX;
      drone.sprite.y = targetY;

      drone.sprite.rotation += dt * 3;
    });
  }

  _shootBullet(x, y, target) {
    const angle = Phaser.Math.Angle.Between(
      x,
      y,
      target.x,
      target.y
    );

    const bullet = this.scene.physics.add.image(x, y, 'drone_bullet');

    bullet.setDepth(12);
    bullet.setScale(1.2);
    bullet.rotation = angle;

    bullet.body.setVelocity(
      Math.cos(angle) * this.bulletSpeed,
      Math.sin(angle) * this.bulletSpeed
    );

    if (bullet.body.setCircle) {
      bullet.body.setCircle(5);
    }

    this.bullets.push({
      sprite: bullet,
      damage: this.damage,
      life: 1.7,
      dead: false
    });
  }

  _updateBullets(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];

      if (!bullet.sprite || !bullet.sprite.active || bullet.dead) {
        this._destroyBullet(bullet);
        this.bullets.splice(i, 1);
        continue;
      }

      bullet.life -= dt;

      if (bullet.life <= 0) {
        this._destroyBullet(bullet);
        this.bullets.splice(i, 1);
        continue;
      }

      this._checkBulletHit(bullet);
    }
  }

  _checkBulletHit(bullet) {
    const hitOne = (target) => {
      if (!target || !target.active || !target.parentRef) return;
      if (bullet.dead) return;

      const d = Phaser.Math.Distance.Between(
        bullet.sprite.x,
        bullet.sprite.y,
        target.x,
        target.y
      );

      if (d > 24) return;

      target.parentRef.takeDamage(bullet.damage);
      bullet.dead = true;

      this._hitEffect(target.x, target.y);
    };

    this.scene.enemyManager.group.children.each(hitOne);
    this.scene.enemyManager.bossGroup.children.each(hitOne);
  }

  _findNearestEnemy(x, y, maxRange) {
    let best = null;
    let bestDist = maxRange;

    const check = (sprite) => {
      if (!sprite || !sprite.active) return;

      const d = Phaser.Math.Distance.Between(
        x,
        y,
        sprite.x,
        sprite.y
      );

      if (d < bestDist) {
        bestDist = d;
        best = sprite;
      }
    };

    this.scene.enemyManager.group.children.each(check);
    this.scene.enemyManager.bossGroup.children.each(check);

    return best;
  }

  _hitEffect(x, y) {
    const scene = this.scene;

    const flash = scene.add.circle(x, y, 12, 0xffee88, 0.7)
      .setDepth(14);

    scene.tweens.add({
      targets: flash,
      scale: 1.8,
      alpha: 0,
      duration: 130,
      onComplete: () => flash.destroy()
    });
  }

  _destroyBullet(bullet) {
    if (bullet.sprite && bullet.sprite.active) {
      bullet.sprite.destroy();
    }
  }

  _ensureTextures() {
    const scene = this.scene;

    if (!scene.textures.exists('drone_core')) {
      const g = scene.add.graphics();

      g.fillStyle(0x222222, 1);
      g.fillCircle(12, 12, 11);

      g.fillStyle(0xffdd66, 1);
      g.fillCircle(12, 12, 6);

      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeCircle(12, 12, 10);

      g.generateTexture('drone_core', 24, 24);
      g.destroy();
    }

    if (!scene.textures.exists('drone_bullet')) {
      const g = scene.add.graphics();

      g.fillStyle(0xffee88, 1);
      g.fillCircle(6, 6, 5);

      g.lineStyle(1, 0xffffff, 1);
      g.strokeCircle(6, 6, 5);

      g.generateTexture('drone_bullet', 12, 12);
      g.destroy();
    }
  }

  destroy() {
    this.drones.forEach(drone => {
      if (drone.sprite && drone.sprite.active) {
        drone.sprite.destroy();
      }
    });

    this.bullets.forEach(bullet => {
      this._destroyBullet(bullet);
    });

    this.drones = [];
    this.bullets = [];
  }
}