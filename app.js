// =====================
// STORAGE
// =====================
let decks = [];
let fcState = {};
let qzState = {};

function save() {
  localStorage.setItem('studyDecks', JSON.stringify(decks));
  localStorage.setItem('studyFcState', JSON.stringify(fcState));
  localStorage.setItem('studyQzState', JSON.stringify(qzState));
}

function load() {
  const d = localStorage.getItem('studyDecks');
  const fc = localStorage.getItem('studyFcState');
  const qz = localStorage.getItem('studyQzState');
  if (d) decks = JSON.parse(d);
  if (fc) fcState = JSON.parse(fc);
  if (qz) qzState = JSON.parse(qz);
}

// =====================
// UTILITIES
// =====================
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =====================
// TABS
// =====================
let currentActiveTab = 'tab-manage';

function showTab(id, btn) {
  currentActiveTab = id;
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'tab-flashcards') renderFlashcards();
  if (id === 'tab-quiz') renderQuizzes();
}

// =====================
// RICH TEXT TOOLBAR
// =====================
let activeEditor = null;
let savedRange   = null;

function saveSelection() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount) savedRange = sel.getRangeAt(0).cloneRange();
}

function restoreSelection() {
  if (!savedRange) return;
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(savedRange);
}

function fmt(command, value = null) {
  if (activeEditor) {
    activeEditor.focus();
    restoreSelection();
  }
  document.execCommand(command, false, value);
  updateToolbarState();
}

function applyBlock(tag) {
  if (activeEditor) {
    activeEditor.focus();
    restoreSelection();
  }
  document.execCommand('formatBlock', false, tag);
  updateToolbarState();
}

function updateToolbarState() {
  const map = {
    'tb-bold':      'bold',
    'tb-italic':    'italic',
    'tb-underline': 'underline',
    'tb-strike':    'strikeThrough',
    'tb-left':      'justifyLeft',
    'tb-center':    'justifyCenter',
    'tb-right':     'justifyRight',
    'tb-justify':   'justifyFull',
  };
  for (const [id, cmd] of Object.entries(map)) {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
  }

  const sel = window.getSelection();
  const inTable = sel && sel.anchorNode &&
    !!(sel.anchorNode.nodeType === 3
      ? sel.anchorNode.parentElement.closest('.rt-table')
      : sel.anchorNode.closest && sel.anchorNode.closest('.rt-table'));
  const tableOps = document.getElementById('tb-table-ops');
  if (tableOps) tableOps.style.display = inTable ? '' : 'none';
}

// =====================
// TABLE PICKER
// =====================
const TP_ROWS = 7, TP_COLS = 7;

function buildTablePicker() {
  const grid = document.getElementById('tpGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let r = 1; r <= TP_ROWS; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'tp-row';
    for (let c = 1; c <= TP_COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'tp-cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      cell.addEventListener('mouseover', () => highlightPicker(r, c));
      cell.addEventListener('click',     () => insertTable(r, c));
      rowEl.appendChild(cell);
    }
    grid.appendChild(rowEl);
  }
}

function highlightPicker(rows, cols) {
  const label = document.getElementById('tpLabel');
  if (label) label.textContent = `${rows} × ${cols} Table`;
  document.querySelectorAll('.tp-cell').forEach(cell => {
    const on = +cell.dataset.r <= rows && +cell.dataset.c <= cols;
    cell.classList.toggle('active', on);
  });
}

function toggleTablePicker(e) {
  if (e) e.stopPropagation();
  const picker = document.getElementById('tablePicker');
  if (!picker) return;
  const isOpen = picker.style.display !== 'none';
  picker.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) buildTablePicker();
}

