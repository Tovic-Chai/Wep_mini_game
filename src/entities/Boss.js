export default class Boss extends Phaser.Events.EventEmitter {
  constructor(scene, x, y, kind = 'mini1') {
    super();
    this.scene = scene;
    this.kind  = kind;

    const keyMap = {
      mini1: 'boss_mini1',
      mini2: 'boss_mini2',
      mini3: 'boss_mini3',
      final: 'boss_final_phase1'
    };
    const scaleMap = {
      mini1: 0.2, mini2: 0.3, mini3: 0.26, final: 0.4
    };

    this.sprite = scene.physics.add.sprite(x, y, keyMap[kind] || 'boss_mini1')
      .setDepth(3)
      .setScale(scaleMap[kind] || 0.3);
    this.sprite.parentRef = this;

    this.alive       = true;
    this.attackTimer = 0;

    // 보스별 스탯 및 획득 스킬
    const configs = {
      mini1: { hp: 1500, skill: { id: 'slow',     name: '시간 슬로우', duration: 5,  cooldown: 45, effect: 'timeSlow'   }},
      mini2: { hp: 2500, skill: { id: 'blackhole', name: '블랙홀',      duration: 3,  cooldown: 60, effect: 'blackhole'  }},
      mini3: { hp: 4000, skill: { id: 'clone',     name: '분신',        duration: 8,  cooldown: 75, effect: 'clone'      }},
      final: { hp: 15000, skill: null }
    };

    const cfg = configs[kind] || configs.mini1;
    this.hp    = cfg.hp;
    this.skill = cfg.skill;

    // 메인보스 전용
    if (kind === 'final') this.phase = 1;

    this.angleOffset = 0;

    // 체력바 (보스 HP 바)
    this._buildHpBar();
  }

  // ──────────────────────────────────────────
  //  체력바 생성 (화면 상단 고정)
  // ──────────────────────────────────────────
  _buildHpBar() {
    const scene  = this.scene;
    const barW   = (this.kind === 'final') ? 600 : 400;
    const barX   = 480;
    // 상단 HUD 패널(y 0~54) 아래에 배치해 타이머·HP 텍스트와 겹치지 않게 한다
    const barY   = (this.kind === 'final') ? 84 : 76;
    const label  = (this.kind === 'final') ? 'FINAL BOSS' : `MINI BOSS ${this.kind.slice(-1)}`;
    const color  = (this.kind === 'final') ? 0xff2200 : 0xff6600;

    this.hpBarBg = scene.add.rectangle(barX, barY, barW + 4, 18, 0x000000)
      .setScrollFactor(0).setDepth(45).setAlpha(0.8);
    this.hpBarFill = scene.add.rectangle(barX - barW / 2, barY, barW, 14, color)
      .setScrollFactor(0).setDepth(46).setOrigin(0, 0.5);
    this.hpBarLabel = scene.add.text(barX, barY - 18, label, {
      fontSize: '15px', fontStyle: 'bold', color: '#ffddaa', stroke: '#000', strokeThickness: 4
    }).setScrollFactor(0).setDepth(46).setOrigin(0.5);

    this._maxHp = this.hp;
    this._barW  = barW;
  }

  _destroyHpBar() {
    [this.hpBarBg, this.hpBarFill, this.hpBarLabel].forEach(o => {
      if (o && o.active) o.destroy();
    });
  }

  _updateHpBar() {
    if (!this.hpBarFill || !this.hpBarFill.active) return;
    const ratio = Math.max(0, this.hp / this._maxHp);
    this.hpBarFill.width = this._barW * ratio;
  }

  // ──────────────────────────────────────────
  //  업데이트
  // ──────────────────────────────────────────
  update(dt) {
    if (!this.alive) return;

    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.attackTimer = (this.kind === 'final') ? 0.9 : 1.2;
      this.firePattern();
    }

    // 메인보스 페이즈 전환
    if (this.kind === 'final') {
      if (this.phase === 1 && this.hp <= 10000) this.setPhase(2);
      if (this.phase === 2 && this.hp <=  5000) this.setPhase(3);
    }

    // 플레이어 추적
    const player = this.scene.player.sprite;
    const angle  = Phaser.Math.Angle.Between(
      this.sprite.x, this.sprite.y, player.x, player.y
    );

    const speedMap = {
      mini1: 45, mini2: 55, mini3: 70,
    };
    let moveSpeed = speedMap[this.kind] || 45;
    if (this.kind === 'final') {
      moveSpeed = [null, 60, 85, 110][this.phase] || 60;
    }

    this.sprite.setVelocity(
      Math.cos(angle) * moveSpeed,
      Math.sin(angle) * moveSpeed
    );

    this._updateHpBar();
  }

  // ──────────────────────────────────────────
  //  탄막 발사
  // ──────────────────────────────────────────
  firePattern() {
    const bullets = (this.kind === 'final' && this.phase === 3) ? 36 : 12;
    const speed   = (this.kind === 'final' && this.phase >= 2)  ? 180 : 120;

    // GameScene에 enemyBullets 그룹이 있어야 함
    if (!this.scene.enemyBullets) return;

    for (let i = 0; i < bullets; i++) {
      const angle = Phaser.Math.DegToRad((360 / bullets) * i + this.angleOffset);
      const bx = this.sprite.x + Math.cos(angle) * 20;
      const by = this.sprite.y + Math.sin(angle) * 20;

      const b = this.scene.enemyBullets.create(bx, by, 'boss_bullet');
      if (!b) continue;
      b.setActive(true).setVisible(true);
      b.isEnemyBullet = true;
      b.setDepth(2);
      b.setScale(1.2);
      b.rotation = angle;
      b.body.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
    }

    this.angleOffset += 10;
  }

  // ──────────────────────────────────────────
  //  데미지 처리
  // ──────────────────────────────────────────
  takeDamage(amount) {
    if (!this.alive) return;
    this.hp -= amount;
    // 피격 이펙트
    this.sprite.setTint(0xff6666);
    this.scene.time.delayedCall(80, () => {
      if (this.sprite && this.sprite.active) this.sprite.clearTint();
    });
    if (this.hp <= 0) this.defeated();
  }

  defeated() {
    if (!this.alive) return;
    this.alive = false;

    this._destroyHpBar();

    // 화면 중앙에 보스 이미지 오버레이
    const overlay = this.scene.add.image(480, 320, this.sprite.texture.key)
      .setAlpha(0).setDepth(50).setScrollFactor(0);
    this.scene.tweens.add({ targets: overlay, alpha: 0.6, duration: 200 });

    // 폭발 파티클
    const emitter = this.scene.add.particles(this.sprite.x, this.sprite.y, 'particle_star', {
      speed:    { min: -200, max: 200 },
      scale:    { start: 1.0, end: 0 },
      lifespan: 800,
      emitting: false
    });
    emitter.explode(40);

    this.scene.time.delayedCall(1400, () => {
      emitter.destroy();
      overlay.destroy();
      if (this.skill) this.emit('defeated', this.skill);
      else            this.emit('defeated');
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
    // 페이즈 전환 flash
    this.scene.cameras.main.flash(400, 255, 0, 0);
  }
}
