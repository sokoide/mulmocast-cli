// Server-Sent Events Client for Real-time Updates
class SSEClient {
  constructor() {
    this.eventSource = null;
    this.isConnected = false;
  }

  connect(userName = null) {
    if (this.eventSource) {
      this.disconnect();
    }

    const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.EVENTS}${userName ? `?userId=${userName}` : ""}`;
    
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = (event) => {
      console.log("SSE connection opened");
      this.isConnected = true;
      this.showMessage("🔗 サーバーに接続しました", "info");
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.showMessage(data.message, "server");
      } catch (error) {
        this.showMessage(event.data, "server");
      }
    };

    this.eventSource.onerror = (event) => {
      console.error("SSE error:", event);
      this.isConnected = false;
      this.showMessage("❌ サーバー接続エラー", "error");
    };
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      this.showMessage("🔌 サーバーから切断しました", "info");
    }
  }

  showMessage(message, type = "info") {
    const messagesContainer = document.getElementById("realTimeMessages");
    const messagesList = document.getElementById("messagesList");

    if (!messagesContainer || !messagesList) {
      console.warn("Real-time message containers not found");
      return;
    }

    // Show container if hidden
    messagesContainer.style.display = "block";

    // Create message element
    const messageElement = document.createElement("div");
    const timestamp = new Date().toLocaleTimeString("ja-JP");

    let color = "#333";
    let prefix = "";

    switch (type) {
      case "error":
        color = "#d32f2f";
        prefix = "❌ ";
        break;
      case "info":
        color = "#1976d2";
        prefix = "ℹ️ ";
        break;
      case "server":
        color = "#388e3c";
        prefix = "🖥️ ";
        break;
    }

    messageElement.style.color = color;
    messageElement.style.marginBottom = "2px";
    messageElement.innerHTML = `[${timestamp}] ${prefix}${message}`;

    messagesList.appendChild(messageElement);

    // Auto-scroll to bottom if enabled
    if (CONFIG.UI.AUTO_SCROLL) {
      messagesList.scrollTop = messagesList.scrollHeight;
    }

    // Limit to MAX_MESSAGES
    while (messagesList.children.length > CONFIG.UI.MAX_MESSAGES) {
      messagesList.removeChild(messagesList.firstChild);
    }
  }

  clearMessages() {
    const messagesList = document.getElementById("messagesList");
    if (messagesList) {
      messagesList.innerHTML = "";
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

// Make SSEClient available globally
if (typeof window !== 'undefined') {
  window.SSEClient = SSEClient;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SSEClient;
}