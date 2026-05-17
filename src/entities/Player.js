import Skill from './Skill.js';

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player').setDepth(2).setScale(0.3);
    this.sprite.setCollideWorldBounds(true);

    this.hp = 100;
    this.maxHp = 100;
    this.attackPower = 10;
    this.speed = 200;
    this.attackRate = 0.5;
    this.attackTimer = 0;

    this.bullets = scene.physics.add.group();
    this.level = 1;
    this.exp = 0;
    this.expToNext = 20;

    this.skills = { Q: null, W: null, E: null };
    this.skillCooldowns = { Q: 0, W: 0, E: 0 };

    this.keyQ = scene.input.keyboard.addKey('Q');
    this.keyW = scene.input.keyboard.addKey('W');
    this.keyE = scene.input.keyboard.addKey('E');
  }

  update(dt, cursors, keys) {
    // 이동
    let vx = 0, vy = 0;
    if (cursors.left.isDown  || keys.A.isDown) vx = -1;
    if (cursors.right.isDown || keys.D.isDown) vx =  1;
    if (cursors.up.isDown    || keys.W.isDown) vy = -1;
    if (cursors.down.isDown  || keys.S.isDown) vy =  1;

    const slow = keys.SHIFT && keys.SHIFT.isDown;
    const spd = slow ? this.speed * 0.5 : this.speed;
    const len = Math.hypot(vx, vy) || 1;
    this.sprite.setVelocity((vx / len) * spd, (vy / len) * spd);

    // 자동공격
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.fireAuto();
      this.attackTimer = this.attackRate;
    }

    // ★ 플레이어로부터 멀어진 총알 정리 (월드 좌표 기준)
    this.bullets.children.each(b => {
      if (!b.active) return;
      const d = Phaser.Math.Distance.Between(b.x, b.y, this.sprite.x, this.sprite.y);
      if (d > 800) b.destroy();
    });

    // 쿨다운
    for (const k of ['Q', 'W', 'E']) {
      if (this.skillCooldowns[k] > 0) {
        this.skillCooldowns[k] = Math.max(0, this.skillCooldowns[k] - dt);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyQ)) this.useSkill('Q');
    if (Phaser.Input.Keyboard.JustDown(this.keyW)) this.useSkill('W');
    if (Phaser.Input.Keyboard.JustDown(this.keyE)) this.useSkill('E');
  }

  // ★ 가장 가까운 적을 찾아 그쪽으로 발사 (뱀서라이크 자동 조준)
  fireAuto() {
    const me = this.sprite;
    let nearest = null;
    let minDist = Infinity;

    // 일반 적 검색
    const enemies = this.scene.enemyManager.group.getChildren();
    for (const e of enemies) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(me.x, me.y, e.x, e.y);
      if (d < minDist) { minDist = d; nearest = e; }
    }
    // 보스도 검색 대상
    const bosses = this.scene.enemyManager.bossGroup.getChildren();
    for (const e of bosses) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.Between(me.x, me.y, e.x, e.y);
      if (d < minDist) { minDist = d; nearest = e; }
    }

    if (!nearest) return; // 사거리 내 적 없으면 발사 안 함

    const angle = Phaser.Math.Angle.Between(me.x, me.y, nearest.x, nearest.y);
    const b = this.scene.add.image(me.x, me.y, 'bullet');
    b.isPlayerBullet = true;
    this.scene.physics.world.enable(b);
    const speed = 500;
    b.body.velocity.x = Math.cos(angle) * speed;
    b.body.velocity.y = Math.sin(angle) * speed;
    this.bullets.add(b);
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) this.hp = 0;
    this.scene.cameras.main.flash(200, 255, 0, 0);
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
    this.expToNext = Math.floor(this.expToNext * 1.4);
    const choices = [
      () => { this.attackPower += 2; },
      () => { this.attackRate = Math.max(0.1, this.attackRate - 0.05); },
      () => { this.maxHp += 10; this.hp += 10; }
    ];
    const idx = Phaser.Math.Between(0, choices.length - 1);
    choices[idx]();
  }

  acquireSkill(skillData) {
    for (const k of ['Q', 'W', 'E']) {
      if (!this.skills[k]) {
        this.skills[k] = new Skill(this.scene, skillData);
        return;
      }
    }
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
