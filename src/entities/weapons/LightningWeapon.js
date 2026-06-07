import PassiveWeapon from './PassiveWeapon.js';

/**
 * 번개 무기
 * 쿨다운마다 무작위 적 N명의 머리 위에 번개를 내려쳐
 * 즉시 범위 데미지를 입힌다. 투사체 없이 즉발로 처리된다.
 */
export default class LightningWeapon extends PassiveWeapon {
  constructor(scene, player) {
    super(scene, player, 'lightning');
    this.applyLevelStats();
  }

  applyLevelStats() {
    const STATS = [
      null,
      { damage: 60,  strikes: 1, radius: 50, cooldown: 4.0 }, // Lv1
      { damage: 90,  strikes: 1, radius: 60, cooldown: 3.0 }, // Lv2
      { damage: 120, strikes: 2, radius: 65, cooldown: 2.5 }, // Lv3
      { damage: 150, strikes: 2, radius: 75, cooldown: 2.0 }, // Lv4
      { damage: 200, strikes: 3, radius: 85, cooldown: 1.5 }, // Lv5
    ];
    const s = STATS[this.level];
    this.damage   = s.damage;
    this.strikes  = s.strikes;
    this.radius   = s.radius;
    this.cooldown = s.cooldown;
  }

  fire() {
    const targets = this._pickRandomEnemies(this.strikes);
    if (targets.length === 0) return;

    targets.forEach(target => this._strikeAt(target.x, target.y));
  }

  _strikeAt(cx, cy) {
    const scene = this.scene;

    // ── 번개 비주얼 (화면 상단 → 적 위치까지 수직 사각형) ──
    const boltH = 200;
    const bolt = scene.add.rectangle(cx, cy - boltH / 2, 5, boltH, 0xffffff, 1)
      .setDepth(15)
      .setAlpha(0.95);

    // 번개 플래시 (주변 빛 퍼짐)
    const flash = scene.add.circle(cx, cy, 40, 0xccddff, 0.6)
      .setDepth(14);

    // 이펙트 파티클
    if (scene.add.particles) {
      const emitter = scene.add.particles(cx, cy, 'particle_star', {
        speed: { min: 50, max: 150 },
        scale: { start: 0.9, end: 0 },
        tint: 0xaaddff,
        lifespan: 350,
        emitting: false
      });
      emitter.explode(10);
      scene.time.delayedCall(500, () => emitter.destroy());
    }

    // 번개 페이드 아웃
    scene.tweens.add({
      targets: [bolt, flash],
      alpha: 0,
      duration: 200,
      onComplete: () => { bolt.destroy(); flash.destroy(); }
    });

    // ── 범위 내 적 데미지 ──
    const dmg = this.damage;
    const r   = this.radius;

    const hit = (sprite) => {
      if (!sprite.active) return;
      const d = Phaser.Math.Distance.Between(cx, cy, sprite.x, sprite.y);
      if (d <= r && sprite.parentRef) {
        sprite.parentRef.takeDamage(dmg);
      }
    };

    scene.enemyManager.group.children.each(hit);
    scene.enemyManager.bossGroup.children.each(hit);
  }

  _pickRandomEnemies(n) {
    const all = [];

    const collect = (sprite) => {
      if (sprite.active) all.push(sprite);
    };

    this.scene.enemyManager.group.children.each(collect);
    this.scene.enemyManager.bossGroup.children.each(collect);

    // 랜덤 섞어서 n명 선택
    Phaser.Utils.Array.Shuffle(all);
    return all.slice(0, n);
  }
}
