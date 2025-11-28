(function () {
  const tg = window.Telegram?.WebApp;
  let tgBackOn = false;
  const params = new URLSearchParams(location.search);
  const ALLOW_MIX = params.has('mix');
  const SEED_PARAM = params.get('seed') || '';
  const ENFORCE_FINAL_DEPTH = true; // все неверные пути заканчиваются на финальной глубине
  const MAX_STEPS_TO_SECRET = 6;    // столько шагов от корня до финала (секрет/тупик)
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
      // Отключаем системную кнопку Назад в Telegram Mini App
      try { tg.BackButton?.hide?.(); } catch (_) {}
      tgBackOn = false;
    } catch (_) { /* noop */ }
  }

  const state = {
    root: null,
    current: null,
    stack: [],
    depth: 0, // кол-во сделанных шагов от корня (next/funnel)
  };

  const elTitle = document.getElementById('node-title');
  const elGrid = document.getElementById('grid');
  const elSecret = document.getElementById('secret');
  const btnHome = document.getElementById('home');
  // no back button in UI by requirement

  btnHome.addEventListener('click', () => goHome());

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
    state.depth = 0;
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
      // Прыжки сохраняем как есть (не превращаем в воронку)
      const dest = child.target_path === 'root' ? state.root : findByPath(state.root, child.target_path);
      if (dest) {
        state.stack.push(state.current);
        state.current = dest;
        state.depth += 1;
        renderNode();
      }
      return;
    }
    if (action === 'next') {
      if (child.node?.type === 'dead_end') {
        if (ENFORCE_FINAL_DEPTH) {
          startFunnel();
        } else {
          state.stack.push(state.current);
          state.current = child.node;
          state.depth += 1;
          renderDeadEnd(child.node);
        }
        return;
      }
      if (child.node?.type === 'secret') {
        state.stack.push(state.current);
        state.current = child.node;
        state.depth += 1;
        renderSecret(child.node);
        return;
      }
      if (child.node) {
        state.stack.push(state.current);
        state.current = child.node;
        state.depth += 1;
        renderNode();
      }
      return;
    }
  }

  function startFunnel() {
    // Учтём текущий переход как 1 шаг
    const remaining = Math.max(0, MAX_STEPS_TO_SECRET - (state.depth + 1));
    state.stack.push(state.current);
    state.depth += 1;
    if (remaining <= 0) {
      // Уже достигли финальной глубины — показываем тупик сразу
      const de = { type: 'dead_end', title: 'Тупик', button: { emoji: '🏠', title: 'На главную', action: 'jump', target_path: 'root' } };
      state.current = de;
      renderDeadEnd(de);
      return;
    }
    const node = { type: 'funnel', title: '…', remaining };
    state.current = node;
    renderFunnel(node);
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

  function renderFunnel(node) {
    elTitle.textContent = node.title || '…';
    clearGrid();

    const placeholders = new Array(9).fill(null);
    placeholders.forEach(() => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.textContent = '⬛';
      btn.addEventListener('click', () => {
        // ещё шаг в воронке
        if (node.remaining > 1) {
          const next = { type: 'funnel', title: node.title || '…', remaining: node.remaining - 1 };
          state.stack.push(state.current);
          state.current = next;
          state.depth += 1;
          renderFunnel(next);
        } else {
          // Этот клик завершает путь и приводит к тупику на финальной глубине
          const de = { type: 'dead_end', title: 'Тупик', button: { emoji: '🏠', title: 'На главную', action: 'jump', target_path: 'root' } };
          state.stack.push(state.current);
          state.current = de;
          state.depth += 1;
          renderDeadEnd(de);
        }
      });
      elGrid.appendChild(btn);
    });
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

    // Перемешивание кнопок — ТОЛЬКО по вашей команде: ?mix[&seed=...]
    let ordered = children.slice();
    if (ALLOW_MIX) {
      function xmur3(str){let h=1779033703^str.length;for(let i=0;i<str.length;i++){h=Math.imul(h^str.charCodeAt(i),3432918353);h=h<<13|h>>>19;}return function(){h=Math.imul(h^h>>>16,2246822507);h=Math.imul(h^h>>>13,3266489909);return (h^h>>>16)>>>0;}}
      function mulberry32(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}}
      function shuffleStable(arr, seedStr){const out=arr.slice();const seed=xmur3(seedStr||'seed')();const rnd=mulberry32(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
      const mixSeed = SEED_PARAM || String(node.path||'root');
      ordered = shuffleStable(children, mixSeed);
    }

    // Ensure exactly 9 buttons (fill with disabled if fewer)
    const nine = ordered.slice(0, 9);
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
