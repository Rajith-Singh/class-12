// Simple frontend logic for upload + QA
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const qaSection = document.getElementById('qaSection');
const questionInput = document.getElementById('questionInput');
const askBtn = document.getElementById('askBtn');
const answerContainer = document.getElementById('answerContainer');
const citationsRow = document.getElementById('citationsRow');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalClose = document.getElementById('modalClose');
const clearBtn = document.getElementById('clearBtn');
const clearQABtn = document.getElementById('clearQABtn');

let selectedFile = null;
let lastCitations = null;

// Dropzone handlers
dropzone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  selectedFile = e.target.files[0];
  uploadBtn.disabled = !selectedFile;
  uploadStatus.textContent = selectedFile ? selectedFile.name : '';
  const preview = document.getElementById('uploadPreview');
  const nameEl = document.getElementById('uploadName');
  const sizeEl = document.getElementById('uploadSize');
  if (selectedFile) {
    nameEl.textContent = selectedFile.name;
    sizeEl.textContent = `${Math.round(selectedFile.size/1024)} KB`;
    preview.classList.remove('hidden');
  } else {
    preview.classList.add('hidden');
  }
});

dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault(); dropzone.classList.remove('dragover');
  const f = e.dataTransfer.files && e.dataTransfer.files[0];
  if (f) {
    selectedFile = f;
    fileInput.files = e.dataTransfer.files;
    uploadBtn.disabled = false;
    uploadStatus.textContent = f.name;
    const preview = document.getElementById('uploadPreview');
    const nameEl = document.getElementById('uploadName');
    const sizeEl = document.getElementById('uploadSize');
    nameEl.textContent = f.name;
    sizeEl.textContent = `${Math.round(f.size/1024)} KB`;
    preview.classList.remove('hidden');
  }
});

// Upload
uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  uploadBtn.disabled = true;
  uploadStatus.textContent = 'Uploading...';
  const fd = new FormData();
  fd.append('file', selectedFile);

  // Show progress UI
  const progressWrap = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const percent = document.getElementById('uploadPercent');
  if (progressWrap) progressWrap.classList.remove('hidden');

  // Use XMLHttpRequest to get upload progress events
  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/index-pdf');

      // Animate the visible progress from 0 -> 100 over a fixed duration (15s)
      const DURATION = 7000; // ms
      const start = Date.now();
      let rafId = null;
      const setVisiblePct = (p) => {
        const v = Math.max(0, Math.min(100, Math.round(p)));
        if (progressFill) progressFill.style.width = v + '%';
        if (percent) percent.textContent = v + '%';
      };

      const step = () => {
        const elapsed = Date.now() - start;
        const pct = (elapsed / DURATION) * 100;
        setVisiblePct(pct);
        if (elapsed < DURATION) {
          rafId = requestAnimationFrame(step);
        } else {
          // ensure final 100%
          setVisiblePct(100);
          rafId = null;
        }
      };

      // Start the visual animation
      rafId = requestAnimationFrame(step);

      // Keep track of xhr events; we don't use actual progress to drive the UI
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { const data = JSON.parse(xhr.responseText); uploadStatus.textContent = data.message || 'Upload complete'; } catch (e) { uploadStatus.textContent = 'Upload complete'; }
          // Wait until animation duration completes before revealing QA and resolving
          const remaining = Math.max(0, DURATION - (Date.now() - start));
          setTimeout(() => {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            setVisiblePct(100);
            qaSection.classList.remove('hidden');
            resolve();
          }, remaining);
        } else {
          if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
          reject(new Error('Upload failed: ' + xhr.status));
        }
      };

      xhr.onerror = () => {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        reject(new Error('Network error'));
      };

      // send
      xhr.send(fd);
    });
  } catch (err) {
    uploadStatus.textContent = err.message || 'Upload error';
  } finally {
    uploadBtn.disabled = false;
    // hide progress after short delay
    setTimeout(() => { const pw = document.getElementById('uploadProgress'); if (pw) pw.classList.add('hidden'); }, 800);
  }
});

