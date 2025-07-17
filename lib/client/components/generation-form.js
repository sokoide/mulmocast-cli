// Generation Form Component
class GenerationForm {
  constructor(apiClient, sseClient) {
    this.apiClient = apiClient;
    this.sseClient = sseClient;
  }

  async generateScript() {
    const input = document.getElementById("storyInput")?.value;
    const template = document.getElementById("template")?.value;
    const uniqueUserName = document.getElementById("uniqueUserName")?.value?.trim();
    const filename = document.getElementById("filename")?.value;

    if (!input?.trim()) {
      UIComponents.showResult("❌ Please enter a story", "error");
      return;
    }

    if (!uniqueUserName) {
      UIComponents.showResult("❌ Please enter Unique User Name", "error");
      return;
    }

    UIComponents.disableGenerationButtons();
    UIComponents.updateButtonText("script", "🔄 Generating a script...");

    UIComponents.showLoading("Generating a script...");
    try {
      const result = await this.apiClient.generateScript(input, {
        template,
        llm: CONFIG.DEFAULT_LLM,
        filename,
        uniqueUserName
      });

      UIComponents.showResult(`✅ スクリプト生成成功!\n${JSON.stringify(result, null, 2)}`);

      // Auto-reload user files after generation
      if (window.fileManager) {
        await window.fileManager.loadUserFiles(uniqueUserName);
      }
    } catch (error) {
      this.handleGenerationError(error, "Script generation failed");
    } finally {
      UIComponents.enableGenerationButtons();
    }
  }

  async generateAll() {
    const input = document.getElementById("storyInput")?.value;
    const template = document.getElementById("template")?.value;
    const uniqueUserName = document.getElementById("uniqueUserName")?.value?.trim();
    const filename = document.getElementById("filename")?.value;

    const outputs = ["script", "video", "pdf"];

    if (!input?.trim()) {
      UIComponents.showResult("❌ Please enter a story", "error");
      return;
    }

    if (!uniqueUserName) {
      UIComponents.showResult("❌ Please enter Unique User Name", "error");
      return;
    }

    UIComponents.disableGenerationButtons();
    UIComponents.updateButtonText("all", "🔄 Generating ...");

    // Show initial progress in real-time messages
    this.sseClient.showMessage("🚀 Starting batch generation (script → video → pdf)", "info");
    this.sseClient.showMessage("🔄 Generating ...", "info");

    UIComponents.showLoading(`Generating... (${outputs.join(", ")})`);
    try {
      const result = await this.apiClient.generateAll(input, {
        template,
        outputs,
        llm: CONFIG.DEFAULT_LLM,
        filename,
        uniqueUserName
      });

      UIComponents.showResult(`✅ Successfully generated!\n${JSON.stringify(result, null, 2)}`);
      this.sseClient.showMessage("✅ All generation completed successfully!", "info");

      // Auto-reload files after generation
      if (window.fileManager) {
        await window.fileManager.loadUserFiles(uniqueUserName);
        await window.fileManager.loadUserMedia(uniqueUserName);
      }
    } catch (error) {
      this.handleGenerationError(error, "Batch generation failed");
      this.sseClient.showMessage("❌ Batch generation failed", "error");
    } finally {
      UIComponents.enableGenerationButtons();
    }
  }

  async generateFromJsonPath() {
    const jsonFilePath = document.getElementById("jsonFilePath")?.value?.trim();
    const generateType = document.querySelector('input[name="generateType"]:checked')?.value;
    const userName = document.getElementById("uniqueUserName")?.value?.trim();

    const jsonButton = document.querySelector('button[onclick="generateFromJsonPath()"]');

    if (!jsonFilePath) {
      UIComponents.showResult("❌ Please enter JSON file path", "error");
      return;
    }

    if (!userName) {
      UIComponents.showResult("❌ Please enter Unique User Name", "error");
      return;
    }

    UIComponents.disableButton(jsonButton, `🔄 Generating ${generateType === "video" ? "Video" : "PDF"}...`);

    try {
      let result;
      if (generateType === "video") {
        const autoCaptionLanguage = await this.getAutoCaptionLanguage(jsonFilePath);

        UIComponents.showLoading(`Video generation in progress... (File: ${jsonFilePath})`);
        result = await this.apiClient.generateVideo(jsonFilePath, {
          caption: autoCaptionLanguage,
          userName
        });
        UIComponents.showResult(`✅ Video generation successful!\n${JSON.stringify(result, null, 2)}`);
      } else if (generateType === "pdf") {
        const pdfMode = document.getElementById("pdfMode")?.value || "slide";
        const pdfSize = document.getElementById("pdfSize")?.value || "letter";

        UIComponents.showLoading(`PDF generation in progress... (File: ${jsonFilePath})`);
        result = await this.apiClient.generatePdf(jsonFilePath, pdfMode, pdfSize, userName);
        UIComponents.showResult(`✅ PDF generation successful!\n${JSON.stringify(result, null, 2)}`);
      }

      // Update file lists after successful generation
      if (window.fileManager) {
        await window.fileManager.loadUserFiles(userName);
        await window.fileManager.loadUserMedia(userName);
      }
    } catch (error) {
      UIComponents.showResult(`❌ ${generateType === "video" ? "Video" : "PDF"} generation failed: ${error.message}`, "error");
    } finally {
      UIComponents.enableButton(jsonButton);
    }
  }

