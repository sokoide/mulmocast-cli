// Generation Form Component
class GenerationForm {
  constructor(apiClient, sseClient) {
    this.apiClient = apiClient;
    this.sseClient = sseClient;
  }

  async generateAll() {
    const input = document.getElementById("storyInput")?.value?.trim();
    const template = document.getElementById("template")?.value;
    const uniqueUserName = document.getElementById("uniqueUserName")?.value?.trim();
    const filename = document.getElementById("filename")?.value?.trim() || "story";

    if (!input) {
      UIComponents.showResult("❌ Please enter a story input", "error");
      return;
    }

    if (!uniqueUserName) {
      UIComponents.showResult("❌ Please enter a unique user name", "error");
      return;
    }

    try {
      UIComponents.showLoading("🚀 Starting generation process...");
      
      const options = {
        uniqueUserName,
        filename
      };

      const result = await this.apiClient.generateAll(input, template, options);
      
      if (result.success) {
        UIComponents.showResult("✅ Generation completed successfully!");
        
        // Auto-load user media after generation
        if (window.fileManager) {
          setTimeout(() => {
            window.fileManager.loadUserMedia(uniqueUserName);
          }, 2000);
        }
      } else {
        UIComponents.showResult(`❌ Generation failed: ${result.error}`, "error");
      }
    } catch (error) {
      UIComponents.showResult(`❌ Generation failed: ${error.message}`, "error");
      console.error('Generation error:', error);
    }
  }

  async generateScript() {
    const input = document.getElementById("storyInput")?.value?.trim();
    const template = document.getElementById("template")?.value;
    const uniqueUserName = document.getElementById("uniqueUserName")?.value?.trim();
    const filename = document.getElementById("filename")?.value?.trim() || "story";

    if (!input) {
      UIComponents.showResult("❌ Please enter a story input", "error");
      return;
    }

    if (!uniqueUserName) {
      UIComponents.showResult("❌ Please enter a unique user name", "error");
      return;
    }

    try {
      UIComponents.showLoading("📝 Generating script...");
      
      const options = {
        uniqueUserName,
        filename
      };

      const result = await this.apiClient.generateScript(input, template, options);
      
      if (result.success) {
        UIComponents.showResult(`✅ Script generated successfully!\nPath: ${result.data.scriptPath}`);
        
        // Auto-load user files after script generation
        if (window.fileManager) {
          setTimeout(() => {
            window.fileManager.loadUserFiles(uniqueUserName);
          }, 1000);
        }
      } else {
        UIComponents.showResult(`❌ Script generation failed: ${result.error}`, "error");
      }
    } catch (error) {
      UIComponents.showResult(`❌ Script generation failed: ${error.message}`, "error");
      console.error('Script generation error:', error);
    }
  }

  async generateFromJsonPath() {
    const jsonPath = document.getElementById("jsonFilePath")?.value?.trim();
    const generateType = document.querySelector('input[name="generateType"]:checked')?.value;
    const uniqueUserName = document.getElementById("uniqueUserName")?.value?.trim();

    if (!jsonPath) {
      UIComponents.showResult("❌ Please enter a JSON file path", "error");
      return;
    }

    if (!uniqueUserName) {
      UIComponents.showResult("❌ Please enter a unique user name", "error");
      return;
    }

    try {
      UIComponents.showLoading(`🎬 Generating ${generateType}...`);
      
      let options = { userName: uniqueUserName };
      
      if (generateType === 'pdf') {
        options.pdfMode = document.getElementById("pdfMode")?.value || 'handout';
        options.pdfSize = document.getElementById("pdfSize")?.value || 'a4';
      }

      const result = await this.apiClient.generateFromJsonPath(jsonPath, generateType, options);
      
      if (result.success) {
        UIComponents.showResult(`✅ ${generateType} generated successfully!`);
        
        // Auto-load user media after generation
        if (window.fileManager) {
          setTimeout(() => {
            window.fileManager.loadUserMedia(uniqueUserName);
          }, 2000);
        }
      } else {
        UIComponents.showResult(`❌ ${generateType} generation failed: ${result.error}`, "error");
      }
    } catch (error) {
      UIComponents.showResult(`❌ ${generateType} generation failed: ${error.message}`, "error");
      console.error('Generation error:', error);
    }
  }

  async generateVideoFromFile(fileId) {
    const uniqueUserName = document.getElementById("uniqueUserName")?.value?.trim();
    
    if (!uniqueUserName) {
      UIComponents.showResult("❌ Please enter a unique user name", "error");
      return;
    }

    try {
      UIComponents.showLoading("🎬 Generating video from file...");
      
      const options = { uniqueUserName };
      const result = await this.apiClient.makeRequest(CONFIG.ENDPOINTS.VIDEO_FROM_FILE, {
        method: 'POST',
        body: JSON.stringify({
          fileId,
          options
        })
      });
      
      if (result.success) {
        UIComponents.showResult("✅ Video generated successfully!");
        
        // Auto-load user media after generation
        if (window.fileManager) {
          setTimeout(() => {
            window.fileManager.loadUserMedia(uniqueUserName);
          }, 2000);
        }
      } else {
        UIComponents.showResult(`❌ Video generation failed: ${result.error}`, "error");
      }
    } catch (error) {
      UIComponents.showResult(`❌ Video generation failed: ${error.message}`, "error");
      console.error('Video generation error:', error);
    }
  }

  async generatePdfFromFile(fileId) {
    const uniqueUserName = document.getElementById("uniqueUserName")?.value?.trim();
    const pdfMode = document.getElementById("pdfMode")?.value || 'handout';
    const pdfSize = document.getElementById("pdfSize")?.value || 'a4';
    
    if (!uniqueUserName) {
      UIComponents.showResult("❌ Please enter a unique user name", "error");
      return;
    }

    try {
      UIComponents.showLoading("📄 Generating PDF from file...");
      
      const options = { uniqueUserName };
      const result = await this.apiClient.makeRequest(CONFIG.ENDPOINTS.PDF_FROM_FILE, {
        method: 'POST',
        body: JSON.stringify({
          fileId,
          pdfMode,
          pdfSize,
          options
        })
      });
      
      if (result.success) {
        UIComponents.showResult("✅ PDF generated successfully!");
        
        // Auto-load user media after generation
        if (window.fileManager) {
          setTimeout(() => {
            window.fileManager.loadUserMedia(uniqueUserName);
          }, 2000);
        }
      } else {
        UIComponents.showResult(`❌ PDF generation failed: ${result.error}`, "error");
      }
    } catch (error) {
      UIComponents.showResult(`❌ PDF generation failed: ${error.message}`, "error");
      console.error('PDF generation error:', error);
    }
  }
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenerationForm;
}