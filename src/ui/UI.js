export default class UI {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.create();
  }

  create() {
    const s = this.scene;

    // ── 체력 표시 ──
    this.hpText = s.add.text(12, 12, 'HP: 100', {
      fontSize: '16px', color: '#ff6688',
      stroke: '#000', strokeThickness: 3
    }).setDepth(20).setScrollFactor(0);

    // ── 타이머 (중앙 상단) ──
    this.timerText = s.add.text(480, 12, '10:00', {
      fontSize: '20px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000', strokeThickness: 3
    }).setOrigin(0.5, 0).setDepth(20).setScrollFactor(0);

    // ── 스킬 슬롯 (Q / E / C) — 하단 ──
    this.skillSlots = {
      Q: this._makeSkillSlot(s, 16, 596, 'Q'),
      E: this._makeSkillSlot(s, 180, 596, 'E'),
      C: this._makeSkillSlot(s, 344, 596, 'C')
    };

    // ── 패시브 무기 HUD (우측 하단) ──
    this.passiveIcons = {};
    const passiveTypes = [
      { key: 'fireball', label: '🔥', color: '#ff6600', x: 920 },
      { key: 'lightning', label: '⚡', color: '#aaddff', x: 895 },
      { key: 'orbit', label: '🌀', color: '#00aaff', x: 870 }
    ];
    passiveTypes.forEach(({ key, label, color, x }, i) => {
      const icon = s.add.text(920 - i * 34, 612, label, {
        fontSize: '16px', color: '#666'
      }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
      const lvTxt = s.add.text(920 - i * 34, 628, '', {
        fontSize: '11px', color
      }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
      this.passiveIcons[key] = { icon, lvTxt };
    });

    // ── 결과 화면 (게임 오버 / 클리어) ──
    this.resultOverlay = s.add.rectangle(480, 320, 500, 200, 0x000000, 0.8)
      .setScrollFactor(0).setDepth(29).setVisible(false);
    this.resultText = s.add.text(480, 300, '', {
      fontSize: '26px', fontStyle: 'bold', color: '#ffffff',
      stroke: '#000', strokeThickness: 4,
      align: 'center', lineSpacing: 8
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30).setVisible(false);
  }

  _makeSkillSlot(s, x, y, key) {
    const bg = s.add.rectangle(x + 70, y + 12, 140, 24, 0x112233, 0.85)
      .setScrollFactor(0).setDepth(19);

    const text = s.add.text(x + 6, y + 2, `${key}: -`, {
      fontSize: '13px',
      color: '#44cc88',
      stroke: '#000',
      strokeThickness: 2
    }).setScrollFactor(0).setDepth(20);

    return { bg, text };
  }

  // ────────────────────────────────────────────
  update(gameTime) {
    const p = this.player;

    // 체력
    const hpRatio = p.hp / p.maxHp;
    const hpColor = hpRatio > 0.6 ? '#44ff88' : hpRatio > 0.3 ? '#ffcc00' : '#ff3333';
    this.hpText.setText(`HP  ${Math.max(0, Math.ceil(p.hp))} / ${p.maxHp}`);
    this.hpText.setColor(hpColor);

    // 타이머
    const remain = Math.max(0, 600 - Math.floor(gameTime));
    const mm = String(Math.floor(remain / 60)).padStart(2, '0');
    const ss = String(remain % 60).padStart(2, '0');
    this.timerText.setText(`${mm}:${ss}`);
    // 1분 이하 경고 색상
    this.timerText.setColor(remain <= 60 ? '#ff4444' : '#ffffff');

    // 스킬 슬롯
    for (const k of ['Q', 'E', 'C']) {
      const skill = p.skills[k];
      const cd = p.skillCooldowns[k];
      let text;
      if (!skill) {
        text = `${k}: -`;
        this.skillSlots[k].text.setColor('#556677');
      } else if (cd > 0) {
        text = `${k}: [${cd.toFixed(1)}s]`;
        this.skillSlots[k].text.setColor('#aa8844');
      } else {
        text = `${k}: ${skill.name}`;
        this.skillSlots[k].text.setColor('#44ff88');
      }
      this.skillSlots[k].text.setText(text);
    }

    // 패시브 무기 아이콘
    for (const [key, { icon, lvTxt }] of Object.entries(this.passiveIcons)) {
      const w = p.getPassiveWeapon(key);
      if (w) {
        icon.setColor('#ffffff');
        lvTxt.setText(`Lv${w.level}`);
      } else {
        icon.setColor('#444444');
        lvTxt.setText('');
      }
    }
  }

  showSkillAcquired(skill) {
    const s = this.scene;
    const txt = s.add.text(480, 180, `✦ 스킬 흡수: ${skill.name} ✦`, {
      fontSize: '22px', fontStyle: 'bold', color: '#ffdd44',
      stroke: '#000', strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(40);
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
      this.resultText.setText(
        `🎉 클리어!\n생존 시간: ${mm}:${ss}\n레벨: ${player.level || 1}`
      );
      this.resultText.setColor('#44ff88');
    } else {
      this.resultText.setText(
        `💀 게임 오버\n생존 시간: ${mm}:${ss}\n레벨: ${player.level || 1}`
      );
      this.resultText.setColor('#ff6666');
    }

    this.scene.add.text(480, 390, 'SPACE 또는 버튼으로 재시작', {
      fontSize: '15px', color: '#aabbcc',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30);
  }

  flashDamage() { this.scene.cameras.main.flash(160, 255, 0, 0); }
}
