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
    // 로드 실패한 이미지(저장소에 없는 한글 애니메이션 파일 등)를 위한 폴백
    this.ensurePlayerTextures();
    this.ensureBossTextures();
    this.scene.start('TitleScene');
  }

  // ──────────────────────────────────────────────
  //  플레이어 텍스처 폴백 (이미지 누락 시 절차적 생성)
  //  실제 로드된 텍스처가 있으면 건드리지 않는다.
  // ──────────────────────────────────────────────
  ensurePlayerTextures() {
    const defs = [
      ['player_down_idle', 'down', 0], ['player_down_r1', 'down', 1], ['player_down_r2', 'down', 2],
      ['player_down_l1', 'down', 2],   ['player_down_l2', 'down', 1],
      ['player_up_idle',  'up',   0],  ['player_up_r1',   'up',   1], ['player_up_r2',   'up',   2],
      ['player_up_l1',    'up',   2],  ['player_up_l2',   'up',   1],
      ['player_side_idle','side', 0],  ['player_side_r1', 'side', 1], ['player_side_r2', 'side', 2],
    ];
    for (const [key, facing, step] of defs) {
      if (!this.textures.exists(key)) this._makePlayerTex(key, facing, step);
    }
    if (!this.textures.exists('player')) this._makePlayerTex('player', 'down', 0);
  }

  /** 간단한 우주비행사 캐릭터 프레임 생성 (방향 + 걸음 단계) */
  _makePlayerTex(key, facing, step) {
    const g  = this.add.graphics();
    const cx = 24;
    // 다리 (step 1/2 에서 좌우로 벌어져 걷는 느낌)
    const off = step === 0 ? 0 : (step === 1 ? -3 : 3);
    g.fillStyle(0x21527a, 1);
    g.fillRect(cx - 9 + off, 38, 6, 8);
    g.fillRect(cx + 3 - off, 38, 6, 8);
    // 몸통 (우주복)
    g.fillStyle(0x3a9bdc, 1);
    g.fillRoundedRect(cx - 12, 16, 24, 22, 6);
    g.fillStyle(0x2a7bb5, 1);
    g.fillRoundedRect(cx - 12, 28, 24, 10, 5); // 하단 음영
    // 헬멧
    g.fillStyle(0xe2f4ff, 1);
    g.fillCircle(cx, 13, 11);
    // 방향 표시
    g.fillStyle(0x12334d, 1);
    if (facing === 'down') {
      g.fillEllipse(cx, 15, 15, 8);             // 정면 바이저
    } else if (facing === 'up') {
      g.fillStyle(0x2a6e9e, 1);
      g.fillRoundedRect(cx - 7, 18, 14, 13, 3); // 등 쪽 백팩
    } else {
      g.fillEllipse(cx + 5, 13, 9, 8);          // 측면 바이저 (오른쪽)
    }
    g.generateTexture(key, 48, 48);
    g.destroy();
  }

  // ──────────────────────────────────────────────
  //  보스 텍스처 폴백
  // ──────────────────────────────────────────────
  ensureBossTextures() {
    const bosses = [
      ['boss_mini1',        0xaa3355, 0xff6688],
      ['boss_mini2',        0x884466, 0xff88bb],
      ['boss_mini3',        0xaa5522, 0xffaa55],
      ['boss_final_phase1', 0x882222, 0xff5544],
      ['boss_final_phase2', 0x661133, 0xff3377],
      ['boss_final_phase3', 0x440066, 0xcc55ff],
    ];
    for (const [key, body, edge] of bosses) {
      if (this.textures.exists(key)) continue;
      const g = this.add.graphics();
      g.fillStyle(body, 1);
      g.fillCircle(120, 120, 110);
      g.lineStyle(8, edge, 1);
      g.strokeCircle(120, 120, 110);
      // 눈
      g.fillStyle(0xffffaa, 1);
      g.fillCircle(85, 100, 18);
      g.fillCircle(155, 100, 18);
      g.fillStyle(0x000000, 1);
      g.fillCircle(85, 100, 8);
      g.fillCircle(155, 100, 8);
      g.generateTexture(key, 240, 240);
      g.destroy();
    }
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
