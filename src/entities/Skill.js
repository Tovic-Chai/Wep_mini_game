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
    switch (this.effect) {
      case 'timeSlow': this.applyTimeSlow(player); break;
      case 'blackhole': this.applyBlackhole(player); break;
      case 'clone': this.applyClone(player); break;
      case 'laser': this.applyLaser(player); break;
    }
  }

  // ── 시간 슬로우 ──
  applyTimeSlow(player) {
    const scene = this.scene;
    scene.time.timeScale = 0.45;
    scene.tweens.timeScale = 0.45;
    scene.cameras.main.flash(200, 200, 200, 255);

    // 화면 테두리 파란색 (시간 슬로우 시각 표시)
    const border = scene.add.rectangle(480, 320, 960, 640, 0x0000ff, 0)
      .setStrokeStyle(6, 0x4488ff, 0.6).setScrollFactor(0).setDepth(60);

    scene.time.delayedCall(this.duration * 1000 / 0.45, () => {
      scene.time.timeScale = 1;
      scene.tweens.timeScale = 1;
      if (border.active) border.destroy();
    });
  }

  // ── 블랙홀 ──
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

    // 메인보스 제외, 주변 적 탄 소멸
    scene.enemyBullets && scene.enemyBullets.children.each(b => {
      if (!b.active) return;
      const dx = b.x - x, dy = b.y - y;
      if (Math.hypot(dx, dy) < 300) b.destroy();
    });

    // 파티클 블랙홀 효과
    const emitter = scene.add.particles(x, y, 'particle_star', {
      speed: { min: -120, max: 120 },
      scale: { start: 1.2, end: 0 },
      lifespan: 700,
      frequency: 30
    });
    scene.time.delayedCall(this.duration * 1000, () => emitter.destroy());

    // 블랙홀 원 시각화
    const circle = scene.add.circle(x, y, 60, 0x220044, 0.7).setDepth(15);
    scene.tweens.add({
      targets: circle, radius: 100, alpha: 0,
      duration: this.duration * 1000,
      onComplete: () => circle.destroy()
    });
  }

  // ── 분신 ──
  applyClone(player) {
    const scene = this.scene;

    // 분신 생성
    for (let i = 0; i < 2; i++) {
      const cx = player.sprite.x + (i === 0 ? -70 : 70);
      const cy = player.sprite.y;
      const cloneTex = scene.textures.exists('player_down_idle') ? 'player_down_idle' : 'player';
      const cloneSize = player.sprite.displayWidth * 0.95;

      const clone = scene.add.sprite(cx, cy, cloneTex)
        .setAlpha(0.7)
        .setDepth(2)
        .setDisplaySize(cloneSize, cloneSize);

      const t = scene.time.addEvent({
        delay: 300,
        callback: () => {
          if (!clone.active) return;

          // ── 분신 기준 가장 가까운 적 찾기
          let nearest = null;
          let minDist = Infinity;

          const checkEnemy = (enemySprite) => {
            if (!enemySprite.active) return;

            const d = Phaser.Math.Distance.Between(
              clone.x,
              clone.y,
              enemySprite.x,
              enemySprite.y
            );

            if (d < minDist) {
              minDist = d;
              nearest = enemySprite;
            }
          };

          if (scene.enemyManager && scene.enemyManager.group) {
            scene.enemyManager.group.children.each(checkEnemy);
          }

          if (scene.enemyManager && scene.enemyManager.bossGroup) {
            scene.enemyManager.bossGroup.children.each(checkEnemy);
          }

          // 적이 없으면 발사 안 함
          if (!nearest) return;

          const angle = Phaser.Math.Angle.Between(
            clone.x,
            clone.y,
            nearest.x,
            nearest.y
          );

          // 분신의 탄은 player.bullets에 추가해서 기존 충돌 처리 사용
          const b = player.bullets.create(clone.x, clone.y, 'bullet');
          if (!b) return;

          b.setActive(true).setVisible(true);
          b.isPlayerBullet = true;
          b.setDepth(10);
          b.setScale(1.15);
          b.rotation = angle;

          const bulletSpeed = 630;

          b.body.setVelocity(
            Math.cos(angle) * bulletSpeed,
            Math.sin(angle) * bulletSpeed
          );
        },
        repeat: Math.floor(this.duration * 5) - 1
      });

      scene.time.delayedCall(this.duration * 1000, () => {
        if (clone.active) clone.destroy();
        t.remove(false);
      });
    }

    // 활성화 파티클
    const emitter = scene.add.particles(
      player.sprite.x, player.sprite.y, 'particle_star', {
      speed: { min: -80, max: 80 },
      scale: { start: 0.8, end: 0 },
      lifespan: 600,
      emitting: false
    }
    );
    emitter.explode(20);
    scene.time.delayedCall(800, () => emitter.destroy());
  }

  // ── 레이저 ──
  applyLaser(player) {
    const scene = this.scene;
    const sx = player.sprite.x;
    const sy = player.sprite.y;

    // 마우스 커서 방향으로 발사
    const ptr = scene.input.activePointer;
    const cx = scene.cameras.main;
    const mx = ptr.x + cx.scrollX;
    const my = ptr.y + cx.scrollY;
    const angle = Phaser.Math.Angle.Between(sx, sy, mx, my);
    const length = 1400;

    // 예고선
    const warning = scene.add.rectangle(
      sx + Math.cos(angle) * length / 2,
      sy + Math.sin(angle) * length / 2,
      length, 10, 0x00ffff, 0.4
    ).setDepth(15).setRotation(angle).setScrollFactor(1);

    scene.tweens.add({
      targets: warning, alpha: 0.8, duration: 100, yoyo: true, repeat: 2
    });

    scene.time.delayedCall(350, () => {
      if (warning.active) warning.destroy();

      // 레이저 빔
      const beam = scene.add.rectangle(
        sx + Math.cos(angle) * length / 2,
        sy + Math.sin(angle) * length / 2,
        length, 24, 0x00ffff, 0.95
      ).setDepth(15).setRotation(angle).setScrollFactor(1);

      const core = scene.add.rectangle(
        sx + Math.cos(angle) * length / 2,
        sy + Math.sin(angle) * length / 2,
        length, 8, 0xffffff, 1
      ).setDepth(16).setRotation(angle).setScrollFactor(1);

      scene.cameras.main.flash(200, 0, 200, 255);

      // 빔 범위 안의 적에게 데미지
      const beamLine = new Phaser.Geom.Line(
        sx, sy,
        sx + Math.cos(angle) * length,
        sy + Math.sin(angle) * length
      );

      const dealDamage = (group) => {
        if (!group) return;
        group.children.each(sprite => {
          if (!sprite.active) return;
          const d = Phaser.Geom.Line.GetShortestDistance(beamLine, new Phaser.Geom.Point(sprite.x, sprite.y));
          if (d < 30) {
            if (sprite.parentRef && sprite.parentRef.takeDamage) {
              sprite.parentRef.takeDamage(80);
            }
          }
        });
      };

      dealDamage(scene.enemyManager?.group);
      dealDamage(scene.enemyManager?.bossGroup);

      scene.tweens.add({
        targets: [beam, core], alpha: 0, duration: 400,
        onComplete: () => {
          if (beam.active) beam.destroy();
          if (core.active) core.destroy();
        }
      });
    });
  }

}
