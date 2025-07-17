// Main Application Logic
class MulmocastApp {
  constructor() {
    this.apiClient = new APIClient();
    this.sseClient = new SSEClient();
    this.fileManager = new FileManager(this.apiClient);
    this.generationForm = new GenerationForm(this.apiClient, this.sseClient);
    
    // Make instances available globally for onclick handlers
    window.apiClient = this.apiClient;
    window.sseClient = this.sseClient;
    window.fileManager = this.fileManager;
    window.generationForm = this.generationForm;
  }

  async init() {
    this.setupEventListeners();
    this.loadUserNameFromStorage();
    await this.checkHealth();
    this.connectSSE();
    
    // Auto-load files for saved user and start auto-refresh
    const savedUserName = this.fileManager.loadUserNameFromStorage();
    if (savedUserName) {
      setTimeout(() => this.fileManager.loadUserFiles(savedUserName), 1000);
      setTimeout(() => {
        this.fileManager.loadUserMedia(savedUserName);
        this.fileManager.startAutoRefresh(savedUserName);
      }, 1500);
    }
  }

  setupEventListeners() {
    // Advanced section toggle
    const toggleButton = document.getElementById("toggleGenerateSectionButton");
    if (toggleButton) {
      toggleButton.addEventListener("click", () => {
        UIComponents.toggleAdvancedSection();
      });
    }

    // Radio button changes for generation type
    const radioButtons = document.querySelectorAll('input[name="generateType"]');
    radioButtons.forEach((radio) => {
      radio.addEventListener("change", UIComponents.handleGenerateTypeChange);
    });

    // User name auto-save and auto-refresh media
    const uniqueUserNameInput = document.getElementById("uniqueUserName");
    if (uniqueUserNameInput) {
      uniqueUserNameInput.addEventListener("change", (e) => {
        const userName = e.target.value.trim();
        if (userName) {
          this.fileManager.saveUserNameToStorage(userName);
          // Auto-refresh media files when user name changes and start auto-refresh
          this.fileManager.loadUserMedia(userName);
          this.fileManager.startAutoRefresh(userName);
        } else {
          // Stop auto-refresh if user name is cleared
          this.fileManager.stopAutoRefresh();
        }
      });
      
      // Also trigger on input (real-time) for better UX
      uniqueUserNameInput.addEventListener("input", (e) => {
        const userName = e.target.value.trim();
        if (userName) {
          // Debounce the input to avoid too many requests
          clearTimeout(this.userNameInputTimeout);
          this.userNameInputTimeout = setTimeout(() => {
            this.fileManager.loadUserMedia(userName);
          }, 500); // Wait 500ms after user stops typing
        }
      });
    }

    // File select update
    const userFileSelect = document.getElementById("userFileSelect");
    if (userFileSelect) {
      userFileSelect.addEventListener("change", UIComponents.updateJsonPathFromSelect);
    }

    // Page unload - disconnect SSE
    window.addEventListener("beforeunload", () => {
      this.sseClient.disconnect();
    });
  }

  loadUserNameFromStorage() {
    const savedUserName = this.fileManager.loadUserNameFromStorage();
    const uniqueUserNameInput = document.getElementById("uniqueUserName");
    if (savedUserName && uniqueUserNameInput) {
      uniqueUserNameInput.value = savedUserName;
    }
  }

  async checkHealth() {
    UIComponents.showLoading("ヘルスチェック中...");
    try {
      const result = await this.apiClient.checkHealth();
      UIComponents.showResult(`✅ ヘルスチェック成功!\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      UIComponents.showResult(`❌ ヘルスチェック失敗: ${error.message}`, "error");
    }
  }

  connectSSE() {
    const userName = document.getElementById("uniqueUserName")?.value?.trim();
    this.sseClient.connect(userName);
  }
}

// Global functions for onclick handlers (maintaining backward compatibility)
async function checkHealth() {
  if (window.mulmocastApp) {
    await window.mulmocastApp.checkHealth();
  }
}

async function generateScript() {
  if (window.generationForm) {
    await window.generationForm.generateScript();
  }
}

async function generateAll() {
  if (window.generationForm) {
    await window.generationForm.generateAll();
  }
}

async function generateFromJsonPath() {
  if (window.generationForm) {
    await window.generationForm.generateFromJsonPath();
  }
}

async function generateVideoFromFile(fileId) {
  if (window.generationForm) {
    await window.generationForm.generateVideoFromFile(fileId);
  }
}

async function generatePdfFromFile(fileId) {
  if (window.generationForm) {
    await window.generationForm.generatePdfFromFile(fileId);
  }
}

async function loadUserFiles() {
  const userName = document.getElementById("uniqueUserName")?.value?.trim();
  if (window.fileManager && userName) {
    await window.fileManager.loadUserFiles(userName);
  }
}

async function loadUserMedia() {
  const userName = document.getElementById("uniqueUserName")?.value?.trim();
  if (window.fileManager && userName) {
    await window.fileManager.loadUserMedia(userName);
  }
}

async function loadUserMediaWithAutoRefresh() {
  const userName = document.getElementById("uniqueUserName")?.value?.trim();
  if (window.fileManager && userName) {
    await window.fileManager.loadUserMedia(userName);
    window.fileManager.startAutoRefresh(userName);
  }
}

function stopAutoRefresh() {
  if (window.fileManager) {
    window.fileManager.stopAutoRefresh();
  }
}

function downloadFile(filePath) {
  if (window.fileManager) {
    window.fileManager.downloadFile(filePath);
  }
}

function previewVideo(filePath) {
  if (window.fileManager) {
    window.fileManager.previewVideo(filePath);
  }
}

function updateJsonPathFromSelect() {
  UIComponents.updateJsonPathFromSelect();
}

function clearMessages() {
  if (window.sseClient) {
    window.sseClient.clearMessages();
  }
}

// Initialize application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.mulmocastApp = new MulmocastApp();
});

// Initialize application when window loads
window.addEventListener("load", () => {
  if (window.mulmocastApp) {
    window.mulmocastApp.init();
  }
});

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MulmocastApp;
}