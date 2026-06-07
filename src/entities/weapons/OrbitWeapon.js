import PassiveWeapon from './PassiveWeapon.js';

/**
 * 회전 오브 무기
 * 플레이어 주위를 일정 반경으로 공전하는 오브(구슬)를 생성한다.
 * 쿨다운 없이 항상 회전하며, 적에 닿으면 즉시 데미지 (단, 적당한 히트 쿨다운 적용).
 */
export default class OrbitWeapon extends PassiveWeapon {
  constructor(scene, player) {
    super(scene, player, 'orbit');
    this.angle       = 0;          // 현재 공전 각도 (라디안)
    this.orbs        = [];         // 시각 오브젝트 배열
    this.hitCooldowns = new Map(); // 적별 마지막 히트 시각 Map
    this.cooldown    = 9999;       // 발동 쿨다운 없음 (update에서 직접 처리)

    this.applyLevelStats();
    this._buildOrbs();
  }

  applyLevelStats() {
    const STATS = [
      null,
      { damage: 12, count: 2, radius: 70, rotSpeed: 1.5 }, // Lv1
      { damage: 18, count: 2, radius: 75, rotSpeed: 2.0 }, // Lv2
      { damage: 24, count: 3, radius: 80, rotSpeed: 2.5 }, // Lv3
      { damage: 30, count: 4, radius: 85, rotSpeed: 3.0 }, // Lv4
      { damage: 38, count: 5, radius: 90, rotSpeed: 3.5 }, // Lv5
    ];
    const s = STATS[this.level];
    this.damage   = s.damage;
    this.count    = s.count;
    this.radius   = s.radius;
    this.rotSpeed = s.rotSpeed; // radians per second
  }

  /** 오브 개수 변화 시 시각 오브젝트를 재생성 */
  _buildOrbs() {
    // 기존 오브 제거
    this.orbs.forEach(o => { if (o && o.active) o.destroy(); });
    this.orbs = [];

    for (let i = 0; i < this.count; i++) {
      const orb = this.scene.add.image(0, 0, 'orbit_orb')
        .setDepth(9)
        .setScale(1.2);
      this.orbs.push(orb);
    }
  }

  /** PassiveWeapon.update 오버라이드 — 매 프레임 회전 및 충돌 처리 */
  update(dt) {
    // 쿨다운 축적 생략 (항상 활성)
    this.angle += this.rotSpeed * dt;

    const me = this.player.sprite;

    // 오브 위치 갱신
    for (let i = 0; i < this.orbs.length; i++) {
      const a = this.angle + (Math.PI * 2 / this.orbs.length) * i;
      this.orbs[i].x = me.x + Math.cos(a) * this.radius;
      this.orbs[i].y = me.y + Math.sin(a) * this.radius;
    }

    // 충돌 체크
    const now = this.scene.time.now;
    const dmg = this.damage;
    const hitR = 18; // 히트 반경 (px)

    const checkHit = (sprite) => {
      if (!sprite.active || !sprite.parentRef) return;
      for (const orb of this.orbs) {
        const d = Phaser.Math.Distance.Between(orb.x, orb.y, sprite.x, sprite.y);
        if (d < hitR) {
          const last = this.hitCooldowns.get(sprite) || 0;
          if (now - last > 500) {
            sprite.parentRef.takeDamage(dmg);
            this.hitCooldowns.set(sprite, now);
            // 히트 이펙트 (오브 깜빡임)
            this.scene.tweens.add({
              targets: orb,
              alpha: 0.3,
              duration: 60,
              yoyo: true,
              onComplete: () => { if (orb && orb.active) orb.setAlpha(1); }
            });
          }
        }
      }
    };

    this.scene.enemyManager.group.children.each(checkHit);
    this.scene.enemyManager.bossGroup.children.each(checkHit);

    // 사용하지 않는 히트쿨다운 엔트리 정리 (메모리 누수 방지)
    if (Math.random() < 0.01) {
      for (const [key] of this.hitCooldowns) {
        if (!key || !key.active) this.hitCooldowns.delete(key);
      }
    }
  }

  levelUp() {
    if (this.level < 5) {
      this.level++;
      const oldCount = this.count;
      this.applyLevelStats();
      if (this.count !== oldCount) this._buildOrbs();
    }
  }

  destroy() {
    this.orbs.forEach(o => { if (o && o.active) o.destroy(); });
    this.orbs = [];
  }
}
