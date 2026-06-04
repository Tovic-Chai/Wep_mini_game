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
      { damage: 35,  count: 1, length: 520, width: 18, cooldown: 3.2 }, // Lv1
      { damage: 50,  count: 1, length: 600, width: 20, cooldown: 2.9 }, // Lv2
      { damage: 65,  count: 2, length: 700, width: 22, cooldown: 2.6 }, // Lv3
      { damage: 85,  count: 2, length: 800, width: 25, cooldown: 2.3 }, // Lv4
      { damage: 115, count: 3, length: 900, width: 30, cooldown: 2.0 }, // Lv5
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

    const g = scene.add.graphics().setDepth(15);

    // 바깥 레이저
    g.lineStyle(this.beamWidth, 0x33ccff, 0.35);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(endX, endY);
    g.strokePath();

    // 안쪽 레이저
    g.lineStyle(Math.max(3, this.beamWidth * 0.35), 0xffffff, 0.95);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(endX, endY);
    g.strokePath();

    // 시작 지점 빛
    const startFlash = scene.add.circle(x, y, 18, 0x99eeff, 0.75)
      .setDepth(16);

    // 끝 지점 빛
    const endFlash = scene.add.circle(endX, endY, 12, 0x99eeff, 0.45)
      .setDepth(16);

    scene.tweens.add({
      targets: [g, startFlash, endFlash],
      alpha: 0,
      duration: 160,
      onComplete: () => {
        g.destroy();
        startFlash.destroy();
        endFlash.destroy();
      }
    });
  }

  _hitEffect(x, y) {
    const scene = this.scene;

    const flash = scene.add.circle(x, y, 16, 0x66ddff, 0.65)
      .setDepth(17);

    scene.tweens.add({
      targets: flash,
      scale: 1.7,
      alpha: 0,
      duration: 140,
      onComplete: () => flash.destroy()
    });
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