export default class Boss extends Phaser.Events.EventEmitter {
  constructor(scene, x, y, kind = 'mini1') {
    super();
    this.scene = scene;
    this.kind = kind;

    const keyMap = {
      mini1: 'mb1_back_close',
      mini2: 'boss_mini2',
      mini3: 'boss_mini3',
      final: 'boss_final_phase1'
    };
    const scaleMap = {
      mini1: 0.5, mini2: 0.3, mini3: 0.26, final: 0.4  // mini1: 500×500px 이미지 기준
    };

    this.sprite = scene.physics.add.sprite(x, y, keyMap[kind] || 'boss_mini1')
      .setDepth(3)
      .setScale(scaleMap[kind] || 0.3);

    // setScale() does NOT resize the Arcade Physics body — must set explicitly.
    const bodySizeMap = { mini1: 250, mini2: 220, mini3: 220, final: 240 };
    const bs = bodySizeMap[kind] || 220;
    this.sprite.body.setSize(bs, bs);

    this.sprite.parentRef = this;
    this._bodySize  = bs;                     // setTexture 후 body 재적용용

    this.alive = true;
    this.attackTimer = 0;

    // 보스별 스탯 및 획득 스킬
    const configs = {
      mini1: { hp: 1500, skill: { id: 'slow', name: '시간 슬로우', duration: 5, cooldown: 45, effect: 'timeSlow' } },
      mini2: { hp: 2500, skill: { id: 'blackhole', name: '블랙홀', duration: 3, cooldown: 60, effect: 'blackhole' } },
      mini3: { hp: 4000, skill: { id: 'clone', name: '분신', duration: 8, cooldown: 75, effect: 'clone' } },
      final: { hp: 15000, skill: null }
    };

    const cfg = configs[kind] || configs.mini1;

    // 플레이어 레벨 비례 HP 스케일 (최소 2배)
    const playerLevel = scene.player?.level || 1;
    const hpScale = Math.max(2, 1 + (playerLevel - 1) * 0.35);
    this.hp = Math.floor(cfg.hp * hpScale);
    this.skill = cfg.skill;

    // 메인보스 전용
    if (kind === 'final') this.phase = 1;

    this.angleOffset = 0;
    this._baseScale = scaleMap[kind] || 0.3;  // 캐스팅 스케일 복원용

    // ── 미니보스1 애니메이션 상태 ──
    if (kind === 'mini1') {
      this._animTimer  = 0;
      this._animFrame  = 0;
      this._animDir    = 'back';
      this._isCasting  = false;
    }

    // ── 미니보스2 방향별 눈 깜빡임 애니메이션 ──
    if (kind === 'mini2') {
      this._animDir   = 'front';
      this._animFrame = 0;
      this._animTimer = 0;
    }

    // ── 미니보스3 걷기/멈춤 방향 애니메이션 ──
    if (kind === 'mini3') {
      this._stopTimer = 0;
      this._animDir   = 'down';
      this._animFrame = 0;
      this._animTimer = 0;
    }

    // ── 보스별 특수 패턴 타이머 ──
    this.patternTimer = 9;  // 초기 유예 시간 + 첫 시전까지 9초
    this.specialTimer = 0;
    this.teleportTimer = 4;
    this.cloneSprites = [];

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
    this._barW = barW;
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
    this.patternTimer -= dt;
    this.specialTimer -= dt;
    this.teleportTimer -= dt;

    if (this.attackTimer <= 0) {
      // 최종 보스는 페이즈가 올라갈수록 공격이 빨라짐
      if (this.kind === 'final') {
        this.attackTimer = [null, 1.0, 0.75, 0.55][this.phase] || 0.9;
      } else {
        this.attackTimer = 1.2;
      }

      this.firePattern();
    }

    // ── 미니보스 특수 패턴 ──
    if (this.kind === 'mini1' && this.patternTimer <= 0 && !this._isCasting) {
      this.patternTimer = 9;
      this.castSlowZone();
    }

    if (this.kind === 'mini2' && this.patternTimer <= 0) {
      this.patternTimer = 6;
      this.castBlackhole();
    }

    if (this.kind === 'mini3') {
      if (this.patternTimer <= 0) {
        this.patternTimer = 7;
        this.summonClones();
      }

      if (this.teleportTimer <= 0) {
        this.teleportTimer = 5;
        this.teleportNearPlayer();
      }
    }

    // ── 최종 보스 특수 패턴 ──
    if (this.kind === 'final' && this.specialTimer <= 0) {
      if (this.phase === 1) {
        this.specialTimer = 4;
        this.fireAimedShots();
      } else if (this.phase === 2) {
        this.specialTimer = 5;
        this.fireLaserWarning();
      } else if (this.phase === 3) {
        this.specialTimer = 6;
        this.castBlackhole();
        this.summonClones();
        this.fireLaserWarning();
      }
    }

    // 메인보스 페이즈 전환
    if (this.kind === 'final') {
      if (this.phase === 1 && this.hp <= 10000) this.setPhase(2);
      if (this.phase === 2 && this.hp <= 5000) this.setPhase(3);
    }

    // 플레이어 추적
    const player = this.scene.player.sprite;
    const angle = Phaser.Math.Angle.Between(
      this.sprite.x, this.sprite.y, player.x, player.y
    );

    const speedMap = {
      mini1: 45, mini2: 55, mini3: 70,
    };
    let moveSpeed = speedMap[this.kind] || 45;
    if (this.kind === 'final') {
      moveSpeed = [null, 60, 85, 110][this.phase] || 60;
    }

    // mini3 정지 타이머 차감
    if (this.kind === 'mini3' && this._stopTimer > 0) this._stopTimer -= dt;

    const mini3Stopped = this.kind === 'mini3' && this._stopTimer > 0;

    if ((this.kind === 'mini1' && this._isCasting) || mini3Stopped) {
      this.sprite.setVelocity(0, 0);
    } else {
      this.sprite.setVelocity(
        Math.cos(angle) * moveSpeed,
        Math.sin(angle) * moveSpeed
      );
    }

    if (this.kind === 'mini1' && !this._isCasting) this._updateMini1Anim(dt);
    if (this.kind === 'mini2') this._updateMini2Anim(dt);
    if (this.kind === 'mini3') this._updateMini3Anim(dt);
    this._updateHpBar();
  }

