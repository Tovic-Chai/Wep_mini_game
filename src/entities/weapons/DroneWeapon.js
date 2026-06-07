import PassiveWeapon from './PassiveWeapon.js';

/**
 * 자동 공격 드론 무기
 * 플레이어 주변 근처에서 자유롭게 돌아다니며 가까운 적에게 총알을 자동 발사한다.
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
      { damage: 18, count: 1, cooldown: 0.85, bulletSpeed: 430, range: 520, wanderRadius: 120, droneSpeed: 130 },
      { damage: 27, count: 1, cooldown: 0.70, bulletSpeed: 470, range: 580, wanderRadius: 135, droneSpeed: 145 },
      { damage: 36, count: 2, cooldown: 0.65, bulletSpeed: 510, range: 640, wanderRadius: 150, droneSpeed: 160 },
      { damage: 51, count: 2, cooldown: 0.52, bulletSpeed: 560, range: 700, wanderRadius: 165, droneSpeed: 175 },
      { damage: 72, count: 3, cooldown: 0.42, bulletSpeed: 620, range: 780, wanderRadius: 185, droneSpeed: 195 },
    ];

    const s = STATS[this.level];

    this.damage = s.damage;
    this.droneCount = s.count;
    this.cooldown = s.cooldown;
    this.bulletSpeed = s.bulletSpeed;
    this.range = s.range;
    this.wanderRadius = s.wanderRadius;
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

      const sprite = this.scene.add.image(pos.x, pos.y, 'drone_core');
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

      if (drone.targetX === undefined || drone.targetY === undefined) {
        const pos = this._pickNewTarget();
        drone.targetX = pos.x;
        drone.targetY = pos.y;
      }

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

      // 플레이어에게서 너무 멀어지면 다시 플레이어 근처로 이동
      if (distToPlayer > this.wanderRadius + 90) {
        const pos = this._pickNewTarget();
        drone.targetX = pos.x;
        drone.targetY = pos.y;
        drone.wait = 0;
      }

      // 목표 지점 도착
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

      // 자유 비행 느낌만 주는 살짝 흔들림
      drone.sprite.rotation = Math.sin(this.scene.time.now / 180) * 0.15;
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
    bullet.setScale(1.1);
    bullet.rotation = angle;

    bullet.body.setVelocity(
      Math.cos(angle) * this.bulletSpeed,
      Math.sin(angle) * this.bulletSpeed
    );

    if (bullet.body.setCircle) {
      bullet.body.setCircle(6);
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

  _pickNewTarget() {
    const player = this.player.sprite;

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.FloatBetween(35, this.wanderRadius);

    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;

    return this._clampToWorld(x, y);
  }

  _clampToWorld(x, y) {
    const world = this.scene.physics.world.bounds;
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
      const tex = scene.textures.createCanvas('drone_core', 34, 34);
      const ctx = tex.getContext();

      ctx.clearRect(0, 0, 34, 34);

      // 좌우 날개
      ctx.fillStyle = '#34384a';
      ctx.fillRect(3, 13, 8, 8);
      ctx.fillRect(23, 13, 8, 8);

      // 바깥 원형 몸체
      ctx.fillStyle = '#1e1e28';
      ctx.beginPath();
      ctx.arc(17, 17, 13, 0, Math.PI * 2);
      ctx.fill();

      // 외곽 링
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(17, 17, 12, 0, Math.PI * 2);
      ctx.stroke();

      // 중앙 코어 glow
      const glow = ctx.createRadialGradient(17, 17, 2, 17, 17, 8);
      glow.addColorStop(0, 'rgba(255,255,255,1)');
      glow.addColorStop(0.45, 'rgba(255,230,120,1)');
      glow.addColorStop(1, 'rgba(255,200,70,0.2)');

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(17, 17, 8, 0, Math.PI * 2);
      ctx.fill();

      // 중앙 핵
      ctx.fillStyle = '#ffd95a';
      ctx.beginPath();
      ctx.arc(17, 17, 4, 0, Math.PI * 2);
      ctx.fill();

      tex.refresh();
    }

    if (!scene.textures.exists('drone_bullet')) {
      const tex = scene.textures.createCanvas('drone_bullet', 18, 18);
      const ctx = tex.getContext();

      ctx.clearRect(0, 0, 18, 18);

      ctx.shadowColor = 'rgba(255,230,120,0.95)';
      ctx.shadowBlur = 8;

      const grad = ctx.createRadialGradient(9, 9, 1, 9, 9, 8);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.5, 'rgba(255,235,120,1)');
      grad.addColorStop(1, 'rgba(255,180,60,0.3)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(9, 9, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(9, 9, 5.5, 0, Math.PI * 2);
      ctx.stroke();

      tex.refresh();
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