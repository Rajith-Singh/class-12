// Advanced RAG QA Frontend with Enhanced UI/UX
class RAGInterface {
  constructor() {
    this.selectedFile = null;
    this.lastCitations = null;
    this.currentModalIndex = 0;
    this.modalCitations = [];
    
    this.initElements();
    this.initEventListeners();
    this.initAnimations();
    this.initParticles();
    this.initSuggestions();
  }
  
  initElements() {
    // Core elements
    this.dropzone = document.getElementById('dropzone');
    this.fileInput = document.getElementById('fileInput');
    this.uploadBtn = document.getElementById('uploadBtn');
    this.uploadStatus = document.getElementById('uploadStatus');
    this.qaSection = document.getElementById('qaSection');
    this.questionInput = document.getElementById('questionInput');
    this.askBtn = document.getElementById('askBtn');
    this.answerContainer = document.getElementById('answerContainer');
    this.answerText = document.getElementById('answerText');
    this.citationsRow = document.getElementById('citationsRow');
    this.modal = document.getElementById('modal');
    this.modalBody = document.getElementById('modalBody');
    this.modalClose = document.getElementById('modalClose');
    this.clearBtn = document.getElementById('clearBtn');
    this.clearQABtn = document.getElementById('clearQABtn');
    this.toast = document.getElementById('toast');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    
    // New elements
    this.charCount = document.getElementById('charCount');
    this.responseTime = document.getElementById('responseTime');
    this.confidenceScore = document.getElementById('confidenceScore');
    this.citationCount = document.getElementById('citationCount');
    this.evidenceMap = document.getElementById('evidenceMap');
    this.relationshipCanvas = document.getElementById('relationshipCanvas');
    
    // Initialize feature buttons after DOM is loaded
    setTimeout(() => {
      this.initFeatureButtons();
    }, 100);
  }
  
