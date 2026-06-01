export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() {
    // ── 보스 이미지 ──
    this.load.image('player',            'assets/images/player1.png');
    this.load.image('boss_mini1',        'assets/images/mini_boss_1.png');
    this.load.image('boss_mini2',        'assets/images/mini_boss_2.png');
    this.load.image('boss_mini3',        'assets/images/mini_boss_3.png');
    this.load.image('boss_final_phase1', 'assets/images/boss_phase_1.png');
    this.load.image('boss_final_phase2', 'assets/images/boss_phase_2.png');
    this.load.image('boss_final_phase3', 'assets/images/boss_phase_3.png');

    // ── 플레이어 4방향 걷기 애니메이션 (assets/images/ 에 파일 위치) ──
    // 아래 방향 (후면 = 카메라 향해 걷기)
    this.load.image('player_down_idle', 'assets/images/후면_서있기.png');
    this.load.image('player_down_r1',   'assets/images/후면_오른발앞_걷기.png');
    this.load.image('player_down_r2',   'assets/images/후면_오른발앞_달리기.png');
    this.load.image('player_down_l1',   'assets/images/후면_왼발앞_걷기.png');
    this.load.image('player_down_l2',   'assets/images/후면_왼발앞_달리기.png');
    // 위 방향 (정면 = 카메라 등지고 걷기)
    this.load.image('player_up_idle',   'assets/images/정면_서있기.png');
    this.load.image('player_up_r1',     'assets/images/정면_오른발_앞으로.png');
    this.load.image('player_up_r2',     'assets/images/정면_오른발_많이_앞으로.png');
    this.load.image('player_up_l1',     'assets/images/정면_왼발_앞으로.png');
    this.load.image('player_up_l2',     'assets/images/정면_왼발_많이_앞으로.png');
    // 좌우 방향 (측면, 왼쪽은 flipX로 처리)
    this.load.image('player_side_idle', 'assets/images/오른쪽으로_걷기_서있는_상태.png');
    this.load.image('player_side_r1',   'assets/images/오른쪽으로_걷기_작게.png');
    this.load.image('player_side_r2',   'assets/images/오른쪽으로_걷기_크게.png');

    // 자산 로드 실패해도 게임이 죽지 않도록
    this.load.on('loaderror', (file) => {
      console.warn('자산 로드 실패 (무시):', file.src);
    });
  }

  create() {
    this.generateFallbackTextures();
    this.scene.start('TitleScene');
  }

  generateFallbackTextures() {
    // ── 1) 플레이어 탄 (청록색 타원형) ──
    let g = this.add.graphics();
    g.fillStyle(0x66ffff, 1);
    g.fillEllipse(8, 5, 16, 10);
    g.lineStyle(1, 0xffffff, 0.8);
    g.strokeEllipse(8, 5, 16, 10);
    g.generateTexture('bullet', 16, 10);
    g.destroy();

    // ── 2) 파이어볼 (주황-빨강 원형) ──
    g = this.add.graphics();
    // 외곽 오렌지 glow
    g.fillStyle(0xff4400, 0.5);
    g.fillCircle(12, 12, 12);
    // 메인 화염
    g.fillStyle(0xff6600, 1);
    g.fillCircle(12, 12, 9);
    // 내부 노란 코어
    g.fillStyle(0xffdd00, 1);
    g.fillCircle(12, 12, 5);
    // 하이라이트
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(10, 10, 2);
    g.generateTexture('fireball', 24, 24);
    g.destroy();

    // ── 3) 회전 오브 (청록 구슬) ──
    g = this.add.graphics();
    g.fillStyle(0x0044aa, 0.4);
    g.fillCircle(7, 7, 7);
    g.fillStyle(0x00aaff, 1);
    g.fillCircle(7, 7, 5);
    g.fillStyle(0x66ddff, 1);
    g.fillCircle(7, 7, 3);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(5, 5, 1.5);
    g.generateTexture('orbit_orb', 14, 14);
    g.destroy();

    // ── 4) 파티클 별 ──
    g = this.add.graphics();
    g.fillStyle(0xffffaa, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('particle_star', 8, 8);
    g.destroy();

    // ── 5) 보스 탄 (분홍-빨강 타원) ──
    g = this.add.graphics();
    g.fillStyle(0xcc0044, 0.6);
    g.fillEllipse(7, 3, 14, 6);
    g.fillStyle(0xff3366, 1);
    g.fillEllipse(7, 3, 11, 5);
    g.fillStyle(0xff88aa, 0.9);
    g.fillEllipse(5, 2, 5, 3);
    g.generateTexture('boss_bullet', 14, 6);
    g.destroy();

    // ── 6) 적 M01 (자홍색 사각형) ──
    g = this.add.graphics();
    g.fillStyle(0xaa44ff, 1);
    g.fillRect(2, 2, 24, 24);
    g.lineStyle(2, 0xffaaff, 1);
    g.strokeRect(2, 2, 24, 24);
    g.generateTexture('enemy', 28, 28);
    g.destroy();

    // ── 7) 적 M02 (다크레드 다이아몬드) ──
    g = this.add.graphics();
    g.fillStyle(0xcc2200, 1);
    g.fillTriangle(14, 1, 27, 14, 14, 27);
    g.fillTriangle(14, 1, 1, 14, 14, 27);
    g.lineStyle(2, 0xff6644, 1);
    g.strokeTriangle(14, 1, 27, 14, 14, 27);
    g.strokeTriangle(14, 1, 1, 14, 14, 27);
    g.generateTexture('enemy_m02', 28, 28);
    g.destroy();

    // ── 8) 적 M03 (오렌지 육각형) ──
    g = this.add.graphics();
    g.fillStyle(0xff8800, 1);
    const cx = 14, cy = 14, r = 11;
    const hex = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      hex.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    g.fillPoints(hex, true);
    g.lineStyle(2, 0xffcc44, 1);
    g.strokePoints(hex, true);
    g.generateTexture('enemy_m03', 28, 28);
    g.destroy();

    // ── 9) 경험치 구슬 ──
    g = this.add.graphics();
    g.fillStyle(0x22cc66, 1);
    g.fillCircle(6, 6, 6);
    g.fillStyle(0x88ffbb, 0.8);
    g.fillCircle(4, 4, 3);
    g.lineStyle(2, 0xffffff, 0.5);
    g.strokeCircle(6, 6, 6);
    g.generateTexture('exp_orb', 12, 12);
    g.destroy();

    // ── 10) 배경 3중 (별 밀도 다르게) ──
    this.makeStarTexture('bg_space_far',  960, 640, 200, 1, true);
    this.makeStarTexture('bg_space_mid',  960, 640,  60, 2, false);
    this.makeStarTexture('bg_space_near', 960, 640,  25, 3, false);
  }

  makeStarTexture(key, w, h, count, radius, opaque) {
    const g = this.add.graphics();
    if (opaque) {
      g.fillStyle(0x000022, 1);
      g.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < count; i++) {
      const x     = Phaser.Math.Between(0, w);
      const y     = Phaser.Math.Between(0, h);
      const alpha = Phaser.Math.FloatBetween(0.4, 1);
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(x, y, radius);
    }
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
