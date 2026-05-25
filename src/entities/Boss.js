export default class Boss extends Phaser.Events.EventEmitter {
  constructor(scene, x, y, kind = 'mini1') {
    super();
    this.scene = scene;
    this.kind = kind;

    let key = 'boss_mini1';
    if (kind === 'mini2') key = 'boss_mini2';
    if (kind === 'mini3') key = 'boss_mini3';
    if (kind === 'final') key = 'boss_final_phase1';

    const scale = (kind === 'final') ? 0.6 : 0.45;
    this.sprite = scene.physics.add.sprite(x, y, key).setDepth(3).setScale(scale);
    this.sprite.parentRef = this;
    this.alive = true;
    this.attackTimer = 0;

    if (kind === 'mini1') { this.hp = 1500; this.skill = { id: 'slow', name: '시간 슬로우', duration: 5, cooldown: 45, effect: 'timeSlow' }; }
    else if (kind === 'mini2') { this.hp = 2500; this.skill = { id: 'blackhole', name: '블랙홀', duration: 3, cooldown: 60, effect: 'blackhole' }; }
    else if (kind === 'mini3') { this.hp = 4000; this.skill = { id: 'clone', name: '분신', duration: 8, cooldown: 75, effect: 'clone' }; }
    else { this.hp = 15000; this.skill = null; this.phase = 1; }

    this.angleOffset = 0;
  }

  update(dt) {
    if (!this.alive) return;
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = (this.kind === 'final') ? 0.9 : 1.2;
      this.firePattern();
    }
    if (this.kind === 'final') {
      if (this.phase === 1 && this.hp <= 10000) this.setPhase(2);
      if (this.phase === 2 && this.hp <= 5000) this.setPhase(3);
    }

    // 플레이어 추적
    const player = this.scene.player.sprite;

    const angle = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      player.x,
      player.y
    );

    let moveSpeed = 45;

    if (this.kind === 'mini2') moveSpeed = 55;
    if (this.kind === 'mini3') moveSpeed = 70;

    if (this.kind === 'final') {
      if (this.phase === 1) moveSpeed = 60;
      if (this.phase === 2) moveSpeed = 85;
      if (this.phase === 3) moveSpeed = 110;
    }

    this.sprite.setVelocity(
      Math.cos(angle) * moveSpeed,
      Math.sin(angle) * moveSpeed
    );
  }

  firePattern() {
    const bullets = (this.kind === 'final' && this.phase === 3) ? 36 : 12;
    for (let i = 0; i < bullets; i++) {
      const angle = Phaser.Math.DegToRad((360 / bullets) * i + this.angleOffset);
      const bx = this.sprite.x + Math.cos(angle) * 20;
      const by = this.sprite.y + Math.sin(angle) * 20;
      const b = this.scene.add.image(bx, by, 'bullet').setDepth(2).setTint(0xff3366);
      b.isEnemyBullet = true;
      this.scene.physics.world.enable(b);
      const speed = (this.kind === 'final' && this.phase === 2) ? 180 : 120;
      b.body.velocity.x = Math.cos(angle) * speed;
      b.body.velocity.y = Math.sin(angle) * speed;
    }
    this.angleOffset += 10;
  }

  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    if (this.hp <= 0) this.defeated();
  }

  defeated() {
    if (!this.alive) return;
    this.alive = false;

    // ★ 시네마틱 오버레이를 카메라 기준 화면 중앙에 띄움 (setScrollFactor(0))
    const overlay = this.scene.add.image(480, 320, this.sprite.texture.key)
      .setAlpha(0).setDepth(50).setScrollFactor(0);
    this.scene.tweens.add({ targets: overlay, alpha: 0.6, duration: 200 });

    // 보스 위치에서 폭발 파티클
    const emitter = this.scene.add.particles(this.sprite.x, this.sprite.y, 'particle_star', {
      speed: { min: -200, max: 200 },
      scale: { start: 1.0, end: 0 },
      lifespan: 800,
      emitting: false
    });
    emitter.explode(40);

    this.scene.time.delayedCall(1400, () => {
      emitter.destroy();
      overlay.destroy();
      if (this.skill) this.emit('defeated', this.skill);
      else this.emit('defeated');
      if (this.sprite && this.sprite.active) this.sprite.destroy();
    });
  }

  setPhase(n) {
    if (this.phase === n) return;
    this.phase = n;
    if (n === 2) {
      this.sprite.setTexture('boss_final_phase2');
      this.attackTimer = 0.5;
    } else if (n === 3) {
      this.sprite.setTexture('boss_final_phase3');
      this.attackTimer = 0.4;
    }
  }
}
