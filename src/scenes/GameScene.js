import Player from '../entities/Player.js';
import EnemyManager from '../entities/EnemyManager.js';
import Boss from '../entities/Boss.js';
import UI from '../ui/UI.js';

export default class GameScene extends Phaser.Scene {
  constructor() { super({ key: 'GameScene' }); }

  create() {
    // ★ 뱀서라이크: 거대 월드 + 플레이어 추적 카메라
    const WORLD = 4000;
    this.physics.world.setBounds(-WORLD / 2, -WORLD / 2, WORLD, WORLD);

    // 배경: 화면에 고정된 tileSprite (카메라 스크롤 기반으로 별이 흘러가는 효과)
    this.bgFar = this.add.tileSprite(480, 320, 960, 640, 'bg_space_far')
      .setScrollFactor(0).setDepth(-3);
    this.bgMid = this.add.tileSprite(480, 320, 960, 640, 'bg_space_mid')
      .setScrollFactor(0).setDepth(-2);
    this.bgNear = this.add.tileSprite(480, 320, 960, 640, 'bg_space_near')
      .setScrollFactor(0).setDepth(-1);

    // 플레이어를 월드 중앙에 배치
    this.player = new Player(this, 0, 0);
    this.enemyManager = new EnemyManager(this);
    this.ui = new UI(this, this.player);

    // ★ 카메라가 플레이어를 부드럽게 따라감
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setBounds(-WORLD / 2, -WORLD / 2, WORLD, WORLD);

    this.gameTime = 0;
    this.spawnedMiniBosses = 0;
    this.boss = null;

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('W,A,S,D,SHIFT,R,SPACE');

    this.enemyManager.start();

    this.expOrbs = this.physics.add.group();

    this.physics.add.overlap(
      this.player.sprite,
      this.expOrbs,
      (player, orb) => {
        this.player.gainExp(orb.expValue || 1);

        // 경험치 먹는 효과
        this.tweens.add({
          targets: orb,
          scale: 1.8,
          alpha: 0,
          duration: 120,
          onComplete: () => orb.destroy()
        });
      }
    );

    // 플레이어 총알 ↔ 일반 적
    this.physics.add.overlap(
      this.player.bullets,
      this.enemyManager.group,
      (bullet, enemySprite) => {
        if (!bullet.active || !enemySprite.active) return;

        const enemy = enemySprite.parentRef;
        if (!enemy) return;

        enemy.takeDamage(this.player.attackPower);

        // 총알 제거
        bullet.destroy();
      }
    );

    // 플레이어 총알 ↔ 보스
    this.physics.add.overlap(
      this.player.bullets,
      this.enemyManager.bossGroup,
      (bullet, bossSprite) => {
        if (!bullet.active || !bossSprite.active) return;

        const boss = bossSprite.parentRef;
        if (!boss) return;

        boss.takeDamage(this.player.attackPower);

        bullet.destroy();
      }
    );

    this.isLeveling = false;
  }