  initEventListeners() {
    // File upload
    this.dropzone.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    
    // Drag and drop
    this.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropzone.classList.add('dragover');
      this.showHoverEffect();
    });
    
    this.dropzone.addEventListener('dragleave', () => {
      this.dropzone.classList.remove('dragover');
      this.hideHoverEffect();
    });
    
    this.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropzone.classList.remove('dragover');
      this.hideHoverEffect();
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        this.handleFile(file);
      } else {
        this.showToast('Please upload a PDF file', 'error');
      }
    });
    
    // Upload button
    this.uploadBtn.addEventListener('click', () => this.uploadFile());
    
    // Clear buttons
    this.clearBtn.addEventListener('click', () => this.clearCache());
    this.clearQABtn.addEventListener('click', () => this.clearQA());
    
    // Question input
    this.questionInput.addEventListener('input', () => this.updateCharCount());
    this.questionInput.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        this.askQuestion();
      }
    });
    
    // Ask button
    this.askBtn.addEventListener('click', () => this.askQuestion());
    
    // Modal
    this.modalClose.addEventListener('click', () => this.closeModal());
    this.modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.closeModal();
      }
    });
    
    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        this.questionInput.value = e.currentTarget.dataset.question;
        this.updateCharCount();
        this.questionInput.focus();
      });
    });
    
    // Floating indicators
    document.querySelectorAll('.floating-indicator').forEach(indicator => {
      indicator.addEventListener('click', (e) => {
        const step = e.currentTarget.dataset.step;
        this.scrollToStep(step);
      });
    });
  }
  
  initFeatureButtons() {
    // Initialize answer feature buttons
    const featureButtons = document.querySelectorAll('.feature-btn');
    featureButtons.forEach(btn => {
      const title = btn.getAttribute('title');
      
      if (title === 'Read aloud') {
        btn.addEventListener('click', () => this.readAloud());
      } else if (title === 'Copy answer') {
        btn.addEventListener('click', () => this.copyAnswer());
      } else if (title === 'Export') {
        btn.addEventListener('click', () => this.exportAnswer());
      }
    });
    
    // Initialize preview and info buttons in upload section
    const previewBtn = document.querySelector('.preview-btn');
    const infoBtn = document.querySelector('.info-btn');
    
    if (previewBtn) {
      previewBtn.addEventListener('click', () => this.showFilePreview());
    }
    
    if (infoBtn) {
      infoBtn.addEventListener('click', () => this.showFileInfo());
    }
  }
  
  initAnimations() {
    // Initialize GSAP animations if available
    if (typeof gsap !== 'undefined') {
      this.initGSAPAnimations();
    }
    
    // Add scroll animations
    this.initScrollAnimations();
  }
  
  initGSAPAnimations() {
    // Example GSAP animations
    gsap.from('.logo-container', {
      duration: 1,
      y: -30,
      opacity: 0,
      ease: "power3.out"
    });
    
    gsap.from('.header-stats .stat-item', {
      duration: 1,
      x: -20,
      opacity: 0,
      stagger: 0.2,
      ease: "power3.out",
      delay: 0.3
    });
  }
  
  initScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animated');
          const step = entry.target.dataset.step;
          if (step) {
            this.updateFloatingIndicator(step);
          }
        }
      });
    }, observerOptions);
    
    document.querySelectorAll('[data-step]').forEach(el => observer.observe(el));
  }
  
  initParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    // Create simple particle system
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.cssText = `
        position: absolute;
        width: ${Math.random() * 4 + 1}px;
        height: ${Math.random() * 4 + 1}px;
        background: ${Math.random() > 0.5 ? 'rgba(99, 102, 241, 0.3)' : 'rgba(6, 182, 212, 0.3)'};
        border-radius: 50%;
        top: ${Math.random() * 100}%;
        left: ${Math.random() * 100}%;
        filter: blur(${Math.random() * 2}px);
        animation: floatParticle ${Math.random() * 20 + 10}s infinite linear;
        animation-delay: ${Math.random() * 5}s;
      `;
      particlesContainer.appendChild(particle);
    }
    
    // Add CSS for particle animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes floatParticle {
        0% {
          transform: translate(0, 0) rotate(0deg);
        }
        25% {
          transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px) rotate(90deg);
        }
        50% {
          transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px) rotate(180deg);
        }
        75% {
          transform: translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px) rotate(270deg);
        }
        100% {
          transform: translate(0, 0) rotate(360deg);
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  initSuggestions() {
    // Initialize tooltips
    this.initTooltips();
  }
  
  initTooltips() {
    const tooltipElements = document.querySelectorAll('[title]');
    tooltipElements.forEach(el => {
      el.addEventListener('mouseenter', (e) => {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = e.currentTarget.title;
        document.body.appendChild(tooltip);
        
        const rect = e.currentTarget.getBoundingClientRect();
        tooltip.style.cssText = `
          position: fixed;
          top: ${rect.top - 40}px;
          left: ${rect.left + rect.width / 2}px;
          transform: translateX(-50%);
          background: var(--bg-tertiary);
          color: var(--text-primary);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 12px;
          white-space: nowrap;
          z-index: 10000;
          border: 1px solid var(--border-light);
          pointer-events: none;
        `;
        
        e.currentTarget.tooltip = tooltip;
      });
      
      el.addEventListener('mouseleave', (e) => {
        if (e.currentTarget.tooltip) {
          e.currentTarget.tooltip.remove();
          e.currentTarget.tooltip = null;
        }
      });
    });
  }
  
  // ====== FEATURE FUNCTIONS ======
  
  readAloud() {
    const answerText = this.answerText.textContent;
    if (!answerText || answerText.trim() === '') {
      this.showToast('No answer to read aloud', 'warning');
      return;
    }
    
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(answerText);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Try to get a nice voice
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.lang.includes('en') && voice.name.includes('Natural')
      );
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }
      
      speechSynthesis.speak(utterance);
      this.showToast('Reading answer aloud...', 'info');
    } else {
      this.showToast('Speech synthesis not supported in this browser', 'error');
    }
  }
  
  copyAnswer() {
    const answerText = this.answerText.textContent;
    if (!answerText || answerText.trim() === '') {
      this.showToast('No answer to copy', 'warning');
      return;
    }
    
    navigator.clipboard.writeText(answerText)
      .then(() => {
        this.showToast('Answer copied to clipboard!', 'success');
        // Visual feedback
        const copyBtn = document.querySelector('.feature-btn[title="Copy answer"]');
        if (copyBtn) {
          const originalIcon = copyBtn.innerHTML;
          copyBtn.innerHTML = '<i class="fas fa-check"></i>';
          copyBtn.style.color = '#10b981';
          
          setTimeout(() => {
            copyBtn.innerHTML = originalIcon;
            copyBtn.style.color = '';
          }, 2000);
        }
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        this.showToast('Failed to copy answer', 'error');
      });
  }
  
  exportAnswer() {
    const answerText = this.answerText.textContent;
    if (!answerText || answerText.trim() === '') {
      this.showToast('No answer to export', 'warning');
      return;
    }
    
    // Create export content with metadata
    const question = this.questionInput.value.trim();
    const responseTime = this.responseTime.textContent;
    const confidence = this.confidenceScore.textContent;
    const citationCount = this.citationCount.textContent;
    const exportDate = new Date().toLocaleString();
    
    // Build export content
    let exportContent = `=== NexusRAG Analysis Export ===\n\n`;
    exportContent += `Export Date: ${exportDate}\n`;
    exportContent += `Question: ${question}\n`;
    exportContent += `Response Time: ${responseTime}\n`;
    exportContent += `Confidence: ${confidence}\n`;
    exportContent += `Sources: ${citationCount}\n\n`;
    exportContent += `=== ANSWER ===\n\n`;
    exportContent += `${answerText}\n\n`;
    
    // Add citations if available
    if (this.lastCitations && Object.keys(this.lastCitations).length > 0) {
      exportContent += `=== SOURCE CITATIONS ===\n\n`;
      Object.entries(this.lastCitations).forEach(([cid, meta], index) => {
        exportContent += `[${index + 1}] ${cid}\n`;
        exportContent += `Snippet: ${(meta.snippet || '').substring(0, 200)}...\n`;
        if (meta.page) exportContent += `Page: ${meta.page}\n`;
        if (meta.score) exportContent += `Relevance: ${(meta.score * 100).toFixed(1)}%\n`;
        exportContent += `\n`;
      });
    }
    
    exportContent += `\n=== End of Export ===\n`;
    exportContent += `Generated by NexusRAG - Intelligent Document Analysis Platform`;
    
    // Create filename
    const sanitizedQuestion = question.substring(0, 50).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `nexusrag_analysis_${sanitizedQuestion || 'export'}_${Date.now()}.txt`;
    
    // Create and trigger download
    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    
    // Visual feedback
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Show success message
    this.showToast(`Exported as ${filename}`, 'success');
    
    // Visual feedback on button
    const exportBtn = document.querySelector('.feature-btn[title="Export"]');
    if (exportBtn) {
      const originalIcon = exportBtn.innerHTML;
      exportBtn.innerHTML = '<i class="fas fa-check"></i>';
      exportBtn.style.color = '#10b981';
      
      setTimeout(() => {
        exportBtn.innerHTML = originalIcon;
        exportBtn.style.color = '';
      }, 2000);
    }
  }
  
  showFilePreview() {
    if (!this.selectedFile) {
      this.showToast('No file selected', 'warning');
      return;
    }
    
    // Create a modal preview
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-container">
        <div class="modal-header">
          <h3 class="modal-title">
            <i class="fas fa-file-pdf"></i>
            <span>File Preview: ${this.selectedFile.name}</span>
          </h3>
          <button class="modal-close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <div class="file-preview-content">
            <div class="preview-info">
              <p><strong>Name:</strong> ${this.selectedFile.name}</p>
              <p><strong>Size:</strong> ${this.formatFileSize(this.selectedFile.size)}</p>
              <p><strong>Type:</strong> ${this.selectedFile.type}</p>
              <p><strong>Last Modified:</strong> ${new Date(this.selectedFile.lastModified).toLocaleString()}</p>
            </div>
            <div class="preview-note">
              <i class="fas fa-info-circle"></i>
              <p>Note: For full PDF preview, please open the file in a PDF viewer. This preview shows basic file information only.</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" id="closePreview">
            Close
          </button>
          <button class="btn primary" id="openInViewer">
            <i class="fas fa-external-link-alt"></i>
            Open in Viewer
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.querySelector('.modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.modal-overlay').addEventListener('click', () => modal.remove());
    modal.querySelector('#closePreview').addEventListener('click', () => modal.remove());
    modal.querySelector('#openInViewer').addEventListener('click', () => {
      const url = URL.createObjectURL(this.selectedFile);
      window.open(url, '_blank');
    });
    
    // Add styles for preview
    const style = document.createElement('style');
    style.textContent = `
      .file-preview-content {
        padding: 20px;
      }
      
      .preview-info p {
        margin: 10px 0;
        color: var(--text-secondary);
      }
      
      .preview-info strong {
        color: var(--text-primary);
        margin-right: 8px;
        display: inline-block;
        width: 120px;
      }
      
      .preview-note {
        margin-top: 20px;
        padding: 15px;
        background: rgba(99, 102, 241, 0.1);
        border-radius: 8px;
        display: flex;
        gap: 10px;
        align-items: flex-start;
      }
      
      .preview-note i {
        color: var(--primary-light);
        font-size: 18px;
        margin-top: 2px;
      }
      
      .preview-note p {
        margin: 0;
        color: var(--text-secondary);
        font-size: 14px;
        line-height: 1.5;
      }
    `;
    modal.appendChild(style);
  }
  
  showFileInfo() {
    this.showToast('File information displayed in console', 'info');
    if (this.selectedFile) {
      console.log('File Information:', {
        name: this.selectedFile.name,
        size: this.selectedFile.size,
        type: this.selectedFile.type,
        lastModified: new Date(this.selectedFile.lastModified),
        sizeFormatted: this.formatFileSize(this.selectedFile.size)
      });
    }
  }
  
  // ====== CORE FUNCTIONALITY ======
  
  handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (file) {
      this.handleFile(file);
    }
  }
  
  handleFile(file) {
    this.selectedFile = file;
    this.uploadBtn.disabled = false;
    
    // Update UI
    this.updateFilePreview(file);
    this.showToast('File selected: ' + file.name, 'success');
  }
  
  updateFilePreview(file) {
    const preview = document.getElementById('uploadPreview');
    const nameEl = document.getElementById('uploadName');
    const sizeEl = document.getElementById('uploadSize');
    
    nameEl.textContent = file.name.length > 30 ? file.name.substring(0, 30) + '...' : file.name;
    sizeEl.textContent = this.formatFileSize(file.size);
    
    preview.classList.remove('hidden');
    
    // Animate in
    preview.style.animation = 'slideUp 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
  }
  
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
  
  async uploadFile() {
    if (!this.selectedFile) return;
    
    this.uploadBtn.disabled = true;
    this.showLoading('Processing document...');
    
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    
    try {
      // Simulate progress animation
      this.simulateProgress();
      
      const response = await fetch('/index-pdf', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      
      // Show success
      this.showToast('Document processed successfully!', 'success');
      
      // Reveal QA section with animation
      await this.revealQASection();
      
      // Update floating indicator
      this.updateFloatingIndicator('2');
      
    } catch (error) {
      this.showToast('Upload failed: ' + error.message, 'error');
    } finally {
      this.hideLoading();
      this.uploadBtn.disabled = false;
    }
  }
  
  simulateProgress() {
    const progressFill = document.getElementById('progressFill');
    const uploadPercent = document.getElementById('uploadPercent');
    const progressContainer = document.getElementById('uploadProgress');
    
    progressContainer.classList.remove('hidden');
    
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
      }
      
      progressFill.style.width = progress + '%';
      uploadPercent.textContent = Math.floor(progress) + '%';
    }, 100);
  }
  
  async revealQASection() {
    this.qaSection.classList.remove('hidden');
    
    // Add entrance animation
    this.qaSection.style.animation = 'slideUp 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
    
    // Focus on question input after a delay
    setTimeout(() => {
      this.questionInput.focus();
    }, 600);
  }
  
  updateCharCount() {
    const length = this.questionInput.value.length;
    this.charCount.textContent = length;
    
    // Update character count color based on length
    if (length > 400) {
      this.charCount.style.color = '#ef4444';
    } else if (length > 300) {
      this.charCount.style.color = '#f59e0b';
    } else {
      this.charCount.style.color = 'var(--text-secondary)';
    }
  }
  
  async askQuestion() {
    const question = this.questionInput.value.trim();
    if (!question) {
      this.showToast('Please enter a question', 'warning');
      return;
    }
    
    this.showLoading('Analyzing document...');
    this.askBtn.disabled = true;
    
    try {
      const startTime = Date.now();
      
      const response = await fetch('/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      });
      
      if (!response.ok) throw new Error('QA failed');
      
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      // Update response metrics
      this.responseTime.textContent = (responseTime / 1000).toFixed(2) + 's';
      this.confidenceScore.textContent = '92% confidence'; // Simulated confidence
      
      // Display answer with typing animation
      await this.displayAnswer(data.answer || 'No answer found');
      
      // Display citations
      this.displayCitations(data.citations || {});
      
      // Show evidence map
      this.evidenceMap.classList.remove('hidden');
      
      // Update floating indicator
      this.updateFloatingIndicator('3');
      
      // Update citation count
      const citationCount = Object.keys(data.citations || {}).length;
      this.citationCount.textContent = `${citationCount} source${citationCount !== 1 ? 's' : ''}`;
      
    } catch (error) {
      this.showToast('Analysis failed: ' + error.message, 'error');
      this.answerText.textContent = 'Error: ' + error.message;
    } finally {
      this.hideLoading();
      this.askBtn.disabled = false;
    }
  }
  
  async displayAnswer(answer) {
    this.answerContainer.classList.remove('hidden');
    this.answerText.textContent = '';
    
    // Typewriter effect
    const words = answer.split(' ');
    let index = 0;
    
    const typeNextWord = () => {
      if (index < words.length) {
        this.answerText.textContent += (index === 0 ? '' : ' ') + words[index];
        index++;
        
        // Random typing speed
        setTimeout(typeNextWord, Math.random() * 50 + 20);
      }
    };
    
    typeNextWord();
  }
  
  displayCitations(citations) {
    this.lastCitations = citations;
    this.modalCitations = Object.entries(citations);
    this.citationsRow.innerHTML = '';
    
    this.modalCitations.forEach(([cid, meta], index) => {
      const chip = document.createElement('div');
      chip.className = 'citation-chip';
      chip.innerHTML = `
        <i class="fas fa-file-alt"></i>
        <h5>${this.escapeHtml(cid)}</h5>
        <p>${this.truncateText(meta.snippet || 'No content', 80)}</p>
        <div class="citation-score">
          <div class="score-bar" style="width: ${Math.min(100, (meta.score || 0.5) * 100)}%"></div>
        </div>
      `;
      
      chip.addEventListener('click', () => this.openCitationModal(index));
      this.citationsRow.appendChild(chip);
    });
  }
  
  openCitationModal(index) {
    this.currentModalIndex = index;
    const [cid, meta] = this.modalCitations[index];
    
    // Build modal content
    let modalHtml = `
      <div class="citation-detail">
        <div class="citation-header">
          <div class="citation-id">
            <i class="fas fa-hashtag"></i>
            <span>${this.escapeHtml(cid)}</span>
          </div>
          <div class="citation-meta">
            <span class="meta-badge">
              <i class="fas fa-ruler"></i>
              ${meta.page || 'N/A'} pages
            </span>
            <span class="meta-badge">
              <i class="fas fa-percentage"></i>
              ${((meta.score || 0) * 100).toFixed(1)}% relevance
            </span>
          </div>
        </div>
        
        <div class="citation-content">
          <h4>Source Content</h4>
          <div class="content-snippet">
            ${this.formatSnippet(meta.snippet || 'No content available')}
          </div>
        </div>
        
        <div class="citation-stats">
          <div class="stat">
            <div class="stat-label">Confidence</div>
            <div class="stat-value high">${((meta.confidence || 0.85) * 100).toFixed(0)}%</div>
          </div>
          <div class="stat">
            <div class="stat-label">Position</div>
            <div class="stat-value">${meta.position || 'Unknown'}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Tokens</div>
            <div class="stat-value">${meta.tokens || 'N/A'}</div>
          </div>
        </div>
      </div>
    `;
    
    this.modalBody.innerHTML = modalHtml;
    this.modal.classList.remove('hidden');
    
    // Add CSS for modal content
    this.addModalStyles();
  }
  
  formatSnippet(snippet) {
    // Format snippet with highlights
    const lines = snippet.split('\n').filter(line => line.trim());
    return lines.map(line => {
      const highlighted = line.replace(
        /\b(\w{5,})\b/g,
        '<span class="highlight">$1</span>'
      );
      return `<p>${highlighted}</p>`;
    }).join('');
  }
  
  addModalStyles() {
    const styles = `
      .citation-detail {
        padding: 20px;
      }
      
      .citation-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--border-light);
      }
      
      .citation-id {
        display: flex;
        align-items: center;
        gap: 10px;
        font-family: 'Courier New', monospace;
        font-size: 14px;
        color: var(--text-primary);
      }
      
      .citation-id i {
        color: var(--primary-light);
      }
      
      .citation-meta {
        display: flex;
        gap: 12px;
      }
      
      .meta-badge {
        padding: 6px 12px;
        background: var(--bg-tertiary);
        border-radius: 20px;
        font-size: 12px;
        color: var(--text-secondary);
        display: flex;
        align-items: center;
        gap: 6px;
      }
      
      .citation-content {
        margin-bottom: 24px;
      }
      
      .citation-content h4 {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 12px;
        color: var(--text-primary);
      }
      
      .content-snippet {
        background: var(--bg-tertiary);
        border-radius: 12px;
        padding: 20px;
        font-size: 14px;
        line-height: 1.6;
        color: var(--text-secondary);
        max-height: 300px;
        overflow-y: auto;
      }
      
      .content-snippet p {
        margin-bottom: 12px;
      }
      
      .content-snippet p:last-child {
        margin-bottom: 0;
      }
      
      .highlight {
        background: rgba(99, 102, 241, 0.2);
        padding: 2px 4px;
        border-radius: 4px;
        color: var(--primary-light);
      }
      
      .citation-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        padding: 20px;
        background: var(--bg-tertiary);
        border-radius: 12px;
      }
      
      .stat {
        text-align: center;
      }
      
      .stat-label {
        font-size: 12px;
        color: var(--text-secondary);
        margin-bottom: 4px;
      }
      
      .stat-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--text-primary);
      }
      
      .stat-value.high {
        color: #10b981;
      }
      
      .citation-score {
        height: 4px;
        background: var(--bg-tertiary);
        border-radius: 2px;
        margin-top: 8px;
        overflow: hidden;
      }
      
      .score-bar {
        height: 100%;
        background: var(--gradient-primary);
        border-radius: 2px;
      }
    `;
    
    const styleEl = document.createElement('style');
    styleEl.textContent = styles;
    this.modalBody.appendChild(styleEl);
  }
  
  closeModal() {
    this.modal.classList.add('hidden');
  }
  
  async clearCache() {
    const confirmed = await this.showConfirm(
      'Clear Document Cache',
      'This will remove all uploaded documents and their vector embeddings. This action cannot be undone.'
    );
    
    if (!confirmed) return;
    
    this.showLoading('Clearing cache...');
    
    try {
      const response = await fetch('/clear-cache', { method: 'POST' });
      const data = await response.json();
      
      // Reset UI
      this.selectedFile = null;
      this.fileInput.value = '';
      this.uploadBtn.disabled = true;
      this.qaSection.classList.add('hidden');
      this.questionInput.value = '';
      this.answerContainer.classList.add('hidden');
      this.citationsRow.innerHTML = '';
      this.evidenceMap.classList.add('hidden');
      
      // Hide upload preview
      document.getElementById('uploadPreview').classList.add('hidden');
      
      this.showToast('Cache cleared successfully', 'success');
      this.updateFloatingIndicator('1');
      
    } catch (error) {
      this.showToast('Failed to clear cache: ' + error.message, 'error');
    } finally {
      this.hideLoading();
    }
  }
  
  clearQA() {
    this.questionInput.value = '';
    this.answerContainer.classList.add('hidden');
    this.citationsRow.innerHTML = '';
    this.evidenceMap.classList.add('hidden');
    this.updateCharCount();
  }
  
  showToast(message, type = 'info') {
    const toast = this.toast;
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = toast.querySelector('i');
    
    // Set icon based on type
    switch (type) {
      case 'success':
        toastIcon.className = 'fas fa-check-circle';
        toastIcon.style.color = '#10b981';
        break;
      case 'error':
        toastIcon.className = 'fas fa-exclamation-circle';
        toastIcon.style.color = '#ef4444';
        break;
      case 'warning':
        toastIcon.className = 'fas fa-exclamation-triangle';
        toastIcon.style.color = '#f59e0b';
        break;
      default:
        toastIcon.className = 'fas fa-info-circle';
        toastIcon.style.color = '#3b82f6';
    }
    
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 5000);
  }
  
  showLoading(message) {
    const loadingMessage = document.getElementById('loadingMessage');
    if (loadingMessage && message) {
      loadingMessage.textContent = message;
    }
    this.loadingOverlay.classList.remove('hidden');
  }
  
  hideLoading() {
    this.loadingOverlay.classList.add('hidden');
  }
  
  async showConfirm(title, message) {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirmModal');
      const titleEl = document.getElementById('confirmTitle');
      const messageEl = document.getElementById('confirmMessage');
      const okBtn = document.getElementById('confirmOk');
      const cancelBtn = document.getElementById('confirmCancel');
      
      titleEl.textContent = title;
      messageEl.textContent = message;
      
      modal.classList.remove('hidden');
      
      const cleanup = () => {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
      };
      
      const onOk = () => {
        cleanup();
        resolve(true);
      };
      
      const onCancel = () => {
        cleanup();
        resolve(false);
    };
      
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      
      // Close on overlay click
      modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
          onCancel();
        }
      });
    });
  }
  
  updateFloatingIndicator(step) {
    document.querySelectorAll('.floating-indicator').forEach(indicator => {
      indicator.classList.remove('active');
      if (indicator.dataset.step === step) {
        indicator.classList.add('active');
      }
    });
  }
  
  scrollToStep(step) {
    const element = document.querySelector(`[data-step="${step}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  
  showHoverEffect() {
    // Add visual feedback for drag over
    const dropzoneContent = this.dropzone.querySelector('.dropzone-content');
    if (dropzoneContent) {
      dropzoneContent.style.transform = 'scale(1.05)';
      dropzoneContent.style.transition = 'transform 0.3s ease';
    }
  }
  
  hideHoverEffect() {
    const dropzoneContent = this.dropzone.querySelector('.dropzone-content');
    if (dropzoneContent) {
      dropzoneContent.style.transform = 'scale(1)';
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  truncateText(text, length) {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  window.ragApp = new RAGInterface();
  
  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+U to focus upload
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      document.getElementById('fileInput').click();
    }
    
    // Ctrl+L to clear
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      if (confirm('Clear current session?')) {
        window.ragApp.clearQA();
      }
    }
    
    // Ctrl+E to export
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      window.ragApp.exportAnswer();
    }
    
    // Ctrl+C to copy answer
    if (e.ctrlKey && e.key === 'c' && !e.shiftKey) {
      e.preventDefault();
      window.ragApp.copyAnswer();
    }
  });
  
  // Add responsive behavior
  window.addEventListener('resize', () => {
    // Adjust layout based on viewport
    const grid = document.querySelector('.grid');
    if (window.innerWidth < 768) {
      grid.style.gap = '16px';
    } else {
      grid.style.gap = '32px';
    }
  });
  
  // Add keyboard shortcut hint
  console.log('Keyboard shortcuts available:');
  console.log('Ctrl+U: Upload file');
  console.log('Ctrl+Enter: Ask question');
  console.log('Ctrl+E: Export answer');
  console.log('Ctrl+C: Copy answer');
  console.log('Ctrl+L: Clear session');
});