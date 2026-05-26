import Player       from '../entities/Player.js';
import EnemyManager from '../entities/EnemyManager.js';
import Boss         from '../entities/Boss.js';
import UI           from '../ui/UI.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  // ════════════════════════════════════════════
  //  CREATE
  // ════════════════════════════════════════════
  create() {
    const WORLD = 4000;
    this.physics.world.setBounds(-WORLD / 2, -WORLD / 2, WORLD, WORLD);

    // ── 배경 (시차 스크롤) ──
    this.bgFar  = this.add.tileSprite(480, 320, 960, 640, 'bg_space_far')
      .setScrollFactor(0).setDepth(-3);
    this.bgMid  = this.add.tileSprite(480, 320, 960, 640, 'bg_space_mid')
      .setScrollFactor(0).setDepth(-2);
    this.bgNear = this.add.tileSprite(480, 320, 960, 640, 'bg_space_near')
      .setScrollFactor(0).setDepth(-1);

    // ── 주요 엔티티 ──
    this.player       = new Player(this, 0, 0);
    this.enemyManager = new EnemyManager(this);
    this.ui           = new UI(this, this.player);

    // ── 카메라 ──
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(-WORLD / 2, -WORLD / 2, WORLD, WORLD);

    // ── 타이밍 / 상태 ──
    this.gameTime          = 0;
    this.spawnedMiniBosses = 0;
    this.boss              = null;
    this.isLeveling        = false;
    this.isGameOver        = false;
    this.lastEnemyHitTime  = -1;

    // ── 입력 ──
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys    = this.input.keyboard.addKeys('W,A,S,D,SHIFT,SPACE');

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

    const dt = delta / 1000;
    this.gameTime += dt;

    // 배경 시차
    const cam = this.cameras.main;
    this.bgFar.tilePositionX  = cam.scrollX * 0.3;
    this.bgFar.tilePositionY  = cam.scrollY * 0.3;
    this.bgMid.tilePositionX  = cam.scrollX * 0.6;
    this.bgMid.tilePositionY  = cam.scrollY * 0.6;
    this.bgNear.tilePositionX = cam.scrollX * 1.0;
    this.bgNear.tilePositionY = cam.scrollY * 1.0;

    // 엔티티 업데이트
    this.player.update(dt, this.cursors, this.keys);
    this.enemyManager.update(dt, this.gameTime);

    // ── 보스 스폰 타임라인 (스펙 기준) ──
    // 2:00 미니보스 1 → Q 스킬 획득
    // 4:00 미니보스 2 → E 스킬 획득
    // 6:00 미니보스 3 → R 스킬 획득
    // 8:00 메인보스
    if (this.spawnedMiniBosses < 1 && this.gameTime >= 120) this.spawnMiniBoss(1);
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
    btn.on('pointerout',  () => btn.setFillStyle(0x0055aa));
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

    // 타이틀 (cardObjects에 추가해 선택 후 삭제)
    const titleText = this.add.text(W / 2, 60, '강화 선택', {
      fontSize: '28px', fontStyle: 'bold', color: '#aaddff',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    const cardObjects = [titleText];

    // ── 카드 풀 생성 ──
    const pool   = this._buildCardPool();
    const picked = this._pickCards(pool, 3);

    const rarities = [
      { name: '노말',   chance: 55,   color: 0xffffff },
      { name: '레어',   chance: 27.5, color: 0x3399ff },
      { name: '에픽',   chance: 12.5, color: 0xaa44ff },
      { name: '레전드', chance: 5,    color: 0xffaa00 }
    ];

    picked.forEach((cardDef, i) => {
      const rarity = this.rollRarity(rarities);
      const x      = 240 + i * 240;

      const { label, applyFn, iconColor } = this._resolveCard(cardDef, rarity);

      // 배경색
      const bgColorMap = { 노말: 0x1a1a2e, 레어: 0x1a2a44, 에픽: 0x2a1a44, 레전드: 0x443300 };
      const bgColor = bgColorMap[rarity.name] || 0x1a1a2e;

      // ── Glow 레이어 ──
      const glows = [
        { w: 420, h: 510, a: 0.015 }, { w: 360, h: 450, a: 0.025 },
        { w: 320, h: 410, a: 0.04  }, { w: 280, h: 370, a: 0.06  },
        { w: 245, h: 335, a: 0.09  }, { w: 220, h: 310, a: 0.13  }
      ].map(({ w, h, a }) =>
        this.add.rectangle(x, 330, w, h, rarity.color, a)
          .setDepth(96).setScrollFactor(0).setAlpha(0).setScale(0.7)
      );

      const shadow = this.add.rectangle(x + 10, 340, 200, 290, 0x000000, 0.35)
        .setDepth(102).setScrollFactor(0).setAlpha(0);

      const card = this.add.rectangle(x, 330, 200, 290, bgColor)
        .setStrokeStyle(3, rarity.color, 0.45)
        .setDepth(103).setScrollFactor(0).setInteractive({ useHandCursor: true })
        .setAlpha(0).setScale(0.7);

      // ── 아이콘 (색상 원) ──
      const iconCircle = this.add.circle(x, 255, 28, iconColor, 0.9)
        .setDepth(105).setScrollFactor(0).setAlpha(0);

      // ── 등급 텍스트 ──
      const rarityText = this.add.text(x, 295, rarity.name, {
        fontSize: '12px', color: '#' + rarity.color.toString(16).padStart(6, '0'),
        stroke: '#000', strokeThickness: 2, fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(105).setScrollFactor(0).setAlpha(0);

      // ── 메인 레이블 ──
      const statText = this.add.text(x, 350, label, {
        fontFamily: 'sans-serif',
        fontSize: '22px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 5,
        align: 'center', wordWrap: { width: 180 },
        padding: { left: 8, right: 8, top: 4, bottom: 4 },
      }).setOrigin(0.5).setResolution(2).setDepth(105).setScrollFactor(0).setAlpha(0);

      // ── 등장 애니메이션 ──
      const allParts = [...glows, card, shadow, iconCircle, rarityText, statText];
      this.tweens.add({
        targets: allParts, alpha: 1,
        duration: 250, delay: i * 120
      });
      this.tweens.add({
        targets: [...glows, card],
        scaleX: 1, scaleY: 1,
        duration: 320, ease: 'Back.Out'
      });

      // Hover
      card.on('pointerover', () => {
        card.setScale(1.05);
        glows.forEach((g, idx) => g.setScale(1.06 + idx * 0.02));
      });
      card.on('pointerout', () => {
        card.setScale(1);
        glows.forEach(g => g.setScale(1));
      });

      // 선택
      card.on('pointerdown', () => {
        applyFn();
        overlay.destroy();
        cardObjects.forEach(obj => { if (obj && obj.active) obj.destroy(); });
        this.physics.resume();
        this.isLeveling = false;
      });

      cardObjects.push(...allParts, shadow);
    });
  }

  // ── 카드 풀 빌더 ──
  _buildCardPool() {
    const pool = [];
    const p    = this.player;

    // 기본 능력치 항상 포함
    pool.push('attack', 'hp', 'movespeed', 'attackspeed');

    // 다중 발사 (최대 3발)
    if (p.bulletCount < 3) pool.push('multishot');

    // 패시브 무기
    for (const wType of ['fireball', 'lightning', 'orbit']) {
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
        const vals = { 노말: [5,10], 레어: [8,12], 에픽: [12,15], 레전드: [17,17] };
        const [lo, hi] = vals[rarity.name] || [5, 10];
        const v = Phaser.Math.Between(lo, hi);
        return {
          label: `⚔️ 공격력\n+${v}`,
          iconColor: 0xff4444,
          applyFn: () => { p.attackPower += v; }
        };
      }
      case 'hp': {
        const vals = { 노말: [10,15], 레어: [15,20], 에픽: [20,25], 레전드: [30,30] };
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
        const vals = { 노말: [0.02,0.05], 레어: [0.04,0.07], 에픽: [0.07,0.10], 레전드: [0.12,0.12] };
        const [lo, hi] = vals[rarity.name] || [0.02, 0.05];
        const v = Phaser.Math.FloatBetween(lo, hi);
        return {
          label: `⚡ 공속\n${(v*100).toFixed(0)}%↑`,
          iconColor: 0xffdd00,
          applyFn: () => {
            p.attackRate *= (1 - v);
            if (p.attackRate < 0.05) p.attackRate = 0.05;
          }
        };
      }
      case 'multishot': {
        return {
          label: `🔫 다중발사\n(${p.bulletCount}→${p.bulletCount+1}발)`,
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
          label: `🔥 파이어볼\nLv${lv}→${lv+1}`,
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
          label: `⚡ 번개\nLv${lv}→${lv+1}`,
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
          label: `🌀 회전 오브\nLv${lv}→${lv+1}`,
          iconColor: 0x4488ff,
          applyFn: () => { p.addOrUpgradePassiveWeapon('orbit'); }
        };
      }
      default:
        return {
          label: '강화',
          iconColor: 0xffffff,
          applyFn: () => {}
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
}
