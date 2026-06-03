/**
 * PassiveWeapon — 뱀서라이크 자동 발동 무기 베이스 클래스
 * 레벨업 카드로 언락/강화되며, update(dt)가 호출될 때마다
 * 자체 쿨다운을 체크해 자동 발동된다.
 */
export default class PassiveWeapon {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} player  - Player 인스턴스
   * @param {string} type    - 'fireball' | 'lightning' | 'orbit'
   */
  constructor(scene, player, type) {
    this.scene  = scene;
    this.player = player;
    this.type   = type;
    this.level  = 1;
    this.timer  = 0;   // cooldown accumulator (seconds)

    // 서브클래스가 오버라이드할 기본값
    this.cooldown = 3;
  }

  /** GameScene → Player → 각 무기의 update 체인으로 호출 */
  update(dt) {
    this.timer += dt;
    if (this.timer >= this.cooldown) {
      this.timer = 0;
      this.fire();
    }
  }

  /** 서브클래스에서 구현 */
  fire() {}

  /** 레벨업 카드 선택 시 호출 */
  levelUp() {
    if (this.level < 5) {
      this.level++;
      this.applyLevelStats();
    }
  }

  /** 서브클래스에서 레벨별 수치 갱신 */
  applyLevelStats() {}

  /** 무기 제거 시 시각 오브젝트 정리 (필요 시 오버라이드) */
  destroy() {}
}
