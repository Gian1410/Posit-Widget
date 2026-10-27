const bodyInput = document.querySelector('#note-body');
const saveLabel = document.querySelector('#save-label');
const pinToggle = document.querySelector('#pin-toggle');
const saveButton = document.querySelector('#save-note');
const openButton = document.querySelector('#open-note');
const moreActions = document.querySelector('#more-actions');
const fontMenu = document.querySelector('#font-menu');
const newPositButton = document.querySelector('#new-posit');
const fontSizeRange = document.querySelector('#font-size-range');
const fontSizeValue = document.querySelector('#font-size-value');
const fontFamilyButtons = document.querySelectorAll('.font-family-button');
const formatButtons = document.querySelectorAll('.format-button');
const selectionSizeToggle = document.querySelector('#selection-size-toggle');
const selectionSizeMenu = document.querySelector('#selection-size-menu');
const selectionSizeButtons = document.querySelectorAll('#selection-size-menu button');
const highlightMenu = document.querySelector('#highlight-menu');
const increaseSelectionSizeButton = document.querySelector('#increase-selection-size');
const decreaseSelectionSizeButton = document.querySelector('#decrease-selection-size');
const removeHighlightButton = document.querySelector('#remove-highlight');
const highlightButtons = document.querySelectorAll('.highlight-swatch');
const positShell = document.querySelector('.posit-shell');
const themeButtons = document.querySelectorAll('.theme-dot');
const resizeHandles = document.querySelectorAll('.resize-handle');
const minimizeButton = document.querySelector('.minimize-button');
const closeButton = document.querySelector('.close-button');

const noteWindowId = (window.location.hash.slice(1) || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
const isNewNote = noteWindowId.startsWith('new-');
const STORAGE_KEY = `posit-note-v1-${noteWindowId}`;
let activeFilePath = null;
let autoSaveTimer = null;
let savedSelection = null;
let windowTextScale = 1;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\r?\n/g, '<br>');
}

function getPlainNoteText() {
  return bodyInput.innerText.replace(/\u200B/g, '');
}

function addHighlightCaretGuard(highlight) {
  const nextSibling = highlight.nextSibling;
  if (nextSibling?.nodeType === Node.ELEMENT_NODE && nextSibling.classList.contains('highlight-caret-guard')) {
    return nextSibling;
  }

  const caretGuard = document.createElement('span');
  caretGuard.className = 'highlight-caret-guard';
  caretGuard.textContent = '\u200B';
  highlight.after(caretGuard);
  return caretGuard;
}

function ensureHighlightCaretGuards() {
  bodyInput.querySelectorAll('.hand-highlight').forEach((highlight) => {
    if (!highlight.dataset.highlightColor) {
      highlight.dataset.highlightColor = normalizeColor(getComputedStyle(highlight).backgroundColor);
    }
    addHighlightCaretGuard(highlight);
  });
}

function normalizeColor(color) {
  const colorSample = document.createElement('span');
  colorSample.style.backgroundColor = color;
  return colorSample.style.backgroundColor.replace(/\s/g, '').toLowerCase();
}

function saveCurrentSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    savedSelection = null;
    return;
  }
  const range = selection.getRangeAt(0);
  if (bodyInput.contains(range.commonAncestorContainer)) {
    savedSelection = range.cloneRange();
  } else {
    savedSelection = null;
  }
}

function restoreCurrentSelection() {
  if (!savedSelection) return false;
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(savedSelection);
  return true;
}

function applySelectionCommand(command, value = null) {
  if (!restoreCurrentSelection()) return;
  bodyInput.focus();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand(command, false, value);
  saveCurrentSelection();
  queueAutoSave();
}

function applySelectionFontSize(size) {
  if (!restoreCurrentSelection()) {
    const fontSizeMap = { 2: 12, 3: 16, 5: 20, 6: 24 };
    applyFontSize(fontSizeMap[size] || 16);
    queueAutoSave();
    return;
  }

  bodyInput.focus();
  document.execCommand('styleWithCSS', false, true);
  document.execCommand('fontSize', false, size);
  saveCurrentSelection();
  queueAutoSave();
}

