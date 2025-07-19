// UI Components and Utilities
class UIComponents {
  static showResult(message, type = "success") {
    const resultDiv = document.getElementById("result");
    if (resultDiv) {
      resultDiv.className = `result ${type}`;
      resultDiv.textContent = message;
    }
  }

  static showLoading(message) {
    this.showResult(message, "loading");
  }

  static clearLoading() {
    const resultDiv = document.getElementById("result");
    if (resultDiv) {
      resultDiv.className = "";
      resultDiv.textContent = "";
    }
  }

  static disableGenerationButtons() {
    const scriptButton = document.querySelector('button[onclick="generateScript()"]');
    const allButton = document.querySelector('button[onclick="generateAll()"]');

    if (scriptButton) {
      scriptButton.dataset.originalText = scriptButton.textContent;
      scriptButton.disabled = true;
      scriptButton.style.backgroundColor = "#6c757d";
      scriptButton.style.cursor = "not-allowed";
    }

    if (allButton) {
      allButton.dataset.originalText = allButton.textContent;
      allButton.disabled = true;
      allButton.style.backgroundColor = "#6c757d";
      allButton.style.cursor = "not-allowed";
    }
  }

  static enableGenerationButtons() {
    const scriptButton = document.querySelector('button[onclick="generateScript()"]');
    const allButton = document.querySelector('button[onclick="generateAll()"]');

    if (scriptButton) {
      scriptButton.disabled = false;
      scriptButton.textContent = scriptButton.dataset.originalText || "Generate Script";
      scriptButton.style.backgroundColor = "";
      scriptButton.style.cursor = "";
    }

    if (allButton) {
      allButton.disabled = false;
      allButton.textContent = allButton.dataset.originalText || "Generate All";
      allButton.style.backgroundColor = "";
      allButton.style.cursor = "";
    }
  }

  static updateButtonText(buttonType, text) {
    const selector = buttonType === "script" ? 'button[onclick="generateScript()"]' : 'button[onclick="generateAll()"]';
    const button = document.querySelector(selector);
    if (button) {
      button.textContent = text;
    }
  }

  static disableButton(button, loadingText) {
    if (!button) return;
    
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = loadingText;
    button.style.backgroundColor = "#6c757d";
    button.style.cursor = "not-allowed";
  }

  static enableButton(button) {
    if (!button) return;
    
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
    button.style.backgroundColor = "";
    button.style.cursor = "";
  }

  static handleGenerateTypeChange() {
    const generateType = document.querySelector('input[name="generateType"]:checked')?.value;
    const pdfOptions = document.getElementById("pdfOptions");
    const videoOptions = document.getElementById("videoOptions");

    if (pdfOptions) {
      pdfOptions.style.display = generateType === "pdf" ? "block" : "none";
    }
    if (videoOptions) {
      videoOptions.style.display = generateType === "video" ? "block" : "none";
    }
  }

  static displayUserFiles(files) {
    const userFileSelectGroup = document.getElementById("userFileSelectGroup");
    const userFileSelect = document.getElementById("userFileSelect");

    if (!userFileSelect) return;

    // Clear select box
    userFileSelect.innerHTML = '<option value="">-- Select File --</option>';

    if (files.length === 0) {
      if (userFileSelectGroup) {
        userFileSelectGroup.style.display = "none";
      }
      this.showResult("No files found for this user", "error");
      return;
    }

    // Add files
    files.forEach((file) => {
      const option = document.createElement("option");
      option.value = file.path;
      option.textContent = `${file.filename} (${new Date(file.timestamp).toLocaleString("ja-JP")})`;
      userFileSelect.appendChild(option);
    });

    if (userFileSelectGroup) {
      userFileSelectGroup.style.display = "block";
    }
  }

  static displayUserMedia(mediaFiles) {
    const mediaListDiv = document.getElementById("mediaList");
    if (!mediaListDiv) return;

    if (mediaFiles.length === 0) {
      mediaListDiv.innerHTML = "<p>No media files found.</p>";
      return;
    }

    // File size formatter
    function formatFileSize(bytes) {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    }

    mediaListDiv.innerHTML = mediaFiles
      .map(
        (file) => `
          <div class="file-item" style="margin-bottom: 15px;">
            <div class="file-header">
              <span class="file-id">${file.filename}</span>
              <span class="file-status status-${file.type}">${file.type.toUpperCase()}</span>
            </div>
            <div style="font-size: 12px; color: #999; margin-bottom: 10px;">
              Size: ${formatFileSize(file.size)} |
              Generated: ${new Date(file.timestamp).toLocaleString("en-US")}
            </div>
            <div class="file-actions">
              <button onclick="downloadFile('${file.path}')" style="background: #28a745;">
                ${file.type === "video" ? "🎬" : "📄"} Download
              </button>
              ${file.type === "video" ? `<button onclick="previewVideo('${file.path}')" style="background: #17a2b8;">👁️ Preview</button>` : ""}
            </div>
          </div>
        `
      )
      .join("");
  }

  static updateJsonPathFromSelect() {
    const selectedPath = document.getElementById("userFileSelect")?.value;
    const jsonFilePathInput = document.getElementById("jsonFilePath");
    
    if (selectedPath && jsonFilePathInput) {
      jsonFilePathInput.value = selectedPath;

      // Highlight display
      jsonFilePathInput.style.backgroundColor = "#fff3cd";
      setTimeout(() => {
        jsonFilePathInput.style.backgroundColor = "";
      }, CONFIG.UI.MESSAGE_DISPLAY_TIME);
    }
  }

  static copyPathToInput(scriptPath) {
    const jsonFilePathInput = document.getElementById("jsonFilePath");
    if (!jsonFilePathInput) return;
    
    jsonFilePathInput.value = scriptPath;
    jsonFilePathInput.scrollIntoView({ behavior: "smooth", block: "center" });

    // Temporarily highlight input field
    jsonFilePathInput.style.backgroundColor = "#fff3cd";
    setTimeout(() => {
      jsonFilePathInput.style.backgroundColor = "";
    }, CONFIG.UI.MESSAGE_DISPLAY_TIME);

    this.showResult(`✅ Path copied: ${scriptPath}`, "success");
  }

  static toggleAdvancedSection() {
    const generateSection = document.querySelector("#advancedSection");
    if (!generateSection) return;
    
    const isHidden = window.getComputedStyle(generateSection).display === "none";
    generateSection.style.display = isHidden ? "block" : "none";
  }
}

// Make UIComponents available globally
if (typeof window !== 'undefined') {
  window.UIComponents = UIComponents;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIComponents;
}