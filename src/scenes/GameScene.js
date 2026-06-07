import Player from '../entities/Player.js';
import EnemyManager from '../entities/EnemyManager.js';
import Boss from '../entities/Boss.js';
import UI from '../ui/UI.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  // ════════════════════════════════════════════
  //  CREATE
  // ════════════════════════════════════════════
  create() {
    const WORLD = 4000;
    this.physics.world.setBounds(-WORLD / 2, -WORLD / 2, WORLD, WORLD);

    // ── 배경 (시차 스크롤) ──
    this.bgFar = this.add.tileSprite(480, 320, 960, 640, 'bg_space_far')
      .setScrollFactor(0).setDepth(-3);
    this.bgMid = this.add.tileSprite(480, 320, 960, 640, 'bg_space_mid')
      .setScrollFactor(0).setDepth(-2);
    this.bgNear = this.add.tileSprite(480, 320, 960, 640, 'bg_space_near')
      .setScrollFactor(0).setDepth(-1);

    // ── 주요 엔티티 ──
    this.player = new Player(this, 0, 0);
    this.enemyManager = new EnemyManager(this);
    this.ui = new UI(this, this.player);

    // ESC 일시정지
    this.isGamePaused = false;
    this.pauseObjects = [];

    // 트레일러 / 타이틀 화면 씬 이름
    this.returnSceneKey = 'TitleScene';

    this.input.keyboard.on('keydown-ESC', () => {
      this.togglePause();
    });

    // ── 카메라 ──
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(-WORLD / 2, -WORLD / 2, WORLD, WORLD);

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

    // ── 적군 시작 ──
    this.enemyManager.start();

    // ── 경험치 구슬 그룹 ──
    this.expOrbs = this.physics.add.group();

    // ── 파이어볼 그룹 ──
    this.fireballs = this.physics.add.group({ maxSize: 40, runChildUpdate: false });

    // ── 보스 탄 그룹 ──
    this.enemyBullets = this.physics.add.group({ maxSize: 300, runChildUpdate: false });

    // ── 충돌 설정 ──
    this._setupCollisions();
  }

  _setupCollisions() {
    const p = this.player;

    // ① 플레이어 탄 ↔ 일반 적
    this.physics.add.overlap(
      p.bullets, this.enemyManager.group,
      (bullet, enemySprite) => {
        if (!bullet.active || !enemySprite.active) return;
        const enemy = enemySprite.parentRef;
        if (!enemy) return;
        enemy.takeDamage(p.attackPower);
        bullet.destroy();
      }
    );

    // ② 플레이어 탄 ↔ 보스
    this.physics.add.overlap(
      p.bullets, this.enemyManager.bossGroup,
      (bullet, bossSprite) => {
        if (!bullet.active || !bossSprite.active) return;
        const boss = bossSprite.parentRef;
        if (!boss) return;
        boss.takeDamage(p.attackPower);
        bullet.destroy();
      }
    );

    // ③ 파이어볼 ↔ 일반 적
    this.physics.add.overlap(
      this.fireballs, this.enemyManager.group,
      (fb, enemySprite) => {
        if (!fb.active || !enemySprite.active) return;
        const enemy = enemySprite.parentRef;
        if (!enemy) return;
        enemy.takeDamage(fb.damage || 60);
        this._fireballHitEffect(fb.x, fb.y);
        fb.destroy();
      }
    );

    // ④ 파이어볼 ↔ 보스
    this.physics.add.overlap(
      this.fireballs, this.enemyManager.bossGroup,
      (fb, bossSprite) => {
        if (!fb.active || !bossSprite.active) return;
        const boss = bossSprite.parentRef;
        if (!boss) return;
        boss.takeDamage(fb.damage || 60);
        this._fireballHitEffect(fb.x, fb.y);
        fb.destroy();
      }
    );

    // ⑤ 경험치 구슬 ↔ 플레이어
    this.physics.add.overlap(
      p.sprite, this.expOrbs,
      (playerSprite, orb) => {
        this.player.gainExp(orb.expValue || 1);
        this.tweens.add({
          targets: orb, scale: 1.8, alpha: 0,
          duration: 120,
          onComplete: () => { if (orb.active) orb.destroy(); }
        });
      }
    );

    // ⑥ 보스 탄 ↔ 플레이어
    this.physics.add.overlap(
      p.sprite, this.enemyBullets,
      (playerSprite, b) => {
        if (!b.active) return;
        this.player.takeDamage(8);
        b.destroy();
        if (this.player.hp <= 0) this._triggerGameOver();
      }
    );

    // ⑦ 적 접촉 ↔ 플레이어 (쿨다운 500ms)
    this.physics.add.overlap(
      p.sprite, this.enemyManager.group,
      (playerSprite, enemySprite) => {
        if (!enemySprite.active || !enemySprite.parentRef) return;
        const now = this.time.now;
        if (now - this.lastEnemyHitTime < 500) return;
        this.lastEnemyHitTime = now;
        this.player.takeDamage(enemySprite.parentRef.contactDmg || 10);
        if (this.player.hp <= 0) this._triggerGameOver();
      }
    );
  }

  // ════════════════════════════════════════════
  //  UPDATE
  // ════════════════════════════════════════════
  update(time, delta) {
    if (this.isGameOver) return;
    if (this.isLeveling) return;
    if (this.isGamePaused) return;

    const dt = delta / 1000;
    this.gameTime += dt;

    // 배경 시차
    const cam = this.cameras.main;
    this.bgFar.tilePositionX = cam.scrollX * 0.3;
    this.bgFar.tilePositionY = cam.scrollY * 0.3;
    this.bgMid.tilePositionX = cam.scrollX * 0.6;
    this.bgMid.tilePositionY = cam.scrollY * 0.6;
    this.bgNear.tilePositionX = cam.scrollX * 1.0;
    this.bgNear.tilePositionY = cam.scrollY * 1.0;

    // 엔티티 업데이트
    this.player.update(dt, this.cursors, this.keys);
    this.enemyManager.update(dt, this.gameTime);

    // ── 보스 스폰 타임라인 (스펙 기준) ──
    // 2:00 미니보스 1 → Q 스킬 획득
    // 4:00 미니보스 2 → E 스킬 획득
    // 6:00 미니보스 3 → C 스킬 획득
    // 8:00 메인보스
    if (this.spawnedMiniBosses < 1 && this.gameTime >= 10) this.spawnMiniBoss(1);
    if (this.spawnedMiniBosses < 2 && this.gameTime >= 240) this.spawnMiniBoss(2);
    if (this.spawnedMiniBosses < 3 && this.gameTime >= 360) this.spawnMiniBoss(3);
    if (!this.boss && this.gameTime >= 480) this.spawnMainBoss();

    // ── 10분 시간 초과 → 패배 ──
    if (!this.boss && this.gameTime >= 600) {
      this._triggerGameOver();
    }

    // ── 경험치 구슬 자석 효과 (150px 이내) ──
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    this.expOrbs.children.each(orb => {
      if (!orb.active) return;
      const d = Phaser.Math.Distance.Between(orb.x, orb.y, px, py);
      if (d < 150) {
        const angle = Phaser.Math.Angle.Between(orb.x, orb.y, px, py);
        orb.body.setVelocity(Math.cos(angle) * 300, Math.sin(angle) * 300);
      } else {
        orb.body.setVelocity(0, 0);
      }
    });

    // ── 적 탄 범위 밖 정리 ──
    this.enemyBullets.children.each(b => {
      if (!b.active) return;
      const d = Phaser.Math.Distance.Between(b.x, b.y, px, py);
      if (d > 900) b.destroy();
    });

    this.ui.update(this.gameTime);
  }

  // ════════════════════════════════════════════
  //  보스 스폰
  // ════════════════════════════════════════════
  spawnMiniBoss(index) {
    this.spawnedMiniBosses++;
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    const boss = new Boss(this, px, py - 280, 'mini' + index);
    this.enemyManager.addBoss(boss);
    boss.on('defeated', (skill) => {
      this.player.acquireSkill(skill);
      this.ui.showSkillAcquired(skill);
    });
  }

  spawnMainBoss() {
    const px = this.player.sprite.x;
    const py = this.player.sprite.y;
    this.boss = new Boss(this, px, py - 320, 'final');
    this.enemyManager.addBoss(this.boss);
    this.boss.on('defeated', () => {
      this._triggerClear();
    });
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

    const btn = this.add.rectangle(W / 2, H / 2 + 80, 220, 48, 0x0055aa)
      .setStrokeStyle(2, 0x00ccff).setScrollFactor(0).setDepth(35).setInteractive({ useHandCursor: true });

    const btnTxt = this.add.text(W / 2, H / 2 + 80, '다시 시작', {
      fontSize: '22px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#003366', strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(36);

    btn.on('pointerover', () => btn.setFillStyle(0x0077dd));
    btn.on('pointerout', () => btn.setFillStyle(0x0055aa));
    btn.on('pointerdown', () => {
      // 패시브 무기 시각 오브젝트 정리
      if (this.player && this.player.passiveWeapons) {
        this.player.passiveWeapons.forEach(w => w.destroy && w.destroy());
      }
      this.scene.restart();
    });

    this.input.keyboard.once('keydown-SPACE', () => {
      if (this.player && this.player.passiveWeapons) {
        this.player.passiveWeapons.forEach(w => w.destroy && w.destroy());
      }
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
      tint: 0xff6600,
      lifespan: 350,
      emitting: false
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

    const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.72)
      .setDepth(100).setScrollFactor(0);

    const titleText = this.add.text(W / 2, 60, '강화 선택', {
      fontSize: '28px', fontStyle: 'bold', color: '#aaddff',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(130);

    const cardObjects = [titleText];

    const safeDestroy = (obj) => {
      if (!obj || !obj.destroy) return;
      try { obj.destroy(); } catch (e) { }
    };

    const pool = this._buildCardPool();
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
      let rarity = this.rollRarity(rarities);

      // 패시브 무기 카드 등급 고정
      // 획득/Lv2 = 레어, Lv3/Lv4 = 에픽, Lv5 = 레전드
      if (
        cardDef.includes('fireball') ||
        cardDef.includes('lightning') ||
        cardDef.includes('orbit') ||
        cardDef.includes('poison') ||
        cardDef.includes('ice') ||
        cardDef.includes('laser') ||
        cardDef.includes('blade') ||
        cardDef.includes('drone')
      ) {
        let targetLevel = 1;

        const weaponType = cardDef.split('_')[0];
        const weapon = this.player.getPassiveWeapon(weaponType);

        if (weapon) targetLevel = weapon.level + 1;

        if (targetLevel <= 2) {
          rarity = { name: '레어', color: 0x3399ff };
        } else if (targetLevel <= 4) {
          rarity = { name: '에픽', color: 0xaa44ff };
        } else {
          rarity = { name: '레전드', color: 0xffaa00 };
        }
      }

      // 다중발사는 항상 레어
      if (cardDef === 'multishot') {
        rarity = { name: '레어', color: 0x3399ff };
      }

      const cardXs = [180, 480, 780];
      const x = cardXs[i];

      const { label, applyFn, iconColor } = this._resolveCard(cardDef, rarity);

      const bgColorMap = {
        노말: 0x202033,
        레어: 0x182f4f,
        에픽: 0x2b1d4a,
        레전드: 0x4a3600
      };

      const bgColor = bgColorMap[rarity.name] || 0x1a1a2e;

      // 오버레이(depth 100)보다 높고 카드보다 낮은 글로우 레이어
      const glowColor =
        rarity.name === '노말' ? 0x7f8ca8 : rarity.color;

      const glowAlphaMult =
        rarity.name === '노말' ? 0.45 : 1;

      const glowRadius = {
        노말: 180,
        레어: 220,
        에픽: 260,
        레전드: 320
      }[rarity.name];

      const glow = this.add.graphics()
        .setDepth(102)
        .setScrollFactor(0)
        .setAlpha(0);

      for (let r = glowRadius; r > 0; r -= 2) {

        const alpha =
          Math.pow(r / glowRadius, 2) *
          0.004 *
          glowAlphaMult;

        glow.fillStyle(glowColor, alpha);
        glow.fillCircle(x, 330, r);
      }

      glow.setBlendMode(Phaser.BlendModes.ADD);

      const glows = [glow];

      // ─────────────────────────────
      // 카드 뒤 부드러운 후광
      // ─────────────────────────────
      const haloColor =
        rarity.name === '노말' ? 0xb8c4d6 : rarity.color;

      const haloKeyMap = {
        노말: 'soft_halo_normal',
        레어: 'soft_halo_rare',
        에픽: 'soft_halo_epic',
        레전드: 'soft_halo_legend'
      };

      const halo = this.add.image(x, 330, haloKeyMap[rarity.name])
        .setDepth(103)
        .setScrollFactor(0)
        .setAlpha(0)
        .setScale(rarity.name === '노말' ? 0.85 : 0.95);

      const haloLine = this.add.rectangle(x, 330, 214, 304)
        .setStrokeStyle(
          rarity.name === '노말' ? 2 : 3,
          haloColor,
          rarity.name === '노말' ? 0.22 : 0.45
        )
        .setDepth(104)
        .setScrollFactor(0)
        .setAlpha(0);

      cardObjects.push(halo, haloLine);

      cardObjects.push(halo, haloLine);

      const shadow = this.add.rectangle(
        x + 4,
        334,
        160,
        240,
        0x000000,
        0.18
      )
        .setDepth(102)
        .setScrollFactor(0)
        .setAlpha(0);

      const card = this.add.rectangle(x, 330, 200, 290, bgColor)
        .setStrokeStyle(rarity.name === '레전드' ? 5 : 3, rarity.color, rarity.name === '레전드' ? 1 : 0.55)
        .setDepth(108).setScrollFactor(0).setInteractive({ useHandCursor: true })
        .setAlpha(0).setScale(0.7);

      const iconCircle = this.add.circle(x, 255, rarity.name === '레전드' ? 34 : 28, iconColor, 0.9)
        .setDepth(112).setScrollFactor(0).setAlpha(0);

      const rarityText = this.add.text(x, 295, rarity.name, {
        fontSize: '12px',
        color: '#' + rarity.color.toString(16).padStart(6, '0'),
        stroke: '#000',
        strokeThickness: 2,
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(113).setScrollFactor(0).setAlpha(0);

      const statText = this.add.text(x, 350, label, {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
        wordWrap: { width: 180 },
        padding: { left: 8, right: 8, top: 4, bottom: 4 },
      }).setOrigin(0.5).setResolution(2).setDepth(114).setScrollFactor(0).setAlpha(0);

      const allParts = [...glows, halo, haloLine, shadow, card, iconCircle, rarityText, statText];

      // ─────────────────────────────
      // 카드 등장 등급 연출
      // ─────────────────────────────

      if (rarity.name === '레어') {
        const flash = this.add.rectangle(x, 330, 380, 520, 0x3399ff, 0.5)
          .setDepth(101)
          .setScrollFactor(0);

        cardObjects.push(flash);

        this.tweens.add({
          targets: flash,
          alpha: 0,
          scaleX: 0,
          duration: 1500,
          ease: 'Cubic.Out',
          onComplete: () => safeDestroy(flash)
        });

        this.tweens.add({
          targets: glows,
          alpha: { from: 0.2, to: 0.45 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut'
        });
      }

      if (rarity.name === '에픽') {
        // 에픽 보라 기둥
        const epicBeam = this.add.rectangle(x, 330, 180, 600, 0xaa44ff, 0.38)
          .setDepth(106)
          .setScrollFactor(0);

        cardObjects.push(epicBeam);

        this.tweens.add({
          targets: epicBeam,
          scaleX: 2.2,
          alpha: 0,
          duration: 1600,
          ease: 'Expo.Out',
          onComplete: () => safeDestroy(epicBeam)
        });

        // 보라 화면 플래시 - 레전드보다 약하게
        const epicFlash = this.add.rectangle(480, 320, 960, 640, 0xaa44ff, 0.12)
          .setDepth(101)
          .setScrollFactor(0);

        cardObjects.push(epicFlash);

        this.tweens.add({
          targets: epicFlash,
          alpha: 0,
          duration: 900,
          ease: 'Cubic.Out',
          onComplete: () => safeDestroy(epicFlash)
        });

        // 카드 뒤 보라 후광
        const aura = this.add.circle(x, 330, 220, 0xaa44ff, 0.2)
          .setDepth(105)
          .setScrollFactor(0);

        cardObjects.push(aura);

        this.tweens.add({
          targets: aura,
          alpha: { from: 0.1, to: 0.28 },
          scale: { from: 0.9, to: 1.3 },
          duration: 1300,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut'
        });

        // 카드 위 보라 폭발 입자
        const epicBurst = this.add.particles(x, 330, 'particle_star', {
          speed: { min: 120, max: 280 },
          scale: { start: 1.4, end: 0 },
          tint: 0xaa44ff,
          lifespan: 1100,
          quantity: 55,
          emitting: false,
          blendMode: 'ADD'
        }).setDepth(125).setScrollFactor(0);

        epicBurst.explode(55);
        cardObjects.push(epicBurst);
        this.time.delayedCall(1200, () => safeDestroy(epicBurst));

        // 카드 위에서 계속 떠오르는 보라 입자
        const epicParticles = this.add.particles(x, 330, 'particle_star', {
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Rectangle(-85, -120, 170, 240)
          },

          speedY: { min: -35, max: -12 },
          speedX: { min: -15, max: 15 },

          scale: {
            start: 0.22,
            end: 0
          },

          tint: 0xcc88ff,

          lifespan: 1200,

          frequency: 80,

          quantity: 1,

          blendMode: 'ADD'
        })
          .setDepth(126)
          .setScrollFactor(0);

        cardObjects.push(epicParticles);

        // 회전 룬
        const rune = this.add.circle(x, 330, 120)
          .setStrokeStyle(4, 0xcc88ff, 0.8)
          .setDepth(104)
          .setScrollFactor(0);

        cardObjects.push(rune);

        this.tweens.add({
          targets: rune,
          angle: 360,
          duration: 6000,
          repeat: -1
        });

        this.tweens.add({
          targets: rune,
          alpha: { from: 0.35, to: 0.9 },
          duration: 1200,
          yoyo: true,
          repeat: -1
        });
      }

      if (rarity.name === '레전드') {
        // 화면 플래시
        const screenFlash = this.add.rectangle(480, 320, 960, 640, 0xffdd44, 0.32)
          .setDepth(101)
          .setScrollFactor(0);

        cardObjects.push(screenFlash);

        this.tweens.add({
          targets: screenFlash,
          alpha: 0,
          duration: 1300,
          ease: 'Expo.Out',
          onComplete: () => safeDestroy(screenFlash)
        });

        // 카드 뒤 황금 후광
        const halo1 = this.add.circle(x, 330, 220, 0xffdd44, 0.2)
          .setDepth(102)
          .setScrollFactor(0);

        const halo2 = this.add.circle(x, 330, 150, 0xffee88, 0.24)
          .setDepth(103)
          .setScrollFactor(0);

        cardObjects.push(halo1, halo2);

        this.tweens.add({
          targets: [halo1, halo2],
          alpha: { from: 0.1, to: 0.28 },
          scale: { from: 0.9, to: 1.35 },
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut'
        });

        // 회전 황금 링
        const ring = this.add.circle(x, 330, 128)
          .setStrokeStyle(6, 0xffdd44, 0.9)
          .setDepth(104)
          .setScrollFactor(0);

        cardObjects.push(ring);

        this.tweens.add({
          targets: ring,
          angle: 360,
          duration: 5000,
          repeat: -1
        });

        // 황금 빛기둥
        const beam = this.add.rectangle(x, 330, 220, 720, 0xffdd44, 0.35)
          .setDepth(101)
          .setScrollFactor(0);

        cardObjects.push(beam);

        this.tweens.add({
          targets: beam,
          scaleX: 2.6,
          alpha: 0,
          duration: 2000,
          ease: 'Expo.Out',
          onComplete: () => safeDestroy(beam)
        });

        // 황금 폭발
        const legendaryBurst = this.add.particles(x, 330, 'particle_star', {
          speed: { min: 120, max: 300 },
          scale: { start: 0.9, end: 0 },
          tint: 0xfff2aa,
          lifespan: 1400,
          quantity: 80,
          emitting: false,
          blendMode: 'ADD'
        })
          .setDepth(140)
          .setScrollFactor(0);

        legendaryBurst.explode(90);
        cardObjects.push(legendaryBurst);
        this.time.delayedCall(1600, () => safeDestroy(legendaryBurst));

        // 카드 아래에서 올라오는 지속 황금 입자
        const goldParticles = this.add.particles(x, 330, 'particle_star', {
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Rectangle(-90, -130, 180, 260)
          },

          speedY: { min: -40, max: -15 },
          speedX: { min: -20, max: 20 },

          scale: {
            start: 0.35,
            end: 0
          },

          tint: 0xfff2aa,

          lifespan: 1400,

          frequency: 55,

          quantity: 1,

          blendMode: 'ADD'
        })
          .setDepth(130)
          .setScrollFactor(0);

        cardObjects.push(goldParticles);
      }

      // 카드 3장 동시 등장
      this.tweens.add({
        targets: allParts,
        alpha: 1,
        duration: 300
      });

      this.tweens.add({
        targets: [...glows, card],
        scaleX: 1,
        scaleY: 1,
        duration: rarity.name === '레전드' ? 700 : 500,
        ease: rarity.name === '레전드' ? 'Elastic.Out' : 'Back.Out'
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

        safeDestroy(overlay);
        cardObjects.forEach(safeDestroy);

        this.physics.resume();
        this.isLeveling = false;
      });

      cardObjects.push(...allParts);
    });
  }


  // ── 카드 풀 빌더 ──
  _buildCardPool() {
    const pool = [];
    const p = this.player;

    // 기본 능력치 항상 포함
    pool.push('attack', 'hp', 'movespeed', 'attackspeed');

    // 다중 발사 (최대 3발)
    if (p.bulletCount < 3) pool.push('multishot');

    // 패시브 무기
    for (const wType of ['fireball', 'lightning', 'orbit', 'poison', 'ice', 'laser', 'blade', 'drone']) {
      const w = p.getPassiveWeapon(wType);
      if (!w) {
        pool.push(`${wType}_unlock`);
      } else if (w.level < 5) {
        pool.push(`${wType}_upgrade`);
      }
    }

    return pool;
  }

  /** 풀에서 n장 뽑기 (중복 없이) */
  _pickCards(pool, n) {
    const shuffled = Phaser.Utils.Array.Shuffle([...pool]);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  /** 카드 정의 → 레이블, 적용 함수, 아이콘 색상 */
  _resolveCard(cardDef, rarity) {
    const p = this.player;

    const rarityMult = { 노말: 1, 레어: 1.3, 에픽: 1.7, 레전드: 2.2 }[rarity.name] || 1;

    switch (cardDef) {
      case 'attack': {
        const vals = { 노말: [5, 10], 레어: [8, 12], 에픽: [12, 15], 레전드: [17, 17] };
        const [lo, hi] = vals[rarity.name] || [5, 10];
        const v = Phaser.Math.Between(lo, hi);
        return {
          label: `⚔️ 공격력\n+${v}`,
          iconColor: 0xff4444,
          applyFn: () => { p.attackPower += v; }
        };
      }
      case 'hp': {
        const vals = { 노말: [10, 15], 레어: [15, 20], 에픽: [20, 25], 레전드: [30, 30] };
        const [lo, hi] = vals[rarity.name] || [10, 15];
        const v = Phaser.Math.Between(lo, hi);
        return {
          label: `❤️ 체력\n+${v}`,
          iconColor: 0xff6688,
          applyFn: () => { p.maxHp += v; p.hp = Math.min(p.hp + v, p.maxHp); }
        };
      }
      case 'movespeed': {
        const v = Math.floor(20 * rarityMult);
        return {
          label: `👟 이동속도\n+${v}`,
          iconColor: 0x44ffaa,
          applyFn: () => { p.speed += v; }
        };
      }
      case 'attackspeed': {
        const vals = { 노말: [0.02, 0.05], 레어: [0.04, 0.07], 에픽: [0.07, 0.10], 레전드: [0.12, 0.12] };
        const [lo, hi] = vals[rarity.name] || [0.02, 0.05];
        const v = Phaser.Math.FloatBetween(lo, hi);
        return {
          label: `⚡ 공속\n${(v * 100).toFixed(0)}%↑`,
          iconColor: 0xffdd00,
          applyFn: () => {
            p.attackRate *= (1 - v);
            if (p.attackRate < 0.05) p.attackRate = 0.05;
          }
        };
      }
      case 'multishot': {
        return {
          label: `🔫 다중발사\n(${p.bulletCount}→${p.bulletCount + 1}발)`,
          iconColor: 0x66ccff,
          applyFn: () => { p.bulletCount = Math.min(p.bulletCount + 1, 3); }
        };
      }
      case 'fireball_unlock': {
        return {
          label: `🔥 파이어볼\n획득!`,
          iconColor: 0xff6600,
          applyFn: () => { p.addOrUpgradePassiveWeapon('fireball'); }
        };
      }
      case 'fireball_upgrade': {
        const w = p.getPassiveWeapon('fireball');
        const lv = w ? w.level : 1;
        return {
          label: `🔥 파이어볼\nLv${lv}→${lv + 1}`,
          iconColor: 0xff8800,
          applyFn: () => { p.addOrUpgradePassiveWeapon('fireball'); }
        };
      }
      case 'lightning_unlock': {
        return {
          label: `⚡ 번개\n획득!`,
          iconColor: 0xaaddff,
          applyFn: () => { p.addOrUpgradePassiveWeapon('lightning'); }
        };
      }
      case 'lightning_upgrade': {
        const w = p.getPassiveWeapon('lightning');
        const lv = w ? w.level : 1;
        return {
          label: `⚡ 번개\nLv${lv}→${lv + 1}`,
          iconColor: 0x88ccff,
          applyFn: () => { p.addOrUpgradePassiveWeapon('lightning'); }
        };
      }
      case 'orbit_unlock': {
        return {
          label: `🌀 회전 오브\n획득!`,
          iconColor: 0x00aaff,
          applyFn: () => { p.addOrUpgradePassiveWeapon('orbit'); }
        };
      }
      case 'orbit_upgrade': {
        const w = p.getPassiveWeapon('orbit');
        const lv = w ? w.level : 1;
        return {
          label: `🌀 회전 오브\nLv${lv}→${lv + 1}`,
          iconColor: 0x4488ff,
          applyFn: () => { p.addOrUpgradePassiveWeapon('orbit'); }
        };
      }
      case 'poison_unlock': {
        return {
          label: `☠️ 독 장판\n획득!`,
          iconColor: 0x22cc66,
          applyFn: () => { p.addOrUpgradePassiveWeapon('poison'); }
        };
      }

      case 'poison_upgrade': {
        const w = p.getPassiveWeapon('poison');
        const lv = w ? w.level : 1;

        return {
          label: `☠️ 독 장판\nLv${lv}→${lv + 1}`,
          iconColor: 0x66ff99,
          applyFn: () => { p.addOrUpgradePassiveWeapon('poison'); }
        };
      }
      case 'ice_unlock': {
        return {
          label: `❄️ 얼음 파편\n획득!`,
          iconColor: 0x99ddff,
          applyFn: () => { p.addOrUpgradePassiveWeapon('ice'); }
        };
      }

      case 'ice_upgrade': {
        const w = p.getPassiveWeapon('ice');
        const lv = w ? w.level : 1;

        return {
          label: `❄️ 얼음 파편\nLv${lv}→${lv + 1}`,
          iconColor: 0x66ccff,
          applyFn: () => { p.addOrUpgradePassiveWeapon('ice'); }
        };
      }
      case 'laser_unlock': {
        return {
          label: `🔷 레이저\n획득!`,
          iconColor: 0x33ccff,
          applyFn: () => { p.addOrUpgradePassiveWeapon('laser'); }
        };
      }

      case 'laser_upgrade': {
        const w = p.getPassiveWeapon('laser');
        const lv = w ? w.level : 1;

        return {
          label: `🔷 레이저\nLv${lv}→${lv + 1}`,
          iconColor: 0x66ddff,
          applyFn: () => { p.addOrUpgradePassiveWeapon('laser'); }
        };
      }
      case 'blade_unlock': {
        return {
          label: `🗡️ 검기\n획득!`,
          iconColor: 0x99eeff,
          applyFn: () => { p.addOrUpgradePassiveWeapon('blade'); }
        };
      }

      case 'blade_upgrade': {
        const w = p.getPassiveWeapon('blade');
        const lv = w ? w.level : 1;

        return {
          label: `🗡️ 검기\nLv${lv}→${lv + 1}`,
          iconColor: 0xccf6ff,
          applyFn: () => { p.addOrUpgradePassiveWeapon('blade'); }
        };
      }
      case 'drone_unlock': {
        return {
          label: `🤖 드론\n획득!`,
          iconColor: 0xffdd66,
          applyFn: () => { p.addOrUpgradePassiveWeapon('drone'); }
        };
      }

      case 'drone_upgrade': {
        const w = p.getPassiveWeapon('drone');
        const lv = w ? w.level : 1;

        return {
          label: `🤖 드론\nLv${lv}→${lv + 1}`,
          iconColor: 0xffee88,
          applyFn: () => { p.addOrUpgradePassiveWeapon('drone'); }
        };
      }
      default:
        return {
          label: '강화',
          iconColor: 0xffffff,
          applyFn: () => { }
        };
    }
  }

  rollRarity(rarities) {
    const roll = Math.random() * 100;
    let current = 0;
    for (const r of rarities) {
      current += r.chance;
      if (roll <= current) return r;
    }
    return rarities[0];
  }

  togglePause() {
    if (this.isGameOver) return;
    if (this.isLeveling) return;

    if (this.isGamePaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  pauseGame() {
    if (this.isGamePaused) return;

    this.isGamePaused = true;

    // 물리 멈춤
    this.physics.world.pause();

    // 현재 움직임 멈춤
    if (this.player && this.player.sprite && this.player.sprite.body) {
      this.player.sprite.body.setVelocity(0, 0);
    }

    // 애니메이션 / 트윈 멈춤
    if (this.anims) this.anims.pauseAll();
    if (this.tweens) this.tweens.pauseAll();

    // 타이머 멈춤
    if (this.time) this.time.paused = true;

    this.showPauseOverlay();
  }

  resumeGame() {
    if (!this.isGamePaused) return;

    this.isGamePaused = false;

    this.hidePauseOverlay();

    // 타이머 재개
    if (this.time) this.time.paused = false;

    // 트윈 / 애니메이션 재개
    if (this.tweens) this.tweens.resumeAll();
    if (this.anims) this.anims.resumeAll();

    // 물리 재개
    this.physics.world.resume();
  }

  showPauseOverlay() {
    this.hidePauseOverlay();

    const cam = this.cameras.main;
    const W = cam.width;
    const H = cam.height;
    const cx = W / 2;
    const cy = H / 2;

    const bg = this.add.rectangle(cx, cy, W, H, 0x000000, 0.72)
      .setDepth(1000)
      .setScrollFactor(0);

    const glowPanel = this.add.rectangle(cx, cy, 560, 540, 0x0ea5e9, 0.16)
      .setDepth(1001)
      .setScrollFactor(0);
    glowPanel.setStrokeStyle(4, 0x38bdf8, 0.45);

    const panel = this.add.rectangle(cx, cy, 520, 500, 0x0f172a, 0.97)
      .setDepth(1002)
      .setScrollFactor(0);
    panel.setStrokeStyle(3, 0x7dd3fc, 0.95);

    const topLine = this.add.rectangle(cx, cy - 232, 380, 3, 0x38bdf8, 0.9)
      .setDepth(1003)
      .setScrollFactor(0);

    const bottomLine = this.add.rectangle(cx, cy + 232, 380, 3, 0x38bdf8, 0.45)
      .setDepth(1003)
      .setScrollFactor(0);

    const leftDot = this.add.circle(cx - 220, cy - 232, 7, 0x93c5fd, 0.95)
      .setDepth(1004)
      .setScrollFactor(0);

    const rightDot = this.add.circle(cx + 220, cy - 232, 7, 0x93c5fd, 0.95)
      .setDepth(1004)
      .setScrollFactor(0);

    const title = this.add.text(cx, cy - 185, 'PAUSED', {
      fontSize: '42px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#38bdf8',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(1005).setScrollFactor(0);

    const subTitle = this.add.text(cx, cy - 145, '일시정지', {
      fontSize: '22px',
      color: '#bae6fd',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1005).setScrollFactor(0);

    const desc = this.add.text(cx, cy - 115, 'ESC를 다시 누르면 게임을 이어합니다', {
      fontSize: '16px',
      color: '#cbd5e1'
    }).setOrigin(0.5).setDepth(1005).setScrollFactor(0);

    const infoBox = this.add.rectangle(cx, cy - 95, 360, 36, 0x020617, 0.75)
      .setDepth(1004)
      .setScrollFactor(0);
    infoBox.setStrokeStyle(1, 0x334155, 0.9);

    const infoText = this.add.text(cx, cy - 95, '이동: WASD / 스킬: Q E C / 일시정지: ESC', {
      fontSize: '14px',
      color: '#94a3b8'
    }).setOrigin(0.5).setDepth(1005).setScrollFactor(0);

    const skillBox = this.add.rectangle(cx, cy + 40, 420, 220, 0x020617, 0.82)
      .setDepth(1004)
      .setScrollFactor(0);
    skillBox.setStrokeStyle(2, 0x334155, 0.95);

    const activeTitle = this.add.text(cx - 120, cy - 55, '액티브 스킬', {
      fontSize: '18px',
      color: '#7dd3fc',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1005).setScrollFactor(0);

    const passiveTitle = this.add.text(cx + 120, cy - 55, '패시브 레벨', {
      fontSize: '18px',
      color: '#7dd3fc',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1005).setScrollFactor(0);

    const divider = this.add.rectangle(cx, cy + 20, 2, 150, 0x334155, 1)
      .setDepth(1005)
      .setScrollFactor(0);

    const activeText = this.add.text(cx - 185, cy - 25, this.getPauseActiveSkillText(), {
      fontSize: '16px',
      color: '#e2e8f0',
      lineSpacing: 8
    }).setOrigin(0, 0).setDepth(1005).setScrollFactor(0);

    const passiveText = this.add.text(cx + 20, cy - 25, this.getPausePassiveSkillText(), {
      fontSize: '16px',
      color: '#e2e8f0',
      lineSpacing: 6
    }).setOrigin(0, 0).setDepth(1005).setScrollFactor(0);

    const resumeBtn = this.createPauseButton(
      cx,
      cy + 175,
      '이어하기',
      0x2563eb,
      0x1d4ed8,
      () => {
        this.resumeGame();
      }
    );

    const trailerBtn = this.createPauseButton(
      cx,
      cy + 228,
      '다시하기',
      0x7c2d12,
      0x9a3412,
      () => {
        this.goToTrailerScene();
      }
    );

    this.tweens.add({
      targets: [glowPanel, leftDot, rightDot],
      alpha: 0.35,
      duration: 650,
      yoyo: true,
      repeat: -1
    });

    this.pauseObjects.push(
      bg,
      glowPanel,
      panel,
      topLine,
      bottomLine,
      leftDot,
      rightDot,
      title,
      subTitle,
      desc,
      infoBox,
      infoText,
      skillBox,
      activeTitle,
      passiveTitle,
      divider,
      activeText,
      passiveText,
      ...resumeBtn,
      ...trailerBtn
    );
  }

  createPauseButton(x, y, label, baseColor, hoverColor, callback) {
    const shadow = this.add.rectangle(x + 4, y + 5, 250, 46, 0x000000, 0.35)
      .setDepth(1005)
      .setScrollFactor(0);

    const box = this.add.rectangle(x, y, 250, 46, baseColor, 1)
      .setDepth(1006)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });

    box.setStrokeStyle(2, 0xffffff, 0.55);

    const shine = this.add.rectangle(x, y - 13, 220, 5, 0xffffff, 0.18)
      .setDepth(1007)
      .setScrollFactor(0);

    const text = this.add.text(x, y, label, {
      fontSize: '19px',
      color: '#ffffff',
      fontStyle: 'bold'
    })
      .setOrigin(0.5)
      .setDepth(1008)
      .setScrollFactor(0);

    const hoverOn = () => {
      box.setFillStyle(hoverColor, 1);
      box.setScale(1.04);
      shadow.setScale(1.04);
      shine.setScale(1.04, 1);
    };

    const hoverOff = () => {
      box.setFillStyle(baseColor, 1);
      box.setScale(1);
      shadow.setScale(1);
      shine.setScale(1);
    };

    box.on('pointerover', hoverOn);
    text.setInteractive({ useHandCursor: true });
    text.on('pointerover', hoverOn);

    box.on('pointerout', hoverOff);
    text.on('pointerout', hoverOff);

    box.on('pointerdown', callback);
    text.on('pointerdown', callback);

    return [shadow, box, shine, text];
  }

  goToTrailerScene() {
    // 멈춘 것들 먼저 다시 풀어주기
    this.isGamePaused = false;

    if (this.time) this.time.paused = false;
    if (this.tweens) this.tweens.resumeAll();
    if (this.anims) this.anims.resumeAll();
    if (this.physics && this.physics.world) this.physics.world.resume();

    this.hidePauseOverlay();

    // 트레일러 / 타이틀 화면으로 이동
    this.scene.start(this.returnSceneKey || 'TitleScene');
  }

  getPauseActiveSkillText() {
    const slots = ['Q', 'E', 'C'];

    return slots.map(slot => {
      const skill = this.player?.skills?.[slot];
      if (!skill) return `${slot} : 없음`;
      return `${slot} : ${skill.name}  Lv.${skill.level || 1}`;
    }).join('\n');
  }

  getPausePassiveSkillText() {
    const names = {
      fireball: '파이어볼',
      lightning: '번개',
      orbit: '회전 오브',
      poison: '독 장판',
      ice: '얼음 파편',
      laser: '레이저',
      blade: '검기',
      drone: '드론'
    };

    const order = ['fireball', 'lightning', 'orbit', 'poison', 'ice', 'laser', 'blade', 'drone'];

    const lines = [];

    order.forEach(type => {
      const weapon = this.player?.getPassiveWeapon(type);
      if (!weapon) return;
      lines.push(`${names[type]}  Lv.${weapon.level}`);
    });

    return lines.length > 0 ? lines.join('\n') : '획득한 패시브 없음';
  }

  hidePauseOverlay() {
    if (!this.pauseObjects) {
      this.pauseObjects = [];
      return;
    }

    this.pauseObjects.forEach(obj => {
      if (obj && obj.destroy) {
        obj.destroy();
      }
    });

    this.pauseObjects = [];
  }
}
