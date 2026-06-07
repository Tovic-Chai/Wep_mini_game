import PassiveWeapon from './PassiveWeapon.js';

/**
 * 레이저 무기
 * 가까운 적 방향으로 관통 레이저를 발사한다.
 * 레이저 경로에 있는 일반 몬스터와 보스에게 데미지를 준다.
 */
export default class LaserWeapon extends PassiveWeapon {
  constructor(scene, player) {
    super(scene, player, 'laser');

    this.applyLevelStats();
  }

  applyLevelStats() {
    const STATS = [
      null,
      { damage: 52, count: 1, length: 520, width: 18, cooldown: 3.2 }, // Lv1
      { damage: 75, count: 1, length: 600, width: 20, cooldown: 2.9 }, // Lv2
      { damage: 98, count: 2, length: 700, width: 22, cooldown: 2.6 }, // Lv3
      { damage: 128, count: 2, length: 800, width: 25, cooldown: 2.3 }, // Lv4
      { damage: 172, count: 3, length: 900, width: 30, cooldown: 2.0 }, // Lv5
    ];

    const s = STATS[this.level];

    this.damage = s.damage;
    this.count = s.count;
    this.length = s.length;
    this.beamWidth = s.width;
    this.cooldown = s.cooldown;
  }

  fire() {
    const targets = this._findNearestEnemies(this.count);
    if (targets.length === 0) return;

    const me = this.player.sprite;

    // 같은 발동 안에서 같은 적이 여러 레이저에 중복으로 맞지 않게 처리
    const hitSet = new Set();

    targets.forEach(target => {
      const angle = Phaser.Math.Angle.Between(
        me.x,
        me.y,
        target.x,
        target.y
      );

      this._fireBeam(me.x, me.y, angle, hitSet);
    });
  }

  _fireBeam(x, y, angle, hitSet) {
    const endX = x + Math.cos(angle) * this.length;
    const endY = y + Math.sin(angle) * this.length;

    this._damageEnemiesOnBeam(x, y, angle, hitSet);
    this._drawBeam(x, y, endX, endY);
  }

  _damageEnemiesOnBeam(x, y, angle, hitSet) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    const check = (sprite) => {
      if (!sprite || !sprite.active || !sprite.parentRef) return;
      if (hitSet.has(sprite)) return;

      const dx = sprite.x - x;
      const dy = sprite.y - y;

      // 레이저 방향으로 얼마나 앞에 있는지
      const forward = dx * dirX + dy * dirY;

      // 뒤쪽이거나 사거리 밖이면 제외
      if (forward < 0 || forward > this.length) return;

      // 레이저 중심선과 적 사이의 거리
      const closestX = x + dirX * forward;
      const closestY = y + dirY * forward;

      const distToLine = Phaser.Math.Distance.Between(
        sprite.x,
        sprite.y,
        closestX,
        closestY
      );

      if (distToLine <= this.beamWidth) {
        sprite.parentRef.takeDamage(this.damage);
        hitSet.add(sprite);
        this._hitEffect(sprite.x, sprite.y);
      }
    };

