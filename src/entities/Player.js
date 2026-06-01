import Skill from './Skill.js';
import FireballWeapon  from './weapons/FireballWeapon.js';
import LightningWeapon from './weapons/LightningWeapon.js';
import OrbitWeapon     from './weapons/OrbitWeapon.js';

// ── 플레이어 표시 크기 (이미지 실제 크기와 무관하게 고정) ──
export const PLAYER_DISPLAY_SIZE = 60;

// ── 4방향 애니메이션 프레임 (텍스처 키 배열) ──
const ANIMATIONS = {
  down:  ['player_down_idle', 'player_down_r1', 'player_down_r2',
          'player_down_idle', 'player_down_l1', 'player_down_l2'],
  up:    ['player_up_idle',   'player_up_r1',   'player_up_r2',
          'player_up_idle',   'player_up_l1',   'player_up_l2'],
  right: ['player_side_idle', 'player_side_r1', 'player_side_r2', 'player_side_r1'],
  left:  ['player_side_idle', 'player_side_r1', 'player_side_r2', 'player_side_r1'],
};

const IDLE_TEXTURES = {
  down:  'player_down_idle',
  up:    'player_up_idle',
  right: 'player_side_idle',
  left:  'player_side_idle',
};

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;

    // 애니메이션 이미지가 로드됐으면 사용, 아니면 player1.png 폴백
    const initTex = scene.textures.exists('player_down_idle')
      ? 'player_down_idle'
      : 'player';

    this.sprite = scene.physics.add.sprite(x, y, initTex)
      .setDepth(2)
      .setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE);
    this.sprite.setCollideWorldBounds(true);

    // ── 기본 스탯 ──
    this.hp          = 100;
    this.maxHp       = 100;
    this.attackPower = 10;
    this.speed       = 200;
    this.attackRate  = 0.5;
    this.attackTimer = 0;
    this.bulletCount = 1;

    // ── 총알 그룹 ──
    this.bullets = scene.physics.add.group({
      maxSize: 120,
      runChildUpdate: false
    });

    // ── 레벨 / 경험치 ──
    this.level     = 1;
    this.exp       = 0;
    this.expToNext = 20;

    // ── 액티브 스킬 (Q / E / C) ──
    this.skills         = { Q: null, E: null, C: null };
    this.skillCooldowns = { Q: 0, E: 0, C: 0 };

    this.keyQ = scene.input.keyboard.addKey('Q');
    this.keyE = scene.input.keyboard.addKey('E');
    this.keyC = scene.input.keyboard.addKey('C');

    // ── 패시브 무기 ──
    this.passiveWeapons = [];

    // ── 4방향 애니메이션 상태 ──
    this.direction     = 'down';
    this.frameIndex    = 0;
    this.frameTimer    = 0;
    this.frameInterval = 0.12; // 초 (약 8fps)

    // ── HUD: 체력바 ──
    const hpY = PLAYER_DISPLAY_SIZE / 2 + 8;
    this.hpBarBg = scene.add.rectangle(x, y + hpY, 42, 6, 0x000000).setDepth(5);
    this.hpBar   = scene.add.rectangle(x, y + hpY, 40, 4, 0x00ff66).setDepth(6);

    // ── HUD: 경험치바 (화면 고정) ──
    this.expBarBg = scene.add.rectangle(480, 42, 220, 10, 0x000000)
      .setScrollFactor(0).setDepth(20);
    this.expBar   = scene.add.rectangle(370, 42, 0, 8, 0x44ff88)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(21);

    // ── HUD: 레벨 텍스트 ──
    this.levelText = scene.add.text(255, 34, `Lv.${this.level}`, {
      fontSize: '18px', color: '#44ff88',
      stroke: '#000', strokeThickness: 3
    }).setScrollFactor(0).setDepth(22);

    // 무적 타이머
    this.invincibleTimer = 0;
  }

  // ────────────────────────────────────────────
  //  메인 업데이트
  // ────────────────────────────────────────────
  update(dt, cursors, keys) {
    this._handleMovement(dt, cursors, keys);
    this._handleAutoAttack(dt);
    this._cleanupBullets();
    this._handleSkillKeys();
    this._updateCooldowns(dt);
    this._updatePassiveWeapons(dt);
    this._updateHUD();
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
  }

  // ────────────────────────────────────────────
  //  이동 + 4방향 애니메이션
  // ────────────────────────────────────────────
  _handleMovement(dt, cursors, keys) {
    let dx = 0, dy = 0;
    if (cursors.left.isDown  || keys.A.isDown) dx -= 1;
    if (cursors.right.isDown || keys.D.isDown) dx += 1;
    if (cursors.up.isDown    || keys.W.isDown) dy -= 1;
    if (cursors.down.isDown  || keys.S.isDown) dy += 1;

    const isMoving = dx !== 0 || dy !== 0;
    const slow     = keys.SHIFT && keys.SHIFT.isDown;
    const spd      = slow ? this.speed * 0.5 : this.speed;

    if (isMoving) {
      const len = Math.hypot(dx, dy);
      this.sprite.setVelocity((dx / len) * spd, (dy / len) * spd);

      // 방향 결정: 좌우 우선 (대각선 이동 시)
      if      (dx > 0) this._changeDirection('right');
      else if (dx < 0) this._changeDirection('left');
      else if (dy < 0) this._changeDirection('up');
      else             this._changeDirection('down');

      this._animateStep(dt);
    } else {
      this.sprite.setVelocity(0, 0);
      // 정지 → 현재 방향의 idle 프레임으로 리셋
      this.frameIndex = 0;
      this.frameTimer = 0;
      this._applyTexture(IDLE_TEXTURES[this.direction]);
    }
  }

  /** 방향이 바뀔 때 프레임 리셋 */
  _changeDirection(newDir) {
    if (this.direction === newDir) return;
    this.direction  = newDir;
    this.frameIndex = 0;
    this.frameTimer = 0;
    this._applyTexture(IDLE_TEXTURES[newDir]);
  }

  /** 이동 중 프레임 전진 */
  _animateStep(dt) {
    const frames = ANIMATIONS[this.direction];
    this.frameTimer += dt;
    if (this.frameTimer >= this.frameInterval) {
      this.frameTimer = 0;
      this.frameIndex = (this.frameIndex + 1) % frames.length;
      this._applyTexture(frames[this.frameIndex]);
    }
  }

  /**
   * 텍스처 교체 + DisplaySize 유지 + flipX 적용
   * setTexture() 호출 시 내부적으로 width/height 가 리셋되므로
   * setDisplaySize 로 항상 일정한 표시 크기를 보장한다.
   */
  _applyTexture(key) {
    const tex = this.scene.textures.exists(key) ? key : 'player';
    if (this.sprite.texture.key !== tex) {
      this.sprite.setTexture(tex)
        .setDisplaySize(PLAYER_DISPLAY_SIZE, PLAYER_DISPLAY_SIZE);
    }
    // 왼쪽 이동 시 오른쪽 측면 이미지를 수평 반전
    this.sprite.setFlipX(this.direction === 'left');
  }

  // ────────────────────────────────────────────
  //  자동 공격
  // ────────────────────────────────────────────
  _handleAutoAttack(dt) {
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.fireAuto();
      this.attackTimer = this.attackRate;
    }
  }

  fireAuto() {
    const me = this.sprite;
    let nearest = null, minDist = Infinity;

    const check = (e) => {
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(me.x, me.y, e.x, e.y);
      if (d < minDist) { minDist = d; nearest = e; }
    };
    this.scene.enemyManager.group.children.each(check);
    this.scene.enemyManager.bossGroup.children.each(check);

    if (!nearest) return;

    const base   = Phaser.Math.Angle.Between(me.x, me.y, nearest.x, nearest.y);
    const spread = this._spreadAngles(this.bulletCount);
    for (const off of spread) this._spawnBullet(me.x, me.y, base + off);
  }

  _spawnBullet(x, y, angle) {
    const b = this.bullets.create(x, y, 'bullet');
    if (!b) return;
    b.setActive(true).setVisible(true).setDepth(10).setScale(1.3);
    b.isPlayerBullet = true;
    b.rotation = angle;
    b.body.setVelocity(Math.cos(angle) * 700, Math.sin(angle) * 700);
  }

  _spreadAngles(count) {
    if (count === 1) return [0];
    if (count === 2) return [-0.087, 0.087];
    return [-0.174, 0, 0.174];
  }

  _cleanupBullets() {
    const { x, y } = this.sprite;
    this.bullets.children.each(b => {
      if (b.active && Phaser.Math.Distance.Between(b.x, b.y, x, y) > 900) b.destroy();
    });
  }

  // ────────────────────────────────────────────
  //  스킬 / 쿨다운
  // ────────────────────────────────────────────
  _handleSkillKeys() {
    if (Phaser.Input.Keyboard.JustDown(this.keyQ)) this.useSkill('Q');
    if (Phaser.Input.Keyboard.JustDown(this.keyE)) this.useSkill('E');
    if (Phaser.Input.Keyboard.JustDown(this.keyC)) this.useSkill('C');
  }

  _updateCooldowns(dt) {
    for (const k of ['Q', 'E', 'C']) {
      if (this.skillCooldowns[k] > 0)
        this.skillCooldowns[k] = Math.max(0, this.skillCooldowns[k] - dt);
    }
  }

  // ────────────────────────────────────────────
  //  패시브 무기
  // ────────────────────────────────────────────
  _updatePassiveWeapons(dt) {
    for (const w of this.passiveWeapons) w.update(dt);
  }

  addOrUpgradePassiveWeapon(type) {
    const existing = this.passiveWeapons.find(w => w.type === type);
    if (existing) {
      existing.levelUp();
    } else {
      let w;
      if (type === 'fireball')  w = new FireballWeapon(this.scene, this);
      if (type === 'lightning') w = new LightningWeapon(this.scene, this);
      if (type === 'orbit')     w = new OrbitWeapon(this.scene, this);
      if (w) this.passiveWeapons.push(w);
    }
  }

  getPassiveWeapon(type) {
    return this.passiveWeapons.find(w => w.type === type) || null;
  }

  // ────────────────────────────────────────────
  //  HUD
  // ────────────────────────────────────────────
  _updateHUD() {
    const { x, y } = this.sprite;
    const hpY = y + PLAYER_DISPLAY_SIZE / 2 + 8;

    this.hpBarBg.setPosition(x, hpY);
    this.hpBar.setPosition(x - (40 - 40 * (this.hp / this.maxHp)) / 2, hpY);
    this.hpBar.width = 40 * (this.hp / this.maxHp);

    if (this.hp < this.maxHp * 0.3)      this.hpBar.fillColor = 0xff3333;
    else if (this.hp < this.maxHp * 0.6) this.hpBar.fillColor = 0xffcc00;
    else                                  this.hpBar.fillColor = 0x00ff66;

    this.expBar.width = 220 * (this.exp / this.expToNext);
    this.levelText.setText(`Lv.${this.level}`);
  }

  // ────────────────────────────────────────────
  //  데미지 / 경험치 / 레벨업
  // ────────────────────────────────────────────
  takeDamage(amount) {
    if (this.invincibleTimer > 0) return;
    this.hp -= amount;
    if (this.hp < 0) this.hp = 0;
    this.scene.cameras.main.flash(160, 255, 0, 0);
    this.invincibleTimer = 0.5;
  }

  gainExp(amount) {
    this.exp += amount;
    while (this.exp >= this.expToNext) {
      this.exp -= this.expToNext;
      this.levelUp();
    }
  }

  levelUp() {
    this.level++;
    this.expToNext = Math.floor(this.expToNext * 1.35);
    this.scene.showLevelUpCards();
    this.scene.cameras.main.flash(200, 100, 255, 100);

    const txt = this.scene.add.text(
      this.sprite.x, this.sprite.y - 70,
      `LEVEL UP! ${this.level}`,
      { fontSize: '24px', color: '#44ff88', stroke: '#000', strokeThickness: 4 }
    ).setOrigin(0.5).setDepth(50);

    this.scene.tweens.add({
      targets: txt, y: txt.y - 40, alpha: 0,
      duration: 1200, onComplete: () => txt.destroy()
    });
  }

  acquireSkill(skillData) {
    for (const k of ['Q', 'E', 'C']) {
      if (!this.skills[k]) { this.skills[k] = new Skill(this.scene, skillData); return; }
    }
    this.skills['Q'] = new Skill(this.scene, skillData);
  }

  useSkill(slotKey) {
    const skill = this.skills[slotKey];
    if (!skill || this.skillCooldowns[slotKey] > 0) return;
    skill.activate(this);
    this.skillCooldowns[slotKey] = skill.cooldown;
    if (skill.uses !== undefined && --skill.uses <= 0) this.skills[slotKey] = null;
  }
}