  update(time, delta) {
    if (this.isLeveling) return;
    const dt = delta / 1000;
    this.gameTime += dt;

    // ★ 배경이 카메라 이동에 따라 자연스럽게 흘러가는 시차 효과
    // 멀리 있는 별은 천천히, 가까운 별은 빠르게 흘러서 입체감 부여
    const cam = this.cameras.main;
    this.bgFar.tilePositionX = cam.scrollX * 0.3;
    this.bgFar.tilePositionY = cam.scrollY * 0.3;
    this.bgMid.tilePositionX = cam.scrollX * 0.6;
    this.bgMid.tilePositionY = cam.scrollY * 0.6;
    this.bgNear.tilePositionX = cam.scrollX * 1.0;
    this.bgNear.tilePositionY = cam.scrollY * 1.0;

    this.player.update(dt, this.cursors, this.keys);
    this.enemyManager.update(dt, this.gameTime);

    if (this.spawnedMiniBosses < 1 && this.gameTime >= 10) this.spawnMiniBoss(1);
    if (this.spawnedMiniBosses < 2 && this.gameTime >= 270) this.spawnMiniBoss(2);
    if (this.spawnedMiniBosses < 3 && this.gameTime >= 420) this.spawnMiniBoss(3);

    if (!this.boss && this.gameTime >= 540) this.spawnMainBoss();

    this.ui.update(this.gameTime);
  }

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
    this.boss.on('defeated', () => this.ui.showResult(true, this.gameTime, this.player));
  }

  showLevelUpCards() {

    this.isLeveling = true;

    // 게임 정지
    this.physics.pause();

    const W = 960;
    const H = 640;

    // 어두운 배경
    const overlay = this.add.rectangle(
      W / 2,
      H / 2,
      W,
      H,
      0x000000,
      0.72
    )
      .setDepth(100)
      .setScrollFactor(0);

    // 희귀도
    const rarities = [
      {
        name: '노말',
        chance: 55,
        color: 0xffffff
      },
      {
        name: '레어',
        chance: 27.5,
        color: 0x3399ff
      },
      {
        name: '에픽',
        chance: 12.5,
        color: 0xaa44ff
      },
      {
        name: '레전드',
        chance: 5,
        color: 0xffaa00
      }
    ];

    const cardTypes = ['attack', 'hp', 'speed'];

    const cardObjects = [];

    for (let i = 0; i < 3; i++) {

      const rarity = this.rollRarity(rarities);

      const type = Phaser.Utils.Array.GetRandom(cardTypes);

      let value = 0;
      let label = '';

      // 공격력
      if (type === 'attack') {

        if (rarity.name === '노말')
          value = Phaser.Math.Between(5, 10);

        if (rarity.name === '레어')
          value = Phaser.Math.Between(8, 12);

        if (rarity.name === '에픽')
          value = Phaser.Math.Between(12, 15);

        if (rarity.name === '레전드')
          value = 17;

        label = `공격력 +${value}`;
      }

      // 체력
      if (type === 'hp') {

        if (rarity.name === '노말')
          value = Phaser.Math.Between(10, 15);

        if (rarity.name === '레어')
          value = Phaser.Math.Between(15, 20);

        if (rarity.name === '에픽')
          value = Phaser.Math.Between(20, 25);

        if (rarity.name === '레전드')
          value = 30;

        label = `체력 +${value}`;
      }

      // 공격속도
      if (type === 'speed') {

        if (rarity.name === '노말')
          value = Phaser.Math.FloatBetween(0.02, 0.05);

        if (rarity.name === '레어')
          value = Phaser.Math.FloatBetween(0.04, 0.07);

        if (rarity.name === '에픽')
          value = Phaser.Math.FloatBetween(0.07, 0.10);

        if (rarity.name === '레전드')
          value = 0.12;

        label = `공속 ${(value * 100).toFixed(0)}%`;
      }

      // 카드 위치
      const x = 240 + i * 240;

      // 희귀도별 배경색
      let bgColor = 0x1a1a2e;

      if (rarity.name === '레어')
        bgColor = 0x1a2a44;

      if (rarity.name === '에픽')
        bgColor = 0x2a1a44;

      if (rarity.name === '레전드')
        bgColor = 0x443300;

      // =========================
      // Glow Layers
      // =========================

      // 가장 바깥 glow
      const glowOuter4 = this.add.rectangle(
        x,
        320,
        420,
        510,
        rarity.color,
        0.015
      )
        .setDepth(96)
        .setScrollFactor(0)
        .setAlpha(0)
        .setScale(0.7);

      // glow 3
      const glowOuter3 = this.add.rectangle(
        x,
        320,
        360,
        450,
        rarity.color,
        0.025
      )
        .setDepth(97)
        .setScrollFactor(0)
        .setAlpha(0)
        .setScale(0.7);

      // glow 2
      const glowOuter2 = this.add.rectangle(
        x,
        320,
        320,
        410,
        rarity.color,
        0.04
      )
        .setDepth(98)
        .setScrollFactor(0)
        .setAlpha(0)
        .setScale(0.7);

      // glow 1
      const glowOuter1 = this.add.rectangle(
        x,
        320,
        280,
        370,
        rarity.color,
        0.06
      )
        .setDepth(99)
        .setScrollFactor(0)
        .setAlpha(0)
        .setScale(0.7);

      // 중간 glow
      const glowMiddle = this.add.rectangle(
        x,
        320,
        245,
        335,
        rarity.color,
        0.09
      )
        .setDepth(100)
        .setScrollFactor(0)
        .setAlpha(0)
        .setScale(0.7);

      // 안쪽 glow
      const glowInner = this.add.rectangle(
        x,
        320,
        220,
        310,
        rarity.color,
        0.13
      )
        .setDepth(101)
        .setScrollFactor(0)
        .setAlpha(0)
        .setScale(0.7);

      // 그림자
      const shadow = this.add.rectangle(
        x + 10,
        330,
        200,
        290,
        0x000000,
        0.35
      )
        .setDepth(102)
        .setScrollFactor(0)
        .setAlpha(0);

      // 메인 카드
      const card = this.add.rectangle(
        x,
        320,
        200,
        290,
        bgColor
      )
        .setStrokeStyle(3, rarity.color, 0.45)
        .setDepth(103)
        .setScrollFactor(0)
        .setInteractive()
        .setAlpha(0)
        .setScale(0.7);

      // 텍스트
      const statText = this.add.text(
        x,
        340,
        label,
        {
          fontFamily: 'Pretendard',
          fontSize: '34px',
          color: '#ffffff',
          fontStyle: 'bold',

          stroke: '#000000',
          strokeThickness: 6,

          align: 'center',

          padding: {
            left: 8,
            right: 8,
            top: 4,
            bottom: 4
          },

          shadow: {
            offsetX: 0,
            offsetY: 3,
            color: '#000000',
            blur: 8,
            fill: true
          }
        }
      )
        .setOrigin(0.5)
        .setResolution(2)
        .setDepth(105)
        .setScrollFactor(0)
        .setAlpha(0);

      // 등장 애니메이션
      this.tweens.add({
        targets: [
          glowOuter4,
          glowOuter3,
          glowOuter2,
          glowOuter1,
          glowMiddle,
          glowInner,
          card,
          shadow,
          statText
        ],
        alpha: 1,
        duration: 250,
        delay: i * 120
      });

      // 카드 등장
      this.tweens.add({
        targets: [
          glowOuter4,
          glowOuter3,
          glowOuter2,
          glowOuter1,
          glowMiddle,
          glowInner,
          card
        ],
        scaleX: 1,
        scaleY: 1,
        duration: 320,
        ease: 'Back.Out'
      });

      // Hover 효과
      card.on('pointerover', () => {

        card.setScale(1.05);

        glowOuter4.setScale(1.16);
        glowOuter3.setScale(1.14);
        glowOuter2.setScale(1.12);
        glowOuter1.setScale(1.10);
        glowMiddle.setScale(1.08);
        glowInner.setScale(1.06);

      });

      // Hover 해제
      card.on('pointerout', () => {

        card.setScale(1);

        glowOuter4.setScale(1);
        glowOuter3.setScale(1);
        glowOuter2.setScale(1);
        glowOuter1.setScale(1);
        glowMiddle.setScale(1);
        glowInner.setScale(1);

      });

      // 카드 선택
      card.on('pointerdown', () => {

        // 공격력
        if (type === 'attack') {
          this.player.attackPower += value;
        }

        // 체력
        if (type === 'hp') {
          this.player.maxHp += value;
          this.player.hp += value;
        }

        // 공격속도
        if (type === 'speed') {

          this.player.attackRate *= (1 - value);

          if (this.player.attackRate < 0.05) {
            this.player.attackRate = 0.05;
          }
        }

        // 제거
        overlay.destroy();

        cardObjects.forEach(obj => {

          if (obj && obj.active) {
            obj.destroy();
          }

        });

        // 게임 재개
        this.physics.resume();

        this.isLeveling = false;

      });

      // 저장
      cardObjects.push(glowOuter4);
      cardObjects.push(glowOuter3);
      cardObjects.push(glowOuter2);
      cardObjects.push(glowOuter1);
      cardObjects.push(glowMiddle);
      cardObjects.push(glowInner);
      cardObjects.push(shadow);
      cardObjects.push(card);
      cardObjects.push(statText);

    }
  }

  //등급 확률 함수 추가
  rollRarity(rarities) {

    const roll = Math.random() * 100;

    let current = 0;

    for (const r of rarities) {

      current += r.chance;

      if (roll <= current) {
        return r;
      }
    }

    return rarities[0];
  }
}

