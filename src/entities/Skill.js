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
    }
  }

  // ── 시간 슬로우: 적만 슬로우, 플레이어는 정상 속도 ──
  applyTimeSlow(player) {
    const scene = this.scene;
    const slowScale = 0.25;
    const duration  = this.duration * 1000;

    scene.cameras.main.flash(200, 200, 200, 255);

    // 테두리 표시
    const border = scene.add.rectangle(480, 320, 960, 640, 0x0000ff, 0)
      .setStrokeStyle(6, 0x4488ff, 0.6).setScrollFactor(0).setDepth(60);

    // 적(Enemy) 속도 저장 후 슬로우
    const slowed = [];
    const applyToEnemy = (sprite) => {
      if (!sprite.active || !sprite.parentRef) return;
      const e = sprite.parentRef;
      if (e._slowedSpeed !== undefined) return; // 이미 슬로우 중
      e._slowedSpeed = e.speed;
      e.speed = e.speed * slowScale;
      slowed.push(e);
    };
    if (scene.enemyManager?.group)    scene.enemyManager.group.children.each(applyToEnemy);
    if (scene.enemyManager?.bossGroup) scene.enemyManager.bossGroup.children.each(applyToEnemy);

    // 보스 탄도 느리게
    scene.enemyBullets?.children.each(b => {
      if (!b.active || !b.body) return;
      b.body.velocity.x *= slowScale;
      b.body.velocity.y *= slowScale;
      b._slowed = true;
    });

    // 해제
    scene.time.delayedCall(duration, () => {
      slowed.forEach(e => {
        if (e._slowedSpeed !== undefined) {
          e.speed = e._slowedSpeed;
          delete e._slowedSpeed;
        }
      });
      if (border.active) border.destroy();
    });
  }

  // ── 블랙홀: 플레이어 위치 중심, 지속 흡인, 반경 320px ──
  applyBlackhole(player) {
    const scene      = this.scene;
    const x          = player.sprite.x;
    const y          = player.sprite.y;
    const pullRadius = 320;
    const visualMax  = 200;
    const duration   = this.duration * 1000;

    // 블랙홀 원 시각화 (scene.add.circle → 물리 바디 없음 → 충돌/벽 없음)
    const circle = scene.add.circle(x, y, 15, 0x110022, 0.92)
      .setDepth(1).setStrokeStyle(5, 0xaa44ff, 1.0);
    scene.tweens.add({ targets: circle, radius: visualMax, duration: 500, ease: 'Back.Out' });

    // 파티클
    const emitter = scene.add.particles(x, y, 'particle_star', {
      speed: { min: 20, max: 100 },
      scale: { start: 0.9, end: 0 },
      lifespan: 700,
      frequency: 35,
      angle: { min: 0, max: 360 }
    });

    // 범위 내 적 탄 즉시 소멸
    scene.enemyBullets?.children.each(b => {
      if (!b.active) return;
      if (Math.hypot(b.x - x, b.y - y) < visualMax) b.destroy();
    });

    // postupdate 훅: 범위 내 적 속도를 매 프레임 블랙홀 방향으로 절대값 설정
    // (enemy update 이후 실행되므로 플레이어 추적 속도를 덮어씀 → 벽 현상 없음)
    const pullCallback = () => {
      if (!scene.enemyManager) return;
      const pull = (sprite) => {
        if (!sprite.active || !sprite.body) return;
        const dx   = x - sprite.x;
        const dy   = y - sprite.y;
        const dist = Math.hypot(dx, dy);
        if (dist > pullRadius || dist < 10) return;
        const spd  = 150;
        sprite.body.velocity.x = (dx / dist) * spd;
        sprite.body.velocity.y = (dy / dist) * spd;
      };
      scene.enemyManager.group.children.each(pull);
      scene.enemyManager.bossGroup?.children.each(pull);
    };

    scene.events.on('postupdate', pullCallback);

    scene.time.delayedCall(duration, () => {
      scene.events.off('postupdate', pullCallback);
      if (emitter && emitter.active) emitter.destroy();
      if (circle && circle.active) {
        scene.tweens.add({
          targets: circle, alpha: 0, radius: 20, duration: 300,
          onComplete: () => { if (circle.active) circle.destroy(); }
        });
      }
    });
  }

  // ── 분신: 화면 내 랜덤 2위치 소환, 강화 탄환 ──
  applyClone(player) {
    const scene = this.scene;
    const cam = scene.cameras.main;
    const cloneTex  = scene.textures.exists('player_down_idle') ? 'player_down_idle' : 'player';
    const cloneSize = player.sprite.displayWidth * 0.95;
    // 분신 탄 데미지 = 플레이어 공격력 × 2 (최소 20)
    const cloneDmg  = Math.max(20, player.attackPower * 2);

    // 화면 내 랜덤 위치 2곳 (플레이어와 180px 이상 떨어진 곳)
    const positions = [];
    let attempts = 0;
    while (positions.length < 2 && attempts < 30) {
      attempts++;
      const cx = cam.scrollX + Phaser.Math.Between(80, 880);
      const cy = cam.scrollY + Phaser.Math.Between(80, 560);
      if (Phaser.Math.Distance.Between(cx, cy, player.sprite.x, player.sprite.y) >= 180) {
        if (positions.length === 0 || Phaser.Math.Distance.Between(cx, cy, positions[0].x, positions[0].y) >= 120) {
          positions.push({ x: cx, y: cy });
        }
      }
    }
    // fallback: 좌우 충분히 떨어진 고정 위치
    if (positions.length < 2) {
      positions[0] = { x: player.sprite.x - 200, y: player.sprite.y };
      positions[1] = { x: player.sprite.x + 200, y: player.sprite.y };
    }

    for (let i = 0; i < 2; i++) {
      const { x: cx, y: cy } = positions[i];

      const clone = scene.add.sprite(cx, cy, cloneTex)
        .setAlpha(0).setDepth(2).setDisplaySize(cloneSize, cloneSize);

      // 소환 연출: 파티클 + 페이드인
      const ep = scene.add.particles(cx, cy, 'particle_star', {
        speed: { min: 40, max: 130 }, scale: { start: 0.8, end: 0 },
        lifespan: 500, emitting: false
      });
      ep.explode(18);
      scene.time.delayedCall(600, () => ep.destroy());
      scene.tweens.add({ targets: clone, alpha: 0.75, duration: 250 });

      // 발사 이벤트 (200ms 간격)
      const fireTimer = scene.time.addEvent({
        delay: 200,
        repeat: Math.floor(this.duration * 5) - 1,
        callback: () => {
          if (!clone.active) return;

          // 가장 가까운 적 탐색
          let nearest = null, minDist = Infinity;
          const check = (s) => {
            if (!s.active) return;
            const d = Phaser.Math.Distance.Between(clone.x, clone.y, s.x, s.y);
            if (d < minDist) { minDist = d; nearest = s; }
          };
          scene.enemyManager?.group?.children.each(check);
          scene.enemyManager?.bossGroup?.children.each(check);
          if (!nearest) return;

          const angle = Phaser.Math.Angle.Between(clone.x, clone.y, nearest.x, nearest.y);

          // 3발 부채꼴 발사
          for (const off of [-0.12, 0, 0.12]) {
            const b = player.bullets.create(clone.x, clone.y, 'bullet');
            if (!b) continue;
            b.setActive(true).setVisible(true).isPlayerBullet = true;
            b.setDepth(10).setScale(1.2);
            b.rotation = angle + off;
            b.damage = cloneDmg;
            b.body.setVelocity(Math.cos(angle + off) * 680, Math.sin(angle + off) * 680);
          }
        }
      });

      scene.time.delayedCall(this.duration * 1000, () => {
        fireTimer.remove(false);
        scene.tweens.add({
          targets: clone, alpha: 0, duration: 200,
          onComplete: () => { if (clone.active) clone.destroy(); }
        });
      });
    }

    // 활성화 파티클
    const emitter = scene.add.particles(player.sprite.x, player.sprite.y, 'particle_star', {
      speed: { min: -80, max: 80 }, scale: { start: 0.8, end: 0 },
      lifespan: 600, emitting: false
    });
    emitter.explode(20);
    scene.time.delayedCall(800, () => emitter.destroy());
  }
}
