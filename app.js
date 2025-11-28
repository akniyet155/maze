(function () {
  const tg = window.Telegram?.WebApp;
  let tgBackOn = false;
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      const theme = tg.themeParams || {};
      const root = document.documentElement;
      if (theme.bg_color) root.style.setProperty('--bg', theme.bg_color);
      if (theme.text_color) root.style.setProperty('--fg', theme.text_color);
      if (theme.hint_color) root.style.setProperty('--muted', theme.hint_color);
      if (theme.button_color) root.style.setProperty('--btn-bg', theme.button_color);
      if (theme.button_text_color) root.style.setProperty('--btn-fg', theme.button_text_color);

      // Handle Telegram BackButton
      if (tg.BackButton) {
        tg.BackButton.onClick(() => goBack());
        tgBackOn = true;
      } else if (tg.onEvent) {
        // fallback for older API
        tg.onEvent('backButtonClicked', () => goBack());
        tgBackOn = true;
      }
    } catch (_) { /* noop */ }
  }

  const state = {
    root: null,
    current: null,
    stack: [],
  };

  const elTitle = document.getElementById('node-title');
  const elGrid = document.getElementById('grid');
  const elSecret = document.getElementById('secret');
  const btnHome = document.getElementById('home');
  const btnBack = document.getElementById('back');

  btnHome.addEventListener('click', () => goHome());
  btnBack.addEventListener('click', () => goBack());

  function syncTgBackButton() {
    if (!tg || !tgBackOn) return;
    try {
      if (state.stack.length > 0) tg.BackButton?.show?.();
      else tg.BackButton?.hide?.();
    } catch (_) { /* noop */ }
  }

  function goHome() {
    state.stack = [];
    state.current = state.root;
    renderNode();
    syncTgBackButton();
  }

  function goBack() {
    if (state.stack.length > 0) {
      state.current = state.stack.pop();
      renderNode();
    }
    syncTgBackButton();
  }

  function findByPath(node, path) {
    if (!node) return null;
    if (node.path === path) return node;
    const children = node.children || [];
    for (const child of children) {
      if (child.action === 'next' && child.node) {
        const found = findByPath(child.node, path);
        if (found) return found;
      }
    }
    return null;
  }

  function navigate(child) {
    const { action } = child;
    if (action === 'jump') {
      const dest = child.target_path === 'root' ? state.root : findByPath(state.root, child.target_path);
      if (dest) {
        state.stack.push(state.current);
        state.current = dest;
        renderNode();
      }
      return;
    }
    if (action === 'next') {
      if (child.node?.type === 'dead_end') {
        // show single button to go home
        state.stack.push(state.current);
        state.current = child.node;
        renderDeadEnd(child.node);
        return;
      }
      if (child.node?.type === 'secret') {
        state.stack.push(state.current);
        state.current = child.node;
        renderSecret(child.node);
        return;
      }
      if (child.node) {
        state.stack.push(state.current);
        state.current = child.node;
        renderNode();
      }
      return;
    }
  }

  function clearGrid() {
    elGrid.innerHTML = '';
    elSecret.style.display = 'none';
    elSecret.innerHTML = '';
  }

  function renderDeadEnd(node) {
    elTitle.textContent = node.title || 'Тупик';
    clearGrid();
    // Show a single back-home button in grid center
    const placeholders = new Array(9).fill(null);
    placeholders.forEach((_, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      if (i === 4) {
        btn.textContent = node.button?.emoji || '🏠';
        btn.title = node.button?.title || 'На главную';
        btn.addEventListener('click', () => goHome());
      } else {
        btn.textContent = '·';
        btn.disabled = true;
        btn.style.opacity = '0.25';
      }
      elGrid.appendChild(btn);
    });
    syncTgBackButton();
  }

  function renderSecret(node) {
    elTitle.textContent = node.title || 'Секрет';
    clearGrid();

    // Render a mini grid of dimmed buttons (non-interactive) and focus secret
    const placeholders = new Array(9).fill(null);
    placeholders.forEach(() => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = '✨';
      btn.disabled = true;
      btn.style.opacity = '0.25';
      elGrid.appendChild(btn);
    });

    // Secret content block
    elSecret.style.display = 'block';
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = 'Содержимое:';
    elSecret.appendChild(label);

    if (/^https?:\/\//i.test(node.value || '')) {
      const a = document.createElement('a');
      a.href = node.value;
      a.target = '_blank';
      a.rel = 'noreferrer noopener';
      a.className = 'link';
      a.textContent = node.value;
      elSecret.appendChild(a);
    } else {
      const span = document.createElement('div');
      span.textContent = node.value || '';
      elSecret.appendChild(span);
    }
    syncTgBackButton();
  }

  function renderNode() {
    const node = state.current;
    if (!node) return;

    if (node.type === 'dead_end') return renderDeadEnd(node);
    if (node.type === 'secret') return renderSecret(node);

    elTitle.textContent = node.title || '';
    clearGrid();

    const children = node.children || [];
    // Ensure exactly 9 buttons (fill with disabled if fewer)
    const nine = children.slice(0, 9);
    while (nine.length < 9) nine.push({ disabled: true });

    for (const child of nine) {
      const btn = document.createElement('button');
      btn.className = 'btn';
      if (child.disabled) {
        btn.textContent = '·';
        btn.disabled = true;
        btn.style.opacity = '0.25';
      } else {
        btn.textContent = child.emoji || '⬜';
        btn.addEventListener('click', () => navigate(child));
      }
      elGrid.appendChild(btn);
    }
    syncTgBackButton();
  }

  async function bootstrap() {
    try {
      const res = await fetch('./routes.json', { cache: 'no-store' });
      const data = await res.json();
      state.root = data;
      state.current = data;
      renderNode();
    } catch (e) {
      elTitle.textContent = 'Ошибка загрузки маршрутов';
      console.error(e);
    }
  }

  bootstrap();
})();