// Clear cache button - delete server uploads and reset UI
clearBtn.addEventListener('click', async () => {
  const confirmed = await showConfirm('Clear local upload cache? This will remove uploaded files.');
  if (!confirmed) return;
  clearBtn.disabled = true;
  uploadStatus.textContent = 'Clearing...';
  try {
    const res = await fetch('/clear-cache', { method: 'POST' });
    const j = await res.json();
    uploadStatus.textContent = j.message || 'Cleared';

    // Reset frontend state
    selectedFile = null;
    fileInput.value = '';
    uploadBtn.disabled = true;
    qaSection.classList.add('hidden');
    questionInput.value = '';
    answerContainer.textContent = '';
    citationsRow.innerHTML = '';
    // clear any localStorage used by the app
    try { localStorage.clear(); } catch (e) {}
  } catch (err) {
    uploadStatus.textContent = err.message || 'Clear error';
  } finally {
    clearBtn.disabled = false;
  }
  // hide upload preview
  const preview = document.getElementById('uploadPreview');
  if (preview) preview.classList.add('hidden');
});

// Ask question
askBtn.addEventListener('click', async () => {
  const q = questionInput.value && questionInput.value.trim();
  if (!q) return;
  askBtn.disabled = true;
  answerContainer.textContent = 'Thinking...';
  citationsRow.innerHTML = '';

  try {
    const res = await fetch('/qa', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q })
    });
    if (!res.ok) throw new Error('QA failed');
    const body = await res.json();

    // Show answer
    answerContainer.textContent = body.answer || 'No answer';

    // Render citations horizontally
    lastCitations = body.citations || {};
    citationsRow.innerHTML = '';
    Object.keys(lastCitations).forEach(cid => {
      const meta = lastCitations[cid];
      const chip = document.createElement('div');
      chip.className = 'citation-chip';
      chip.textContent = cid;
      chip.addEventListener('click', () => openCitationModal(cid, meta));
      citationsRow.appendChild(chip);
    });
    // Ensure answer area is visible
    answerContainer.classList.remove('hidden');

  } catch (err) {
    answerContainer.textContent = err.message || 'Error';
  } finally {
    askBtn.disabled = false;
  }
});

function openCitationModal(cid, meta) {
  console.log('openCitationModal', cid, meta);
  // Build a details view showing all metadata fields clearly
  let detailsHtml = `<h3>${cid}</h3>`;
  detailsHtml += '<div class="citation-metadata">';
  for (const key of Object.keys(meta)) {
    if (key === 'snippet') continue;
    detailsHtml += `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(meta[key]))}</p>`;
  }
  detailsHtml += '</div>';
  detailsHtml += `<div class="modal-body-snippet">${escapeHtml(meta.snippet || '')}</div>`;

  modalBody.innerHTML = detailsHtml;
  modal.classList.remove('hidden');
}

// Clear QA (question, answer, citations)
clearQABtn.addEventListener('click', async () => {
  const confirmed = await showConfirm('Clear question, answer, and citations?');
  if (!confirmed) return;
  questionInput.value = '';
  answerContainer.textContent = '';
  answerContainer.classList.add('hidden');
  citationsRow.innerHTML = '';
  lastCitations = null;
});

modalClose.addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

// Themed confirm modal helper
function showConfirm(message) {
  return new Promise((resolve) => {
    const cm = document.getElementById('confirmModal');
    const msg = document.getElementById('confirmMessage');
    const ok = document.getElementById('confirmOk');
    const cancel = document.getElementById('confirmCancel');
    if (!cm || !msg || !ok || !cancel) {
      // fallback to native confirm
      resolve(window.confirm(message));
      return;
    }
    let cleaned = false;
    const cleanup = (val) => {
      if (cleaned) return; cleaned = true;
      cm.classList.add('hidden');
      ok.removeEventListener('click', onOk);
      cancel.removeEventListener('click', onCancel);
      cm.removeEventListener('click', onBackdrop);
      resolve(val);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onBackdrop = (e) => { if (e.target === cm) cleanup(false); };

    msg.textContent = message;
    cm.classList.remove('hidden');
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    cm.addEventListener('click', onBackdrop);
  });
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