  // ──────────────────────────────────────────
  //  미니보스1 방향별 프레임 애니메이션
  //  down(backward): eye_close→half→open→half 사이클
  //  up(frontward) : base↔alpha 사이클
  //  right/left    : eye_close→half→open→half (flipX)
  // ──────────────────────────────────────────
  _updateMini1Anim(dt) {
    const vx = this.sprite.body.velocity.x;
    const vy = this.sprite.body.velocity.y;

    let dir;
    if (Math.abs(vx) > Math.abs(vy)) {
      dir = 'right';
    } else {
      dir = vy >= 0 ? 'back' : 'front';
    }

    if (dir !== this._animDir) {
      this._animDir   = dir;
      this._animFrame = 0;
      this._animTimer = 0;
    }

    this._animTimer -= dt;
    if (this._animTimer > 0) return;
    this._animTimer = 0.22;

    const BACK  = ['mb1_back_close',  'mb1_back_half',  'mb1_back_open',  'mb1_back_half'];
    const FRONT = ['mb1_front_base',  'mb1_front_alpha'];
    const RIGHT = ['mb1_right_close', 'mb1_right_half', 'mb1_right_open', 'mb1_right_half'];

    if (dir === 'back') {
      this._animFrame = (this._animFrame + 1) % BACK.length;
      this.sprite.setTexture(BACK[this._animFrame]).setFlipX(false);
    } else if (dir === 'front') {
      this._animFrame = (this._animFrame + 1) % FRONT.length;
      this.sprite.setTexture(FRONT[this._animFrame]).setFlipX(false);
    } else {
      this._animFrame = (this._animFrame + 1) % RIGHT.length;
      this.sprite.setTexture(RIGHT[this._animFrame]).setFlipX(vx < 0);
    }

    // setTexture() resets body size to texture dimensions — restore after every frame change
    this.sprite.body.setSize(this._bodySize, this._bodySize);
  }

