const titleInput = document.querySelector('#note-title');
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

function loadNote() {
  if (isNewNote) {
    titleInput.value = '';
    bodyInput.value = '';
    applyTheme('cream');
    applyFontSize(16);
    return;
  }

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    titleInput.value = typeof stored.title === 'string' ? stored.title : '';
    bodyInput.value = typeof stored.body === 'string' ? stored.body : '';
    applyTheme(stored.theme);
    applyFontSize(stored.fontSize);
  } catch {
    titleInput.value = '';
    bodyInput.value = '';
    applyTheme('cream');
    applyFontSize(16);
  }
}

function saveNote() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    title: titleInput.value,
    body: bodyInput.value,
    theme: positShell.dataset.theme,
    fontSize: Number(fontSizeRange.value)
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
  const titleSize = nextSize * 1.75;
  document.documentElement.style.setProperty('--note-font-size', `${nextSize}px`);
  document.documentElement.style.setProperty('--note-title-font-size', `${titleSize}px`);
  fontSizeRange.value = String(nextSize);
  fontSizeValue.textContent = `${nextSize} px`;
}

function updateTextScale() {
  const widthScale = window.innerWidth / 380;
  const heightScale = window.innerHeight / 470;
  const scale = Math.max(0.82, Math.min(1.55, widthScale * 0.72 + heightScale * 0.28));
  document.documentElement.style.setProperty('--note-scale', scale.toFixed(3));
}

async function saveToActiveFile() {
  if (!activeFilePath) return;

  try {
    await window.positWindow.saveNoteToPath({
      filePath: activeFilePath,
      title: titleInput.value,
      body: bodyInput.value
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

titleInput.addEventListener('input', queueAutoSave);
bodyInput.addEventListener('input', queueAutoSave);

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

document.addEventListener('pointerdown', (event) => {
  if (!fontMenu.hidden && !fontMenu.contains(event.target) && !moreActions.contains(event.target)) {
    fontMenu.hidden = true;
    moreActions.setAttribute('aria-expanded', 'false');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    fontMenu.hidden = true;
    moreActions.setAttribute('aria-expanded', 'false');
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
      title: titleInput.value,
      body: bodyInput.value,
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
      titleInput.value = result.title;
      bodyInput.value = result.body;
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
