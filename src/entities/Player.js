import Skill from './Skill.js';
import FireballWeapon  from './weapons/FireballWeapon.js';
import LightningWeapon from './weapons/LightningWeapon.js';
import OrbitWeapon     from './weapons/OrbitWeapon.js';

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;

    this.sprite = scene.physics.add.sprite(x, y, 'player')
      .setDepth(2)
      .setScale(0.08);
    this.sprite.setCollideWorldBounds(true);

    // ── 기본 스탯 ──
    this.hp          = 100;
    this.maxHp       = 100;
    this.attackPower = 10;
    this.speed       = 200;
    this.attackRate  = 0.5;   // 초당 발사 간격 (초)
    this.attackTimer = 0;
    this.bulletCount = 1;     // 다중 발사 수 (레벨업 카드로 증가)

    // ── 총알 그룹 (physics group → group.create() 패턴 사용) ──
    this.bullets = scene.physics.add.group({
      maxSize: 120,
      runChildUpdate: false
    });

    // ── 레벨 / 경험치 ──
    this.level    = 1;
    this.exp      = 0;
    this.expToNext = 20;

    // ── 액티브 스킬 (보스 흡수) Q / E / R ──
    this.skills       = { Q: null, E: null, R: null };
    this.skillCooldowns = { Q: 0, E: 0, R: 0 };

    // 스킬 키 (Q, E, R)
    this.keyQ = scene.input.keyboard.addKey('Q');
    this.keyE = scene.input.keyboard.addKey('E');
    this.keyR = scene.input.keyboard.addKey('R');

    // ── 패시브 무기 목록 ──
    this.passiveWeapons = [];

    // ── HUD: 체력바 ──
    this.hpBarBg = scene.add.rectangle(x, y + 38, 42, 6, 0x000000).setDepth(5);
    this.hpBar   = scene.add.rectangle(x, y + 38, 40, 4, 0x00ff66).setDepth(6);

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

    // 무적 타이머 (적 접촉 데미지 쿨다운)
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

    // 무적 타이머 감소
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
  }

  // ────────────────────────────────────────────
  //  이동
  // ────────────────────────────────────────────
  _handleMovement(dt, cursors, keys) {
    let vx = 0, vy = 0;
    if (cursors.left.isDown  || keys.A.isDown) vx = -1;
    if (cursors.right.isDown || keys.D.isDown) vx = 1;
    if (cursors.up.isDown    || keys.W.isDown) vy = -1;
    if (cursors.down.isDown  || keys.S.isDown) vy = 1;

    const slow = keys.SHIFT && keys.SHIFT.isDown;
    const spd  = slow ? this.speed * 0.5 : this.speed;
    const len  = Math.hypot(vx, vy) || 1;
    this.sprite.setVelocity((vx / len) * spd, (vy / len) * spd);
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

  /** 가장 가까운 적을 향해 bulletCount 발 자동 발사 */
  fireAuto() {
    const me = this.sprite;

    // 가장 가까운 적 탐색
    let nearest = null;
    let minDist = Infinity;

    const checkTarget = (enemy) => {
      if (!enemy.active) return;
      const d = Phaser.Math.Distance.Between(me.x, me.y, enemy.x, enemy.y);
      if (d < minDist) { minDist = d; nearest = enemy; }
    };

    this.scene.enemyManager.group.children.each(checkTarget);
    this.scene.enemyManager.bossGroup.children.each(checkTarget);

    if (!nearest) return;

    const baseAngle = Phaser.Math.Angle.Between(me.x, me.y, nearest.x, nearest.y);

    // 다중 발사 spread 각도 (±5° per extra bullet)
    const spread = this._spreadAngles(this.bulletCount);
    for (const offset of spread) {
      this._spawnBullet(me.x, me.y, baseAngle + offset);
    }
  }

  _spawnBullet(x, y, angle) {
    // ★ group.create() 사용 — physics.add.image() + group.add() 패턴 제거
    const bullet = this.bullets.create(x, y, 'bullet');
    if (!bullet) return;

    bullet.setActive(true).setVisible(true);
    bullet.setDepth(10);
    bullet.isPlayerBullet = true;
    bullet.setScale(1.3);
    bullet.rotation = angle;

    const speed = 700;
    bullet.body.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed
    );
  }

  _spreadAngles(count) {
    if (count === 1) return [0];
    if (count === 2) return [-0.087, 0.087]; // ±5°
    return [-0.174, 0, 0.174];               // ±10°
  }

  // ────────────────────────────────────────────
  //  총알 정리
  // ────────────────────────────────────────────
  _cleanupBullets() {
    const me = this.sprite;
    this.bullets.children.each(b => {
      if (!b.active) return;
      const d = Phaser.Math.Distance.Between(b.x, b.y, me.x, me.y);
      if (d > 900) b.destroy();
    });
  }

  // ────────────────────────────────────────────
  //  스킬 키 처리
  // ────────────────────────────────────────────
  _handleSkillKeys() {
    if (Phaser.Input.Keyboard.JustDown(this.keyQ)) this.useSkill('Q');
    if (Phaser.Input.Keyboard.JustDown(this.keyE)) this.useSkill('E');
    if (Phaser.Input.Keyboard.JustDown(this.keyR)) this.useSkill('R');
  }

  _updateCooldowns(dt) {
    for (const k of ['Q', 'E', 'R']) {
      if (this.skillCooldowns[k] > 0) {
        this.skillCooldowns[k] = Math.max(0, this.skillCooldowns[k] - dt);
      }
    }
  }

  // ────────────────────────────────────────────
  //  패시브 무기
  // ────────────────────────────────────────────
  _updatePassiveWeapons(dt) {
    for (const w of this.passiveWeapons) w.update(dt);
  }

  /** 패시브 무기 추가 또는 레벨업 */
  addOrUpgradePassiveWeapon(type) {
    const existing = this.passiveWeapons.find(w => w.type === type);
    if (existing) {
      existing.levelUp();
    } else {
      let weapon;
      if (type === 'fireball')  weapon = new FireballWeapon(this.scene, this);
      if (type === 'lightning') weapon = new LightningWeapon(this.scene, this);
      if (type === 'orbit')     weapon = new OrbitWeapon(this.scene, this);
      if (weapon) this.passiveWeapons.push(weapon);
    }
  }

  getPassiveWeapon(type) {
    return this.passiveWeapons.find(w => w.type === type) || null;
  }

  // ────────────────────────────────────────────
  //  HUD 갱신
  // ────────────────────────────────────────────
  _updateHUD() {
    const me = this.sprite;

    // 체력바 위치
    this.hpBarBg.setPosition(me.x, me.y + 38);
    this.hpBar.setPosition(
      me.x - (40 - 40 * (this.hp / this.maxHp)) / 2,
      me.y + 38
    );
    this.hpBar.width = 40 * (this.hp / this.maxHp);

    // 체력 색상
    if (this.hp < this.maxHp * 0.3)      this.hpBar.fillColor = 0xff3333;
    else if (this.hp < this.maxHp * 0.6) this.hpBar.fillColor = 0xffcc00;
    else                                  this.hpBar.fillColor = 0x00ff66;

    // 경험치바
    this.expBar.width = 220 * (this.exp / this.expToNext);

    // 레벨 텍스트
    this.levelText.setText(`Lv.${this.level}`);
  }

  // ────────────────────────────────────────────
  //  데미지 / 경험치 / 레벨업
  // ────────────────────────────────────────────
  takeDamage(amount) {
    if (this.invincibleTimer > 0) return; // 무적 중
    this.hp -= amount;
    if (this.hp < 0) this.hp = 0;
    this.scene.cameras.main.flash(160, 255, 0, 0);
    this.invincibleTimer = 0.5; // 0.5초 무적
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
      this.sprite.x, this.sprite.y - 60,
      `LEVEL UP! ${this.level}`,
      { fontSize: '24px', color: '#44ff88', stroke: '#000', strokeThickness: 4 }
    ).setOrigin(0.5).setDepth(50);

    this.scene.tweens.add({
      targets: txt, y: txt.y - 40, alpha: 0,
      duration: 1200,
      onComplete: () => txt.destroy()
    });
  }

  // ────────────────────────────────────────────
  //  액티브 스킬 (보스 흡수)
  // ────────────────────────────────────────────
  acquireSkill(skillData) {
    // 빈 슬롯 Q → E → R 순서로 채움
    for (const k of ['Q', 'E', 'R']) {
      if (!this.skills[k]) {
        this.skills[k] = new Skill(this.scene, skillData);
        return;
      }
    }
    // 모든 슬롯이 찼으면 Q를 덮어씀
    this.skills['Q'] = new Skill(this.scene, skillData);
  }

  useSkill(slotKey) {
    const skill = this.skills[slotKey];
    if (!skill) return;
    if (this.skillCooldowns[slotKey] > 0) return;
    skill.activate(this);
    this.skillCooldowns[slotKey] = skill.cooldown;
    if (skill.uses !== undefined) {
      skill.uses--;
      if (skill.uses <= 0) this.skills[slotKey] = null;
    }
  }
}