  // ──────────────────────────────────────────
  //  미니보스2 방향별 눈 깜빡임 애니메이션
  //  front(아래): boss_mini2 → half2 → half → close → close2 → close3 → ... → 반복
  //  right(우): right_open2 → half2 → half → close → ... → 반복  (flipX for left)
  //  up: up_open → up_half → up_close → up_half → 반복
  // ──────────────────────────────────────────
  _updateMini2Anim(dt) {
    if (!this.sprite?.active) return;

    const vx = this.sprite.body.velocity.x;
    const vy = this.sprite.body.velocity.y;
    let dir;
    if (Math.abs(vx) > Math.abs(vy)) {
      dir = 'right';
    } else {
      dir = vy >= 0 ? 'front' : 'up';
    }

    if (dir !== this._animDir) {
      this._animDir   = dir;
      this._animFrame = 0;
      this._animTimer = 0;
    }

    this._animTimer -= dt;
    if (this._animTimer > 0) return;

    // 각 방향 프레임 시퀀스 [텍스처키, 재생시간(초)]
    // 프레임 0 = 눈 뜬 상태 (길게 유지) — 실제 시간은 아래에서 랜덤 처리
    const SEQS = {
      front: [
        ['boss_mini2',      0],
        ['mb2_front_half2', 0.08],
        ['mb2_front_half',  0.08],
        ['mb2_front_close', 0.12],
        ['mb2_front_close2',0.10],
        ['mb2_front_close3',0.10],
        ['mb2_front_close2',0.08],
        ['mb2_front_close', 0.08],
        ['mb2_front_half',  0.08],
        ['mb2_front_half2', 0.08],
      ],
      right: [
        ['mb2_right_open2', 0],
        ['mb2_right_half2', 0.08],
        ['mb2_right_half',  0.08],
        ['mb2_right_close', 0.18],
        ['mb2_right_half',  0.08],
        ['mb2_right_half2', 0.08],
      ],
      up: [
        ['mb2_up_open',  0],
        ['mb2_up_half',  0.10],
        ['mb2_up_close', 0.15],
        ['mb2_up_half',  0.10],
      ],
    };

    const seq = SEQS[dir];
    this._animFrame = (this._animFrame + 1) % seq.length;
    const [key, baseDur] = seq[this._animFrame];

    // 프레임 0은 눈 뜬 상태 — 랜덤 대기 후 다음 깜빡임
    const dur = this._animFrame === 0 ? 2.0 + Math.random() * 1.5 : baseDur;
    this._animTimer = dur;

    this.sprite.setTexture(key).setFlipX(vx < 0 && dir === 'right');
    // setTexture() 는 body 크기를 텍스처 치수로 덮어씀 — 매번 명시 복원
    this.sprite.body.setSize(this._bodySize, this._bodySize);
  }

  // ──────────────────────────────────────────
  //  미니보스3 방향별 걷기/멈춤 애니메이션
  //  이동 중: 방향별 walk1↔walk2 교체 (0.18s 간격)
  //  정지 중(_stopTimer > 0): mb3_stop 고정
  //  좌측 이동: right 텍스처 + flipX
  // ──────────────────────────────────────────
  _updateMini3Anim(dt) {
    if (!this.sprite?.active) return;

    const vx = this.sprite.body.velocity.x;
    const vy = this.sprite.body.velocity.y;
    const moving = Math.abs(vx) > 5 || Math.abs(vy) > 5;

    // 정지 상태: mb3_stop 고정
    if (this._stopTimer > 0 || !moving) {
      if (this.sprite.texture.key !== 'mb3_stop') {
        this.sprite.setTexture('mb3_stop');
        this.sprite.body.setSize(this._bodySize, this._bodySize);
      }
      this._animTimer = 0;
      return;
    }

    // 방향 감지
    let dir;
    if (Math.abs(vx) > Math.abs(vy)) {
      dir = 'right';
    } else {
      dir = vy >= 0 ? 'down' : 'up';
    }

    if (dir !== this._animDir) {
      this._animDir   = dir;
      this._animFrame = 0;
      this._animTimer = 0;
    }

    this._animTimer -= dt;
    if (this._animTimer > 0) return;
    this._animTimer = 0.18;

    const WALK = {
      down:  ['mb3_down_walk1',  'mb3_down_walk2'],
      right: ['mb3_right_walk1', 'mb3_right_walk2'],
      up:    ['mb3_up_walk1',    'mb3_up_walk2'],
    };

    const frames = WALK[dir];
    this._animFrame = (this._animFrame + 1) % frames.length;

    this.sprite.setTexture(frames[this._animFrame]).setFlipX(vx < 0 && dir === 'right');
    // setTexture() 는 body 크기를 텍스처 치수로 덮어씀 — 매번 명시 복원
    this.sprite.body.setSize(this._bodySize, this._bodySize);
  }

