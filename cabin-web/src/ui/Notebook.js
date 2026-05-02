export class Notebook {
  constructor(container, sessionEngine) {
    this.container = container;
    this.session = sessionEngine;
    this._el = null;
    this._onClose = null;
  }

  onClose(fn) { this._onClose = fn; }

  open() {
    if (this._el) return;
    const overlay = document.createElement('div');
    overlay.className = 'panel-overlay';
    overlay.innerHTML = `<div class="panel-backdrop"></div>`;

    const panel = document.createElement('div');
    panel.className = 'notebook-panel';

    const s = this.session.state;
    let notes = s.notes || '';
    if (!s.notebookOpenedThisSprint) {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const header = `Sprint ${s.currentSprint} — ${timeStr}\n\n`;
      notes = notes ? notes + '\n' + header : header;
      s.notebookOpenedThisSprint = true;
      this.session.updateNotes(notes);
    }

    panel.innerHTML = `
      <div class="notebook-binding">
        <div class="notebook-ring"></div>
        <div class="notebook-ring"></div>
        <div class="notebook-ring"></div>
        <div class="notebook-ring"></div>
        <div class="notebook-ring"></div>
        <div class="notebook-ring"></div>
        <div class="notebook-title">CABIN NOTEBOOK</div>
        <button class="notebook-close-btn" id="nb-close">✕</button>
      </div>
      <div class="notebook-body">
        <div class="notebook-margin"></div>
        <div class="notebook-editor-wrap">
          <div class="notebook-editor" id="nb-editor" contenteditable="true" spellcheck="true"></div>
        </div>
      </div>
      <div class="notebook-footer">
        <span id="nb-charcount">0 characters</span>
      </div>
    `;

    overlay.appendChild(panel);
    this.container.appendChild(overlay);
    this._el = overlay;

    const editor = panel.querySelector('#nb-editor');
    editor.textContent = notes;
    this._moveCursorToEnd(editor);

    panel.querySelector('#nb-close').addEventListener('click', () => this.close());
    overlay.querySelector('.panel-backdrop').addEventListener('click', () => this.close());

    const updateCount = () => {
      const text = editor.textContent;
      this.session.updateNotes(text);
      const countEl = panel.querySelector('#nb-charcount');
      if (countEl) countEl.textContent = text.length + ' characters';
    };

    editor.addEventListener('input', updateCount);
    updateCount();

    setTimeout(() => editor.focus(), 100);
  }

  close() {
    if (!this._el) return;
    const panel = this._el.querySelector('.notebook-panel');
    if (panel) panel.classList.add('closing');
    setTimeout(() => {
      if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el);
      this._el = null;
    }, 300);
    if (this._onClose) this._onClose();
  }

  _moveCursorToEnd(el) {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}
