export class MealService {
  constructor(scene, sessionEngine, audioEngine) {
    this.scene = scene;
    this.session = sessionEngine;
    this.audio = audioEngine;
    this.activeMeal = null;
    this.mealMesh = null;
    this._fadeTimeout = null;
  }

  init() {
    this.session.on('mealService', (meal) => this._serveMeal(meal));
  }

  _serveMeal(meal) {
    if (this.activeMeal) this._clearMeal(false);
    this.activeMeal = meal;
    this.audio.playMealClink();
    if (this.scene && this.scene.cabinGeometry) {
      this.scene.cabinGeometry.showMealCard(meal);
    }
    this._fadeTimeout = setTimeout(() => {
      if (this.activeMeal === meal) this._clearMeal(true);
    }, 60000);
  }

  eatMeal() {
    if (!this.activeMeal) return false;
    if (this._fadeTimeout) clearTimeout(this._fadeTimeout);
    if (this.scene && this.scene.cabinGeometry) {
      this.scene.cabinGeometry.hideMealCard();
    }
    this.activeMeal = null;
    return true;
  }

  _clearMeal(fade) {
    if (this._fadeTimeout) clearTimeout(this._fadeTimeout);
    if (this.scene && this.scene.cabinGeometry) {
      this.scene.cabinGeometry.hideMealCard();
    }
    this.activeMeal = null;
  }
}
