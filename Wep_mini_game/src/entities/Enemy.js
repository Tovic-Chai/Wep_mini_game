export default class Enemy {
  constructor(scene, x, y, type = 'M01') {
    this.scene = scene;
    this.type = type;
    this.sprite = scene.physics.add.sprite(x, y, 'enemy').setDepth(1);
    this.sprite.parentRef = this;

    const base = {
      M01: { hp: 12, speed: 60, exp: 3 },
      M02: { hp: 30, speed: 40, exp: 6 },
      M03: { hp: 18, speed: 30, exp: 5 },
    }[type] || { hp: 20, speed: 50, exp: 5 };

    this.hp = base.hp;
    this.speed = base.speed;
    this.expValue = base.exp;
    this.alive = true;
    this.state = 'spawn';
    this.lifetime = 0;
  }

  update(dt) {
    if (!this.alive) return;
    this.lifetime += dt;

    // ★ 플레이어 추적 (뱀서라이크 핵심)
    const player = this.scene.player.sprite;
    const angle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);

    if (this.type === 'M03') {
      // M03: 잠시 멈췄다가 천천히 접근 (사수병 컨셉)
      if (this.lifetime < 1.2) this.sprite.setVelocity(0, 0);
      else this.sprite.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    } else {
      this.sprite.setVelocity(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
    }

    // ★ 플레이어로부터 너무 멀어지면 디스폰 (성능 + 무한 누적 방지)
    const dist = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y);
    if (dist > 1200) this.destroy();
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) this.die();
  }

  die() {
    if (!this.alive) return;
    this.alive = false;

    const emitter = this.scene.add.particles(this.sprite.x, this.sprite.y, 'particle_star', {
      speed: { min: -80, max: 80 },
      lifespan: 400,
      scale: { start: 0.6, end: 0 },
      emitting: false
    });
    emitter.explode(8);
    this.scene.time.delayedCall(500, () => emitter.destroy());

    this.sprite.destroy();
  }

  isDead() { return !this.alive; }

  destroy() {
    if (this.sprite && this.sprite.active) this.sprite.destroy();
    this.alive = false;
  }
}
