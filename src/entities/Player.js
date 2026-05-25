import Skill from './Skill.js';

export default class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.sprite = scene.physics.add.sprite(x, y, 'player').setDepth(2).setScale(0.08);
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

    this.skills = { Q: null, E: null, C: null };
    this.skillCooldowns = { Q: 0, E: 0, C: 0 };

    this.keyQ = scene.input.keyboard.addKey('Q');
    this.keyW = scene.input.keyboard.addKey('E');
    this.keyE = scene.input.keyboard.addKey('C');

    // 체력바 배경
    this.hpBarBg = scene.add.rectangle(x, y + 38, 42, 6, 0x000000)
      .setDepth(5);

    // 체력바
    this.hpBar = scene.add.rectangle(x, y + 38, 40, 4, 0x00ff66)
      .setDepth(6);

    // 경험치바 배경 (시간 아래)
    this.expBarBg = scene.add.rectangle(480, 42, 220, 10, 0x000000)
      .setScrollFactor(0)
      .setDepth(20);

    // 경험치바
    this.expBar = scene.add.rectangle(370, 42, 0, 8, 0x44ff88)
      .setOrigin(0, 0.5)
      .setScrollFactor(0)
      .setDepth(21);

    // 레벨 표시
    this.levelText = scene.add.text(
      255,
      34,
      `Lv.${this.level}`,
      {
        fontSize: '18px',
        color: '#44ff88',
        stroke: '#000',
        strokeThickness: 3
      }
    )
      .setScrollFactor(0)
      .setDepth(22);
  }

  update(dt, cursors, keys) {
    // 이동
    let vx = 0, vy = 0;
    if (cursors.left.isDown || keys.A.isDown) vx = -1;
    if (cursors.right.isDown || keys.D.isDown) vx = 1;
    if (cursors.up.isDown || keys.W.isDown) vy = -1;
    if (cursors.down.isDown || keys.S.isDown) vy = 1;

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
    for (const k of ['Q', 'E', 'C']) {
      if (this.skillCooldowns[k] > 0) {
        this.skillCooldowns[k] = Math.max(0, this.skillCooldowns[k] - dt);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyQ)) this.useSkill('Q');
    if (Phaser.Input.Keyboard.JustDown(this.keyW)) this.useSkill('E');
    if (Phaser.Input.Keyboard.JustDown(this.keyE)) this.useSkill('C');

    // 체력바 위치 갱신
    this.hpBarBg.setPosition(this.sprite.x, this.sprite.y + 38);
    this.hpBar.setPosition(
      this.sprite.x - (40 - (40 * (this.hp / this.maxHp))) / 2,
      this.sprite.y + 38
    );

    // 체력 비율
    this.hpBar.width = 40 * (this.hp / this.maxHp);

    // 체력 적을 때 색 변경
    if (this.hp < this.maxHp * 0.3) {
      this.hpBar.fillColor = 0xff3333;
    } else if (this.hp < this.maxHp * 0.6) {
      this.hpBar.fillColor = 0xffcc00;
    } else {
      this.hpBar.fillColor = 0x00ff66;
    }

    // 경험치바 갱신
    const ratio = this.exp / this.expToNext;

    this.expBar.width = 220 * ratio;

    // 레벨 텍스트 갱신
    this.levelText.setText(`Lv.${this.level}`);
  }

  // ★ 가장 가까운 적을 찾아 그쪽으로 발사 (뱀서라이크 자동 조준)
  fireAuto() {
    const me = this.sprite;

    let nearest = null;
    let minDist = Infinity;

    // 일반 적 탐색
    this.scene.enemyManager.group.children.each(enemy => {
      if (!enemy.active) return;

      const d = Phaser.Math.Distance.Between(
        me.x,
        me.y,
        enemy.x,
        enemy.y
      );

      if (d < minDist) {
        minDist = d;
        nearest = enemy;
      }
    });

    // 보스 탐색
    this.scene.enemyManager.bossGroup.children.each(enemy => {
      if (!enemy.active) return;

      const d = Phaser.Math.Distance.Between(
        me.x,
        me.y,
        enemy.x,
        enemy.y
      );

      if (d < minDist) {
        minDist = d;
        nearest = enemy;
      }
    });

    // 적 없으면 공격 안 함
    if (!nearest) return;

    // 방향 계산
    const angle = Phaser.Math.Angle.Between(
      me.x,
      me.y,
      nearest.x,
      nearest.y
    );

    // 총알 생성
    const bullet = this.scene.physics.add.image(
      me.x,
      me.y,
      'bullet'
    );

    bullet.isPlayerBullet = true;

    // 총알 회전
    bullet.setRotation(angle);

    // 총알 크기
    bullet.setScale(1.2);

    // 총알 속도
    const speed = 700;

    bullet.body.velocity.x = Math.cos(angle) * speed;
    bullet.body.velocity.y = Math.sin(angle) * speed;

    // 그룹 추가
    this.bullets.add(bullet);

    // 총구 이펙트
    this.scene.tweens.add({
      targets: bullet,
      scaleX: 1,
      scaleY: 1,
      duration: 100
    });
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
    for (const k of ['Q', 'E', 'C']) {
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