    this.scene.enemyManager.group.children.each(check);
    this.scene.enemyManager.bossGroup.children.each(check);
  }

  _drawBeam(x, y, endX, endY) {
    const scene = this.scene;

    // 살짝 화면 흔들림
    if (scene.cameras && scene.cameras.main) {
      scene.cameras.main.shake(70, 0.002);
    }

    // 본 레이저
    const g = scene.add.graphics().setDepth(15);

    // 잔상 레이저: 본 레이저보다 뒤에 깔리고 조금 더 오래 남음
    const trail = scene.add.graphics().setDepth(14);

    // 잔상 큰 빛
    trail.lineStyle(this.beamWidth * 1.7, 0x33ccff, 0.18);
    trail.beginPath();
    trail.moveTo(x, y);
    trail.lineTo(endX, endY);
    trail.strokePath();

    // 잔상 중심
    trail.lineStyle(Math.max(3, this.beamWidth * 0.45), 0xffffff, 0.22);
    trail.beginPath();
    trail.moveTo(x, y);
    trail.lineTo(endX, endY);
    trail.strokePath();

    // 바깥 큰 빛
    g.lineStyle(this.beamWidth * 2.2, 0x33ccff, 0.16);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(endX, endY);
    g.strokePath();

    // 중간 빛
    g.lineStyle(this.beamWidth * 1.25, 0x66ddff, 0.35);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(endX, endY);
    g.strokePath();

    // 중심 레이저
    g.lineStyle(Math.max(4, this.beamWidth * 0.42), 0xffffff, 1);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(endX, endY);
    g.strokePath();

    // 시작 지점 폭발 빛
    const startFlash = scene.add.circle(x, y, 22, 0x99eeff, 0.8)
      .setDepth(16);

    const startRing = scene.add.circle(x, y, 10, 0x000000, 0)
      .setDepth(17);

    startRing.setStrokeStyle(3, 0xffffff, 0.9);

    // 끝 지점 충격파
    const endFlash = scene.add.circle(endX, endY, 18, 0x66ddff, 0.65)
      .setDepth(16);

    const endRing = scene.add.circle(endX, endY, 12, 0x000000, 0)
      .setDepth(17);

    endRing.setStrokeStyle(3, 0x99eeff, 0.8);

    scene.tweens.add({
      targets: [startFlash, endFlash],
      scale: 2.1,
      alpha: 0,
      duration: 220,
      onComplete: () => {
        startFlash.destroy();
        endFlash.destroy();
      }
    });

    scene.tweens.add({
      targets: [startRing, endRing],
      scale: 2.8,
      alpha: 0,
      duration: 260,
      onComplete: () => {
        startRing.destroy();
        endRing.destroy();
      }
    });

    // 레이저 중간 스파크
    const sparkCount = 7;

    for (let i = 1; i <= sparkCount; i++) {
      const t = i / (sparkCount + 1);

      const px = Phaser.Math.Linear(x, endX, t);
      const py = Phaser.Math.Linear(y, endY, t);

      const spark = scene.add.circle(
        px + Phaser.Math.Between(-8, 8),
        py + Phaser.Math.Between(-8, 8),
        Phaser.Math.FloatBetween(2, 4),
        0xffffff,
        0.85
      ).setDepth(18);

      scene.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-20, 20),
        y: spark.y + Phaser.Math.Between(-20, 20),
        scale: 0,
        alpha: 0,
        duration: 180,
        onComplete: () => spark.destroy()
      });
    }

    // 본 레이저는 빠르게 사라짐
    scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 170,
      onComplete: () => {
        g.destroy();
      }
    });

    // 잔상은 조금 더 오래 남음
    scene.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 460,
      onComplete: () => {
        trail.destroy();
      }
    });
  }

  _hitEffect(x, y) {
    const scene = this.scene;

    const flash = scene.add.circle(x, y, 18, 0xffffff, 0.75)
      .setDepth(17);

    const ring = scene.add.circle(x, y, 10, 0x000000, 0)
      .setDepth(18);

    ring.setStrokeStyle(3, 0x66ddff, 0.9);

    scene.tweens.add({
      targets: flash,
      scale: 2.0,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy()
    });

    scene.tweens.add({
      targets: ring,
      scale: 2.4,
      alpha: 0,
      duration: 190,
      onComplete: () => ring.destroy()
    });

    if (scene.add.particles) {
      const emitter = scene.add.particles(x, y, 'particle_star', {
        speed: { min: 40, max: 140 },
        scale: { start: 0.55, end: 0 },
        tint: 0x99eeff,
        lifespan: 260,
        emitting: false
      });

      emitter.explode(8);

      scene.time.delayedCall(320, () => {
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
}