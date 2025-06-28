// Backward compatibility bridge for client-example.js
// This file maintains compatibility with the original client-example.js interface
// while using the new modular structure internally

// Import the new modular components
// Since this is a browser environment, we'll use the global objects

// Browser client example for Mulmocast API (Refactored)
class MulmocastClient {
  constructor(baseUrl = CONFIG.API_BASE) {
    // Use the new APIClient internally
    this.apiClient = new APIClient(baseUrl);
    this.baseUrl = baseUrl;
  }

  async makeRequest(endpoint, data = null) {
    return await this.apiClient.makeRequest(endpoint, data);
  }

  async checkHealth() {
    return await this.apiClient.checkHealth();
  }

  async generateScript(input, options = {}) {
    return await this.apiClient.generateScript(input, {
      template: options.template || CONFIG.DEFAULT_TEMPLATE,
      llm: options.llm || CONFIG.DEFAULT_LLM,
      filename: options.filename || 'script',
      uniqueUserName: options.uniqueUserName
    });
  }

  async generateVideo(scriptPath, options = {}) {
    return await this.apiClient.generateVideo(scriptPath, options);
  }

  async generatePdf(scriptPath, pdfMode = 'slide', pdfSize = 'letter') {
    return await this.apiClient.generatePdf(scriptPath, pdfMode, pdfSize);
  }

  async generateAll(input, options = {}) {
    return await this.apiClient.generateAll(input, {
      template: options.template || CONFIG.DEFAULT_TEMPLATE,
      outputs: options.outputs || ['script'],
      llm: options.llm || CONFIG.DEFAULT_LLM,
      filename: options.filename || 'script',
      uniqueUserName: options.uniqueUserName
    });
  }

  async generateVideoFromFile(fileId, options = {}) {
    return await this.apiClient.generateVideoFromFile(fileId, options);
  }

  async generatePdfFromFile(fileId, pdfMode = 'slide', pdfSize = 'letter', options = {}) {
    return await this.apiClient.generatePdfFromFile(fileId, pdfMode, pdfSize, options);
  }
}

// Usage example (for browser console or module) - maintains original interface
async function clientExample() {
  const client = new MulmocastClient();

  try {
    // Health check
    console.log('🔍 Checking API health...');
    const health = await client.checkHealth();
    console.log('✅ Health check:', health);

    // Generate script only
    console.log('\n🎬 Generating script...');
    const scriptResult = await client.generateScript(
      "小さな丸い宇宙人プーニが地球にやってきて、人間の少年と友達になる物語。",
      {
        template: 'familyday_jpn',
        llm: 'openAI',
        filename: 'puni-client',
        uniqueUserName: 'TestUser'
      }
    );
    console.log('✅ Script generated:', scriptResult);

    // Generate all (script + video + pdf)
    console.log('\n🎥 Generating all outputs...');
    const allResult = await client.generateAll(
      "風を追いかけて──ユーシャンの道。山に囲まれた小さな村に、サッカーが大好きな少年ユーシャンがいた。",
      {
        template: 'familyday_jpn',
        outputs: ['script', 'video', 'pdf'],
        llm: 'openAI',
        filename: 'yushan-client',
        uniqueUserName: 'TestUser'
      }
    );
    console.log('✅ All outputs generated:', allResult);

  } catch (error) {
    console.error('❌ Client Error:', error.message);
  }
}

// Export for use in modules or direct execution in browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MulmocastClient, clientExample };
}

// Auto-run in browser console
if (typeof window !== 'undefined') {
  window.MulmocastClient = MulmocastClient;
  window.clientExample = clientExample;
  console.log('🚀 Mulmocast Client loaded! Try: clientExample()');
}