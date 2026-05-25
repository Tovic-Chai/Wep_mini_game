export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() {
    // 실제 폴더의 파일명에 정확히 맞춤
    this.load.image('player', 'assets/images/player1.png');
    this.load.image('boss_mini1', 'assets/images/mini_boss_1.png');
    this.load.image('boss_mini2', 'assets/images/mini_boss_2.png');
    this.load.image('boss_mini3', 'assets/images/mini_boss_3.png');
    this.load.image('boss_final_phase1', 'assets/images/boss_phase_1.png');
    this.load.image('boss_final_phase2', 'assets/images/boss_phase_2.png');
    this.load.image('boss_final_phase3', 'assets/images/boss_phase_3.png');

    // 자산 로드 실패해도 게임이 죽지 않도록
    this.load.on('loaderror', (file) => {
      console.warn('자산 로드 실패 (무시):', file.src);
    });
  }

  create() {
    // bullet, enemy, particle_star, 배경 3종은 실제 파일이 없으므로
    // 그래픽으로 즉석에서 생성해 텍스처로 등록 (자산 채워질 때까지의 폴백)
    this.generateFallbackTextures();
    this.scene.start('GameScene');
  }

  generateFallbackTextures() {
    // 1) 플레이어 탄 (청록색 작은 원)
    let g = this.add.graphics();
    g.fillStyle(0x66ffff, 1);
    g.fillCircle(5, 5, 5);
    g.lineStyle(1, 0xffffff, 1);
    g.strokeCircle(5, 5, 5);
    g.generateTexture('bullet', 10, 10);
    g.destroy();

    // 2) 파티클 별
    g = this.add.graphics();
    g.fillStyle(0xffffaa, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle_star', 8, 8);
    g.destroy();

    // 3) 일반 적 (자홍색 사각형)
    g = this.add.graphics();
    g.fillStyle(0xaa44ff, 1);
    g.fillRect(0, 0, 28, 28);
    g.lineStyle(2, 0xffaaff, 1);
    g.strokeRect(0, 0, 28, 28);
    g.generateTexture('enemy', 28, 28);
    g.destroy();

    // 4) 배경 3중 (별 밀도 다르게)
    this.makeStarTexture('bg_space_far', 960, 640, 200, 1, true);
    this.makeStarTexture('bg_space_mid', 960, 640, 60, 2, false);
    this.makeStarTexture('bg_space_near', 960, 640, 25, 3, false);

    // 5) 경험치 구슬
    g = this.add.graphics();
    g.fillStyle(0x44ff88, 1);
    g.fillCircle(6, 6, 6);
    g.lineStyle(2, 0xffffff, 1);
    g.strokeCircle(6, 6, 6);
    g.generateTexture('exp_orb', 12, 12);
    g.destroy();
  }

  makeStarTexture(key, w, h, count, radius, opaque) {
    const g = this.add.graphics();
    if (opaque) {
      g.fillStyle(0x000022, 1);
      g.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(0, w);
      const y = Phaser.Math.Between(0, h);
      const alpha = Phaser.Math.FloatBetween(0.4, 1);
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(x, y, radius);
    }
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