function insertTable(rows, cols) {
  document.getElementById('tablePicker').style.display = 'none';
  if (!activeEditor) return;
  activeEditor.focus();
  restoreSelection();

  let html = '<table class="rt-table"><tbody>';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) {
      const tag = r === 0 ? 'th' : 'td';
      html += `<${tag}><br></${tag}>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table><p><br></p>';
  document.execCommand('insertHTML', false, html);
}

function tableOp(op) {
  if (!activeEditor) return;
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode) return;
  const node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
  const cell = node.closest('td, th');
  if (!cell) return;
  const row   = cell.closest('tr');
  const table = cell.closest('table');
  if (!row || !table) return;

  const rows  = Array.from(table.querySelectorAll('tr'));
  const cells = Array.from(row.querySelectorAll('td, th'));
  const colIdx = cells.indexOf(cell);

  if (op === 'addRow') {
    const newRow = document.createElement('tr');
    for (let i = 0; i < cells.length; i++) {
      const td = document.createElement('td');
      td.innerHTML = '<br>';
      newRow.appendChild(td);
    }
    row.after(newRow);

  } else if (op === 'addCol') {
    rows.forEach((tr, ri) => {
      const tag = ri === 0 ? 'th' : 'td';
      const newCell = document.createElement(tag);
      newCell.innerHTML = '<br>';
      const tCells = tr.querySelectorAll('td, th');
      if (tCells[colIdx]) tCells[colIdx].after(newCell);
      else tr.appendChild(newCell);
    });

  } else if (op === 'delRow') {
    if (rows.length > 1) row.remove();
    else table.remove();

  } else if (op === 'delCol') {
    rows.forEach(tr => {
      const tCells = tr.querySelectorAll('td, th');
      if (tCells.length > 1 && tCells[colIdx]) tCells[colIdx].remove();
    });
    if (table.querySelector('tr') && !table.querySelector('td, th')) table.remove();
  }
  updateToolbarState();
}

document.addEventListener('click', (e) => {
  const picker = document.getElementById('tablePicker');
  const btn    = document.getElementById('tb-table');
  if (picker && !picker.contains(e.target) && e.target !== btn) {
    picker.style.display = 'none';
  }
});

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  if (!sel || !sel.anchorNode) return;
  const node = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
  if (node && node.closest && node.closest('.rich-input')) {
    updateToolbarState();
  }
});

// =====================
// DECK EDITOR
// =====================
function addCardRow(term = '', def = '') {
  const editor = document.getElementById('cardsEditor');
  const row = document.createElement('div');
  row.className = 'card-row';
  row.innerHTML = `
    <div class="rich-input" contenteditable="true" data-placeholder="Term / Front"       style="flex:1"></div>
    <div class="rich-input" contenteditable="true" data-placeholder="Definition / Back"  style="flex:2"></div>
    <button class="remove-btn" onclick="this.parentElement.remove()">×</button>
  `;

  const [termEl, defEl] = row.querySelectorAll('.rich-input');
  if (term) termEl.innerHTML = DOMPurify.sanitize(term);
  if (def)  defEl.innerHTML  = DOMPurify.sanitize(def);

  [termEl, defEl].forEach(el => {
    el.addEventListener('focus', () => {
      activeEditor = el;
      updateToolbarState();
    });
    el.addEventListener('keyup',  updateToolbarState);
    el.addEventListener('mouseup', updateToolbarState);
    el.addEventListener('blur', () => saveSelection());
  });

  editor.appendChild(row);
}

function addQuizRow(q = '', choices = ['', '', '', ''], answer = 0, type = 'mc') {
  const editor = document.getElementById('quizEditor');
  const id = uid();
  const letters = ['A', 'B', 'C', 'D'];

  const choicesHTML = choices.map((c, i) => `
    <div class="quiz-choice-wrap">
      <span class="choice-letter-label">${letters[i]}</span>
      <input type="text" placeholder="Choice ${letters[i]}" value="${c.replace(/"/g, '&quot;')}">
      <input type="radio" name="correct-${id}" value="${i}" ${i === answer ? 'checked' : ''}>
      <label>✓</label>
    </div>
  `).join('');

  const tfHTML = `
    <div class="tf-editor-choices">
      <label class="tf-editor-option ${type === 'tf' && answer === 0 ? 'selected' : ''}">
        <input type="radio" name="tf-correct-${id}" value="0" ${type === 'tf' && answer === 0 ? 'checked' : ''}>
        <span class="tf-editor-icon">✅</span>
        <span>True</span>
        <span class="tf-tick">✓ Correct</span>
      </label>
      <label class="tf-editor-option ${type === 'tf' && answer === 1 ? 'selected' : ''}">
        <input type="radio" name="tf-correct-${id}" value="1" ${type === 'tf' && answer === 1 ? 'checked' : ''}>
        <span class="tf-editor-icon">❌</span>
        <span>False</span>
        <span class="tf-tick">✓ Correct</span>
      </label>
    </div>
  `;

  const div = document.createElement('div');
  div.className = 'quiz-card-editor';
  div.innerHTML = `
    <div class="quiz-type-row">
      <div class="quiz-type-toggle">
        <button type="button" class="type-toggle-btn ${type === 'mc' ? 'active' : ''}" onclick="setQuizType(this, '${id}', 'mc')">Multiple Choice</button>
        <button type="button" class="type-toggle-btn tf-toggle ${type === 'tf' ? 'active' : ''}" onclick="setQuizType(this, '${id}', 'tf')">True / False</button>
      </div>
    </div>
    <div class="quiz-q-row">
      <input type="text" placeholder="Question text" value="${q.replace(/"/g, '&quot;')}">
    </div>
    <div class="quiz-choices-grid" id="mc-grid-${id}" style="${type === 'tf' ? 'display:none' : ''}">${choicesHTML}</div>
    <div id="tf-wrap-${id}" style="${type !== 'tf' ? 'display:none' : ''}">${tfHTML}</div>
    <button class="remove-q-btn" onclick="this.parentElement.remove()">Remove Question</button>
  `;
  editor.appendChild(div);

  div.querySelectorAll(`input[name="tf-correct-${id}"]`).forEach(radio => {
    radio.addEventListener('change', () => {
      div.querySelectorAll('.tf-editor-option').forEach(opt => opt.classList.remove('selected'));
      radio.closest('.tf-editor-option').classList.add('selected');
    });
  });
}

function setQuizType(btn, id, type) {
  const wrap = btn.closest('.quiz-card-editor');
  wrap.querySelectorAll('.type-toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`mc-grid-${id}`).style.display = type === 'tf' ? 'none' : '';
  document.getElementById(`tf-wrap-${id}`).style.display = type !== 'tf' ? 'none' : '';
}

function cancelEdit() {
  document.getElementById('editingDeckId').value = '';
  document.getElementById('deckTitle').value = '';
  document.getElementById('deckColor').value = '#e63946';
  document.getElementById('cardsEditor').innerHTML = '';
  document.getElementById('quizEditor').innerHTML = '';
  activeEditor = null;
  savedRange   = null;
}

function saveDeck() {
  const title = document.getElementById('deckTitle').value.trim();
  if (!title) { alert('Please enter a deck title.'); return; }

  const color  = document.getElementById('deckColor').value;
  const editId = document.getElementById('editingDeckId').value;

  const cardRows = document.querySelectorAll('#cardsEditor .card-row');
  const cards = [];
  cardRows.forEach(row => {
    const inputs  = row.querySelectorAll('.rich-input');
    const term    = inputs[0] ? inputs[0].innerHTML.trim() : '';
    const def     = inputs[1] ? inputs[1].innerHTML.trim() : '';
    const termTxt = inputs[0] ? inputs[0].textContent.trim() : '';
    const defTxt  = inputs[1] ? inputs[1].textContent.trim() : '';
    if (termTxt && defTxt) cards.push({ term, def });
  });

  const qRows = document.querySelectorAll('#quizEditor .quiz-card-editor');
  const questions = [];
  qRows.forEach(row => {
    const qText = row.querySelector('.quiz-q-row input').value.trim();
    const activeTFToggle = row.querySelector('.type-toggle-btn.tf-toggle.active');
    const type = activeTFToggle ? 'tf' : 'mc';

    if (type === 'tf') {
      const tfRadio = row.querySelector('input[name^="tf-correct-"]:checked');
      const answer = tfRadio ? parseInt(tfRadio.value) : 0;
      if (qText) {
        questions.push({ q: qText, type: 'tf', choices: ['True', 'False'], answer });
      }
    } else {
      const choiceInputs = row.querySelectorAll('.quiz-choices-grid input[type=text]');
      const choices = Array.from(choiceInputs).map(i => i.value.trim());
      const radioChecked = row.querySelector('input[type=radio]:checked');
      const answer = radioChecked ? parseInt(radioChecked.value) : 0;
      if (qText && choices.some(c => c)) {
        questions.push({ q: qText, type: 'mc', choices, answer });
      }
    }
  });

  if (cards.length === 0 && questions.length === 0) {
    alert('Add at least one card or question.'); return;
  }

  if (editId) {
    const idx = decks.findIndex(d => d.id === editId);
    if (idx !== -1) {
      decks[idx] = { ...decks[idx], title, color, cards, questions };
    }
  } else {
    decks.push({ id: uid(), title, color, cards, questions });
  }

  save();
  cancelEdit();
  renderDeckList();
  renderFlashcards();
  renderQuizzes();
}

function editDeck(id) {
  const deck = decks.find(d => d.id === id);
  if (!deck) return;
  cancelEdit();
  document.getElementById('editingDeckId').value = id;
  document.getElementById('deckTitle').value = deck.title;
  document.getElementById('deckColor').value = deck.color || '#e63946';
  deck.cards.forEach(c => addCardRow(c.term, c.def));
  deck.questions.forEach(q => addQuizRow(q.q, q.choices, q.answer, q.type || 'mc'));
  document.getElementById('deckTitle').scrollIntoView({ behavior: 'smooth' });
}

function deleteDeck(id) {
  if (!confirm('Delete this deck?')) return;
  decks = decks.filter(d => d.id !== id);
  save();
  renderDeckList();
  renderFlashcards();
  renderQuizzes();
}

function renderDeckList() {
  const el = document.getElementById('deckList');
  if (decks.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="icon">📚</div><p>No decks yet. Create one below!</p></div>';
    return;
  }
  el.innerHTML = decks.map(d => {
    const tfCount = (d.questions || []).filter(q => q.type === 'tf').length;
    const mcCount = (d.questions || []).length - tfCount;
    const qMeta = [mcCount && `${mcCount} MC`, tfCount && `${tfCount} T/F`].filter(Boolean).join(' · ');
    return `
    <div class="deck-item">
      <div class="deck-item-info">
        <div class="deck-item-name">
          <span class="color-dot" style="background:${d.color}"></span>${d.title}
        </div>
        <div class="deck-item-meta">${d.cards.length} card${d.cards.length !== 1 ? 's' : ''} · ${qMeta || '0 questions'}</div>
      </div>
      <div class="deck-item-actions">
        <button class="btn secondary" onclick="editDeck('${d.id}')">✏️ Edit</button>
        <button class="btn secondary" style="color:var(--accent1)" onclick="deleteDeck('${d.id}')">🗑 Delete</button>
      </div>
    </div>
  `}).join('');
}

// =====================
// FLASHCARDS
// =====================
function initFcState(deck) {
  if (!fcState[deck.id]) {
    fcState[deck.id] = { idx: 0, cards: [...deck.cards] };
  }
}

function renderFlashcards() {
  const el = document.getElementById('flashcardsContent');
  if (decks.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="icon">🃏</div><p>No decks yet. Go to <strong>Manage Decks</strong> to create one.</p></div>';
    return;
  }

  el.innerHTML = decks.map((deck, di) => {
    initFcState(deck);
    const s = fcState[deck.id];
    return `
      <div class="deck-fc-container" data-deck-id="${deck.id}">
        ${di > 0 ? '<div class="topic-sep"></div>' : ''}
        <div class="topic-header">
          <div class="topic-dot" style="background:${deck.color}"></div>
          <div>
            <h2>${deck.title}</h2>
            <span>${deck.cards.length} card${deck.cards.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
        ${deck.cards.length === 0
          ? '<div class="empty-state"><div class="icon">😶</div><p>This deck has no flashcards yet.</p></div>'
          : `
          <div>
            <div class="progress-bar"><div class="progress-fill" id="fc-prog-${deck.id}"></div></div>
            <div class="flashcard-nav">
              <span class="fc-counter" id="fc-cnt-${deck.id}">1 / ${s.cards.length}</span>
              <div class="fc-controls">
                <button class="icon-btn" id="fc-prev-${deck.id}" onclick="fcMove('${deck.id}',-1)">←</button>
                <button class="icon-btn" onclick="fcShuffle('${deck.id}')">⇌</button>
                <button class="icon-btn" id="fc-next-${deck.id}" onclick="fcMove('${deck.id}',1)">→</button>
              </div>
            </div>
            <div class="scene" id="fc-scene-${deck.id}" onclick="fcFlip('${deck.id}')">
              <div class="card-inner" id="fc-inner-${deck.id}">
                <div class="card-face card-front">
                  <div class="card-label">Term</div>
                  <div class="card-term" id="fc-term-${deck.id}"></div>
                  <div class="card-hint">Tap to reveal definition</div>
                </div>
                <div class="card-face card-back">
                  <div class="card-label">Definition</div>
                  <div class="card-def" id="fc-def-${deck.id}"></div>
                </div>
              </div>
            </div>
            <p class="tap-hint">↑ tap card to flip</p>
          </div>
        `}
      </div>
    `;
  }).join('');

  decks.forEach(deck => {
    if (deck.cards.length > 0) fcRender(deck.id);
  });
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function renderCardContent(el, text) {
  if (!text) { el.textContent = ''; return; }
  if (/<[a-z][\s\S]*>/i.test(text)) {
    el.innerHTML = DOMPurify.sanitize(text);
    el.querySelectorAll('table').forEach(t => {
      t.querySelectorAll('th, td').forEach(c => c.removeAttribute('contenteditable'));
    });
    return;
  }
  const lines = text.split('\n');
  const hasTab = lines.some(l => l.includes('\t'));
  if (hasTab) {
    const rows = lines.map(line => {
      if (!line.trim()) return '<tr><td colspan="99" class="card-table-spacer"></td></tr>';
      const cols = line.split('\t');
      return '<tr>' + cols.map(c => `<td>${escapeHtml(c)}</td>`).join('') + '</tr>';
    }).join('');
    el.innerHTML = `<table class="card-table">${rows}</table>`;
  } else {
    el.textContent = text;
  }
}

function fcRender(id) {
  const s = fcState[id];
  if (!s || s.cards.length === 0) return;
  const c = s.cards[s.idx];
  renderCardContent(document.getElementById(`fc-term-${id}`), c.term);
  renderCardContent(document.getElementById(`fc-def-${id}`),  c.def);
  document.getElementById(`fc-cnt-${id}`).textContent = `${s.idx + 1} / ${s.cards.length}`;
  document.getElementById(`fc-prog-${id}`).style.width = `${((s.idx + 1) / s.cards.length) * 100}%`;
  document.getElementById(`fc-prev-${id}`).disabled = s.idx === 0;
  document.getElementById(`fc-next-${id}`).disabled = s.idx === s.cards.length - 1;
  const scene = document.getElementById(`fc-scene-${id}`);
  if (scene) scene.classList.remove('flipped');
  save();
}

function fcFlip(id) {
  document.getElementById(`fc-scene-${id}`).classList.toggle('flipped');
}

function fcMove(id, dir) {
  const s = fcState[id];
  s.idx = Math.max(0, Math.min(s.cards.length - 1, s.idx + dir));
  fcRender(id);
}

function fcShuffle(id) {
  const deck = decks.find(d => d.id === id);
  if (!deck) return;
  fcState[id] = { idx: 0, cards: shuffle(deck.cards) };
  fcRender(id);
}

// Global Keydown for Flashcards
document.addEventListener('keydown', (e) => {
  if (currentActiveTab !== 'tab-flashcards') return;
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable) return;
  
  const containers = document.querySelectorAll('.deck-fc-container');
  let visibleId = null;
  
  for (const c of containers) {
    const rect = c.getBoundingClientRect();
    if (rect.top >= 0 && rect.bottom <= window.innerHeight + 100) {
      visibleId = c.dataset.deckId;
      break;
    }
  }
  if (!visibleId) return;

  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    fcFlip(visibleId);
  } else if (e.key === 'ArrowRight') {
    fcMove(visibleId, 1);
  } else if (e.key === 'ArrowLeft') {
    fcMove(visibleId, -1);
  }
});

// =====================
// QUIZ
// =====================
function initQzState(deck) {
  if (!qzState[deck.id]) {
    qzState[deck.id] = {
      score: 0,
      answered: new Array(deck.questions.length).fill(false),
      order: deck.questions.map((_, i) => i)
    };
  }
}

function renderQuizzes() {
  const el = document.getElementById('quizContent');
  if (decks.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="icon">✏️</div><p>No decks yet. Go to <strong>Manage Decks</strong> to create one.</p></div>';
    return;
  }

  el.innerHTML = decks.map((deck, di) => {
    initQzState(deck);
    const tfCount = (deck.questions || []).filter(q => q.type === 'tf').length;
    const mcCount = (deck.questions || []).length - tfCount;
    const typePills = [mcCount && `${mcCount} MC`, tfCount && `${tfCount} T/F`].filter(Boolean).join(' · ');
    return `
      <div>
        ${di > 0 ? '<div class="topic-sep"></div>' : ''}
        <div class="topic-header">
          <div class="topic-dot" style="background:${deck.color}"></div>
          <div>
            <h2>${deck.title} — Quiz</h2>
            <span>${typePills || 'No questions'}</span>
          </div>
        </div>
        ${deck.questions.length === 0
          ? '<div class="empty-state"><div class="icon">😶</div><p>This deck has no quiz questions yet.</p></div>'
          : `
          <div class="quiz-header">
            <div class="quiz-score-badge">Score: <span id="qz-score-${deck.id}">0</span> / <span id="qz-total-${deck.id}">0</span></div>
            <button class="btn secondary" onclick="resetQuiz('${deck.id}')">↺ Reset & Shuffle</button>
          </div>
          <div id="qz-body-${deck.id}"></div>
        `}
      </div>
    `;
  }).join('');

  decks.forEach(deck => {
    if (deck.questions.length > 0) buildQuiz(deck.id);
  });
}

function buildQuiz(id) {
  const deck = decks.find(d => d.id === id);
  if (!deck) return;
  const s = qzState[id];
  const container = document.getElementById(`qz-body-${id}`);
  if (!container) return;
  const letters = ['A', 'B', 'C', 'D'];

  container.innerHTML = s.order.map((qi, displayIdx) => {
    const q = deck.questions[qi];
    let choicesHTML;

    if (q.type === 'tf') {
      choicesHTML = ['True', 'False'].map((c, ci) => `
        <button class="choice tf-choice-btn" onclick="answerQ('${id}',${qi},${ci},${q.answer},true)" id="ch-${id}-${qi}-${ci}">
          <span class="tf-choice-icon">${ci === 0 ? '✅' : '❌'}</span>
          <span>${c}</span>
        </button>
      `).join('');
    } else {
      choicesHTML = q.choices.map((c, ci) => `
        <button class="choice" onclick="answerQ('${id}',${qi},${ci},${q.answer},false)" id="ch-${id}-${qi}-${ci}">
          <span class="choice-letter">${letters[ci]}</span>${c}
        </button>
      `).join('');
    }

    return `
      <div class="question-card" id="qcard-${id}-${qi}">
        <div class="q-number">
          Question ${displayIdx + 1}
          ${q.type === 'tf' ? '<span class="tf-badge">True / False</span>' : ''}
        </div>
        <div class="q-text">${q.q}</div>
        <div class="choices${q.type === 'tf' ? ' tf-choices-row' : ''}">${choicesHTML}</div>
        <div class="explanation" id="exp-${id}-${qi}"></div>
      </div>
    `;
  }).join('');

  updateQzScore(id);
  
  // Re-apply correct/wrong classes if already answered from persistence
  s.answered.forEach((isAns, ansIdx) => {
      if(isAns) {
          const storedQ = deck.questions[ansIdx];
          // Determine chosen implicitly by finding which button was clicked - simplified for persistence, we just show correct answer if loaded from save
          for(let ci=0; ci< (storedQ.type === 'tf' ? 2 : storedQ.choices.length); ci++) {
              const btn = document.getElementById(`ch-${id}-${ansIdx}-${ci}`);
              if(btn) {
                  btn.disabled = true;
                  if (ci === storedQ.answer) btn.classList.add('correct');
              }
          }
      }
  });
}

function answerQ(id, qi, chosen, correct, isTF) {
  const s = qzState[id];
  if (s.answered[qi]) return;
  s.answered[qi] = true;
  const deck = decks.find(d => d.id === id);
  const q = deck.questions[qi];
  const letters = ['A', 'B', 'C', 'D'];
  const tfLabels = ['True', 'False'];

  const totalChoices = isTF ? 2 : q.choices.length;
  for (let ci = 0; ci < totalChoices; ci++) {
    const btn = document.getElementById(`ch-${id}-${qi}-${ci}`);
    if (!btn) continue;
    btn.disabled = true;
    if (ci === correct) btn.classList.add('correct');
    else if (ci === chosen) btn.classList.add('wrong');
  }

  const expEl = document.getElementById(`exp-${id}-${qi}`);
  const correctLabel = isTF ? tfLabels[correct] : `${letters[correct]}: ${q.choices[correct]}`;
  if (chosen === correct) {
    s.score++;
    expEl.className = 'explanation show correct-exp';
    expEl.textContent = `✓ Correct! The answer is ${correctLabel}.`;
  } else {
    expEl.className = 'explanation show wrong-exp';
    expEl.textContent = `✗ Incorrect. The correct answer is ${correctLabel}.`;
  }
  updateQzScore(id);
  save();
}

function resetQuiz(id) {
  const deck = decks.find(d => d.id === id);
  if (!deck) return;
  qzState[id] = {
    score: 0,
    answered: new Array(deck.questions.length).fill(false),
    order: shuffle(deck.questions.map((_, i) => i))
  };
  buildQuiz(id);
  save();
}

function updateQzScore(id) {
  const s = qzState[id];
  const answered = s.answered.filter(Boolean).length;
  const scoreEl = document.getElementById(`qz-score-${id}`);
  const totalEl = document.getElementById(`qz-total-${id}`);
  if (scoreEl) scoreEl.textContent = s.score;
  if (totalEl) totalEl.textContent = answered;
}

// =====================
// IMPORT / EXPORT
// =====================
function exportData() {
  const blob = new Blob([JSON.stringify(decks, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'study-decks.json';
  a.click();
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data)) throw new Error();
      decks = data;
      save();
      fcState = {};
      qzState = {};
      renderDeckList();
      renderFlashcards();
      renderQuizzes();
      alert('Imported successfully!');
    } catch {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function clearAll() {
  if (!confirm('Clear ALL decks? This cannot be undone.')) return;
  decks = [];
  fcState = {};
  qzState = {};
  save();
  renderDeckList();
  renderFlashcards();
  renderQuizzes();
}

// =====================
// INIT
// =====================
load();
renderDeckList();
renderFlashcards();
renderQuizzes();