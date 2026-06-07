export default class Enemy {
  constructor(scene, x, y, type = 'M01', gameTime = 0) {
    this.scene = scene;
    this.type = type;

    // 타입별 텍스처
    const textureKey = {
      M01: 'enemy',
      M02: 'enemy_m02',
      M03: 'enemy_m03'
    }[type] || 'enemy';

    this.sprite = scene.physics.add.sprite(x, y, textureKey)
      .setDepth(1)
      .setDisplaySize(40, 40);
    this.sprite.body.setSize(36, 36);
    this.sprite.parentRef = this;

    // 몬스터별 기본 스탯 + 경험치 색상
    const base = {
      M01: {
        hp: 32,
        speed: 90,
        exp: 3,
        dmg: 12,
        expTint: 0x22cc66 // 초록
      },
      M02: {
        hp: 24,
        speed: 140,
        exp: 6,
        dmg: 15,
        expTint: 0x3399ff // 파랑
      },
      M03: {
        hp: 57,
        speed: 70,
        exp: 5,
        dmg: 8,
        expTint: 0xffaa00 // 주황
      },
    }[type] || {
      hp: 20,
      speed: 50,
      exp: 5,
      dmg: 10,
      expTint: 0xffffff
    };

    // gameTime + 플레이어 레벨 복합 스케일링
    const playerLevel = scene.player?.level || 1;
    const timeFactor  = 1 + Math.floor(gameTime / 30) * 0.20;
    const levelFactor = 1 + (playerLevel - 1) * 0.18;
    const hpMultiplier = timeFactor * levelFactor;

    this.maxHp = Math.floor(base.hp * hpMultiplier);
    this.hp = this.maxHp;
    this.speed = base.speed;
    this.expValue = base.exp;
    this.expTint = base.expTint;
    // 접촉 데미지도 gameTime에 따라 소폭 증가
    const dmgFactor = 1 + Math.floor(gameTime / 60) * 0.10;
    this.contactDmg = Math.round(base.dmg * dmgFactor);
    this.alive = true;
    this.lifetime = 0;
  }

  update(dt) {
    if (!this.alive) return;
    this.lifetime += dt;

    const player = this.scene.player.sprite;
    const angle = Phaser.Math.Angle.Between(
      this.sprite.x, this.sprite.y, player.x, player.y
    );

    if (this.type === 'M03') {
      // 잠시 멈췄다가 접근
      if (this.lifetime < 1.2) {
        this.sprite.setVelocity(0, 0);
      } else {
        this.sprite.setVelocity(
          Math.cos(angle) * this.speed,
          Math.sin(angle) * this.speed
        );
      }
    } else {
      this.sprite.setVelocity(
        Math.cos(angle) * this.speed,
        Math.sin(angle) * this.speed
      );
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
      this.sprite.x,
      this.sprite.y,
      'particle_star',
      {
        speed: { min: -80, max: 80 },
        lifespan: 400,
        scale: { start: 0.6, end: 0 },
        emitting: false
      }
    );

    emitter.explode(8);
    this.scene.time.delayedCall(500, () => emitter.destroy());

    // 경험치 드랍
    const orb = this.scene.physics.add.image(
      this.sprite.x,
      this.sprite.y,
      'exp_orb'
    );

    orb.expValue = this.expValue;
    orb.setDepth(1);

    // 몬스터 종류별 경험치 색상
    orb.setTint(this.expTint);

    // 몬스터 종류별 경험치 구슬 크기 차이
    if (this.type === 'M01') orb.setScale(1.0);
    if (this.type === 'M02') orb.setScale(1.15);
    if (this.type === 'M03') orb.setScale(1.1);

    if (!this.scene.expOrbs) {
      this.scene.expOrbs = this.scene.physics.add.group();
    }

    this.scene.expOrbs.add(orb);

    this.sprite.destroy();
  }

  isDead() {
    return !this.alive;
  }

  destroy() {
    if (this.sprite && this.sprite.active) this.sprite.destroy();
    this.alive = false;
  }
}