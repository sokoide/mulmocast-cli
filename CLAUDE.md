# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MulmoCast is an AI-native multi-modal presentation platform that generates videos, PDFs, audio, and images from JSON-based scripts called MulmoScript. The system uses GraphAI workflow orchestration and integrates with multiple AI providers (OpenAI, Google, Anthropic, etc.) for content generation.

## Development Commands

### Build and Development
```bash
# Build TypeScript to JavaScript
yarn build

# Run TypeScript compilation for development (excludes lib changes from git)
yarn build_test

# Run linting
yarn lint

# Run tests
yarn ci_test

# Format code
yarn format
```

### Local Development Server
```bash
# Start the Express API server
yarn api-server

# Start client development
yarn api-client

# Open web client interface
yarn api-open-client
```

### CLI Development Commands
```bash
# Run CLI directly during development
yarn cli

# Generate scripts interactively
yarn scripting

# Generate specific content types
yarn audio <script-file>
yarn images <script-file>
yarn movie <script-file>
yarn pdf <script-file>
```

## Core Architecture

### MulmoScript System
- **Schema Definition**: `src/types/schema.ts` defines the Zod schemas for MulmoScript JSON format
- **Script Generation**: Uses GraphAI workflows to orchestrate LLM calls for script creation
- **Content Pipeline**: Script → Audio → Images → Video/PDF generation

### Key Directories
- `src/actions/`: Core generation logic (audio, images, movie, pdf, captions)
- `src/tools/`: Script generation workflows using GraphAI
- `src/lib/`: Service layer for programmatic API access
- `src/cli/`: Command-line interface implementation
- `src/types/`: TypeScript type definitions and Zod schemas
- `examples/`: Express server integration with web client
- `assets/templates/`: Script generation templates for different content types

### GraphAI Integration
MulmoCast heavily uses GraphAI for workflow orchestration:
- **Script Generation**: `src/tools/create_mulmo_script_familyday.ts` contains the main script generation workflow
- **Validation**: Uses `validateSchemaAgent` for JSON schema validation with retry logic
- **Agents**: Custom agents in `src/agents/` for specific providers (TTS, image generation, etc.)

### Multi-Language Support
- Templates support different languages (`familyday_jpn` for Japanese, `familyday_eng` for English)
- Language detection in `src/actions/movie.ts` and `src/actions/pdf.ts` determines file suffixes
- File naming convention: `filename_mode_language.extension` (e.g., `story_handout_ja.pdf`)

### File Organization
- Output files are organized under `output/{username}/` directories
- Generated artifacts include: `.json` scripts, `.mp3` audio, `.mp4` videos, `.pdf` documents
- Temporary files stored in `output/{username}/audio/` and `output/{username}/images/`

## Web Integration

The project includes a complete web interface:
- **Server**: `examples/express-integration.ts` provides REST API and SSE for real-time updates
- **Client**: `examples/client-example.html` offers browser-based script generation and media management
- **Service Layer**: `src/lib/mulmocast-service.ts` abstracts CLI functionality for programmatic use

### API Endpoints
- `/api/mulmocast/script` - Generate MulmoScript from text input
- `/api/mulmocast/video` - Generate video from existing script
- `/api/mulmocast/pdf` - Generate PDF from existing script
- `/api/mulmocast/generate-all` - Generate script, video, and PDF in sequence
- `/api/mulmocast/user-files/:userName` - Get user's JSON script files
- `/api/mulmocast/user-media/:userName` - Get user's generated media files
- `/api/mulmocast/download/:userName/:fileName` - Download generated files
- `/api/mulmocast/events` - SSE endpoint for real-time progress updates
- `/api/config` - View current server configuration and paths

### User Directory Structure
Generated files are organized by user in the following structure:
```
MULMOCAST_OUTPUT_PATH/
├── userName1/
│   ├── script-timestamp1.json
│   ├── script-timestamp1.mp4
│   ├── script-timestamp1_slide_en.pdf
│   └── script-timestamp2.json
└── userName2/
    ├── story-timestamp3.json
    └── story-timestamp3_ja.mp4
```

### Advanced Section
The web client includes an advanced section that allows:
- Viewing and selecting previously generated JSON scripts
- Generating videos and PDFs from existing scripts
- Managing user-specific file collections
- Real-time monitoring of generation processes

## Important Implementation Details

### Schema Validation and Retry Logic
The script generation workflow includes sophisticated retry logic:
- LLM generates JSON → Schema validation → Retry if invalid (max 3 attempts)
- Auto-completion of missing required fields like `$mulmocast`, `speechParams`, `audioParams`
- Located in `src/tools/create_mulmo_script_familyday.ts`

### Language Detection Priority
1. Script `lang` property (highest priority)
2. Template name patterns (`familyday_jpn` → `ja`, `familyday_eng` → `en`)
3. Default to English

### File Path Resolution
- Uses `src/cli/helpers.ts` for context initialization and path resolution
- Supports user-specific output directories
- Automatic creation of required subdirectories

### FFmpeg Integration
- Video generation uses FFmpeg via `src/utils/ffmpeg_utils.ts`
- Complex video composition with audio synchronization
- Caption overlay support for multiple languages

## Environment Configuration

### Base Path Configuration
The API server supports configurable paths via environment variables:
- `MULMOCAST_BASE_PATH` - Base directory for all operations (default: current working directory)
- `MULMOCAST_OUTPUT_PATH` - Output directory for generated files (default: {BASE_PATH}/output)
- `MULMOCAST_CACHE_PATH` - Cache directory for temporary files (default: {OUTPUT_PATH}/cache)
- `MULMOCAST_EXAMPLES_PATH` - Examples directory for web client (default: ./examples)
- `PORT` - API server port (default: 3000)

### AI Service API Keys
Required environment variables:
- `OPENAI_API_KEY` - Primary LLM and image generation
- `GOOGLE_PROJECT_ID` - Optional, for Google's image generation
- `NIJIVOICE_API_KEY` - Optional, for Japanese TTS
- `ELEVENLABS_API_KEY` - Optional, for premium TTS
- `BROWSERLESS_API_TOKEN` - Optional, for web content scraping

### Configuration Example
```bash
# Copy .env.example to .env and customize
cp .env.example .env

# Set your custom paths
export MULMOCAST_BASE_PATH=/home/user/mulmocast
export MULMOCAST_OUTPUT_PATH=/home/user/mulmocast/generated
export PORT=8080

# Start the API server
npm run api-server
```

## Testing Strategy

- Unit tests in `test/` directory using TypeScript test runner
- Integration tests via `yarn ci_test`
- Manual testing through web interface at `http://localhost:3000/client/client-example.html`
- Sample scripts in `scripts/` directory for testing various features
