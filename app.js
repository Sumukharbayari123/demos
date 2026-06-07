const state = {
  demos: [],
  currentDemoIndex: 0,
  currentFile: null,
  sourceCache: new Map()
};

const app = document.getElementById('app');

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function lineMarkup(source) {
  const lines = source.split('\n');
  const numbers = lines.map((_, index) => `<span>${index + 1}</span>`).join('');
  const content = lines.map((line) => `<span>${escapeHtml(line) || '&nbsp;'}</span>`).join('');
  return { numbers, content };
}

function highlightSource(source, fileName) {
  const ext = (fileName || '').split('.').pop() || '';
  let lang = 'markup';
  if (/js|mjs|cjs/.test(ext)) lang = 'javascript';
  else if (/css/.test(ext)) lang = 'css';
  else if (/html?|htm|xhtml/.test(ext)) lang = 'markup';

  try {
    if (window && window.Prism && Prism.languages && Prism.languages[lang]) {
      const highlighted = Prism.highlight(source, Prism.languages[lang], lang);
      const lines = highlighted.split('\n');
      const numbers = lines.map((_, i) => `<span>${i + 1}</span>`).join('');
      const content = lines.map((line) => `<span>${line || '&nbsp;'}</span>`).join('');
      return { numbers, content };
    }
  } catch (e) {
    // fallthrough to plain
  }

  return lineMarkup(source);
}

function renderShell() {
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <button class="nav-button" id="prev-demo" aria-label="Previous demo">&#x2039;</button>
        <div class="topbar-title">
          <p class="kicker">Demo Browser</p>
          <h1 class="demo-title" id="demo-title">Loading demos...</h1>
          <button id="choose-demo-btn" class="demo-select" aria-haspopup="dialog" aria-controls="demo-modal">Choose demo</button>
          <p class="demo-subtitle" id="demo-subtitle">Fetching available demo folders and source files.</p>
        </div>
        <button class="nav-button" id="next-demo" aria-label="Next demo">&#x203A;</button>
      </header>

      <main class="workspace">
        <section class="pane" aria-label="Source code">
          <div class="pane-header">
            <h2 class="pane-title">Source</h2>
            <div class="tab-strip" id="tab-strip"></div>
          </div>
          <div class="content-scroll" id="source-panel">
            <div class="empty-state">Select a demo to view its files.</div>
          </div>
        </section>

        <section class="pane" aria-label="Output preview">
          <div class="pane-header">
            <h2 class="pane-title">Output</h2>
          </div>
          <div class="content-scroll" id="preview-panel">
            <div class="empty-state">Preview will appear here.</div>
          </div>
        </section>
      </main>
      <!-- modal chooser -->
      <div id="demo-modal" class="modal-backdrop" hidden>
        <div class="modal" role="dialog" aria-modal="true" aria-label="Choose demo">
          <div class="modal-header">
            <input id="modal-search" class="modal-search" placeholder="Search demos..." aria-label="Search demos" />
            <button id="modal-close" class="modal-close" aria-label="Close">Close</button>
          </div>
          <div class="modal-list" id="modal-list"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('prev-demo').addEventListener('click', () => switchDemo(-1));
  document.getElementById('next-demo').addEventListener('click', () => switchDemo(1));
  const chooseBtn = document.getElementById('choose-demo-btn');
  const modal = document.getElementById('demo-modal');
  const modalList = document.getElementById('modal-list');
  const modalSearch = document.getElementById('modal-search');
  const modalClose = document.getElementById('modal-close');

  function openModal() {
    modal.removeAttribute('hidden');
    modalSearch.value = '';
    renderModalList(state.demos);
    setTimeout(() => modalSearch.focus(), 50);
    document.addEventListener('keydown', handleEscape);
  }

  function closeModal() {
    modal.setAttribute('hidden', '');
    document.removeEventListener('keydown', handleEscape);
    try { document.getElementById('choose-demo-btn').focus(); } catch (e) {}
  }

  function handleEscape(e) {
    if (e.key === 'Escape') closeModal();
  }

  chooseBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  modalSearch.addEventListener('input', () => {
    const q = modalSearch.value.trim().toLowerCase();
    if (!q) return renderModalList(state.demos);
    renderModalList(state.demos.filter((d) => d.title.toLowerCase().includes(q)));
  });

  function renderModalList(list) {
    modalList.innerHTML = list.map((d, idx) => `
      <div class="modal-item" data-id="${escapeHtml(d.id)}" data-idx="${state.demos.indexOf(d)}">
        <strong>${escapeHtml(d.title)}</strong>
        <div class="muted">${d.files.length} file${d.files.length===1?'':'s'}</div>
      </div>
    `).join('');

    modalList.querySelectorAll('.modal-item').forEach((item) => {
      item.addEventListener('click', () => {
        const idx = Number(item.dataset.idx);
        if (!Number.isNaN(idx)) {
          state.currentDemoIndex = idx;
          const d = state.demos[state.currentDemoIndex];
          state.currentFile = d.files[0] || null;
          updateHeader(d);
          renderTabs(d);
          renderPreview(d);
          if (state.currentFile) openFile(d, state.currentFile);
          // ensure modal actually closes and focus returns
          closeModal();
        }
      });
    });
  }
}

