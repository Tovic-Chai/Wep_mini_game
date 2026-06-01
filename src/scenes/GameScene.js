import Player from '../entities/Player.js';
import EnemyManager from '../entities/EnemyManager.js';
import Boss from '../entities/Boss.js';
import UI from '../ui/UI.js';

// 월드 크기 (루프 경계)
const WORLD      = 6000;
const WORLD_HALF = WORLD / 2;

export default class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  // ════════════════════════════════════════════
  //  CREATE
  // ════════════════════════════════════════════
  create() {
    // Physics 범위: 실제 월드보다 크게 (적 이동에 여유)
    this.physics.world.setBounds(-WORLD, -WORLD, WORLD * 2, WORLD * 2);

    // ── 배경 (시차 스크롤 타일) ──
    this.bgFar  = this.add.tileSprite(480, 320, 960, 640, 'bg_space_far')
      .setScrollFactor(0).setDepth(-3);
    this.bgMid = this.add.tileSprite(480, 320, 960, 640, 'bg_space_mid')
      .setScrollFactor(0).setDepth(-2);
    this.bgNear = this.add.tileSprite(480, 320, 960, 640, 'bg_space_near')
      .setScrollFactor(0).setDepth(-1);

    // ── 주요 엔티티 ──
    this.player = new Player(this, 0, 0);
    this.enemyManager = new EnemyManager(this);
    this.ui = new UI(this, this.player);

    // ── 카메라: 경계 없이 플레이어 추적 (무한 맵용) ──
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    // setBounds 제거 → 카메라가 어느 방향으로든 자유롭게 스크롤

    // ── 타이밍 / 상태 ──
    this.gameTime = 0;
    this.spawnedMiniBosses = 0;
    this.boss = null;
    this.isLeveling = false;
    this.isGameOver = false;
    this.lastEnemyHitTime = -1;

    // ── 입력 ──
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SHIFT,SPACE');

    this.enemyManager.start();

    // ── 그룹 ──
    this.expOrbs      = this.physics.add.group();
    this.fireballs    = this.physics.add.group({ maxSize: 40,  runChildUpdate: false });
    this.enemyBullets = this.physics.add.group({ maxSize: 300, runChildUpdate: false });

    this._setupCollisions();
  }

  _setupCollisions() {
    const p = this.player;

    // 플레이어 탄 ↔ 일반 적
    this.physics.add.overlap(p.bullets, this.enemyManager.group,
      (bullet, enemySprite) => {
        if (!bullet.active || !enemySprite.active) return;
        enemySprite.parentRef?.takeDamage(p.attackPower);
        bullet.destroy();
      });

    // 플레이어 탄 ↔ 보스
    this.physics.add.overlap(p.bullets, this.enemyManager.bossGroup,
      (bullet, bossSprite) => {
        if (!bullet.active || !bossSprite.active) return;
        bossSprite.parentRef?.takeDamage(p.attackPower);
        bullet.destroy();
      });

    // 파이어볼 ↔ 일반 적
    this.physics.add.overlap(this.fireballs, this.enemyManager.group,
      (fb, enemySprite) => {
        if (!fb.active || !enemySprite.active) return;
        enemySprite.parentRef?.takeDamage(fb.damage || 60);
        this._fireballHitEffect(fb.x, fb.y);
        fb.destroy();
      });

    // 파이어볼 ↔ 보스
    this.physics.add.overlap(this.fireballs, this.enemyManager.bossGroup,
      (fb, bossSprite) => {
        if (!fb.active || !bossSprite.active) return;
        bossSprite.parentRef?.takeDamage(fb.damage || 60);
        this._fireballHitEffect(fb.x, fb.y);
        fb.destroy();
      });

    // 경험치 구슬 ↔ 플레이어
    this.physics.add.overlap(p.sprite, this.expOrbs,
      (_, orb) => {
        p.gainExp(orb.expValue || 1);
        this.tweens.add({
          targets: orb, scale: 1.8, alpha: 0, duration: 120,
          onComplete: () => { if (orb.active) orb.destroy(); }
        });
      });

    // 보스 탄 ↔ 플레이어
    this.physics.add.overlap(p.sprite, this.enemyBullets,
      (_, b) => {
        if (!b.active) return;
        p.takeDamage(8);
        b.destroy();
        if (p.hp <= 0) this._triggerGameOver();
      });

    // 적 접촉 ↔ 플레이어 (쿨다운 500ms)
    this.physics.add.overlap(p.sprite, this.enemyManager.group,
      (_, enemySprite) => {
        if (!enemySprite.active || !enemySprite.parentRef) return;
        const now = this.time.now;
        if (now - this.lastEnemyHitTime < 500) return;
        this.lastEnemyHitTime = now;
        p.takeDamage(enemySprite.parentRef.contactDmg || 10);
        if (p.hp <= 0) this._triggerGameOver();
      });
  }

  // ════════════════════════════════════════════
  //  UPDATE
  // ════════════════════════════════════════════
  update(time, delta) {
    if (this.isGameOver || this.isLeveling) return;

    const dt = delta / 1000;
    this.gameTime += dt;

    // ── 배경 시차 ──
    const cam = this.cameras.main;
    this.bgFar.tilePositionX  = cam.scrollX * 0.3;
    this.bgFar.tilePositionY  = cam.scrollY * 0.3;
    this.bgMid.tilePositionX  = cam.scrollX * 0.6;
    this.bgMid.tilePositionY  = cam.scrollY * 0.6;
    this.bgNear.tilePositionX = cam.scrollX;
    this.bgNear.tilePositionY = cam.scrollY;

    // ── 엔티티 업데이트 ──
    this.player.update(dt, this.cursors, this.keys);
    this.enemyManager.update(dt, this.gameTime);

    // ── 맵 루프 (벽 통과 → 반대편 등장) ──
    this._wrapPlayer();

    // ── 보스 스폰 (2:00 / 4:00 / 6:00 / 8:00) ──
    if (this.spawnedMiniBosses < 1 && this.gameTime >= 120) this.spawnMiniBoss(1);
    if (this.spawnedMiniBosses < 2 && this.gameTime >= 240) this.spawnMiniBoss(2);
    if (this.spawnedMiniBosses < 3 && this.gameTime >= 360) this.spawnMiniBoss(3);
    if (!this.boss && this.gameTime >= 480)                 this.spawnMainBoss();
    if (!this.boss && this.gameTime >= 600)                 this._triggerGameOver();

    const px = this.player.sprite.x;
    const py = this.player.sprite.y;

    // ── 경험치 구슬: 자석 + 원거리 정리 ──
    this.expOrbs.children.each(orb => {
      if (!orb.active) return;
      const d = Phaser.Math.Distance.Between(orb.x, orb.y, px, py);
      if      (d < 150) {
        const a = Phaser.Math.Angle.Between(orb.x, orb.y, px, py);
        orb.body.setVelocity(Math.cos(a) * 300, Math.sin(a) * 300);
      } else if (d > 900) {
        orb.destroy(); // 너무 멀어진 구슬 제거
      } else {
        orb.body.setVelocity(0, 0);
      }
    });

    // ── 적 탄 원거리 정리 ──
    this.enemyBullets.children.each(b => {
      if (b.active && Phaser.Math.Distance.Between(b.x, b.y, px, py) > 950) b.destroy();
    });

    this.ui.update(this.gameTime);
  }

  // ════════════════════════════════════════════
  //  맵 루프 (토로이달 랩)
  // ════════════════════════════════════════════
  _wrapPlayer() {
    const s = this.player.sprite;
    let wx = s.x, wy = s.y, wrapped = false;

    if (s.x >  WORLD_HALF) { wx = s.x - WORLD; wrapped = true; }
    if (s.x < -WORLD_HALF) { wx = s.x + WORLD; wrapped = true; }
    if (s.y >  WORLD_HALF) { wy = s.y - WORLD; wrapped = true; }
    if (s.y < -WORLD_HALF) { wy = s.y + WORLD; wrapped = true; }

    if (wrapped) {
      s.setPosition(wx, wy);
      // 카메라도 즉시 스냅 → 랩 순간 화면 끊김 없음
      const cam = this.cameras.main;
      cam.scrollX = wx - cam.width  / 2;
      cam.scrollY = wy - cam.height / 2;
    }
  }

  // ════════════════════════════════════════════
  //  보스 스폰
  // ════════════════════════════════════════════
  spawnMiniBoss(index) {
    this.spawnedMiniBosses++;
    const { x, y } = this.player.sprite;
    const boss = new Boss(this, x, y - 280, 'mini' + index);
    this.enemyManager.addBoss(boss);
    boss.on('defeated', (skill) => {
      this.player.acquireSkill(skill);
      this.ui.showSkillAcquired(skill);
    });
  }

  spawnMainBoss() {
    const { x, y } = this.player.sprite;
    this.boss = new Boss(this, x, y - 320, 'final');
    this.enemyManager.addBoss(this.boss);
    this.boss.on('defeated', () => this._triggerClear());
  }

  // ════════════════════════════════════════════
  //  게임 종료
  // ════════════════════════════════════════════
  _triggerClear() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.physics.pause();
    this.ui.showResult(true, this.gameTime, this.player);
    this._showRestartButton();
  }

  _triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.player.hp = 0;
    this.physics.pause();
    this.ui.showResult(false, this.gameTime, this.player);
    this._showRestartButton();
  }

  _showRestartButton() {
    const W = 960, H = 640;
    const btn = this.add.rectangle(W / 2, H / 2 + 90, 220, 50, 0x0055aa)
      .setStrokeStyle(2, 0x00ccff).setScrollFactor(0).setDepth(102)
      .setInteractive({ useHandCursor: true });
    const btnTxt = this.add.text(W / 2, H / 2 + 90, '다시 시작', {
      fontSize: '24px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#003366', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(103);

    btn.on('pointerover', () => btn.setFillStyle(0x0077dd));
    btn.on('pointerout', () => btn.setFillStyle(0x0055aa));
    btn.on('pointerdown', () => {
      this.player.passiveWeapons?.forEach(w => w.destroy?.());
      this.scene.restart();
    });
    this.input.keyboard.once('keydown-SPACE', () => {
      this.player.passiveWeapons?.forEach(w => w.destroy?.());
      this.scene.restart();
    });
  }

  // ════════════════════════════════════════════
  //  파이어볼 히트 이펙트
  // ════════════════════════════════════════════
  _fireballHitEffect(x, y) {
    const emitter = this.add.particles(x, y, 'particle_star', {
      speed: { min: 60, max: 160 },
      scale: { start: 1.0, end: 0 },
      tint: 0xff6600, lifespan: 350, emitting: false
    });
    emitter.explode(12);
    this.time.delayedCall(500, () => emitter.destroy());
  }

  // ════════════════════════════════════════════
  //  레벨업 카드 선택
  // ════════════════════════════════════════════
  showLevelUpCards() {
    this.isLeveling = true;
    this.physics.pause();

    const W = 960, H = 640;

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75)
      .setDepth(100).setScrollFactor(0);

    const titleText = this.add.text(W / 2, 70, '강화 선택', {
      fontSize: '32px', fontStyle: 'bold', color: '#aaddff',
      stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    const cardObjects = [titleText];

    const pool   = this._buildCardPool();
    const picked = this._pickCards(pool, 3);

    const rarities = [
      { name: '노말', chance: 55, color: 0xffffff },
      { name: '레어', chance: 27.5, color: 0x3399ff },
      { name: '에픽', chance: 12.5, color: 0xaa44ff },
      { name: '레전드', chance: 5, color: 0xffaa00 }
    ];

    // ── 부드러운 후광 텍스처 생성 ──
    const makeSoftHaloTexture = (key, color, w = 520, h = 620) => {
      if (this.textures.exists(key)) return;

      const canvas = this.textures.createCanvas(key, w, h);
      const ctx = canvas.getContext();

      const cx = w / 2;
      const cy = h / 2;

      const gradient = ctx.createRadialGradient(
        cx, cy,
        40,
        cx, cy,
        Math.max(w, h) * 0.42
      );

      const hex = '#' + color.toString(16).padStart(6, '0');

      gradient.addColorStop(0.00, hex + '55');
      gradient.addColorStop(0.35, hex + '30');
      gradient.addColorStop(0.65, hex + '14');
      gradient.addColorStop(1.00, hex + '00');

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      canvas.refresh();
    };

    makeSoftHaloTexture('soft_halo_normal', 0xb8c4d6);
    makeSoftHaloTexture('soft_halo_rare', 0x3399ff);
    makeSoftHaloTexture('soft_halo_epic', 0xaa44ff);
    makeSoftHaloTexture('soft_halo_legend', 0xffdd44);

    picked.forEach((cardDef, i) => {
      const rarity    = this.rollRarity(rarities);
      const x         = 240 + i * 240;
      const { label, applyFn, iconColor } = this._resolveCard(cardDef, rarity);

      const bgColorMap = { 노말: 0x1a1a2e, 레어: 0x1a2a44, 에픽: 0x2a1a44, 레전드: 0x443300 };
      const bgColor = bgColorMap[rarity.name] || 0x1a1a2e;

      const glows = [
        { w: 420, h: 510, a: 0.015 }, { w: 360, h: 450, a: 0.025 },
        { w: 320, h: 410, a: 0.04  }, { w: 280, h: 370, a: 0.06  },
        { w: 245, h: 335, a: 0.09  }, { w: 220, h: 310, a: 0.13  }
      ].map(({ w, h, a }) =>
        this.add.rectangle(x, 340, w, h, rarity.color, a)
          .setDepth(96).setScrollFactor(0).setAlpha(0).setScale(0.7)
      );

      const shadow = this.add.rectangle(x + 10, 350, 200, 290, 0x000000, 0.35)
        .setDepth(102).setScrollFactor(0).setAlpha(0);
      const card = this.add.rectangle(x, 340, 200, 290, bgColor)
        .setStrokeStyle(3, rarity.color, 0.45)
        .setDepth(103).setScrollFactor(0).setInteractive({ useHandCursor: true })
        .setAlpha(0).setScale(0.7);
      const iconCircle = this.add.circle(x, 260, 30, iconColor, 0.9)
        .setDepth(105).setScrollFactor(0).setAlpha(0);
      const rarityText = this.add.text(x, 302, rarity.name, {
        fontSize: '14px', color: '#' + rarity.color.toString(16).padStart(6, '0'),
        stroke: '#000', strokeThickness: 3, fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(105).setScrollFactor(0).setAlpha(0);
      const statText = this.add.text(x, 362, label, {
        fontFamily: 'sans-serif', fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 5,
        align: 'center', wordWrap: { width: 180 },
      }).setOrigin(0.5).setResolution(2).setDepth(105).setScrollFactor(0).setAlpha(0);

      const allParts = [...glows, card, shadow, iconCircle, rarityText, statText];
      this.tweens.add({ targets: allParts, alpha: 1, duration: 250, delay: i * 120 });
      this.tweens.add({
        targets: [...glows, card], scaleX: 1, scaleY: 1,
        duration: 320, ease: 'Back.Out'
      });

      card.on('pointerover', () => {
        this.tweens.add({
          targets: card,
          scaleX: 1.035,
          scaleY: 1.035,
          duration: 220,
          ease: 'Sine.Out'
        });

        this.tweens.add({
          targets: glows,
          scaleX: 1.04,
          scaleY: 1.04,
          alpha: rarity.name === '노말' ? 0.16 : 0.35,
          duration: 220,
          ease: 'Sine.Out'
        });

        this.tweens.add({
          targets: [halo, haloLine],
          scaleX: 1.04,
          scaleY: 1.04,
          alpha: rarity.name === '노말' ? 0.7 : 0.9,
          duration: 260,
          ease: 'Sine.Out'
        });
      });

      card.on('pointerout', () => {
        this.tweens.add({
          targets: card,
          scaleX: 1,
          scaleY: 1,
          duration: 240,
          ease: 'Sine.InOut'
        });

        this.tweens.add({
          targets: glows,
          scaleX: 1,
          scaleY: 1,
          alpha: rarity.name === '노말' ? 0.08 : 0.18,
          duration: 240,
          ease: 'Sine.InOut'
        });

        this.tweens.add({
          targets: [halo, haloLine],
          scaleX: 1,
          scaleY: 1,
          alpha: 1,
          duration: 260,
          ease: 'Sine.InOut'
        });
      });
      card.on('pointerdown', () => {
        // 선택 순간 폭발
        const selectTint =
          rarity.name === '레전드' ? 0xfff2aa :
            rarity.name === '에픽' ? 0xaa44ff :
              rarity.name === '레어' ? 0x3399ff :
                0xffffff;

        const selectBurst = this.add.particles(x, 330, 'particle_star', {
          speed: { min: 90, max: rarity.name === '레전드' ? 320 : 240 },
          scale: {
            start: rarity.name === '레전드' ? 0.7 :
              rarity.name === '에픽' ? 0.45 : 0.35,
            end: 0
          },
          tint: selectTint,
          lifespan: rarity.name === '레전드' ? 900 : 700,
          quantity: rarity.name === '레전드' ? 70 : rarity.name === '에픽' ? 45 : 25,
          emitting: false,
          blendMode: 'ADD'
        })
          .setDepth(150)
          .setScrollFactor(0);

        selectBurst.explode(
          rarity.name === '레전드' ? 70 :
            rarity.name === '에픽' ? 45 :
              25
        );


        this.time.delayedCall(900, () => safeDestroy(selectBurst));

        applyFn();
        overlay.destroy();
        cardObjects.forEach(obj => { if (obj?.active) obj.destroy(); });
        this.physics.resume();
        this.isLeveling = false;
      });

      cardObjects.push(...allParts);
    });
  }

  _buildCardPool() {
    const pool = [];
    const p    = this.player;
    pool.push('attack', 'hp', 'movespeed', 'attackspeed');
    if (p.bulletCount < 3) pool.push('multishot');
    for (const wType of ['fireball', 'lightning', 'orbit']) {
      const w = p.getPassiveWeapon(wType);
      if (!w)            pool.push(`${wType}_unlock`);
      else if (w.level < 5) pool.push(`${wType}_upgrade`);
    }
    return pool;
  }

  _pickCards(pool, n) {
    return Phaser.Utils.Array.Shuffle([...pool]).slice(0, Math.min(n, pool.length));
  }

  _resolveCard(cardDef, rarity) {
    const p = this.player;
    switch (cardDef) {
      case 'attack': {
        const vals = { 노말:[5,10], 레어:[8,12], 에픽:[12,15], 레전드:[17,17] };
        const [lo, hi] = vals[rarity.name] || [5,10];
        const v = Phaser.Math.Between(lo, hi);
        return { label:`⚔️ 공격력\n+${v}`, iconColor:0xff4444,
                 applyFn: () => { p.attackPower += v; }};
      }
      case 'hp': {
        const vals = { 노말:[10,15], 레어:[15,20], 에픽:[20,25], 레전드:[30,30] };
        const [lo, hi] = vals[rarity.name] || [10,15];
        const v = Phaser.Math.Between(lo, hi);
        return { label:`❤️ 체력\n+${v}`, iconColor:0xff6688,
                 applyFn: () => { p.maxHp += v; p.hp = Math.min(p.hp + v, p.maxHp); }};
      }
      case 'movespeed': {
        const mult = { 노말:1, 레어:1.3, 에픽:1.7, 레전드:2.2 }[rarity.name] || 1;
        const v = Math.floor(20 * mult);
        return { label:`👟 이동속도\n+${v}`, iconColor:0x44ffaa,
                 applyFn: () => { p.speed += v; }};
      }
      case 'attackspeed': {
        const vals = { 노말:[0.02,0.05], 레어:[0.04,0.07], 에픽:[0.07,0.10], 레전드:[0.12,0.12] };
        const [lo, hi] = vals[rarity.name] || [0.02,0.05];
        const v = Phaser.Math.FloatBetween(lo, hi);
        return { label:`⚡ 공속\n${(v*100).toFixed(0)}%↑`, iconColor:0xffdd00,
                 applyFn: () => { p.attackRate = Math.max(0.05, p.attackRate * (1-v)); }};
      }
      case 'multishot': {
        return { label:`🔫 다중발사\n(${p.bulletCount}→${p.bulletCount+1}발)`, iconColor:0x66ccff,
                 applyFn: () => { p.bulletCount = Math.min(p.bulletCount+1, 3); }};
      }
      case 'fireball_unlock':
        return { label:`🔥 파이어볼\n획득!`, iconColor:0xff6600,
                 applyFn: () => p.addOrUpgradePassiveWeapon('fireball') };
      case 'fireball_upgrade': {
        const lv = p.getPassiveWeapon('fireball')?.level || 1;
        return { label:`🔥 파이어볼\nLv${lv}→${lv+1}`, iconColor:0xff8800,
                 applyFn: () => p.addOrUpgradePassiveWeapon('fireball') };
      }
      case 'lightning_unlock':
        return { label:`⚡ 번개\n획득!`, iconColor:0xaaddff,
                 applyFn: () => p.addOrUpgradePassiveWeapon('lightning') };
      case 'lightning_upgrade': {
        const lv = p.getPassiveWeapon('lightning')?.level || 1;
        return { label:`⚡ 번개\nLv${lv}→${lv+1}`, iconColor:0x88ccff,
                 applyFn: () => p.addOrUpgradePassiveWeapon('lightning') };
      }
      case 'orbit_unlock':
        return { label:`🌀 회전 오브\n획득!`, iconColor:0x00aaff,
                 applyFn: () => p.addOrUpgradePassiveWeapon('orbit') };
      case 'orbit_upgrade': {
        const lv = p.getPassiveWeapon('orbit')?.level || 1;
        return { label:`🌀 회전 오브\nLv${lv}→${lv+1}`, iconColor:0x4488ff,
                 applyFn: () => p.addOrUpgradePassiveWeapon('orbit') };
      }
      default:
        return { label:'강화', iconColor:0xffffff, applyFn: () => {} };
    }
  }

  rollRarity(rarities) {
    const roll = Math.random() * 100;
    let cur = 0;
    for (const r of rarities) {
      cur += r.chance;
      if (roll <= cur) return r;
    }
    return rarities[0];
  }
}
