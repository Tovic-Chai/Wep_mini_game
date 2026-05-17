export default class UI {
  constructor(scene, player) {
    this.scene = scene;
    this.player = player;
    this.create();
  }

  create() {
    const s = this.scene;
    this.hpText    = s.add.text(12, 12, 'HP: 100', { fontSize:'16px', color:'#fff' }).setDepth(20).setScrollFactor(0);
    this.timerText = s.add.text(420, 12, '10:00',  { fontSize:'18px', color:'#fff' }).setDepth(20).setScrollFactor(0);
    this.skillIcons = {
      Q: s.add.text(12,  600, 'Q: -', { fontSize:'14px', color:'#0f0' }).setDepth(20).setScrollFactor(0),
      W: s.add.text(120, 600, 'W: -', { fontSize:'14px', color:'#0f0' }).setDepth(20).setScrollFactor(0),
      E: s.add.text(228, 600, 'E: -', { fontSize:'14px', color:'#0f0' }).setDepth(20).setScrollFactor(0)
    };
    this.resultText = s.add.text(240, 260, '', { fontSize:'28px', color:'#fff', align:'center' }).setDepth(30).setVisible(false);
  }

  update(gameTime) {
    this.hpText.setText(`HP: ${Math.max(0, Math.floor(this.player.hp))}`);
    const remain = Math.max(0, 600 - Math.floor(gameTime));
    const mm = String(Math.floor(remain / 60)).padStart(2, '0');
    const ss = String(remain % 60).padStart(2, '0');
    this.timerText.setText(`${mm}:${ss}`);
    for (const k of ['Q', 'W', 'E']) {
      const s = this.player.skills[k];
      this.skillIcons[k].setText(`${k}: ${s ? s.name : '-'}`);
    }
  }

  showSkillAcquired(skill) {
    const s = this.scene;
    const txt = s.add.text(240, 200, `획득: ${skill.name}`, { fontSize:'22px', color:'#ff0' }).setDepth(40);
    s.tweens.add({ targets: txt, alpha: 0, duration: 1600, delay: 900, onComplete: () => txt.destroy() });
  }

  flashDamage() { this.scene.cameras.main.flash(160, 255, 0, 0); }

  showResult(cleared, time, player) {
    this.resultText.setVisible(true);
    if (cleared) this.resultText.setText(`클리어! 생존시간: ${Math.floor(time)}초\n레벨: ${player.level || 1}`);
    else         this.resultText.setText(`사망... 생존시간: ${Math.floor(time)}초\n다시 도전하세요`);
  }
}