function applyHighlight(color) {
  if (!restoreCurrentSelection()) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  const highlight = document.createElement('span');
  highlight.className = 'hand-highlight';
  highlight.style.backgroundColor = color;
  highlight.dataset.highlightColor = color;

  try {
    range.surroundContents(highlight);
  } catch {
    const contents = range.extractContents();
    highlight.append(contents);
    range.insertNode(highlight);
  }

  const caretGuard = addHighlightCaretGuard(highlight);

  const caretRange = document.createRange();
  caretRange.setStart(caretGuard.firstChild, 1);
  caretRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caretRange);
  savedSelection = null;
  bodyInput.focus();
  queueAutoSave();
}

function removeHighlight(highlight) {
  const caretGuard = highlight.nextSibling?.classList?.contains('highlight-caret-guard')
    ? highlight.nextSibling
    : null;
  highlight.replaceWith(...highlight.childNodes);
  caretGuard?.remove();
}

function removeHighlightsFromSelection() {
  if (!restoreCurrentSelection()) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

  const range = selection.getRangeAt(0);
  const highlights = [...bodyInput.querySelectorAll('.hand-highlight')]
    .filter((highlight) => range.intersectsNode(highlight));

  highlights.forEach(removeHighlight);
  if (highlights.length === 0) return;

  savedSelection = null;
  bodyInput.focus();
  queueAutoSave();
}

function moveCaretOutOfHighlight() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return;

  const anchorNode = selection.anchorNode;
  const anchorElement = anchorNode?.nodeType === Node.ELEMENT_NODE ? anchorNode : anchorNode?.parentElement;
  const highlight = anchorElement?.closest('.hand-highlight');
  if (!highlight || !bodyInput.contains(highlight)) return;

  const caretRange = document.createRange();
  caretRange.setStartAfter(highlight);
  caretRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caretRange);
}

function loadNote() {
  if (isNewNote) {
    bodyInput.innerHTML = '';
    applyTheme('cream');
    applyFontSize(16);
    applyFontFamily('handwritten');
    return;
  }

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const storedBody = typeof stored.bodyHtml === 'string'
      ? stored.bodyHtml
      : escapeHtml(typeof stored.body === 'string' ? stored.body : '');
    const legacyTitle = typeof stored.title === 'string' ? stored.title.trim() : '';
    bodyInput.innerHTML = legacyTitle
      ? `${escapeHtml(legacyTitle)}${storedBody ? '<br><br>' : ''}${storedBody}`
      : storedBody;
    ensureHighlightCaretGuards();
    applyTheme(stored.theme);
    applyFontSize(stored.fontSize);
    applyFontFamily(stored.fontFamily);
  } catch {
    bodyInput.innerHTML = '';
    applyTheme('cream');
    applyFontSize(16);
    applyFontFamily('handwritten');
  }
}

function saveNote() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    body: getPlainNoteText(),
    bodyHtml: bodyInput.innerHTML,
    theme: positShell.dataset.theme,
    fontSize: Number(fontSizeRange.value),
    fontFamily: document.documentElement.dataset.noteFontFamily || 'handwritten'
  }));
  saveLabel.textContent = 'Guardado';
}

