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
      { damage: 12, count: 1, cooldown: 0.85, bulletSpeed: 430, range: 520, wanderRadius: 120, droneSpeed: 130 }, // Lv1
      { damage: 18, count: 1, cooldown: 0.70, bulletSpeed: 470, range: 580, wanderRadius: 135, droneSpeed: 145 }, // Lv2
      { damage: 24, count: 2, cooldown: 0.65, bulletSpeed: 510, range: 640, wanderRadius: 150, droneSpeed: 160 }, // Lv3
      { damage: 34, count: 2, cooldown: 0.52, bulletSpeed: 560, range: 700, wanderRadius: 165, droneSpeed: 175 }, // Lv4
      { damage: 48, count: 3, cooldown: 0.42, bulletSpeed: 620, range: 780, wanderRadius: 185, droneSpeed: 195 }, // Lv5
    ];

    const s = STATS[this.level];

    this.damage = s.damage;
    this.droneCount = s.count;
    this.cooldown = s.cooldown;
    this.bulletSpeed = s.bulletSpeed;
    this.range = s.range;

    // 드론이 플레이어 주변에서 자유롭게 움직이는 범위
    this.wanderRadius = s.wanderRadius;

    // 드론 이동 속도
    this.droneSpeed = s.droneSpeed;

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
      const pos = this._pickNewTarget();

      const sprite = this.scene.add.image(
        pos.x,
        pos.y,
        'drone_core'
      );

      sprite.setDepth(13);
      sprite.setScale(1);

      this.drones.push({
        sprite,
        targetX: pos.x,
        targetY: pos.y,
        wait: Phaser.Math.FloatBetween(0.1, 0.6)
      });
    }

    while (this.drones.length > this.droneCount) {
      const drone = this.drones.pop();

      if (drone.sprite && drone.sprite.active) {
        drone.sprite.destroy();
      }
    }
  }

  _updateDronePositions(dt) {
    const player = this.player.sprite;

    this.drones.forEach(drone => {
      if (!drone.sprite || !drone.sprite.active) return;

      const distToPlayer = Phaser.Math.Distance.Between(
        drone.sprite.x,
        drone.sprite.y,
        player.x,
        player.y
      );

      const distToTarget = Phaser.Math.Distance.Between(
        drone.sprite.x,
        drone.sprite.y,
        drone.targetX,
        drone.targetY
      );

      // 너무 멀어지면 강제로 플레이어 근처 목표로 변경
      if (distToPlayer > this.wanderRadius + 90) {
        const pos = this._pickNewTarget();
        drone.targetX = pos.x;
        drone.targetY = pos.y;
        drone.wait = 0;
      }

      // 목표에 도착하면 잠깐 멈췄다가 새 위치로 이동
      if (distToTarget < 12) {
        drone.wait -= dt;

        if (drone.wait <= 0) {
          const pos = this._pickNewTarget();
          drone.targetX = pos.x;
          drone.targetY = pos.y;
          drone.wait = Phaser.Math.FloatBetween(0.2, 0.8);
        }
      } else {
        const angle = Phaser.Math.Angle.Between(
          drone.sprite.x,
          drone.sprite.y,
          drone.targetX,
          drone.targetY
        );

        drone.sprite.x += Math.cos(angle) * this.droneSpeed * dt;
        drone.sprite.y += Math.sin(angle) * this.droneSpeed * dt;
      }

      // 맵 밖으로 못 나가게 제한
      const clamped = this._clampToWorld(drone.sprite.x, drone.sprite.y);
      drone.sprite.x = clamped.x;
      drone.sprite.y = clamped.y;

      // 회전 오브처럼 도는 게 아니라, 살짝 흔들리는 느낌만 줌
      drone.sprite.rotation = Math.sin(this.scene.time.now / 180) * 0.15;
    });
  }
  _pickNewTarget() {
    const player = this.player.sprite;

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.FloatBetween(35, this.wanderRadius);

    let x = player.x + Math.cos(angle) * dist;
    let y = player.y + Math.sin(angle) * dist;

    return this._clampToWorld(x, y);
  }

  _clampToWorld(x, y) {
    const world = this.scene.physics.world.bounds;

    // 맵 경계에서 살짝 안쪽으로 제한
    const margin = 30;

    const minX = world.x + margin;
    const maxX = world.x + world.width - margin;
    const minY = world.y + margin;
    const maxY = world.y + world.height - margin;

    return {
      x: Phaser.Math.Clamp(x, minX, maxX),
      y: Phaser.Math.Clamp(y, minY, maxY)
    };
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