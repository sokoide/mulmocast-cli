// File Manager Component
class FileManager {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.autoRefreshInterval = null;
  }

  async loadUserFiles(userName) {
    if (!userName) return;

    try {
      UIComponents.showLoading("Loading user files...");
      const result = await this.apiClient.makeRequest(`${CONFIG.ENDPOINTS.USER_FILES}/${userName}`);
      
      this.displayUserFiles(result.data || []);
      UIComponents.clearLoading();
    } catch (error) {
      UIComponents.showResult(`❌ Failed to load files: ${error.message}`, "error");
    }
  }

  async loadUserMedia(userName) {
    if (!userName) return;

    try {
      UIComponents.showLoading("Loading media files...");
      const result = await this.apiClient.makeRequest(`${CONFIG.ENDPOINTS.USER_MEDIA}/${userName}`);
      
      this.displayUserMedia(result.data || []);
      UIComponents.clearLoading();
    } catch (error) {
      UIComponents.showResult(`❌ Failed to load media: ${error.message}`, "error");
      console.error('Error loading user media:', error);
    }
  }

  async loadUserMediaSilent(userName) {
    if (!userName) return;

    try {
      const result = await this.apiClient.makeRequest(`${CONFIG.ENDPOINTS.USER_MEDIA}/${userName}`);
      this.displayUserMedia(result.data || []);
      console.log(`Auto-refresh completed for ${userName} - found ${result.data?.length || 0} files`);
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }
  }

  displayUserFiles(files) {
    const userFileSelect = document.getElementById("userFileSelect");
    if (!userFileSelect) return;

    // Clear existing options except the first one
    userFileSelect.innerHTML = '<option value="">-- Select a file --</option>';

    files.forEach((file) => {
      const option = document.createElement("option");
      option.value = file.path;
      option.textContent = file.filename;
      userFileSelect.appendChild(option);
    });
  }

  displayUserMedia(mediaFiles) {
    const mediaList = document.getElementById("mediaList");
    if (!mediaList) return;

    if (mediaFiles.length === 0) {
      mediaList.innerHTML = '<p style="color: #666; font-style: italic;">No media files found for this user.</p>';
      return;
    }

    let html = '<div style="margin-top: 10px;">';
    html += '<table style="width: 100%; border-collapse: collapse; font-size: 14px;">';
    html += '<thead><tr style="background: #f5f5f5;">';
    html += '<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">File</th>';
    html += '<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Size</th>';
    html += '<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Modified</th>';
    html += '<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Status</th>';
    html += '<th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Actions</th>';
    html += '</tr></thead><tbody>';

    mediaFiles.forEach((file) => {
      const fileExtension = file.filename.split('.').pop().toLowerCase();
      const isVideo = fileExtension === 'mp4';
      const isPdf = fileExtension === 'pdf';
      
      // Get moderation status styling
      const statusInfo = this.getModerationStatusInfo(file.moderationStatus);
      
      html += '<tr>';
      html += `<td style="padding: 8px; border: 1px solid #ddd;">${file.filename}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #ddd;">${this.formatFileSize(file.size)}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #ddd;">${this.formatDate(file.timestamp || file.lastModified)}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #ddd;">
        <span style="background: ${statusInfo.color}; color: white; padding: 2px 6px; border-radius: 3px; font-size: 12px;">
          ${statusInfo.emoji} ${statusInfo.text}
        </span>
      </td>`;
      
      // Actions column with moderation checks
      html += '<td style="padding: 8px; border: 1px solid #ddd;">';
      
      if (file.canPreview && (isVideo || isPdf)) {
        html += `<button onclick="window.fileManager.previewFile('${file.path}')" 
          style="margin-right: 5px; padding: 4px 8px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">
          👁️ Preview
        </button>`;
      } else if (!file.canPreview) {
        html += `<button disabled 
          style="margin-right: 5px; padding: 4px 8px; background: #ccc; color: #666; border: none; border-radius: 3px; cursor: not-allowed;" 
          title="File pending moderation">
          👁️ Preview
        </button>`;
      }
      
      if (file.canDownload) {
        html += `<button onclick="window.fileManager.downloadFile('${file.path}')" 
          style="padding: 4px 8px; background: #28a745; color: white; border: none; border-radius: 3px; cursor: pointer;">
          📥 Download
        </button>`;
      } else {
        html += `<button disabled 
          style="padding: 4px 8px; background: #ccc; color: #666; border: none; border-radius: 3px; cursor: not-allowed;" 
          title="File pending moderation">
          📥 Download
        </button>`;
      }
      
      html += '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    mediaList.innerHTML = html;
  }

  getModerationStatusInfo(status) {
    switch (status) {
      case 'approved':
        return { color: '#28a745', text: 'Approved', emoji: '✅' };
      case 'rejected':
        return { color: '#dc3545', text: 'Rejected', emoji: '❌' };
      case 'pending':
      default:
        return { color: '#ffc107', text: 'Pending Review', emoji: '⏳' };
    }
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  downloadFile(filePath) {
    const userName = document.getElementById("uniqueUserName")?.value?.trim();
    if (!userName) {
      UIComponents.showResult("❌ Please enter a user name first", "error");
      return;
    }

    const fileName = filePath.split('/').pop();
    const downloadUrl = `${this.apiClient.baseUrl}${CONFIG.ENDPOINTS.DOWNLOAD}/${userName}/${fileName}`;
    
    // Create a temporary link and click it
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  previewFile(filePath) {
    const userName = document.getElementById("uniqueUserName")?.value?.trim();
    if (!userName) {
      UIComponents.showResult("❌ Please enter a user name first", "error");
      return;
    }

    const fileName = filePath.split('/').pop();
    const previewUrl = `${this.apiClient.baseUrl}${CONFIG.ENDPOINTS.DOWNLOAD}/${userName}/${fileName}?preview=true`;
    
    // Open in new window for preview
    window.open(previewUrl, '_blank');
  }

  startAutoRefresh(userName, interval = 3000) {
    this.stopAutoRefresh(); // Clear any existing interval
    
    this.autoRefreshInterval = setInterval(async () => {
      console.log(`Auto-refreshing media for user: ${userName}`);
      await this.loadUserMediaSilent(userName);
    }, interval);
    
    // Update UI indicators
    this.updateAutoRefreshIndicators(true);
    console.log(`Auto-refresh started for ${userName} with ${interval}ms interval`);
  }

  stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
      console.log('Auto-refresh stopped');
    }
    
    // Update UI indicators
    this.updateAutoRefreshIndicators(false);
  }

  updateAutoRefreshIndicators(isActive) {
    const refreshIcon = document.getElementById('refreshIcon');
    const refreshText = document.getElementById('refreshText');
    
    if (refreshIcon && refreshText) {
      if (isActive) {
        refreshIcon.textContent = '🔄';
        refreshText.textContent = 'Active';
        refreshIcon.style.color = '#28a745';
        refreshText.style.color = '#28a745';
      } else {
        refreshIcon.textContent = '⏸️';
        refreshText.textContent = 'Disabled';
        refreshIcon.style.color = '#6c757d';
        refreshText.style.color = '#6c757d';
      }
    }
  }

  saveUserNameToStorage(userName) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_NAME, userName);
  }

  loadUserNameFromStorage() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.USER_NAME) || '';
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