function applyTheme(theme = 'cream') {
  const nextTheme = ['cream', 'lavender', 'peach'].includes(theme) ? theme : 'cream';
  positShell.dataset.theme = nextTheme;
  themeButtons.forEach((button) => {
    const isSelected = button.dataset.theme === nextTheme;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
}

function applyFontSize(size = 16) {
  const nextSize = Math.max(8, Math.min(24, Number(size) || 16));
  document.documentElement.style.setProperty('--note-font-size', `${nextSize}px`);
  document.documentElement.style.setProperty('--note-font-zoom', (nextSize / 16).toFixed(3));
  applyContentZoom(nextSize);
  fontSizeRange.value = String(nextSize);
  fontSizeValue.textContent = `${nextSize} px`;
}

function applyContentZoom(fontSize = Number(fontSizeRange.value) || 16) {
  bodyInput.style.zoom = ((fontSize / 16) * windowTextScale).toFixed(3);
}

function applyFontFamily(fontFamily = 'handwritten') {
  const fontFamilies = {
    handwritten: '"Segoe Print", "Bradley Hand", "Comic Sans MS", cursive',
    arial: 'Arial, sans-serif',
    aptos: 'Aptos, "Segoe UI", sans-serif'
  };
  const nextFontFamily = Object.hasOwn(fontFamilies, fontFamily) ? fontFamily : 'handwritten';
  document.documentElement.style.setProperty('--note-font-family', fontFamilies[nextFontFamily]);
  document.documentElement.dataset.noteFontFamily = nextFontFamily;
  fontFamilyButtons.forEach((button) => {
    const isSelected = button.dataset.fontFamily === nextFontFamily;
    button.classList.toggle('is-selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
}

function updateTextScale() {
  const widthScale = window.innerWidth / 380;
  const heightScale = window.innerHeight / 470;
  const scale = Math.max(0.82, Math.min(1.55, widthScale * 0.72 + heightScale * 0.28));
  windowTextScale = scale;
  document.documentElement.style.setProperty('--note-scale', scale.toFixed(3));
  applyContentZoom();
}

async function saveToActiveFile() {
  if (!activeFilePath) return;

  try {
    await window.positWindow.saveNoteToPath({
      filePath: activeFilePath,
      body: getPlainNoteText()
    });
    saveLabel.textContent = 'Guardado';
  } catch {
    saveLabel.textContent = 'No se pudo guardar';
  }
}

function queueAutoSave() {
  saveLabel.textContent = 'Guardando...';
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(async () => {
    saveNote();
    await saveToActiveFile();
  }, 260);
}

function updatePinState(isActive) {
  pinToggle.classList.toggle('is-active', isActive);
  pinToggle.setAttribute('aria-pressed', String(isActive));
  pinToggle.title = isActive ? 'Desactivar siempre arriba' : 'Activar siempre arriba';
}

bodyInput.addEventListener('input', queueAutoSave);
bodyInput.addEventListener('beforeinput', (event) => {
  if (event.inputType === 'insertText' || event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
    moveCaretOutOfHighlight();
  }
});
document.addEventListener('selectionchange', saveCurrentSelection);

pinToggle.addEventListener('click', async () => {
  const isActive = pinToggle.classList.contains('is-active');
  const nextState = await window.positWindow.setAlwaysOnTop(!isActive);
  updatePinState(nextState);
});

moreActions.addEventListener('click', (event) => {
  event.stopPropagation();
  const isOpen = !fontMenu.hidden;
  fontMenu.hidden = isOpen;
  moreActions.setAttribute('aria-expanded', String(!isOpen));
});

newPositButton.addEventListener('click', async () => {
  fontMenu.hidden = true;
  moreActions.setAttribute('aria-expanded', 'false');
  await window.positWindow.createNewPosit();
});

fontMenu.addEventListener('pointerdown', (event) => event.stopPropagation());

fontSizeRange.addEventListener('input', () => {
  applyFontSize(fontSizeRange.value);
  queueAutoSave();
});

fontFamilyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyFontFamily(button.dataset.fontFamily);
    queueAutoSave();
  });
});

formatButtons.forEach((button) => {
  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
    applySelectionCommand(button.dataset.command);
  });
});

selectionSizeToggle.addEventListener('mousedown', (event) => {
  event.preventDefault();
  const isOpen = !selectionSizeMenu.hidden;
  selectionSizeMenu.hidden = isOpen;
  selectionSizeToggle.setAttribute('aria-expanded', String(!isOpen));
});

selectionSizeButtons.forEach((button) => {
  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
    applySelectionFontSize(button.dataset.size);
    selectionSizeMenu.hidden = true;
    selectionSizeToggle.setAttribute('aria-expanded', 'false');
  });
});

highlightButtons.forEach((button) => {
  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
    applyHighlight(button.dataset.highlight);
    highlightMenu.hidden = true;
  });
});

increaseSelectionSizeButton.addEventListener('mousedown', (event) => {
  event.preventDefault();
  applySelectionCommand('fontSize', '6');
  highlightMenu.hidden = true;
});

decreaseSelectionSizeButton.addEventListener('mousedown', (event) => {
  event.preventDefault();
  applySelectionCommand('fontSize', '2');
  highlightMenu.hidden = true;
});

removeHighlightButton.addEventListener('mousedown', (event) => {
  event.preventDefault();
  removeHighlightsFromSelection();
  highlightMenu.hidden = true;
});

bodyInput.addEventListener('contextmenu', (event) => {
  saveCurrentSelection();
  if (!savedSelection) return;

  event.preventDefault();
  const shellBounds = positShell.getBoundingClientRect();
  const menuWidth = 134;
  const menuHeight = 154;
  const left = Math.max(8, Math.min(event.clientX - shellBounds.left, shellBounds.width - menuWidth - 8));
  const top = Math.max(8, Math.min(event.clientY - shellBounds.top, shellBounds.height - menuHeight - 8));
  highlightMenu.style.left = `${left}px`;
  highlightMenu.style.top = `${top}px`;
  highlightMenu.hidden = false;
});

