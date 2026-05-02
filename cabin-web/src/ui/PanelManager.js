import { IFEScreen } from './IFEScreen.js';
import { Notebook } from './Notebook.js';

export class PanelManager {
  constructor(panelLayer, sessionEngine) {
    this.layer = panelLayer;
    this.session = sessionEngine;
    this._current = null;
    this._ife = null;
    this._notebook = null;
  }

  openIFE(mode) {
    if (this._current === 'ife') {
      if (this._ife) this._ife.cycleMode();
      return;
    }
    this._closeAny(() => {
      this._ife = new IFEScreen(this.layer, this.session);
      this._ife.onClose(() => {
        this._current = null;
        this._ife = null;
      });
      this._ife.open(mode || 'map');
      this._current = 'ife';
    });
  }

  openNotebook() {
    if (this._current === 'notebook') return;
    this._closeAny(() => {
      this._notebook = new Notebook(this.layer, this.session);
      this._notebook.onClose(() => {
        this._current = null;
        this._notebook = null;
      });
      this._notebook.open();
      this._current = 'notebook';
    });
  }

  openTaskBoard() {
    this.openIFE('tasks');
  }

  showArrived() {
    this._closeAny(() => {
      this._ife = new IFEScreen(this.layer, this.session);
      this._ife.onClose(() => {
        this._current = null;
        this._ife = null;
      });
      this._ife.open('arrived');
      this._ife.showArrived();
      this._current = 'ife';
    });
  }

  showBreakPrompt(onChoice) {
    this._closeAny(() => {
      const overlay = document.createElement('div');
      overlay.className = 'panel-overlay';
      overlay.innerHTML = `
        <div class="panel-backdrop"></div>
        <div class="break-prompt-panel">
          <div class="break-prompt-title">Sprint Complete</div>
          <div class="break-prompt-sub">Take a ${this.session.state.breakDurationMin}-minute break. How would you like to spend it?</div>
          <div class="break-prompt-actions">
            <button class="break-prompt-btn" id="break-walk">Walk to Galley</button>
            <button class="break-prompt-btn" id="break-stay">Stay Seated</button>
          </div>
        </div>`;
      this.layer.appendChild(overlay);
      overlay.querySelector('.panel-backdrop').addEventListener('click', () => {});
      overlay.querySelector('#break-walk').addEventListener('click', () => {
        this.layer.removeChild(overlay);
        this._current = null;
        onChoice('walk');
      });
      overlay.querySelector('#break-stay').addEventListener('click', () => {
        this.layer.removeChild(overlay);
        this._current = null;
        onChoice('stay');
      });
      this._current = 'break-prompt';
      this._breakPromptEl = overlay;
    });
  }

  closeAll() {
    if (this._ife) { this._ife.close(); this._ife = null; }
    if (this._notebook) { this._notebook.close(); this._notebook = null; }
    if (this._breakPromptEl && this._breakPromptEl.parentNode) {
      this._breakPromptEl.parentNode.removeChild(this._breakPromptEl);
      this._breakPromptEl = null;
    }
    this._current = null;
  }

  _closeAny(cb) {
    if (!this._current) { cb(); return; }
    if (this._ife) { this._ife.close(); this._ife = null; }
    if (this._notebook) { this._notebook.close(); this._notebook = null; }
    if (this._breakPromptEl && this._breakPromptEl.parentNode) {
      this._breakPromptEl.parentNode.removeChild(this._breakPromptEl);
      this._breakPromptEl = null;
    }
    this._current = null;
    setTimeout(cb, 280);
  }

  get isOpen() { return !!this._current; }
}
