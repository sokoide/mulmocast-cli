// Configuration for Mulmocast Client
const CONFIG = {
  // API Configuration - replaced at build time
  API_BASE: "__API_BASE_URL__",
  BASE_URL: "__BASE_URL__",

  // Default LLM Settings
  DEFAULT_LLM: "openAI",

  // Default Template
  DEFAULT_TEMPLATE: "familyday_jpn",

  // Real-time Updates
  SSE_ENABLED: true,

  // Local Storage Keys
  STORAGE_KEYS: {
    USER_NAME: "mulmocast_user_name"
  },

  // UI Settings
  UI: {
    MAX_MESSAGES: 500,
    AUTO_SCROLL: true,
    MESSAGE_DISPLAY_TIME: 1000
  },

  // File Extensions
  ALLOWED_DOWNLOAD_EXTENSIONS: ['.mp4', '.pdf'],

  // API Endpoints
  ENDPOINTS: {
    HEALTH: '/health',
    SCRIPT: '/mulmocast/script',
    VIDEO: '/mulmocast/video',
    PDF: '/mulmocast/pdf',
    GENERATE_ALL: '/mulmocast/generate-all',
    VIDEO_FROM_FILE: '/mulmocast/video-from-file',
    PDF_FROM_FILE: '/mulmocast/pdf-from-file',
    USER_FILES: '/mulmocast/user-files',
    USER_MEDIA: '/mulmocast/user-media',
    DOWNLOAD: '/mulmocast/download',
    EVENTS: '/mulmocast/events'
  }
};

// Make CONFIG available globally
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}