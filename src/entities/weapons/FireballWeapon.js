import PassiveWeapon from './PassiveWeapon.js';

/**
 * 파이어볼 무기
 * 느리지만 강력한 화염구를 가장 가까운 적을 향해 자동 발사.
 * 레벨이 오를수록 데미지, 발사 수, 쿨다운이 강화된다.
 */
export default class FireballWeapon extends PassiveWeapon {
  constructor(scene, player) {
    super(scene, player, 'fireball');
    this.applyLevelStats();
  }

  applyLevelStats() {
    const STATS = [
      null,                                      // 인덱스 0 (미사용)
      { damage: 60,  count: 1, cooldown: 3.0, speed: 140 }, // Lv1
      { damage: 90,  count: 1, cooldown: 2.5, speed: 150 }, // Lv2
      { damage: 110, count: 2, cooldown: 2.2, speed: 160 }, // Lv3
      { damage: 140, count: 2, cooldown: 1.8, speed: 170 }, // Lv4
      { damage: 180, count: 3, cooldown: 1.5, speed: 180 }, // Lv5
    ];
    const s = STATS[this.level];
    this.damage   = s.damage;
    this.count    = s.count;
    this.cooldown = s.cooldown;
    this.fbSpeed  = s.speed;
  }

  fire() {
    const me = this.player.sprite;

    // 가장 가까운 적 찾기 (일반+보스)
    let targets = this._findNearestEnemies(this.count);
    if (targets.length === 0) return;

    // 발사 수만큼 spread 각도로 발사
    const spreadAngles = this._spreadAngles(this.count);

    targets.forEach((target, i) => {
      const baseAngle = Phaser.Math.Angle.Between(me.x, me.y, target.x, target.y);
      const angle = baseAngle + spreadAngles[i];

      this._spawnFireball(me.x, me.y, angle);
    });
  }

  _spawnFireball(x, y, angle) {
    const scene = this.scene;

    // fireballs 그룹이 없으면 생성 (GameScene에서 미리 만들어두지만 방어적 처리)
    if (!scene.fireballs) {
      scene.fireballs = scene.physics.add.group();
    }

    const fb = scene.fireballs.create(x, y, 'fireball');
    if (!fb) return;

    fb.setActive(true).setVisible(true);
    fb.setDepth(8);
    fb.setScale(1.5);
    fb.damage = this.damage;
    fb.rotation = angle;

    fb.body.setVelocity(
      Math.cos(angle) * this.fbSpeed,
      Math.sin(angle) * this.fbSpeed
    );

    // 파이어볼 발사 이펙트 (파티클 flash)
    if (scene.add.particles) {
      const emitter = scene.add.particles(x, y, 'particle_star', {
        speed: { min: 30, max: 80 },
        scale: { start: 0.8, end: 0 },
        tint: 0xff6600,
        lifespan: 300,
        emitting: false
      });
      emitter.explode(6);
      scene.time.delayedCall(400, () => emitter.destroy());
    }

    // 3초 후 자동 소멸
    scene.time.delayedCall(3000, () => {
      if (fb && fb.active) fb.destroy();
    });
  }

  _findNearestEnemies(n) {
    const me = this.player.sprite;
    const candidates = [];

    const collect = (sprite) => {
      if (!sprite.active) return;
      const d = Phaser.Math.Distance.Between(me.x, me.y, sprite.x, sprite.y);
      candidates.push({ sprite, d });
    };

    this.scene.enemyManager.group.children.each(collect);
    this.scene.enemyManager.bossGroup.children.each(collect);

    candidates.sort((a, b) => a.d - b.d);
    return candidates.slice(0, n).map(c => c.sprite);
  }

  /**
   * count가 1이면 [0], 2이면 [-0.12, 0.12], 3이면 [-0.2, 0, 0.2] (라디안)
   */
  _spreadAngles(count) {
    if (count === 1) return [0];
    if (count === 2) return [-0.12, 0.12];
    return [-0.2, 0, 0.2];
  }
}
