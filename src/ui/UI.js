export default class UI {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.create();
  }

  create() {
    const s = this.scene;

    // ── 상단 HUD 다크 패널 (y 0–54) ──
    s.add.rectangle(480, 27, 960, 54, 0x000011, 0.88)
      .setScrollFactor(0).setDepth(40);

    // ── 하단 HUD 다크 패널 (y 596–640) ──
    s.add.rectangle(480, 618, 960, 44, 0x000011, 0.88)
      .setScrollFactor(0).setDepth(40);

    // ── 체력 (좌측 상단) ──
    this.hpText = s.add.text(10, 5, 'HP: 100', {
      fontSize: '20px', color: '#44ff88',
      stroke: '#000', strokeThickness: 4
    }).setDepth(43).setScrollFactor(0);

    // ── 레벨 (HP 오른쪽) ──
    this.levelText = s.add.text(220, 5, 'Lv.1', {
      fontSize: '20px', color: '#aaddff',
      stroke: '#000', strokeThickness: 4
    }).setDepth(43).setScrollFactor(0);

    // ── 타이머 (중앙 상단) ──
    this.timerText = s.add.text(480, 4, '10:00', {
      fontSize: '28px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5, 0).setDepth(43).setScrollFactor(0);

    // ── 경험치바 (상단 패널 하단 근처) ──
    this.expBarBg = s.add.rectangle(480, 44, 300, 10, 0x002211)
      .setScrollFactor(0).setDepth(41);
    this.expBar = s.add.rectangle(330, 44, 0, 8, 0x44ff88)
      .setOrigin(0, 0.5).setScrollFactor(0).setDepth(42);

    // ── 스킬 슬롯 Q / E / R (하단 패널, 균등 배치) ──
    this.skillSlots = {
      Q: this._makeSkillSlot(s, 10,  600, 'Q'),
      E: this._makeSkillSlot(s, 330, 600, 'E'),
      R: this._makeSkillSlot(s, 650, 600, 'R')
    };

    // ── 패시브 무기 아이콘 (하단 패널 우측) ──
    this.passiveIcons = {};
    const PASSIVE = [
      { key: 'fireball',  emoji: '🔥' },
      { key: 'lightning', emoji: '⚡' },
      { key: 'orbit',     emoji: '🌀' }
    ];
    PASSIVE.forEach(({ key, emoji }, i) => {
      const ix = 868 + i * 32;
      const icon  = s.add.text(ix, 606, emoji, { fontSize: '20px' })
        .setOrigin(0.5).setDepth(43).setScrollFactor(0).setAlpha(0.28);
      const lvTxt = s.add.text(ix, 626, '', {
        fontSize: '13px', color: '#ffffff',
        stroke: '#000', strokeThickness: 2
      }).setOrigin(0.5).setDepth(43).setScrollFactor(0);
      this.passiveIcons[key] = { icon, lvTxt };
    });

    // ── 결과 화면 ──
    this.resultOverlay = s.add.rectangle(480, 320, 520, 230, 0x000000, 0.85)
      .setScrollFactor(0).setDepth(100).setVisible(false);
    this.resultText = s.add.text(480, 295, '', {
      fontSize: '28px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000', strokeThickness: 5,
      align: 'center', lineSpacing: 10
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101).setVisible(false);
  }

  _makeSkillSlot(s, x, y, key) {
    const text = s.add.text(x, y, `${key}: -`, {
      fontSize: '17px', color: '#445566',
      stroke: '#000', strokeThickness: 3
    }).setScrollFactor(0).setDepth(43);
    return { text };
  }

  // ────────────────────────────────────────────
  update(gameTime) {
    const p = this.player;

    // 체력
    const hpRatio = p.hp / p.maxHp;
    const hpColor = hpRatio > 0.6 ? '#44ff88' : hpRatio > 0.3 ? '#ffcc00' : '#ff3333';
    this.hpText.setText(`HP  ${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`);
    this.hpText.setColor(hpColor);

    // 레벨 + 경험치바
    this.levelText.setText(`Lv.${p.level}`);
    this.expBar.width = 300 * (p.exp / p.expToNext);

    // 타이머
    const remain = Math.max(0, 600 - Math.floor(gameTime));
    const mm = String(Math.floor(remain / 60)).padStart(2, '0');
    const ss = String(remain % 60).padStart(2, '0');
    this.timerText.setText(`${mm}:${ss}`);
    this.timerText.setColor(remain <= 60 ? '#ff4444' : '#ffffff');

    // 스킬 슬롯
    for (const k of ['Q', 'E', 'C']) {
      const skill = p.skills[k];
      const cd    = p.skillCooldowns[k];
      let label;
      if (!skill) {
        label = `${k}: -`;
        this.skillSlots[k].text.setColor('#445566');
      } else if (cd > 0) {
        label = `${k}: ${skill.name} [${cd.toFixed(1)}s]`;
        this.skillSlots[k].text.setColor('#cc9944');
      } else {
        label = `${k}: ${skill.name} ✓`;
        this.skillSlots[k].text.setColor('#44ff88');
      }
      this.skillSlots[k].text.setText(label);
    }

    // 패시브 무기 아이콘
    for (const [key, { icon, lvTxt }] of Object.entries(this.passiveIcons)) {
      const w = p.getPassiveWeapon(key);
      if (w) {
        icon.setAlpha(1);
        lvTxt.setText(`Lv${w.level}`);
      } else {
        icon.setAlpha(0.28);
        lvTxt.setText('');
      }
    }
  }

  showSkillAcquired(skill) {
    const s = this.scene;
    const txt = s.add.text(480, 180, `✦ 스킬 흡수: ${skill.name} ✦`, {
      fontSize: '24px', fontStyle: 'bold', color: '#ffdd44',
      stroke: '#000', strokeThickness: 5
    }).setOrigin(0.5).setScrollFactor(0).setDepth(50);
    s.tweens.add({
      targets: txt, alpha: 0,
      duration: 1600, delay: 900,
      onComplete: () => txt.destroy()
    });
  }

  showResult(cleared, time, player) {
    this.resultOverlay.setVisible(true);
    this.resultText.setVisible(true);

    const mm = String(Math.floor(time / 60)).padStart(2, '0');
    const ss = String(Math.floor(time % 60)).padStart(2, '0');

    if (cleared) {
      this.resultText.setText(`🎉 클리어!\n생존 시간: ${mm}:${ss}\n레벨: ${player.level || 1}`);
      this.resultText.setColor('#44ff88');
    } else {
      this.resultText.setText(`💀 게임 오버\n생존 시간: ${mm}:${ss}\n레벨: ${player.level || 1}`);
      this.resultText.setColor('#ff6666');
    }

    this.scene.add.text(480, 415, 'SPACE 또는 버튼으로 재시작', {
      fontSize: '17px', color: '#aabbcc',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
  }

  flashDamage() { this.scene.cameras.main.flash(160, 255, 0, 0); }
}
