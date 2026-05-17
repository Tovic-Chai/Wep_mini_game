export default class Skill {
  constructor(scene, data) {
    this.scene = scene;
    this.id = data.id;
    this.name = data.name;
    this.duration = data.duration || 3;
    this.cooldown = data.cooldown || 30;
    this.effect = data.effect;
    this.uses = data.uses;
  }

  activate(player) {
    if (this.effect === 'timeSlow')   this.applyTimeSlow(player);
    else if (this.effect === 'blackhole') this.applyBlackhole(player);
    else if (this.effect === 'clone')     this.applyClone(player);
  }

  applyTimeSlow(player) {
    const scene = this.scene;
    scene.time.timeScale = 0.45;
    scene.tweens.timeScale = 0.45;
    scene.cameras.main.flash(200, 200, 200, 255);
    scene.time.delayedCall(this.duration * 1000, () => {
      scene.time.timeScale = 1;
      scene.tweens.timeScale = 1;
    });
  }

  applyBlackhole(player) {
    const scene = this.scene;
    const x = player.sprite.x;
    const y = player.sprite.y - 80;

    // 적 끌어당기기
    if (scene.enemyManager && scene.enemyManager.group) {
      scene.enemyManager.group.children.each(e => {
        if (!e.active) return;
        scene.physics.moveToObject(e, { x, y }, 220);
      });
    }

    // 적 탄막만 소멸 (플레이어 탄은 보호)
    scene.children.list.forEach(child => {
      if (child.isEnemyBullet) {
        const dx = child.x - x, dy = child.y - y;
        if (Math.hypot(dx, dy) < 300) child.destroy();
      }
    });

    // ★ Phaser 3.60+ 파티클 API
    const emitter = scene.add.particles(x, y, 'particle_star', {
      speed: { min: -120, max: 120 },
      scale: { start: 1.2, end: 0 },
      lifespan: 700,
      frequency: 30
    });
    scene.time.delayedCall(this.duration * 1000, () => emitter.destroy());
  }

  applyClone(player) {
    const scene = this.scene;
    for (let i = 0; i < 2; i++) {
      const cx = player.sprite.x + (i === 0 ? -40 : 40);
      const cy = player.sprite.y;
      const clone = scene.add.sprite(cx, cy, 'player').setAlpha(0.7).setDepth(2);
      const t = scene.time.addEvent({
        delay: 200,
        callback: () => {
          if (!clone.active) return;
          const b = scene.add.image(clone.x, clone.y - 20, 'bullet');
          b.isPlayerBullet = true;
          scene.physics.world.enable(b);
          b.body.velocity.y = -380;
        },
        repeat: Math.floor(this.duration * 5) - 1
      });
      scene.time.delayedCall(this.duration * 1000, () => {
        if (clone.active) clone.destroy();
        t.remove(false);
      });
    }

    const emitter = scene.add.particles(player.sprite.x, player.sprite.y, 'particle_star', {
      speed: { min: -80, max: 80 },
      scale: { start: 0.8, end: 0 },
      lifespan: 600,
      emitting: false
    });
    emitter.explode(20);
    scene.time.delayedCall(800, () => emitter.destroy());
  }
}
