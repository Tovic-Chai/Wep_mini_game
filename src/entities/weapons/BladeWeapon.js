import PassiveWeapon from './PassiveWeapon.js';

/**
 * 날아가는 검기 무기
 * 가장 가까운 적 방향으로 검기를 발사한다.
 * 검기는 날아가면서 적을 맞히고, 레벨이 오를수록 크기가 커진다.
 */
export default class BladeWeapon extends PassiveWeapon {
  constructor(scene, player) {
    super(scene, player, 'blade');

    this.blades = [];

    this._ensureTexture();
    this.applyLevelStats();
  }

  applyLevelStats() {
    const STATS = [
      null,
      // damage, count, cooldown, speed, scale, hitRadius, pierce
      { damage: 35, count: 1, cooldown: 2.4, speed: 420, scale: 0.80, hitRadius: 24, pierce: 1 }, // Lv1
      { damage: 50, count: 1, cooldown: 2.1, speed: 450, scale: 1.00, hitRadius: 30, pierce: 2 }, // Lv2
      { damage: 65, count: 2, cooldown: 1.9, speed: 480, scale: 1.20, hitRadius: 36, pierce: 2 }, // Lv3
      { damage: 85, count: 2, cooldown: 1.6, speed: 520, scale: 1.40, hitRadius: 43, pierce: 3 }, // Lv4
      { damage: 115, count: 3, cooldown: 1.3, speed: 560, scale: 1.65, hitRadius: 52, pierce: 4 }, // Lv5
    ];

    const s = STATS[this.level];

    this.damage = s.damage;
    this.count = s.count;
    this.cooldown = s.cooldown;
    this.bladeSpeed = s.speed;
    this.bladeScale = s.scale;
    this.hitRadius = s.hitRadius;
    this.pierce = s.pierce;
  }

  update(dt) {
    super.update(dt);

    for (let i = this.blades.length - 1; i >= 0; i--) {
      const blade = this.blades[i];

      if (!blade.sprite || !blade.sprite.active || blade.dead) {
        this._destroyBlade(blade);
        this.blades.splice(i, 1);
        continue;
      }

      blade.life -= dt;

      if (blade.life <= 0) {
        this._destroyBlade(blade);
        this.blades.splice(i, 1);
        continue;
      }


      this._checkHits(blade);
    }
  }

  fire() {
    const me = this.player.sprite;

    const targets = this._findNearestEnemies(this.count);
    if (targets.length === 0) return;

    for (let i = 0; i < this.count; i++) {
      const target = targets[i % targets.length];

      if (!target || !target.active) continue;

      const angle = Phaser.Math.Angle.Between(
        me.x,
        me.y,
        target.x,
        target.y
      );

      this._spawnBlade(me.x, me.y, angle);
    }
  }

  _spawnBlade(x, y, angle) {
    const scene = this.scene;

    const sprite = scene.physics.add.image(x, y, 'blade_crescent');

    sprite.setDepth(12);
    sprite.setScale(this.bladeScale);
    sprite.rotation = angle;

    sprite.body.setVelocity(
      Math.cos(angle) * this.bladeSpeed,
      Math.sin(angle) * this.bladeSpeed
    );

    // 몸통 크기 조정
    if (sprite.body.setCircle) {
      sprite.body.setCircle(18);
    }

    // 검기 등장 이펙트
    const flash = scene.add.circle(x, y, 18 * this.bladeScale, 0x99eeff, 0.55)
      .setDepth(11);

    scene.tweens.add({
      targets: flash,
      scale: 1.8,
      alpha: 0,
      duration: 180,
      onComplete: () => flash.destroy()
    });

    this.blades.push({
      sprite,
      damage: this.damage,
      hitRadius: this.hitRadius,
      pierceLeft: this.pierce,
      hits: new Set(),
      life: 2.2,
      dead: false,
    });
  }

  _checkHits(blade) {
    const hitOne = (target) => {
      if (!target || !target.active || !target.parentRef) return;
      if (blade.dead) return;
      if (blade.hits.has(target)) return;

      const d = Phaser.Math.Distance.Between(
        blade.sprite.x,
        blade.sprite.y,
        target.x,
        target.y
      );

      if (d > blade.hitRadius) return;

      target.parentRef.takeDamage(blade.damage);
      blade.hits.add(target);

      this._hitEffect(target.x, target.y, blade.sprite.scaleX);

      if (blade.pierceLeft > 0) {
        blade.pierceLeft--;
      } else {
        blade.dead = true;
      }
    };

    this.scene.enemyManager.group.children.each(hitOne);
    this.scene.enemyManager.bossGroup.children.each(hitOne);
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



  _hitEffect(x, y, scale = 1) {
    const scene = this.scene;

    const flash = scene.add.circle(x, y, 16 * scale, 0xffffff, 0.65)
      .setDepth(14);

    scene.tweens.add({
      targets: flash,
      scale: 1.9,
      alpha: 0,
      duration: 140,
      onComplete: () => flash.destroy()
    });

    if (scene.add.particles) {
      const emitter = scene.add.particles(x, y, 'particle_star', {
        speed: { min: 30, max: 110 },
        scale: { start: 0.55 * scale, end: 0 },
        tint: 0x99eeff,
        lifespan: 260,
        emitting: false
      });

      emitter.explode(5);

      scene.time.delayedCall(320, () => {
        if (emitter) emitter.destroy();
      });
    }
  }

  _destroyBlade(blade) {
    if (blade.sprite && blade.sprite.active) {
      blade.sprite.destroy();
    }
  }

  _ensureTexture() {
    const scene = this.scene;

    if (scene.textures.exists('blade_crescent')) return;

    const tex = scene.textures.createCanvas('blade_crescent', 108, 72);
    const ctx = tex.getContext();

    ctx.clearRect(0, 0, 108, 72);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 외곽 광채
    ctx.shadowColor = 'rgba(120, 235, 255, 0.95)';
    ctx.shadowBlur = 18;

    // 메인 반원 빛
    const grad = ctx.createLinearGradient(18, 0, 100, 72);
    grad.addColorStop(0.00, 'rgba(70, 210, 255, 0.18)');
    grad.addColorStop(0.35, 'rgba(120, 235, 255, 0.88)');
    grad.addColorStop(0.72, 'rgba(230, 255, 255, 1)');
    grad.addColorStop(1.00, 'rgba(255, 255, 255, 1)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.arc(42, 36, 31, -Math.PI / 2, Math.PI / 2, false);
    ctx.stroke();

    // 내부 밝은 코어
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(42, 36, 31, -Math.PI / 2, Math.PI / 2, false);
    ctx.stroke();

    // 바깥 가장자리 라인
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(90, 200, 255, 0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(42, 36, 39, -Math.PI / 2, Math.PI / 2, false);
    ctx.stroke();

    // 끝부분 강조
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(73, 36, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    tex.refresh();
  }

  destroy() {
    this.blades.forEach(blade => this._destroyBlade(blade));
    this.blades = [];
  }
}