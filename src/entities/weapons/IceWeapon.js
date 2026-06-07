import PassiveWeapon from './PassiveWeapon.js';

/**
 * 얼음 파편 무기
 * 가까운 적을 향해 얼음 파편을 발사한다.
 * 맞은 적에게 데미지 + 이동속도 감소 효과를 준다.
 */
export default class IceWeapon extends PassiveWeapon {
  constructor(scene, player) {
    super(scene, player, 'ice');

    this.shards = [];

    this._ensureTexture();
    this.applyLevelStats();
  }

  applyLevelStats() {
    const STATS = [
      null,
      { damage: 38, count: 1, cooldown: 2.8, speed: 430, slow: 0.65, slowDuration: 1.5, pierce: 0 }, // Lv1
      { damage: 52, count: 1, cooldown: 2.5, speed: 450, slow: 0.60, slowDuration: 1.7, pierce: 0 }, // Lv2
      { damage: 68, count: 2, cooldown: 2.3, speed: 470, slow: 0.55, slowDuration: 2.0, pierce: 0 }, // Lv3
      { damage: 90, count: 2, cooldown: 2.0, speed: 500, slow: 0.50, slowDuration: 2.2, pierce: 1 }, // Lv4
      { damage: 120, count: 3, cooldown: 1.7, speed: 530, slow: 0.45, slowDuration: 2.5, pierce: 1 }, // Lv5
    ];

    const s = STATS[this.level];

    this.damage = s.damage;
    this.count = s.count;
    this.cooldown = s.cooldown;
    this.shardSpeed = s.speed;
    this.slow = s.slow;
    this.slowDuration = s.slowDuration;
    this.pierce = s.pierce;
  }

  update(dt) {
    super.update(dt);

    for (let i = this.shards.length - 1; i >= 0; i--) {
      const shard = this.shards[i];

      if (!shard.sprite || !shard.sprite.active || shard.dead) {
        this._destroyShard(shard);
        this.shards.splice(i, 1);
        continue;
      }

      shard.life -= dt;

      if (shard.life <= 0) {
        this._destroyShard(shard);
        this.shards.splice(i, 1);
        continue;
      }

      this._checkHits(shard);
    }
  }

  fire() {
    const me = this.player.sprite;
    const targets = this._findNearestEnemies(this.count);

    if (targets.length === 0) return;

    const spreadAngles = this._spreadAngles(this.count);

    targets.forEach((target, i) => {
      const baseAngle = Phaser.Math.Angle.Between(
        me.x,
        me.y,
        target.x,
        target.y
      );

      const angle = baseAngle + spreadAngles[i];

      this._spawnIceShard(me.x, me.y, angle);
    });
  }

  _spawnIceShard(x, y, angle) {
    const scene = this.scene;

    const sprite = scene.physics.add.image(x, y, 'ice_shard');

    sprite.setDepth(9);
    sprite.setScale(1.4);
    sprite.rotation = angle;

    sprite.body.setVelocity(
      Math.cos(angle) * this.shardSpeed,
      Math.sin(angle) * this.shardSpeed
    );

    if (sprite.body.setCircle) {
      sprite.body.setCircle(8);
    }

    this.shards.push({
      sprite,
      damage: this.damage,
      slow: this.slow,
      slowDuration: this.slowDuration,
      pierceLeft: this.pierce,
      life: 2.2,
      hits: new Set(),
      dead: false
    });
  }

  _checkHits(shard) {
    const hitOne = (target) => {
      if (!target || !target.active || !target.parentRef) return;
      if (shard.dead) return;
      if (shard.hits.has(target)) return;

      const d = Phaser.Math.Distance.Between(
        shard.sprite.x,
        shard.sprite.y,
        target.x,
        target.y
      );

      if (d > 26) return;

      const enemy = target.parentRef;

      enemy.takeDamage(shard.damage);

      // 일반 몬스터만 둔화 적용
      if (enemy.applySlow) {
        enemy.applySlow(shard.slow, shard.slowDuration);
      }

      this._hitEffect(target.x, target.y);

      shard.hits.add(target);

      if (shard.pierceLeft > 0) {
        shard.pierceLeft--;
      } else {
        shard.dead = true;
      }
    };

    this.scene.enemyManager.group.children.each(hitOne);
    this.scene.enemyManager.bossGroup.children.each(hitOne);
  }

  _hitEffect(x, y) {
    const scene = this.scene;

    const flash = scene.add.circle(x, y, 20, 0x99ddff, 0.65)
      .setDepth(12);

    scene.tweens.add({
      targets: flash,
      scale: 1.8,
      alpha: 0,
      duration: 180,
      onComplete: () => flash.destroy()
    });

    if (scene.add.particles) {
      const emitter = scene.add.particles(x, y, 'particle_star', {
        speed: { min: 40, max: 120 },
        scale: { start: 0.55, end: 0 },
        tint: 0x99ddff,
        lifespan: 280,
        emitting: false
      });

      emitter.explode(6);

      scene.time.delayedCall(350, () => {
        if (emitter) emitter.destroy();
      });
    }
  }

  _findNearestEnemies(count) {
    const me = this.player.sprite;
    const candidates = [];

    const collect = (sprite) => {
      if (!sprite || !sprite.active) return;

      const d = Phaser.Math.Distance.Between(
        me.x,
        me.y,
        sprite.x,
        sprite.y
      );

      candidates.push({ sprite, d });
    };

    this.scene.enemyManager.group.children.each(collect);
    this.scene.enemyManager.bossGroup.children.each(collect);

    candidates.sort((a, b) => a.d - b.d);

    return candidates.slice(0, count).map(c => c.sprite);
  }

  _spreadAngles(count) {
    if (count === 1) return [0];
    if (count === 2) return [-0.12, 0.12];
    return [-0.22, 0, 0.22];
  }

  _destroyShard(shard) {
    if (shard.sprite && shard.sprite.active) {
      shard.sprite.destroy();
    }
  }

  _ensureTexture() {
    const scene = this.scene;

    if (scene.textures.exists('ice_shard')) return;

    const tex = scene.textures.createCanvas('ice_shard', 32, 32);
    const ctx = tex.getContext();

    ctx.clearRect(0, 0, 32, 32);

    ctx.shadowColor = 'rgba(180, 240, 255, 0.9)';
    ctx.shadowBlur = 10;

    // 얼음 조각 외곽
    ctx.fillStyle = 'rgba(120, 220, 255, 0.95)';
    ctx.beginPath();
    ctx.moveTo(16, 2);
    ctx.lineTo(27, 10);
    ctx.lineTo(23, 28);
    ctx.lineTo(9, 28);
    ctx.lineTo(5, 10);
    ctx.closePath();
    ctx.fill();

    // 내부 밝은 면
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(16, 5);
    ctx.lineTo(23, 11);
    ctx.lineTo(20, 24);
    ctx.lineTo(12, 24);
    ctx.lineTo(9, 11);
    ctx.closePath();
    ctx.fill();

    // 결정선
    ctx.strokeStyle = 'rgba(170, 245, 255, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 5);
    ctx.lineTo(16, 24);
    ctx.moveTo(12, 12);
    ctx.lineTo(20, 12);
    ctx.moveTo(11, 18);
    ctx.lineTo(21, 18);
    ctx.stroke();

    tex.refresh();
  }

  destroy() {
    this.shards.forEach(shard => this._destroyShard(shard));
    this.shards = [];
  }
}