document.addEventListener('pointerdown', (event) => {
  if (!fontMenu.hidden && !fontMenu.contains(event.target) && !moreActions.contains(event.target)) {
    fontMenu.hidden = true;
    moreActions.setAttribute('aria-expanded', 'false');
  }

  if (!selectionSizeMenu.hidden && !selectionSizeMenu.contains(event.target) && !selectionSizeToggle.contains(event.target)) {
    selectionSizeMenu.hidden = true;
    selectionSizeToggle.setAttribute('aria-expanded', 'false');
  }

  if (!highlightMenu.hidden && !highlightMenu.contains(event.target)) {
    highlightMenu.hidden = true;
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    fontMenu.hidden = true;
    moreActions.setAttribute('aria-expanded', 'false');
    selectionSizeMenu.hidden = true;
    selectionSizeToggle.setAttribute('aria-expanded', 'false');
    highlightMenu.hidden = true;
  }
});

themeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    applyTheme(button.dataset.theme);
    queueAutoSave();
  });
});

saveButton.addEventListener('click', async () => {
  saveButton.disabled = true;
  saveLabel.textContent = 'eligiendo archivo...';

  try {
    const result = await window.positWindow.saveNoteToFile({
      body: getPlainNoteText(),
      theme: positShell.dataset.theme
    });

    if (result.canceled) {
      saveLabel.textContent = 'Guardado';
    } else {
      activeFilePath = result.filePath;
      saveNote();
      saveLabel.textContent = 'Guardado';
    }
  } catch {
    saveLabel.textContent = 'No se pudo guardar';
  } finally {
    saveButton.disabled = false;
  }
});

openButton.addEventListener('click', async () => {
  openButton.disabled = true;
  saveLabel.textContent = 'eligiendo archivo...';

  try {
    const result = await window.positWindow.openNoteFromFile();

    if (result.canceled) {
      saveLabel.textContent = 'Guardado';
    } else {
      activeFilePath = result.filePath;
      bodyInput.innerHTML = escapeHtml(result.body);
      saveNote();
      saveLabel.textContent = 'Guardado';
    }
  } catch {
    saveLabel.textContent = 'No se pudo abrir';
  } finally {
    openButton.disabled = false;
  }
});

let resizeState = null;

async function beginResize(event) {
  event.preventDefault();
  event.stopPropagation();
  const handle = event.currentTarget;

  const bounds = await window.positWindow.getBounds();
  if (!bounds) return;

  resizeState = {
    direction: handle.dataset.resize,
    startX: event.screenX,
    startY: event.screenY,
    bounds
  };

  if (handle.setPointerCapture) {
    handle.setPointerCapture(event.pointerId);
  }

  window.addEventListener('pointermove', resizeWindow);
  window.addEventListener('pointerup', endResize, { once: true });
  document.body.style.cursor = getComputedStyle(event.currentTarget).cursor;
}

function resizeWindow(event) {
  if (!resizeState) return;

  const { direction, startX, startY, bounds } = resizeState;
  const dx = event.screenX - startX;
  const dy = event.screenY - startY;
  const next = { ...bounds };
  const minWidth = 320;
  const minHeight = 360;

  if (direction.includes('e')) next.width = Math.max(minWidth, bounds.width + dx);
  if (direction.includes('s')) next.height = Math.max(minHeight, bounds.height + dy);
  if (direction.includes('w')) {
    next.width = Math.max(minWidth, bounds.width - dx);
    next.x = bounds.x + bounds.width - next.width;
  }
  if (direction.includes('n')) {
    next.height = Math.max(minHeight, bounds.height - dy);
    next.y = bounds.y + bounds.height - next.height;
  }

  window.positWindow.setBounds(next);
}

function endResize() {
  resizeState = null;
  window.removeEventListener('pointermove', resizeWindow);
  document.body.style.cursor = '';
}

resizeHandles.forEach((handle) => handle.addEventListener('pointerdown', beginResize));

minimizeButton.addEventListener('click', () => window.positWindow.minimize());
closeButton.addEventListener('click', () => window.positWindow.close());

loadNote();
updateTextScale();
window.addEventListener('resize', updateTextScale);
window.positWindow.getAlwaysOnTop().then(updatePinState);
