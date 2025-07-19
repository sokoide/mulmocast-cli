// API Client for Mulmocast
class APIClient {
  constructor(baseUrl = CONFIG.API_BASE) {
    this.baseUrl = baseUrl;
  }

  async makeRequest(endpoint, data = null) {
    try {
      const options = {
        method: data ? "POST" : "GET",
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const result = await response.json();

      if (!response.ok) {
        const error = new Error(result.error || `HTTP ${response.status}`);
        error.response = { data: result };
        throw error;
      }

      return result;
    } catch (error) {
      console.error("API Error:", error);
      if (!error.response && error.name === "TypeError") {
        error.message = "Network error - please check your connection";
      }
      throw error;
    }
  }

  async checkHealth() {
    return await this.makeRequest(CONFIG.ENDPOINTS.HEALTH);
  }

  async generateScript(input, options = {}) {
    return await this.makeRequest(CONFIG.ENDPOINTS.SCRIPT, {
      input,
      template: options.template || CONFIG.DEFAULT_TEMPLATE,
      options: {
        llm: options.llm || CONFIG.DEFAULT_LLM,
        filename: options.filename || 'script',
        uniqueUserName: options.uniqueUserName
      }
    });
  }

  async generateVideo(scriptPath, options = {}) {
    return await this.makeRequest(CONFIG.ENDPOINTS.VIDEO, {
      scriptPath,
      caption: options.caption,
      userName: options.userName,
      options
    });
  }

  async generatePdf(scriptPath, pdfMode = 'slide', pdfSize = 'letter', userName) {
    return await this.makeRequest(CONFIG.ENDPOINTS.PDF, {
      scriptPath,
      pdfMode,
      pdfSize,
      userName
    });
  }

  async generateAll(input, options = {}) {
    return await this.makeRequest(CONFIG.ENDPOINTS.GENERATE_ALL, {
      input,
      template: options.template || CONFIG.DEFAULT_TEMPLATE,
      outputs: options.outputs || ['script'],
      options: {
        llm: options.llm || CONFIG.DEFAULT_LLM,
        filename: options.filename || 'script',
        uniqueUserName: options.uniqueUserName
      }
    });
  }

  async generateVideoFromFile(fileId, options = {}) {
    return await this.makeRequest(CONFIG.ENDPOINTS.VIDEO_FROM_FILE, {
      fileId,
      options
    });
  }

  async generatePdfFromFile(fileId, pdfMode = 'slide', pdfSize = 'letter', options = {}) {
    return await this.makeRequest(CONFIG.ENDPOINTS.PDF_FROM_FILE, {
      fileId,
      pdfMode,
      pdfSize,
      options
    });
  }

  async getUserFiles(userName) {
    return await this.makeRequest(`${CONFIG.ENDPOINTS.USER_FILES}/${userName}`);
  }

  async getUserMedia(userName) {
    return await this.makeRequest(`${CONFIG.ENDPOINTS.USER_MEDIA}/${userName}`);
  }

  getDownloadUrl(userName, fileName) {
    return `${this.baseUrl}${CONFIG.ENDPOINTS.DOWNLOAD}/${userName}/${fileName}`;
  }

  getFilePreviewUrl(filePath) {
    return `${CONFIG.BASE_URL}/${filePath}`;
  }
}

// Make APIClient available globally
if (typeof window !== 'undefined') {
  window.APIClient = APIClient;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = APIClient;
}