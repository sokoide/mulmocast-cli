# RELEASE NOTE

# v.0.0.24
## RELEASE NOTE

**MulmoCast CLI v0.0.24** introduces flexible caption styling with CSS and includes system improvements.

- New Features
  - **CSS-Based Caption Styling**: Replace fixed caption properties with flexible CSS styles, supporting animations, shadows, and gradients

- System Improvements
  - **Centralized API Configuration**: New `settings2GraphAIConfig()` for better multi-provider support
  - **Code Organization**: Unified import paths and centralized prompt management

This release enables unlimited caption customization through CSS while improving code maintainability.

# v.0.0.23
## RELEASE NOTE

**MulmoCast CLI v0.0.23** brings powerful AI video generation, automated content import from URLs, and enhanced creative control for multimedia presentations.

- AI Video Generation
  - **Replicate Integration**: Generate dynamic videos from text descriptions using state-of-the-art AI models
  - **Text-to-Movie**: Create video clips directly from text prompts with Replicate API support
  - **Long Duration Support**: Generate extended content without timeouts or processing limitations

- Content Creation & Import
  - **URL to Script**: Convert any web page into a MulmoScript presentation automatically
  - **Web Content Extraction**: Intelligently structure online articles, documentation, or tutorials
  - **Streamlined Workflow**: Reduce manual effort in content creation

