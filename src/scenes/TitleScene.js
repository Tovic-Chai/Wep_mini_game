export default class TitleScene extends Phaser.Scene {
  constructor() { super({ key: 'TitleScene' }); }

  create() {
    const W = 960, H = 640;

    // ── 배경 (별 필드, BootScene에서 생성된 텍스처 사용) ──
    this.bgFar = this.add.tileSprite(W / 2, H / 2, W, H, 'bg_space_far')
      .setScrollFactor(0)
      .setDepth(-3);

    this.bgMid = this.add.tileSprite(W / 2, H / 2, W, H, 'bg_space_mid')
      .setScrollFactor(0)
      .setDepth(-2);

    // ── 타이틀 텍스트 ──
    this.add.text(W / 2, 140, 'SPACE GUARDER', {
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#00eeff',
      stroke: '#003355',
      strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 4, color: '#0099cc', blur: 20, fill: true }
    }).setOrigin(0.5).setDepth(10);

    this.add.text(W / 2, 210, '우주 탄막 서바이벌', {
      fontSize: '24px',
      color: '#aaddff',
      stroke: '#001122',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    // ── 조작 설명 ──
    const controlLines = [
      '  조작 방법     ',
      '',
      'WASD / 방향키   이동            ',
      '               Shift   저속 이동 (정밀 회피)      ',
      '        Q / E / C   보스 흡수 스킬 사용     ',
      '',
      '  게임 설명     ',
      '',
      '✦  기본 공격 자동 발사     ',
      '✦  레벨업 시 강화 카드 선택 ',
      '✦  미니보스 처치 시 스킬 흡수',
    ];
    const controlText = this.add.text(W / 2, 275, controlLines.join('\n'), {
      fontSize: '16px',
      color: '#ccddee',
      lineSpacing: 6,
      align: 'center',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5, 0).setDepth(10);

    // ── 시작 버튼 ──
    const btnBg = this.add.rectangle(W / 2, 560, 260, 56, 0x0055aa)
      .setStrokeStyle(3, 0x00ccff, 1)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add.text(W / 2, 560, '게임 시작', {
      fontSize: '26px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#003366',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(11);

    // 버튼 Hover
    btnBg.on('pointerover', () => {
      btnBg.setFillStyle(0x0077dd);
      this.tweens.add({ targets: [btnBg, btnText], scaleX: 1.05, scaleY: 1.05, duration: 80 });
    });
    btnBg.on('pointerout', () => {
      btnBg.setFillStyle(0x0055aa);
      this.tweens.add({ targets: [btnBg, btnText], scaleX: 1, scaleY: 1, duration: 80 });
    });
    btnBg.on('pointerdown', () => {
      this.cameras.main.flash(300, 0, 100, 255);
      this.time.delayedCall(200, () => this.scene.start('GameScene'));
    });

    // 스페이스바로도 시작 가능
    this.input.keyboard.once('keydown-SPACE', () => {
      this.cameras.main.flash(200, 0, 100, 255);
      this.time.delayedCall(150, () => this.scene.start('GameScene'));
    });

    // 타이틀 깜빡임 애니
    this.tweens.add({
      targets: btnText,
      alpha: 0.5,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut'
    });
  }


  update(time, delta) {
    const dt = delta / 1000;

    this.bgFar.tilePositionX += 8 * dt;
    this.bgFar.tilePositionY += 4 * dt;

    this.bgMid.tilePositionX += 18 * dt;
    this.bgMid.tilePositionY += 10 * dt;
  }

}
