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
      { damage: 8, radius: 75, duration: 4.0, cooldown: 4.5, count: 1 }, // Lv1
      { damage: 11, radius: 85, duration: 4.5, cooldown: 4.0, count: 1 }, // Lv2
      { damage: 14, radius: 95, duration: 5.0, cooldown: 3.5, count: 1 }, // Lv3
      { damage: 18, radius: 105, duration: 5.5, cooldown: 3.0, count: 2 }, // Lv4
      { damage: 24, radius: 120, duration: 6.0, cooldown: 2.5, count: 2 }, // Lv5
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
      z.circle.setAlpha(0.08 + ratio * 0.18);
      z.ring.setAlpha(0.25 + ratio * 0.6);

      if (z.life <= 0) {
        z.circle.destroy();
        z.ring.destroy();
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

    const circle = scene.add.circle(
      x,
      y,
      this.radius,
      0x22cc66,
      0.22
    ).setDepth(3);

    const ring = scene.add.circle(
      x,
      y,
      this.radius,
      0x000000,
      0
    ).setDepth(4);

    ring.setStrokeStyle(3, 0x66ff99, 0.9);

    scene.tweens.add({
      targets: ring,
      scale: 1.05,
      duration: 450,
      yoyo: true,
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
      circle,
      ring
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

  destroy() {
    this.zones.forEach(z => {
      if (z.circle) z.circle.destroy();
      if (z.ring) z.ring.destroy();
    });

    this.zones = [];
  }
}