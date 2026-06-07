import PassiveWeapon from './PassiveWeapon.js';

/**
 * 독 장판 무기
 * 가까운 적 위치에 독 장판을 생성한다.
 * 장판 안에 있는 적은 일정 시간마다 지속 데미지를 받는다.
 */
export default class PoisonWeapon extends PassiveWeapon {
  constructor(scene, player) {
    super(scene, player, 'poison');

    this.zones = [];
    this.tickInterval = 0.45;

    this.applyLevelStats();
  }

  applyLevelStats() {
    const STATS = [
      null,
      { damage: 12, radius: 75, duration: 4.0, cooldown: 4.5, count: 1 },
      { damage: 16, radius: 85, duration: 4.5, cooldown: 4.0, count: 1 },
      { damage: 21, radius: 95, duration: 5.0, cooldown: 3.5, count: 1 },
      { damage: 27, radius: 105, duration: 5.5, cooldown: 3.0, count: 2 },
      { damage: 36, radius: 120, duration: 6.0, cooldown: 2.5, count: 2 },
    ];

    const s = STATS[this.level];

    this.damage = s.damage;
    this.radius = s.radius;
    this.duration = s.duration;
    this.cooldown = s.cooldown;
    this.count = s.count;
  }

  update(dt) {
    super.update(dt);

    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];

      z.life -= dt;
      z.tick -= dt;

      if (z.tick <= 0) {
        z.tick = this.tickInterval;
        this._damageEnemiesInZone(z);
      }

      const ratio = Math.max(0, z.life / z.duration);

      if (z.outer) z.outer.setAlpha(0.06 + ratio * 0.14);
      if (z.inner) z.inner.setAlpha(0.10 + ratio * 0.18);
      if (z.ring) z.ring.setAlpha(0.22 + ratio * 0.58);
      if (z.ring2) z.ring2.setAlpha(0.12 + ratio * 0.25);

      if (z.life <= 0) {
        this._destroyZone(z);
        this.zones.splice(i, 1);
      }
    }
  }

  fire() {
    const targets = this._findNearestEnemies(this.count);
    if (targets.length === 0) return;

    targets.forEach(target => {
      this._createPoisonZone(target.x, target.y);
    });
  }

  _createPoisonZone(x, y) {
    const scene = this.scene;

    // 바깥 독 장판
    const outer = scene.add.circle(
      x,
      y,
      this.radius,
      0x1fae5b,
      0.16
    ).setDepth(3);

    // 안쪽 진한 독 장판
    const inner = scene.add.circle(
      x,
      y,
      this.radius * 0.72,
      0x49d67f,
      0.22
    ).setDepth(4);

    // 바깥 링
    const ring = scene.add.circle(
      x,
      y,
      this.radius,
      0x000000,
      0
    ).setDepth(5);

    ring.setStrokeStyle(4, 0x8bffb0, 0.85);

    // 안쪽 링
    const ring2 = scene.add.circle(
      x,
      y,
      this.radius * 0.58,
      0x000000,
      0
    ).setDepth(5);

    ring2.setStrokeStyle(2, 0xd4ffe0, 0.45);

    const tween1 = scene.tweens.add({
      targets: [outer, ring],
      scale: 1.05,
      duration: 450,
      yoyo: true,
      repeat: -1
    });

    const tween2 = scene.tweens.add({
      targets: inner,
      alpha: 0.12,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    const tween3 = scene.tweens.add({
      targets: ring2,
      angle: 360,
      duration: 2500,
      repeat: -1
    });

    this.zones.push({
      x,
      y,
      radius: this.radius,
      damage: this.damage,
      duration: this.duration,
      life: this.duration,
      tick: 0,

      outer,
      inner,
      ring,
      ring2,

      tweens: [tween1, tween2, tween3]
    });
  }

  _damageEnemiesInZone(zone) {
    const scene = this.scene;

    const hit = (sprite) => {
      if (!sprite || !sprite.active) return;

      const d = Phaser.Math.Distance.Between(
        zone.x,
        zone.y,
        sprite.x,
        sprite.y
      );

      if (d <= zone.radius && sprite.parentRef) {
        sprite.parentRef.takeDamage(zone.damage);
      }
    };

    scene.enemyManager.group.children.each(hit);
    scene.enemyManager.bossGroup.children.each(hit);
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

  _destroyZone(z) {
    if (!z) return;

    // 반복 트윈 먼저 제거
    if (z.tweens) {
      z.tweens.forEach(tween => {
        if (tween && tween.remove) {
          tween.remove();
        }
      });
    }

    // 혹시 남아있는 트윈까지 강제 제거
    this.scene.tweens.killTweensOf([
      z.outer,
      z.inner,
      z.ring,
      z.ring2
    ]);

    if (z.outer && z.outer.active) z.outer.destroy();
    if (z.inner && z.inner.active) z.inner.destroy();
    if (z.ring && z.ring.active) z.ring.destroy();
    if (z.ring2 && z.ring2.active) z.ring2.destroy();

    z.outer = null;
    z.inner = null;
    z.ring = null;
    z.ring2 = null;
    z.tweens = [];
  }

  destroy() {
    this.zones.forEach(z => {
      this._destroyZone(z);
    });

    this.zones = [];
  }
}