function updateHeader(demo) {
  document.getElementById('demo-title').textContent = demo.title;
  document.getElementById('demo-subtitle').textContent = `${demo.files.length} file${demo.files.length === 1 ? '' : 's'} — demo ${state.currentDemoIndex + 1} of ${state.demos.length}`;
  document.getElementById('prev-demo').disabled = state.currentDemoIndex === 0;
  document.getElementById('next-demo').disabled = state.currentDemoIndex === state.demos.length - 1;
  const chooseBtn = document.getElementById('choose-demo-btn');
  if (chooseBtn) chooseBtn.textContent = demo.title;
}

function renderTabs(demo) {
  const tabStrip = document.getElementById('tab-strip');
  tabStrip.innerHTML = demo.files.map((fileName) => {
    const activeClass = fileName === state.currentFile ? 'active' : '';
    return `<button class="tab-button ${activeClass}" data-file="${escapeHtml(fileName)}">${escapeHtml(fileName)}</button>`;
  }).join('');

  tabStrip.querySelectorAll('.tab-button').forEach((button) => {
    button.addEventListener('click', () => {
      openFile(demo, button.dataset.file);
    });
  });
}

async function fetchFileContent(demoId, fileName) {
  const cacheKey = `${demoId}/${fileName}`;
  if (state.sourceCache.has(cacheKey)) {
    return state.sourceCache.get(cacheKey);
  }

  const response = await fetch(`/api/demos/${encodeURIComponent(demoId)}/source?file=${encodeURIComponent(fileName)}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${fileName}`);
  }

  const payload = await response.json();
  state.sourceCache.set(cacheKey, payload.content);
  return payload.content;
}

async function openFile(demo, fileName) {
  state.currentFile = fileName;
  renderTabs(demo);

  const sourcePanel = document.getElementById('source-panel');
  sourcePanel.innerHTML = '<div class="skeleton"><div class="skeleton-line" style="width: 92%"></div><div class="skeleton-line" style="width: 78%"></div><div class="skeleton-line" style="width: 86%"></div><div class="skeleton-line" style="width: 60%"></div><div class="skeleton-line" style="width: 94%"></div><div class="skeleton-line" style="width: 48%"></div></div>';

  try {
    const content = await fetchFileContent(demo.id, fileName);
    const { numbers, content: codeContent } = highlightSource(content, fileName);
    sourcePanel.innerHTML = `
      <pre class="code-view"><code class="line-numbers">${numbers}</code><code class="code-lines"><code class="language-${(fileName||'').split('.').pop()}">${codeContent}</code></code></pre>
    `;
  } catch (error) {
    sourcePanel.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderPreview(demo) {
  const previewPanel = document.getElementById('preview-panel');
  const previewUrl = `/demos/${encodeURIComponent(demo.id)}/index.html`;
  previewPanel.innerHTML = `
    <div class="iframe-wrap">
      <div class="iframe-overlay" id="iframe-overlay"><div class="spinner" aria-hidden></div></div>
      <iframe class="preview-frame" id="preview-iframe" title="${escapeHtml(demo.title)} preview" src="${previewUrl}"></iframe>
    </div>`;

  const iframe = document.getElementById('preview-iframe');
  const overlay = document.getElementById('iframe-overlay');
  if (iframe) {
    iframe.addEventListener('load', () => {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    });
  }
}

function switchDemo(direction) {
  const nextIndex = state.currentDemoIndex + direction;
  if (nextIndex < 0 || nextIndex >= state.demos.length) {
    return;
  }

  state.currentDemoIndex = nextIndex;
  const nextDemo = state.demos[state.currentDemoIndex];
  state.currentFile = nextDemo.files.includes(state.currentFile) ? state.currentFile : nextDemo.files[0];
  updateHeader(nextDemo);
  renderTabs(nextDemo);
  renderPreview(nextDemo);
  openFile(nextDemo, state.currentFile || nextDemo.files[0]);
}

async function boot() {
  renderShell();

  const titleEl = document.getElementById('demo-title');
  titleEl.innerHTML = '<span class="spinner" aria-hidden></span> Loading demos...';

  const response = await fetch('/api/demos');
  const payload = await response.json();
  state.demos = payload.demos;

  if (!state.demos.length) {
    document.getElementById('demo-title').textContent = 'No demos found';
    document.getElementById('demo-subtitle').textContent = 'Add folders under demos/ with index.html, styles.css, and script.js files.';
    document.getElementById('source-panel').innerHTML = '<div class="empty-state">No demo folders are available yet.</div>';
    document.getElementById('preview-panel').innerHTML = '<div class="empty-state">Add a demo folder to see a live preview.</div>';
    return;
  }

  state.currentDemoIndex = 0;
  const firstDemo = state.demos[state.currentDemoIndex];
  state.currentFile = firstDemo.files[0] || null;
  updateHeader(firstDemo);
  renderTabs(firstDemo);
  renderPreview(firstDemo);

  if (state.currentFile) {
    await openFile(firstDemo, state.currentFile);
  }
}

boot().catch((error) => {
  app.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
});