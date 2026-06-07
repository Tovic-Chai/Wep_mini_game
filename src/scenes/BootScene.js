export default class BootScene extends Phaser.Scene {
  constructor() { super({ key: 'BootScene' }); }

  preload() {
    // ── 보스 이미지 ──
    this.load.image('player', 'assets/images/player1.png');
    this.load.image('boss_mini1', 'assets/images/mini_boss_1.png');
    this.load.image('boss_mini2', 'assets/images/mini_boss_2.png');
    this.load.image('boss_mini3', 'assets/images/mini_boss_3.png');
    this.load.image('boss_final_phase1', 'assets/images/boss_phase_1.png');
    this.load.image('boss_final_phase2', 'assets/images/boss_phase_2.png');
    this.load.image('boss_final_phase3', 'assets/images/boss_phase_3.png');

    // ── 메인보스 방향별 이미지 + 스킬 이미지 ──
    this.load.image('main_boss_down',       'assets/images/main_boss_down.png');
    this.load.image('main_boss_up',         'assets/images/main_boss_up.png');
    this.load.image('main_boss_right',      'assets/images/main_boss_right.png');
    this.load.image('boss_skill_blackhole', 'assets/images/main_boss_blackholl.png');
    this.load.image('boss_skill_clock',     'assets/images/main_boss_clock.png');
    this.load.image('boss_skill_light',     'assets/images/main_boss_light.png');
    this.load.image('boss_skill_mirror',    'assets/images/main_boss_borken_mirror.png');

    // ── 플레이어 4방향 걷기 애니메이션 (assets/images/ 에 파일 위치) ──
    // 아래 방향 (후면 = 카메라 향해 걷기)
    this.load.image('player_down_idle', 'assets/images/player_down_idle.png');
    this.load.image('player_down_r1', 'assets/images/player_down_r1.png');
    this.load.image('player_down_r2', 'assets/images/player_down_r2.png');
    this.load.image('player_down_l1', 'assets/images/player_down_l1.png');
    this.load.image('player_down_l2', 'assets/images/player_down_l2.png');
    // 위 방향 (정면 = 카메라 등지고 걷기)
    this.load.image('player_up_idle', 'assets/images/player_up_idle.png');
    this.load.image('player_up_r1', 'assets/images/player_up_r1.png');
    this.load.image('player_up_r2', 'assets/images/player_up_r2.png');
    this.load.image('player_up_l1', 'assets/images/player_up_l1.png');
    this.load.image('player_up_l2', 'assets/images/player_up_l2.png');
    // 좌우 방향 (측면, 왼쪽은 flipX로 처리)
    this.load.image('player_side_idle', 'assets/images/player_side_idle.png');
    this.load.image('player_side_r1', 'assets/images/player_side_r1.png');
    this.load.image('player_side_r2', 'assets/images/player_side_r2.png');

    // 자산 로드 실패해도 게임이 죽지 않도록
    this.load.on('loaderror', (file) => {
      console.warn('자산 로드 실패 (무시):', file.src);
    });

    // ── 미니보스1 방향별 애니메이션 ──
    this.load.image('mb1_front_base',  'assets/images/mini_boss1_frontward_base.png');
    this.load.image('mb1_front_alpha', 'assets/images/mini_boss1_frontward_base+alpha.png');
    this.load.image('mb1_back_close',  'assets/images/mini_boss1_backward_eye_close.png');
    this.load.image('mb1_back_half',   'assets/images/mini_boss1_backward_eye_open_half.png');
    this.load.image('mb1_back_open',   'assets/images/mini_boss1_backward_eye_open.png');
    this.load.image('mb1_right_close', 'assets/images/mini_boss1_rightward_eye_close.png');
    this.load.image('mb1_right_half',  'assets/images/mini_boss1_rightward_eye_open_half.png');
    this.load.image('mb1_right_open',  'assets/images/mini_boss1_rightward_eye_open.png');

    // ── 미니보스1 캐스팅 애니메이션 (마법진 시전 4프레임) ──
    this.load.image('mb1_cast1', 'assets/images/mini_boss_pattern_1_1.png');
    this.load.image('mb1_cast2', 'assets/images/mini_boss_pattern_1_2.png');
    this.load.image('mb1_cast3', 'assets/images/mini_boss_pattern_1_3.png');
    this.load.image('mb1_cast4', 'assets/images/mini_boss_pattern_1_4.png');

    // ── 미니보스2 방향별 눈 깜빡임 애니메이션 ──
    // front(아래) 방향 — open 상태는 boss_mini2 기본 텍스처 사용 (fornt_eye_open.png 는 빈 파일)
    this.load.image('mb2_front_half2',  'assets/images/mini_boss2_fornt_eye_half2.png');
    this.load.image('mb2_front_half',   'assets/images/mini_boss2_fornt_eye_half.png');
    this.load.image('mb2_front_close',  'assets/images/mini_boss2_fornt_eye_close.png');
    this.load.image('mb2_front_close2', 'assets/images/mini_boss2_fornt_eye_close2.png');
    this.load.image('mb2_front_close3', 'assets/images/mini_boss2_fornt_eye_close3.png');
    // right 방향 — open2 사용 (right_eye_open.png 는 빈 파일)
    this.load.image('mb2_right_open2',  'assets/images/mini_boss2_right_eye_open2.png');
    this.load.image('mb2_right_half2',  'assets/images/mini_boss2_right_eye_half2.png');
    this.load.image('mb2_right_half',   'assets/images/mini_boss2_right_eye_half.png');
    this.load.image('mb2_right_close',  'assets/images/mini_boss2_right_eye_close.png');
    // up 방향
    this.load.image('mb2_up_open',  'assets/images/mini_boss2_up_eye_open.png');
    this.load.image('mb2_up_half',  'assets/images/mini_boss2_up_eye_half.png');
    this.load.image('mb2_up_close', 'assets/images/mini_boss2_up_eye_close.png');

    // ── 미니보스3 걷기/멈춤 애니메이션 ──
    this.load.image('mb3_down_walk1',  'assets/images/mini_boss3_down_walk1.png');
    this.load.image('mb3_down_walk2',  'assets/images/mini_boss3_down_walk2.png');
    this.load.image('mb3_right_walk1', 'assets/images/mini_boss3_right_walk1.png');
    this.load.image('mb3_right_walk2', 'assets/images/mini_boss3_right_walk2.png');
    this.load.image('mb3_up_walk1',    'assets/images/mini_boss3_up_walk.png');
    this.load.image('mb3_up_walk2',    'assets/images/mini_boss3_up_walk2.png');
    this.load.image('mb3_stop',        'assets/images/mini_boss3_left_stop.png');
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

    // 여기 추가
    this.generatePixelWeaponTextures();

    // ── 10) 배경 3중 (별 밀도 다르게) ──
    this.makeStarTexture('bg_space_far', 960, 640, 200, 1, true);
    this.makeStarTexture('bg_space_mid', 960, 640, 60, 2, false);
    this.makeStarTexture('bg_space_near', 960, 640, 25, 3, false);
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

  generatePixelWeaponTextures() {
    // 플레이어 총알
    this.makePixelTexture('bullet', [
      '..11..',
      '.1221.',
      '123321',
      '.1221.',
      '..11..'
    ], {
      '1': 0x5ee7ff,
      '2': 0x1fb6d9,
      '3': 0xffffff
    }, 3);

    // 파이어볼
    this.makePixelTexture('fireball', [
      '...11...',
      '..1221..',
      '.123321.',
      '12344321',
      '.123321.',
      '..1221..',
      '...11...'
    ], {
      '1': 0xff6a00,
      '2': 0xff9900,
      '3': 0xffdd55,
      '4': 0xffffff
    }, 4);

    // 회전 오브
    this.makePixelTexture('orbit_orb', [
      '..111..',
      '.12221.',
      '1233321',
      '1234321',
      '1233321',
      '.12221.',
      '..111..'
    ], {
      '1': 0x0d4ea6,
      '2': 0x27a7ff,
      '3': 0x8de8ff,
      '4': 0xffffff
    }, 3);

    // 얼음 파편
    this.makePixelTexture('ice_shard', [
      '................',
      '..11............',
      '.1221...........',
      '1233211.........',
      '1234332211......',
      '123444333221111.',
      '1234332211......',
      '1233211.........',
      '.1221...........',
      '..11............',
      '................'
    ], {
      '1': 0x55cfff,
      '2': 0xa6efff,
      '3': 0xe7fdff,
      '4': 0xffffff
    }, 4);

    // 드론 코어
    this.makePixelTexture('drone_core', [
      '..1111..',
      '.122221.',
      '12344321',
      '12455421',
      '12344321',
      '.122221.',
      '..1111..'
    ], {
      '1': 0x334155,
      '2': 0x60a5fa,
      '3': 0xcbd5e1,
      '4': 0x0f172a,
      '5': 0xffffff
    }, 4);

    // 드론 총알
    this.makePixelTexture('drone_bullet', [
      '.11.',
      '1221',
      '1221',
      '.11.'
    ], {
      '1': 0xf59e0b,
      '2': 0xffffff
    }, 4);

    // 검기
    this.makePixelTexture('blade_crescent', [
      '.........1111.............',
      '.........11122111..........',
      '........1233222111.......',
      '.......1233322211.....',
      '......1234333221....',
      '........4443321...',
      '...........44321...',
      '.............44321...',
      '...........44321...',
      '........4443321...',
      '......1234333221....',
      '.......1233322211.....',
      '........1233222111.......',
      '.........11122111..........',
      '.........1111.............'
    ], {
      '1': 0xdbeafe,
      '2': 0x93c5fd,
      '3': 0x60a5fa,
      '4': 0xffffff
    }, 4);
  }

  makePixelTexture(key, rows, palette, pixelSize = 4) {
    if (this.textures.exists(key)) return;

    const g = this.add.graphics();
    const h = rows.length;
    const w = rows[0].length;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === '.') continue;

        const color = palette[ch];
        if (!color) continue;

        g.fillStyle(color, 1);
        g.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }

    g.generateTexture(key, w * pixelSize, h * pixelSize);
    g.destroy();
  }
}
