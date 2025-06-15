// Browser client example for Mulmocast API
// This runs in the browser and doesn't require API keys
// API keys are managed server-side

class MulmocastClient {
  constructor(baseUrl = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl;
  }

  async makeRequest(endpoint, data = null) {
    try {
      const options = {
        method: data ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      };

      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      return result;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async checkHealth() {
    return await this.makeRequest('/health');
  }

  async generateScript(input, options = {}) {
    return await this.makeRequest('/mulmocast/script', {
      input,
      template: options.template || 'familyday_jpn',
      options: {
        llm: options.llm || 'openAI',
        filename: options.filename || 'script'
      }
    });
  }

  async generateVideo(scriptPath, options = {}) {
    return await this.makeRequest('/mulmocast/video', {
      scriptPath,
      options
    });
  }

  async generatePdf(scriptPath, pdfMode = 'slide', pdfSize = 'letter') {
    return await this.makeRequest('/mulmocast/pdf', {
      scriptPath,
      pdfMode,
      pdfSize
    });
  }

  async generateAll(input, options = {}) {
    return await this.makeRequest('/mulmocast/generate-all', {
      input,
      template: options.template || 'familyday_jpn',
      outputs: options.outputs || ['script'],
      options: {
        llm: options.llm || 'openAI',
        filename: options.filename || 'script'
      }
    });
  }

  async generateVideoFromFile(fileId, options = {}) {
    return await this.makeRequest('/mulmocast/video-from-file', {
      fileId,
      options
    });
  }

  async generatePdfFromFile(fileId, pdfMode = 'slide', pdfSize = 'letter', options = {}) {
    return await this.makeRequest('/mulmocast/pdf-from-file', {
      fileId,
      pdfMode,
      pdfSize,
      options
    });
  }
}

// Usage example (for browser console or module)
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
        filename: 'puni-client'
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
        filename: 'yushan-client'
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