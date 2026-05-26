export default class Enemy {
  constructor(scene, x, y, type = 'M01') {
    this.scene = scene;
    this.type  = type;

    // 타입별 텍스처
    const textureKey = {
      M01: 'enemy',
      M02: 'enemy_m02',
      M03: 'enemy_m03'
    }[type] || 'enemy';

    this.sprite = scene.physics.add.sprite(x, y, textureKey).setDepth(1);
    this.sprite.parentRef = this;

    const base = {
      M01: { hp: 12, speed: 60,  exp: 3, dmg: 8  },
      M02: { hp: 30, speed: 40,  exp: 6, dmg: 15 },
      M03: { hp: 18, speed: 30,  exp: 5, dmg: 12 },
    }[type] || { hp: 20, speed: 50, exp: 5, dmg: 10 };

    this.hp         = base.hp;
    this.speed      = base.speed;
    this.expValue   = base.exp;
    this.contactDmg = base.dmg; // 플레이어 접촉 데미지
    this.alive      = true;
    this.lifetime   = 0;
  }

  update(dt) {
    if (!this.alive) return;
    this.lifetime += dt;

    const player = this.scene.player.sprite;
    const angle  = Phaser.Math.Angle.Between(
      this.sprite.x, this.sprite.y, player.x, player.y
    );

    if (this.type === 'M03') {
      // 잠시 멈췄다가 접근 (저격병 컨셉)
      if (this.lifetime < 1.2) this.sprite.setVelocity(0, 0);
      else this.sprite.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    } else {
      this.sprite.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    }

    // 너무 멀어지면 디스폰
    const dist = Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y, player.x, player.y
    );
    if (dist > 1200) this.destroy();
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;

    // 피격 이펙트
    this.sprite.setTint(0xff4444);
    this.scene.time.delayedCall(80, () => {
      if (this.sprite && this.sprite.active) this.sprite.clearTint();
    });

    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;

    // 폭발 파티클
    const emitter = this.scene.add.particles(
      this.sprite.x, this.sprite.y, 'particle_star', {
        speed: { min: -80, max: 80 },
        lifespan: 400,
        scale: { start: 0.6, end: 0 },
        emitting: false
      }
    );
    emitter.explode(8);
    this.scene.time.delayedCall(500, () => emitter.destroy());

    // 경험치 드랍
    const orb = this.scene.physics.add.image(this.sprite.x, this.sprite.y, 'exp_orb');
    orb.expValue = this.expValue;
    orb.setDepth(1);

    if (!this.scene.expOrbs) {
      this.scene.expOrbs = this.scene.physics.add.group();
    }
    this.scene.expOrbs.add(orb);

    this.sprite.destroy();
  }

  isDead() { return !this.alive; }

  destroy() {
    if (this.sprite && this.sprite.active) this.sprite.destroy();
    this.alive = false;
  }
}
