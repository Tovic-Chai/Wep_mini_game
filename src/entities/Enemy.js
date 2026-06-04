export default class Enemy {
  constructor(scene, x, y, type = 'M01', gameTime = 0) {
    this.scene = scene;
    this.type = type;

    // 타입별 텍스처
    // 이미지가 아직 없으니까 M04~M08은 기존 이미지 임시 사용
    const textureKey = {
      M01: 'enemy',
      M02: 'enemy_m02',
      M03: 'enemy_m03',

      M04: 'enemy',      // 탱커
      M05: 'enemy_m02',  // 돌진
      M06: 'enemy_m03',  // 거리 유지형
      M07: 'enemy',      // 빠른 소형
      M08: 'enemy_m03'   // 엘리트
    }[type] || 'enemy';

    this.sprite = scene.physics.add.sprite(x, y, textureKey).setDepth(1);
    this.sprite.parentRef = this;

    // 몬스터별 기본 스탯
    // 경험치 규칙:
    // M01, M02, M03 = 4
    // M04, M05 = 8
    // M06, M07, M08 = 12
    const base = {
      M01: {
        hp: 32,
        speed: 90,
        exp: 4,
        dmg: 12,
        expTint: 0x22cc66
      },
      M02: {
        hp: 24,
        speed: 140,
        exp: 4,
        dmg: 15,
        expTint: 0x22cc66
      },
      M03: {
        hp: 57,
        speed: 70,
        exp: 4,
        dmg: 8,
        expTint: 0x22cc66
      },

      // M04: 탱커 몬스터
      M04: {
        hp: 130,
        speed: 55,
        exp: 8,
        dmg: 20,
        expTint: 0x3399ff
      },

      // M05: 돌진 몬스터
      M05: {
        hp: 75,
        speed: 105,
        exp: 8,
        dmg: 22,
        expTint: 0x3399ff
      },

      // M06: 거리 유지형 몬스터
      M06: {
        hp: 95,
        speed: 80,
        exp: 12,
        dmg: 18,
        expTint: 0xffaa00
      },

      // M07: 빠른 소형 몬스터
      M07: {
        hp: 45,
        speed: 190,
        exp: 12,
        dmg: 16,
        expTint: 0xffaa00
      },

      // M08: 후반 엘리트 몬스터
      M08: {
        hp: 180,
        speed: 95,
        exp: 12,
        dmg: 28,
        expTint: 0xffaa00
      }
    }[type] || {
      hp: 20,
      speed: 50,
      exp: 4,
      dmg: 10,
      expTint: 0xffffff
    };

    // 시간에 따른 체력 증가
    // 30초마다 체력 15% 증가
    const hpMultiplier = 1 + Math.floor(gameTime / 30) * 0.15;

    this.maxHp = Math.floor(base.hp * hpMultiplier);
    this.hp = this.maxHp;
    this.speed = base.speed;
    this.expValue = base.exp;
    this.expTint = base.expTint;
    this.contactDmg = base.dmg;
    this.alive = true;
    this.lifetime = 0;
    // 얼음 둔화 상태
    this.slowTimer = 0;
    this.slowMultiplier = 1;

    // M05 돌진용 변수
    this.dashCooldown = 2.2;
    this.dashTimer = Phaser.Math.FloatBetween(0.3, 1.5);
    this.dashDuration = 0;
  }

  update(dt) {
    if (!this.alive) return;

    this.lifetime += dt;

    // 둔화 시간 감소
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;

      if (this.slowTimer <= 0) {
        this.slowTimer = 0;
        this.slowMultiplier = 1;
      }
    }

    const player = this.scene.player.sprite;

    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      player.x,
      player.y
    );

    const dist = Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      player.x,
      player.y
    );

    // M03: 처음 1.2초 멈췄다가 접근
    if (this.type === 'M03') {
      if (this.lifetime < 1.2) {
        this.sprite.setVelocity(0, 0);
      } else {
        this.moveToPlayer(angle, this.speed);
      }
    }

    // M05: 일정 시간마다 빠르게 돌진
    else if (this.type === 'M05') {
      this.updateDash(dt, angle);
    }

    // M06: 플레이어에게 너무 가까우면 물러나고, 멀면 접근
    else if (this.type === 'M06') {
      this.updateKeepDistance(angle, dist);
    }

    // M08: 엘리트 몬스터, 살짝 흔들리면서 접근
    else if (this.type === 'M08') {
      this.updateEliteMove(angle);
    }

    // 나머지 몬스터는 기본 추적
    else {
      this.moveToPlayer(angle, this.speed);
    }

    // 너무 멀어지면 디스폰
    if (dist > 1200) this.destroy();
  }

  moveToPlayer(angle, speed) {
    const finalSpeed = speed * this.slowMultiplier;

    this.sprite.setVelocity(
      Math.cos(angle) * finalSpeed,
      Math.sin(angle) * finalSpeed
    );
  }

  updateDash(dt, angle) {
    this.dashTimer -= dt;

    // 돌진 중
    if (this.dashDuration > 0) {
      this.dashDuration -= dt;

      const dashSpeed = 280 * this.slowMultiplier;

      this.sprite.setVelocity(
        Math.cos(angle) * dashSpeed,
        Math.sin(angle) * dashSpeed
      );

      return;
    }

    // 돌진 시작
    if (this.dashTimer <= 0) {
      this.dashTimer = this.dashCooldown;
      this.dashDuration = 0.35;
      return;
    }

    // 평소에는 천천히 추적
    this.moveToPlayer(angle, this.speed);
  }

  updateKeepDistance(angle, dist) {
    // 너무 가까우면 뒤로 이동
    if (dist < 220) {
      const finalSpeed = this.speed * this.slowMultiplier;

      this.sprite.setVelocity(
        -Math.cos(angle) * finalSpeed,
        -Math.sin(angle) * finalSpeed
      );
    }

    // 너무 멀면 접근
    else if (dist > 330) {
      this.moveToPlayer(angle, this.speed);
    }

    // 적당한 거리면 멈춤
    else {
      this.sprite.setVelocity(0, 0);
    }
  }

  updateEliteMove(angle) {
    const wave = Math.sin(this.lifetime * 5) * 0.8;
    const finalAngle = angle + wave;
    const finalSpeed = this.speed * this.slowMultiplier;

    this.sprite.setVelocity(
      Math.cos(finalAngle) * finalSpeed,
      Math.sin(finalAngle) * finalSpeed
    );
  }

  applySlow(multiplier = 0.55, duration = 2) {
    if (!this.alive) return;

    // 더 강한 둔화가 들어오면 강한 쪽 유지
    this.slowMultiplier = Math.min(this.slowMultiplier, multiplier);

    // 지속시간은 더 긴 쪽 유지
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  takeDamage(amount) {
    if (!this.alive) return;

    this.hp -= amount;

    // 피격 이펙트
    this.sprite.setTint(0xff4444);

    this.scene.time.delayedCall(80, () => {
      if (this.sprite && this.sprite.active) {
        this.sprite.clearTint();
      }
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
    orb.setTint(this.expTint);

    // 경험치 그룹별 크기
    if (['M01', 'M02', 'M03'].includes(this.type)) {
      orb.setScale(1.0);
    }

    if (['M04', 'M05'].includes(this.type)) {
      orb.setScale(1.2);
    }

    if (['M06', 'M07', 'M08'].includes(this.type)) {
      orb.setScale(1.4);
    }

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
    if (this.sprite && this.sprite.active) {
      this.sprite.destroy();
    }

    this.alive = false;
  }
}