  async generateVideoFromFile(fileId) {
    const button = event.target;
    UIComponents.disableButton(button, "🔄 動画生成中...");

    UIComponents.showLoading(`動画生成中... (ファイル: ${fileId})`);
    try {
      const result = await this.apiClient.generateVideoFromFile(fileId);

      UIComponents.showResult(`✅ 動画生成成功!\n${JSON.stringify(result, null, 2)}`);
      
      // Reload files to update status
      if (window.fileManager) {
        const userName = document.getElementById("uniqueUserName")?.value?.trim();
        if (userName) {
          await window.fileManager.loadUserFiles(userName);
          await window.fileManager.loadUserMedia(userName);
        }
      }
    } catch (error) {
      UIComponents.showResult(`❌ 動画生成失敗: ${error.message}`, "error");
    } finally {
      UIComponents.enableButton(button);
    }
  }

  async generatePdfFromFile(fileId) {
    const button = event.target;
    UIComponents.disableButton(button, "🔄 PDF生成中...");

    UIComponents.showLoading(`PDF生成中... (ファイル: ${fileId})`);
    try {
      const result = await this.apiClient.generatePdfFromFile(fileId, "slide", "letter");

      UIComponents.showResult(`✅ PDF生成成功!\n${JSON.stringify(result, null, 2)}`);
      
      // Reload files to update status
      if (window.fileManager) {
        const userName = document.getElementById("uniqueUserName")?.value?.trim();
        if (userName) {
          await window.fileManager.loadUserFiles(userName);
          await window.fileManager.loadUserMedia(userName);
        }
      }
    } catch (error) {
      UIComponents.showResult(`❌ PDF生成失敗: ${error.message}`, "error");
    } finally {
      UIComponents.enableButton(button);
    }
  }

  async getAutoCaptionLanguage(scriptPath) {
    try {
      // Try to read JSON file to check language
      const response = await fetch(`${CONFIG.BASE_URL}/${scriptPath}`);
      if (response.ok) {
        const scriptContent = await response.json();
        if (scriptContent.lang === "ja") {
          return "ja";
        }
      }
    } catch (error) {
      console.warn("Failed to read script file for language detection:", error);
    }

    // Fallback: filename or template name based judgment
    if (scriptPath && (scriptPath.includes("familyday_jpn") || scriptPath.includes("_jpn"))) {
      return "ja";
    }
    // Default is English
    return "en";
  }

  handleGenerationError(error, baseMessage) {
    let errorMessage = `❌ ${baseMessage}: ${error.message}`;

    // Check server error response
    if (error.response && error.response.data) {
      const errorData = error.response.data;
      if (errorData.brokenJson) {
        // Display broken JSON as warning
        console.warn("⚠️ WARNING: Broken JSON detected:", errorData.brokenJson);
        this.sseClient.showMessage("⚠️ WARNING: Broken JSON detected during generation", "error");
        this.sseClient.showMessage(`Broken JSON details: ${errorData.brokenJson}`, "error");
        errorMessage += "\n\n⚠️ Broken JSON detected - check console and real-time messages for details";
      }
      if (errorData.details) {
        errorMessage = `❌ ${baseMessage}: ${errorData.details}`;
      }
    }

    UIComponents.showResult(errorMessage, "error");
  }
}

// Make GenerationForm available globally
if (typeof window !== 'undefined') {
  window.GenerationForm = GenerationForm;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenerationForm;
}