  // ──────────────────────────────────────────
  //  탄막 발사
  // ──────────────────────────────────────────
  firePattern() {
    if (!this.scene.enemyBullets) return;

    // 미니보스 1: 십자 탄막
    if (this.kind === 'mini1') {
      this.fireCrossPattern();
      return;
    }

    // 미니보스 2: 원형 탄막 + 블랙홀 보스
    if (this.kind === 'mini2') {
      this.fireCirclePattern(16, 120);
      return;
    }

    // 미니보스 3: 본체 + 분신 조준탄
    if (this.kind === 'mini3') {
      this.fireAimedShots();
      this.fireCloneShots();
      return;
    }

    // 최종 보스
    if (this.kind === 'final') {
      if (this.phase === 1) {
        this.fireCirclePattern(18, 130);
      } else if (this.phase === 2) {
        this.fireSpiralPattern();
      } else if (this.phase === 3) {
        this.fireCirclePattern(36, 165);
        this.fireSpiralPattern();
        this.fireCloneShots();
      }
    }
  }

  // ──────────────────────────────────────────
  //  공통 탄 생성
  // ──────────────────────────────────────────
  _spawnBossBullet(x, y, angle, speed = 120, scale = 1.2) {
    if (!this.scene.enemyBullets) return;

    const b = this.scene.enemyBullets.create(x, y, 'boss_bullet');
    if (!b) return;

    b.setActive(true).setVisible(true);
    b.isEnemyBullet = true;
    b.setDepth(2);
    b.setScale(scale);
    b.rotation = angle;

    b.body.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
  }

  // ──────────────────────────────────────────
  //  원형 전방위 탄막 (count발을 360도로 균등 발사)
  // ──────────────────────────────────────────
  fireCirclePattern(count = 16, speed = 120) {
    const base = Phaser.Math.DegToRad(this.angleOffset);
    for (let i = 0; i < count; i++) {
      const angle = base + (Math.PI * 2 / count) * i;
      const bx = this.sprite.x + Math.cos(angle) * 20;
      const by = this.sprite.y + Math.sin(angle) * 20;
      this._spawnBossBullet(bx, by, angle, speed, 1.2);
    }
    this.angleOffset += 10;
  }

  // ──────────────────────────────────────────
  //  미니보스 1: 십자 탄막
  // ──────────────────────────────────────────
  fireCrossPattern() {
    const base = Phaser.Math.DegToRad(this.angleOffset);

    for (let i = 0; i < 4; i++) {
      const angle = base + Phaser.Math.DegToRad(90 * i);
      this._spawnBossBullet(
        this.sprite.x,
        this.sprite.y,
        angle,
        130,
        1.2
      );
    }

    this.angleOffset += 12;
  }

