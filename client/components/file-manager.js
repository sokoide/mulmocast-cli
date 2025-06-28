// File Management Component
class FileManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
  }

  async loadUserFiles(userName) {
    if (!userName) {
      UIComponents.showResult("❌ Please enter Unique User Name", "error");
      return;
    }

    UIComponents.showLoading(`Loading ${userName}'s files...`);
    try {
      const result = await this.apiClient.getUserFiles(userName);
      UIComponents.displayUserFiles(result.data);
      UIComponents.showResult(`✅ Loaded ${userName}'s files`);
    } catch (error) {
      UIComponents.showResult(`❌ Failed to load ${userName}'s files: ${error.message}`, "error");
    }
  }

  async loadUserMedia(userName) {
    if (!userName) {
      UIComponents.showResult("❌ Please enter Unique User Name", "error");
      return;
    }

    UIComponents.showLoading(`Loading ${userName}'s media files...`);
    try {
      const result = await this.apiClient.getUserMedia(userName);
      UIComponents.displayUserMedia(result.data);
      UIComponents.showResult(`✅ Loaded ${userName}'s media files`);

      // Show media section
      const mediaHistory = document.getElementById("mediaHistory");
      if (mediaHistory) {
        mediaHistory.style.display = "block";
      }
    } catch (error) {
      UIComponents.showResult(`❌ Failed to load ${userName}'s media files: ${error.message}`, "error");
    }
  }

  downloadFile(filePath) {
    // filePath format: "output/userName/fileName"
    const pathParts = filePath.split("/");
    const userName = pathParts[1];
    const fileName = pathParts[2];

    const downloadUrl = this.apiClient.getDownloadUrl(userName, fileName);

    // Create download link and click
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    UIComponents.showResult(`✅ Started downloading ${fileName}`, "success");
  }

  previewVideo(filePath) {
    const pathParts = filePath.split("/");
    const fileName = pathParts[2];

    const videoUrl = this.apiClient.getFilePreviewUrl(filePath);

    // Open new window for video
    const previewWindow = window.open("", "_blank", "width=800,height=600");
    previewWindow.document.write(`
      <html>
        <head><title>Video Preview: ${fileName}</title></head>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif;">
          <h2>Video Preview: ${fileName}</h2>
          <video width="100%" height="auto" controls>
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
          </video>
        </body>
      </html>
    `);
    previewWindow.document.close();
  }

  // Local storage helpers
  loadUserNameFromStorage() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.USER_NAME);
  }

  saveUserNameToStorage(userName) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_NAME, userName);
  }
}

// Make FileManager available globally
if (typeof window !== 'undefined') {
  window.FileManager = FileManager;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileManager;
}