- Creative Enhancements
  - **Vibe Coding Style**: New music video template perfect for programming tutorials ([sample](https://github.com/receptron/mulmocast-cli/blob/0.0.23/scripts/snakajima/vibe_coding.json))
  - **Aspect Fill Support**: Professional image and video framing without distortion
  - **Caption as Style**: Flexible caption control through presentation style system
  - **Non-Interactive Mode**: Automatic template selection for automated workflows

- AI Provider Expansion
  - **Anthropic Claude Support**: Use Claude API for HTML image generation
  - **Provider Flexibility**: Choose between OpenAI, Anthropic, and other providers
  - **Enhanced AI Capabilities**: Better content understanding and generation

- Others
  - **Error Fixes**: Improved speaker validation with clear error messages
  - **Documentation**: Added CLAUDE.md for AI assistance guidelines, updated environment setup docs, fixed header formatting

This release significantly expands MulmoCast's creative possibilities with AI-powered video generation and seamless web content integration.

# v.0.0.22
## RELEASE NOTE

**MulmoCast CLI v0.0.22** introduces AI-powered HTML slide generation and ensures continuous background music in longer presentations.

- New Features
  - **HTML Prompt Support**: Generate data-rich slides using AI-powered HTML generation ([documentation](https://github.com/receptron/mulmocast-cli/blob/0.0.22/docs/image.md#2-htmlprompt))
  - **Data Visualization**: Create charts and infographics with automatic Tailwind CSS and Chart.js integration
  - **Complex Layouts**: Build sophisticated slide designs that were previously difficult with image generation

- Audio Enhancement
  - **BGM Looping**: Background music now loops seamlessly for videos longer than the music duration (contributed by @asuhacoder)
  - **Continuous Audio**: No more silent BGM sections in extended presentations

- Documentation
  - **Updated Image Guide**: Comprehensive documentation for the new htmlPrompt feature
  - **Usage Examples**: Added data visualization and text-based slide examples

This release empowers creators with advanced data presentation capabilities while ensuring professional audio throughout their content.

# v.0.0.21
## RELEASE NOTE

**MulmoCast CLI v0.0.21** focuses on documentation clarity and error handling improvements for a better developer and creator experience.

- Documentation & Guides
  - **Character Control Documentation**: Added comprehensive guide for `beat.imageNames` feature to control character appearances
  - **Audio Spillover Guide**: New documentation explaining how to share narration across multiple beats
  - **FAQ Enhancements**: Added TTS configuration methods and 429 error troubleshooting guides
  - **Historical Release Notes**: Completed documentation for versions 0.0.18-0.0.20

- Error Handling & User Experience
  - **Content Policy Visibility**: Clearer error messages when generation fails due to safety reasons
  - **Reduced Retry Attempts**: Optimized image generation retries from 3 to 2 attempts

- Code Quality
  - **Type Organization**: Refactored session types to centralized location
  - **Bug Fixes**: Fixed typo in audio combination agent

This maintenance release strengthens MulmoCast's foundation through better documentation and clearer communication with users.

# v.0.0.20
## RELEASE NOTE

**MulmoCast CLI v0.0.20** enhances library integration and documentation clarity while introducing artistic new creative possibilities.

- Library Integration & Packaging
  - **Fixed TypeScript Integration**: Resolved critical type errors when importing MulmoCast as a library dependency
  - **Browser Compatibility**: Eliminated `https-proxy-agent` errors and improved cross-environment support
  - **Extended Agent Access**: Made agents directory available for comprehensive API integration in external projects

- New Creative Features
  - **Ghibli Image-Only Template**: Beautiful new template combining Studio Ghibli aesthetic with image-only presentations

- Documentation & User Experience
  - **Documentation Updates**: Clarified `-p` option usage and added multilingual FAQ sections

This focused release resolves critical packaging issues while making custom presentation styles more accessible to creators.

# v.0.0.19
## RELEASE NOTE

**MulmoCast CLI v0.0.19** introduces sophisticated audio mixing controls and creative new presentation features, making multimedia content creation more professional and dynamic.

- Audio Mastery & Mixing Controls
  - **Independent Volume Controls**: Separate `bgmVolume` (default: 0.2) and `audioVolume` (default: 1.0) settings for professional audio balance
  - **Music Video Creation**: New workflow to disable BGM and sync all visuals to a single audio track - perfect for promotional content
  - **Enhanced Spillover**: Intelligent time distribution across beats when durations aren't specified, maintaining minimum 1-second visibility

- Visual Effects & Transitions
  - **Slideout Left Transition**: Dynamic new transition where slides exit stage left, creating engaging progression and flow
  - **Image-Only Templates**: New template for purely visual presentations without text - ideal for photo essays and portfolios

- Architecture & Developer Experience
  - **Image Plugin System**: Split image processing into modular `preprocessor` and `imagePlugin` agents for better extensibility
  - **Context Method Refactoring**: Centralized access patterns through `MulmoStudioContextMethods` for improved maintainability
  - **Enhanced Documentation**: Comprehensive `image.md` updates with detailed prompt interaction examples and generation rules table

- Bug Fixes & Improvements
  - **Multilingual Sync**: Fixed array length mismatches between multilingual data and beats
  - **Movie-Only Beat Timing**: Resolved duration calculation issues for video-only content
  - **Browser Compatibility**: Proper exports configuration for web-based tools and applications
  - **Security Updates**: Patched vulnerabilities in dependencies for improved security posture

This release empowers creators with professional-grade audio control while strengthening the platform's technical foundation for future innovations.

# v.0.0.18
## RELEASE NOTE

**MulmoCast CLI v0.0.18** - Bug fixes and stability improvements

- **Multilingual Fix**: Fixed timing issues in multilingual presentations
- **Code Improvements**: Internal refactoring for better maintainability
- **Documentation**: Enhanced release notes process
- **Dependencies**: Updated GraphAI to v2.0.8

# v.0.0.17
## RELEASE NOTE

**MulmoCast CLI v0.0.17** brings a game-changing audio feature and significant architectural improvements for better performance and reliability.

- Audio Spillover Support
  - **Continuous Narration**: Create presentations where narration flows seamlessly across multiple beats - start speaking in one beat and continue through subsequent beats without text
  - **Precise Timing Control**: Each beat displays for its specified duration while audio continues playing, with the final beat staying visible until narration completes
  - **Creative Freedom**: Perfect for educational content and storytelling where visuals change while maintaining uninterrupted narration

- Performance & Architecture
  - **Parallel Processing**: Multiple media files now process simultaneously, significantly reducing generation time for complex projects
  - **Multilingual Data Separation**: Translation data now stored in separate `{filename}_lang.json` files for better organization

- Others
  - **Browser Compatibility**: Fixed Node.js dependencies to enable MulmoCast schemas in web browsers
  - **Improved Test Visibility**: Validation errors now throw immediately during testing for easier debugging
  - **Enhanced Context Management**: Better state handling throughout the audio generation pipeline
  - **Code Quality**: Extensive refactoring with extracted helper functions for improved maintainability
  - **Dependency Updates**: Updated packages for security and compatibility

This release focuses on giving creators more control over audio timing while significantly improving the tool's internal architecture and reliability.

# v.0.0.16
## RELEASE NOTE

**MulmoCast CLI v0.0.16** introduces revolutionary presentation customization and major performance improvements, making content creation more flexible and powerful than ever.

- Revolutionary Presentation Style System
  - **Independent Style Control**: Use the new `-p` option with file paths to apply different visual styles to the same content without editing scripts
    - Download example styles from [GitHub](https://github.com/receptron/mulmocast-cli/tree/main/assets/styles) or **create your own**
    - Examples:
      - `-p ./downloaded-styles/style.json`
      - `-p ./my-project/custom-style.json`
  - **Built-in Anime Templates**: Choose from professional templates inspired by popular anime (Ghibli, AKIRA, One Piece, Ghost in the Shell)
  - **Mix and Match**: Apply any style to any script - create a Ghibli-style business presentation or an AKIRA-style children's story
  - **Simple Templates**: `text_only` and `text_and_image` options for clean, minimalist presentations

- Enhanced User Experience
  - **Real-time Progress Tracking**: New progress callback system shows exactly what's happening during generation
  - **Faster Processing**: Multiple concurrency improvements for faster image and audio generation
  - **Smart Image Handling**: Automatically extracts images from videos when needed for PDF generation

- Deep Search (Experimental)
  - **AI-Powered Research**: Proof-of-concept feature using web search and reflection agents to enhance content research during script generation

- Others
  - **Translation Bug Fix**: Fixed critical typo that would have broken translation functionality completely
  - **Video Transitions**: Fixed transition handling for single video segments
  - **Legal Compliance**: Switched to properly licensed background music for worry-free distribution
  - **Multilingual FAQ**: Added extensive help documentation in English and Japanese covering workflows, troubleshooting, and upgrade guidance
  - **Concurrency Overhaul**: System-wide improvements to parallel processing and resource management
  - **Modular Audio Processing**: Better code organization with individual beat audio processing
  - **Technical Debt Reduction**: Removed unused code and simplified system components

This release transforms MulmoCast from a content generation tool into a complete creative platform where your imagination is the only limit!

# v.0.0.15
## RELEASE NOTE

**MulmoCast CLI v0.0.15** adds exciting features and improvements to enhance your creative workflows with rich visuals and streamlined production.

- Beat Images & Visual Content
  - Images in Beats: Attach or auto-generate images directly within each beat (scene), enriching your videos with engaging visuals.
  - Multiple Image Types Supported: Easily use URLs, local images, slides, markdown content, charts (Chart.js), diagrams (Mermaid), and HTML-based visuals.
  - Intelligent Image Generation: Automatically creates visuals based on provided prompts or beat text.
  - Explore these features in detail in the updated documentation ([docs/image.md](https://github.com/receptron/mulmocast-cli/blob/0.0.15/docs/image.md)).
  - Sample: [test_beats.json](https://github.com/receptron/mulmocast-cli/blob/0.0.15/scripts/test/test_beats.json)

- Smooth Video Transitions
  - Automatically add smooth transitions between scenes, making your video flow naturally without manual editing.
  - Sample: [test_transition.json](https://github.com/receptron/mulmocast-cli/blob/0.0.15/scripts/test/test_transition.json)

- PDF Output Improvements
  - Standardized PDF output on Puppeteer for selectable text and flexible layouts
  - Enhanced PDF file path handling for better organization
  - Removed the pdf-engine option in favor of the superior Puppeteer implementation

- Improved Error Messages
  - Clearer, helpful error messages, especially for audio generation—no more guessing when something goes wrong.

- Release Readiness
  - Added a release test to verify functionality before publishing a new version. Details: [CONTRIBUTING.md#L144](https://github.com/receptron/mulmocast-cli/blob/0.0.15/CONTRIBUTING.md#L144)

- Other Improvements
  - Documentation improvements for ElevenLabs setup. Details: [README.md#L111-L112](https://github.com/receptron/mulmocast-cli/blob/0.0.15/README.md#L111-L112)
  - Enhanced stability with additional automated tests
  - Minor internal optimizations and typo fixes for smoother operations

Enjoy creating more compelling content effortlessly!

# v.0.0.12
## RELEASE NOTE

**MulmoCast CLI v0.0.12** introduces powerful new features to enhance creative workflows with voice, image, and video generation.

- Customize Background Music
  - You can now specify your own BGM to play behind narration in generated videos.
  - Sample: [trailer.json](https://github.com/receptron/mulmocast-cli/blob/0.0.12/assets/templates/trailer.json)

- Ghibli Comic Style Template
  - Generate whimsical, Ghibli-inspired vertical videos using a ready-made comic-style template.
  - Template: [ghibli_shorts.json](https://github.com/receptron/mulmocast-cli/blob/0.0.12/assets/templates/ghibli_shorts.json)

- ElevenLabs Voice Support
  - Use natural, expressive narration with ElevenLabs TTS voices (API key required).
  - You need to add `ELEVENLABS_API_KEY` to your `.env` file. 
  - Sample: [test_voices.json](https://github.com/receptron/mulmocast-cli/blob/0.0.12/scripts/test/test_voices.json)

- Mixed TTS Providers
  - Assign different TTS providers (e.g., OpenAI + ElevenLabs) to different speakers in the same script.
  - Sample: [test_mixed_providers.json](https://github.com/receptron/mulmocast-cli/blob/0.0.12/scripts/test/test_mixed_providers.json)

- Image Type "beat" 
  - Supports image type 'beat' to reference the output of earlier beats. Each beat can now have an id and refer to another beat’s image.
  - Sample: [test_beats.json](https://github.com/receptron/mulmocast-cli/blob/0.0.12/scripts/test/test_beats.json)

- Fade Transitions Between Scenes
  - Scenes can now fade between images for a smoother, more polished visual flow.

- JPEG Image Support
  - JPEG images are now supported as inputs alongside PNG for editing or composition.


- Other Improvements
  - Simplified audio filenames (beat index removed)
  - Fixed rebuildStudio errors and improved error handling
  - Removed unused code for leaner performance

- Google Image Generation Setup
  - A new guide explains how to enable Google’s Vertex AI for image generation (linked from README).