  // ──────────────────────────────────────────
  //  미니보스 1: 시간 감속 마법진
  // ──────────────────────────────────────────
  castSlowZone() {
    const scene = this.scene;
    const player = scene.player;
    if (!player || !player.sprite) return;

    const x = player.sprite.x;
    const y = player.sprite.y;
    const radius = 150;

    // ── 캐스팅 시작: 이동 정지 + 4단계 텍스처 전환 ──
    // setTexture()는 내부적으로 body.setSize(textureW, textureH)를 호출해
    // body offset이 바뀌고 다음 postUpdate에서 스프라이트가 튀어 사라짐.
    // 매 프레임 교체 후 scale · body · depth를 명시 복원한다.
    const castScale = this._baseScale * 1.12;
    const bs = this._bodySize;

    const _applyFrame = (key) => {
      if (!this.alive || !this.sprite?.active) return;
      this.sprite
        .setTexture(key)
        .setFlipX(false)
        .setScale(castScale)
        .setDepth(10);            // 마법진(depth 3-6) 위에 항상 보이도록
      this.sprite.body.setSize(bs, bs);
    };

    this._isCasting = true;
    _applyFrame('mb1_cast1');

    scene.time.delayedCall(350,  () => _applyFrame('mb1_cast2'));
    scene.time.delayedCall(650,  () => _applyFrame('mb1_cast3'));
    scene.time.delayedCall(900,  () => _applyFrame('mb1_cast4'));

    // 마법진 종료(약 6300ms) 후 이동 재개 + 방향 애니메이션 복원
    scene.time.delayedCall(6300, () => {
      if (!this.alive) return;
      this._isCasting  = false;
      this._animFrame  = 0;
      this._animTimer  = 0;
      if (this.sprite?.active) {
        this.sprite.setScale(this._baseScale).setDepth(3);
        this.sprite.body.setSize(bs, bs);
      }
    });

    // 마법진 오브젝트들을 한 번에 관리
    const magicCircleParts = [];

    // 바깥 원
    const outerCircle = scene.add.circle(x, y, radius)
      .setDepth(4)
      .setStrokeStyle(4, 0x88ccff, 0.8)
      .setAlpha(0.75);

    // 중간 원
    const middleCircle = scene.add.circle(x, y, radius * 0.72)
      .setDepth(4)
      .setStrokeStyle(2, 0x4488ff, 0.7)
      .setAlpha(0.75);

    // 안쪽 원
    const innerCircle = scene.add.circle(x, y, radius * 0.38)
      .setDepth(4)
      .setStrokeStyle(2, 0xaaddff, 0.8)
      .setAlpha(0.75);

    magicCircleParts.push(outerCircle, middleCircle, innerCircle);

    // 마법진 배경 은은한 원
    const fillCircle = scene.add.circle(x, y, radius, 0x2266ff, 0.12)
      .setDepth(3)
      .setAlpha(0.35);

    magicCircleParts.push(fillCircle);

    // 십자선 + 대각선
    for (let i = 0; i < 8; i++) {
      const angle = Phaser.Math.DegToRad(i * 45);

      const line = scene.add.rectangle(
        x,
        y,
        radius * 1.65,
        2,
        0x88ccff,
        i % 2 === 0 ? 0.55 : 0.35
      )
        .setDepth(4)
        .setRotation(angle);

      magicCircleParts.push(line);
    }

    // 룬 문자 느낌의 작은 점들
    const runeDots = [];
    for (let i = 0; i < 16; i++) {
      const angle = Phaser.Math.DegToRad((360 / 16) * i);
      const dotX = x + Math.cos(angle) * radius * 0.88;
      const dotY = y + Math.sin(angle) * radius * 0.88;

      const dot = scene.add.circle(dotX, dotY, 4, 0xaaddff, 0.9)
        .setDepth(5);

      runeDots.push(dot);
      magicCircleParts.push(dot);
    }

    // 중앙 별 모양 느낌
    const centerStar = scene.add.star(
      x,
      y,
      6,
      radius * 0.18,
      radius * 0.34,
      0x88ccff,
      0.18
    )
      .setDepth(4)
      .setStrokeStyle(2, 0xaaddff, 0.75);

    magicCircleParts.push(centerStar);

    // 등장 애니메이션
    magicCircleParts.forEach(part => {
      part.setScale(0.2);
      part.setAlpha(0);
    });

    scene.tweens.add({
      targets: magicCircleParts,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 450,
      ease: 'Back.Out'
    });

    // 회전 애니메이션
    scene.tweens.add({
      targets: outerCircle,
      angle: 360,
      duration: 4000,
      repeat: -1
    });

    scene.tweens.add({
      targets: middleCircle,
      angle: -360,
      duration: 3200,
      repeat: -1
    });

    scene.tweens.add({
      targets: centerStar,
      angle: 360,
      duration: 2500,
      repeat: -1
    });

    // 점들이 깜빡이는 효과
    scene.tweens.add({
      targets: runeDots,
      alpha: 0.25,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    // 장판 발동 전 경고 깜빡임
    scene.tweens.add({
      targets: magicCircleParts,
      alpha: 0.45,
      duration: 220,
      yoyo: true,
      repeat: 3
    });

    scene.time.delayedCall(900, () => {
      if (!outerCircle.active) return;

      // 발동 후 배경은 은은하게만
      fillCircle.setFillStyle(0x2266ff, 0.16);
      fillCircle.setAlpha(0.45);
      fillCircle.setDepth(3);

      // ★ 발동 후에도 마법진 모양이 계속 보이도록 선/룬 다시 표시
      outerCircle.setAlpha(1);
      middleCircle.setAlpha(0.9);
      innerCircle.setAlpha(0.95);
      centerStar.setAlpha(0.8);

      outerCircle.setStrokeStyle(4, 0xaaddff, 1);
      middleCircle.setStrokeStyle(2, 0x66aaff, 0.95);
      innerCircle.setStrokeStyle(2, 0xddf6ff, 1);
      centerStar.setStrokeStyle(2, 0xddf6ff, 0.95);

      runeDots.forEach(dot => {
        if (dot && dot.active) {
          dot.setAlpha(1);
          dot.setFillStyle(0xddf6ff, 1);
          dot.setDepth(6);
        }
      });

      // ★ 발동 중 마법진 전체가 은은하게 맥동
      scene.tweens.add({
        targets: [outerCircle, middleCircle, innerCircle, centerStar],
        alpha: 0.55,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });

      // ★ 바깥 원은 계속 회전하면서 보이게 유지
      scene.tweens.add({
        targets: outerCircle,
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut'
      });

      // ★ 마법진 유지 시간 = 감속 판정 시간
      const magicCircleDuration = 5000;

      // 원래 속도 저장
      const slowSpeed = 110;

      // 이 마법진이 현재 플레이어에게 감속을 걸고 있는지
      let isSlowedByThisCircle = false;

      const applySlow = () => {
        if (!player.sprite || !player.sprite.active) return;

        // 첫 번째 마법진에 걸릴 때만 진짜 원래 속도 저장
        if (!isSlowedByThisCircle) {
          if (player._slowZoneCount == null) player._slowZoneCount = 0;

          // 감속 효과가 하나도 없을 때만 현재 속도를 저장
          // 이동속도 강화가 되어 있으면 그 강화된 속도가 저장됨
          if (player._slowZoneCount === 0) {
            player._speedBeforeSlowZone = player.speed;
          }

          player._slowZoneCount++;
          isSlowedByThisCircle = true;
        }

        const baseSpeed = player._speedBeforeSlowZone || player.speed;
        player.speed = Math.min(baseSpeed, slowSpeed);
        player.sprite.setTint(0x88ccff);
      };

      const releaseSlow = () => {
        if (!isSlowedByThisCircle) return;

        isSlowedByThisCircle = false;
        player._slowZoneCount = Math.max(0, (player._slowZoneCount || 0) - 1);

        // 모든 마법진 감속이 끝났을 때만 원래 속도로 복구
        if (player._slowZoneCount === 0) {
          if (player._speedBeforeSlowZone != null) {
            player.speed = player._speedBeforeSlowZone;
          }

          player._speedBeforeSlowZone = null;

          if (player.sprite && player.sprite.active) {
            player.sprite.clearTint();
          }
        }
      };

      const checkEvent = scene.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          if (!player.sprite || !player.sprite.active) return;

          const d = Phaser.Math.Distance.Between(
            player.sprite.x,
            player.sprite.y,
            x,
            y
          );

          if (d <= radius) {
            applySlow();
          } else {
            // 범위 밖으로 나가면 이 마법진의 감속만 해제
            releaseSlow();
          }
        }
      });

      scene.time.delayedCall(magicCircleDuration, () => {
        if (checkEvent) checkEvent.remove(false);

        // 마법진이 끝나면 이 마법진의 감속만 해제
        releaseSlow();

        scene.tweens.add({
          targets: magicCircleParts,
          alpha: 0,
          scaleX: 1.35,
          scaleY: 1.35,
          duration: 350,
          ease: 'Sine.Out',
          onComplete: () => {
            magicCircleParts.forEach(part => {
              if (part && part.active) part.destroy();
            });
          }
        });
      });
    });
  }

  // ──────────────────────────────────────────
  //  미니보스 2 / 최종보스: 블랙홀
  // ──────────────────────────────────────────
  castBlackhole() {
    const scene = this.scene;
    const player = scene.player;
    if (!player || !player.sprite) return;

    const x = player.sprite.x + Phaser.Math.Between(-120, 120);
    const y = player.sprite.y + Phaser.Math.Between(-90, 90);
    const radius = this.kind === 'final' ? 150 : 120;

    const hole = scene.add.circle(x, y, 20, 0x050010, 0.85)
      .setDepth(6)
      .setStrokeStyle(4, 0x8844ff, 0.9);

    scene.tweens.add({
      targets: hole,
      radius,
      duration: 600,
      ease: 'Sine.Out'
    });

    const pullEvent = scene.time.addEvent({
      delay: 50,
      repeat: 50,
      callback: () => {
        if (!hole.active || !player.sprite.active) return;

        const px = player.sprite.x;
        const py = player.sprite.y;
        const d = Phaser.Math.Distance.Between(px, py, x, y);

        if (d < radius + 80) {
          const angle = Phaser.Math.Angle.Between(px, py, x, y);
          player.sprite.body.velocity.x += Math.cos(angle) * 18;
          player.sprite.body.velocity.y += Math.sin(angle) * 18;
        }

        // 블랙홀 근처 플레이어 탄 제거
        if (player.bullets) {
          player.bullets.children.each(b => {
            if (!b.active) return;
            const bd = Phaser.Math.Distance.Between(b.x, b.y, x, y);
            if (bd < radius) b.destroy();
          });
        }
      }
    });

    // 사라질 때 폭발 탄막
    scene.time.delayedCall(2600, () => {
      if (pullEvent) pullEvent.remove(false);

      for (let i = 0; i < 20; i++) {
        const angle = Phaser.Math.DegToRad((360 / 20) * i);
        this._spawnBossBullet(x, y, angle, 145, 1.1);
      }

      scene.tweens.add({
        targets: hole,
        alpha: 0,
        scale: 1.5,
        duration: 300,
        onComplete: () => {
          if (hole.active) hole.destroy();
        }
      });
    });
  }

  // ──────────────────────────────────────────
  //  미니보스 3 / 최종보스: 분신 소환
  // ──────────────────────────────────────────
  summonClones() {
    const scene = this.scene;

    // 분신 소환 전 잠깐 멈추는 모션 (mini3 전용)
    if (this.kind === 'mini3') {
      this._stopTimer = 2.0;
      if (this.sprite?.active) {
        // 소환 예고: 약간 스케일 업 후 복귀
        scene.tweens.add({
          targets: this.sprite,
          scaleX: this._baseScale * 1.15,
          scaleY: this._baseScale * 1.15,
          duration: 200,
          yoyo: true,
          repeat: 2,
          ease: 'Sine.InOut'
        });
      }
    }

    this.cloneSprites.forEach(c => {
      if (c && c.active) c.destroy();
    });
    this.cloneSprites = [];

    const positions = [
      { x: this.sprite.x - 120, y: this.sprite.y + 40 },
      { x: this.sprite.x + 120, y: this.sprite.y + 40 }
    ];

    positions.forEach(pos => {
      const clone = scene.add.image(pos.x, pos.y, this.sprite.texture.key)
        .setDepth(3)
        .setAlpha(0.45)
        .setScale(this.sprite.scaleX * 0.85);

      scene.tweens.add({
        targets: clone,
        alpha: 0.75,
        duration: 300,
        yoyo: true,
        repeat: -1
      });

      this.cloneSprites.push(clone);
    });

    scene.time.delayedCall(4500, () => {
      this.cloneSprites.forEach(c => {
        if (c && c.active) {
          scene.tweens.add({
            targets: c,
            alpha: 0,
            duration: 250,
            onComplete: () => {
              if (c.active) c.destroy();
            }
          });
        }
      });
      this.cloneSprites = [];
    });
  }

  // ──────────────────────────────────────────
  //  미니보스 3: 순간이동
  // ──────────────────────────────────────────
  teleportNearPlayer() {
    const scene = this.scene;
    const player = scene.player;
    if (!player || !player.sprite) return;

    // 순간이동 직전 잠깐 멈춤
    this._stopTimer = 0.5;

    const oldX = this.sprite.x;
    const oldY = this.sprite.y;

    const flash1 = scene.add.circle(oldX, oldY, 50, 0xaa44ff, 0.45)
      .setDepth(5);

    scene.tweens.add({
      targets: flash1,
      alpha: 0,
      scale: 1.8,
      duration: 250,
      onComplete: () => flash1.destroy()
    });

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.Between(180, 260);

    this.sprite.x = player.sprite.x + Math.cos(angle) * dist;
    this.sprite.y = player.sprite.y + Math.sin(angle) * dist;

    const flash2 = scene.add.circle(this.sprite.x, this.sprite.y, 50, 0xaa44ff, 0.45)
      .setDepth(5);

    scene.tweens.add({
      targets: flash2,
      alpha: 0,
      scale: 1.8,
      duration: 250,
      onComplete: () => flash2.destroy()
    });
  }

  // ──────────────────────────────────────────
  //  미니보스 3 / 최종보스: 분신 조준탄
  // ──────────────────────────────────────────
  fireCloneShots() {
    const player = this.scene.player;
    if (!player || !player.sprite) return;

    this.cloneSprites.forEach(clone => {
      if (!clone || !clone.active) return;

      const angle = Phaser.Math.Angle.Between(
        clone.x,
        clone.y,
        player.sprite.x,
        player.sprite.y
      );

      this._spawnBossBullet(clone.x, clone.y, angle, 180, 1.1);
    });
  }

  // ──────────────────────────────────────────
  //  조준탄
  // ──────────────────────────────────────────
  fireAimedShots() {
    const player = this.scene.player;
    if (!player || !player.sprite) return;

    const base = Phaser.Math.Angle.Between(
      this.sprite.x,
      this.sprite.y,
      player.sprite.x,
      player.sprite.y
    );

    const spread = [-0.18, 0, 0.18];

    spread.forEach(off => {
      this._spawnBossBullet(
        this.sprite.x,
        this.sprite.y,
        base + off,
        this.kind === 'final' ? 210 : 180,
        1.15
      );
    });
  }

  // ──────────────────────────────────────────
  //  최종보스 Phase 2~3: 나선 탄막
  // ──────────────────────────────────────────
  fireSpiralPattern() {
    const count = this.phase === 3 ? 6 : 4;
    const speed = this.phase === 3 ? 190 : 160;

    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.DegToRad(this.angleOffset + i * (360 / count));
      this._spawnBossBullet(
        this.sprite.x,
        this.sprite.y,
        angle,
        speed,
        1.1
      );
    }

    this.angleOffset += this.phase === 3 ? 24 : 18;
  }

  // ──────────────────────────────────────────
  //  최종보스 Phase 2~3: 레이저 예고선
  // ──────────────────────────────────────────
  fireLaserWarning() {
    const scene = this.scene;
    const player = scene.player;
    if (!player || !player.sprite) return;

    const sx = this.sprite.x;
    const sy = this.sprite.y;

    const angle = Phaser.Math.Angle.Between(
      sx,
      sy,
      player.sprite.x,
      player.sprite.y
    );

    const length = 1200;
    const warning = scene.add.rectangle(
      sx + Math.cos(angle) * length / 2,
      sy + Math.sin(angle) * length / 2,
      length,
      8,
      0xff3333,
      0.35
    )
      .setDepth(7)
      .setRotation(angle);

    scene.tweens.add({
      targets: warning,
      alpha: 0.8,
      duration: 120,
      yoyo: true,
      repeat: 5
    });

    scene.time.delayedCall(800, () => {
      if (!warning.active) return;

      warning.setFillStyle(0xff0000, 0.9);
      warning.height = 22;

      // 레이저 맞았는지 판정
      const px = player.sprite.x;
      const py = player.sprite.y;

      const dist = Phaser.Geom.Line.GetShortestDistance(
        new Phaser.Geom.Line(
          sx,
          sy,
          sx + Math.cos(angle) * length,
          sy + Math.sin(angle) * length
        ),
        new Phaser.Geom.Point(px, py)
      );

      if (dist < 22) {
        player.takeDamage(this.phase === 3 ? 22 : 16);
        if (player.hp <= 0 && scene._triggerGameOver) {
          scene._triggerGameOver();
        }
      }

      scene.tweens.add({
        targets: warning,
        alpha: 0,
        duration: 250,
        onComplete: () => {
          if (warning.active) warning.destroy();
        }
      });
    });
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
    this.cloneSprites.forEach(c => {
      if (c && c.active) c.destroy();
    });
    this.cloneSprites = [];

    // 화면 중앙에 보스 이미지 오버레이
    const overlay = this.scene.add.image(480, 320, this.sprite.texture.key)
      .setAlpha(0).setDepth(50).setScrollFactor(0);
    this.scene.tweens.add({ targets: overlay, alpha: 0.6, duration: 200 });

    // 폭발 파티클
    const emitter = this.scene.add.particles(this.sprite.x, this.sprite.y, 'particle_star', {
      speed: { min: -200, max: 200 },
      scale: { start: 1.0, end: 0 },
      lifespan: 800,
      emitting: false
    });
    emitter.explode(40);

    this.scene.time.delayedCall(1400, () => {
      emitter.destroy();
      overlay.destroy();
      if (this.skill) this.emit('defeated', this.skill);
      else this.emit('defeated');
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
