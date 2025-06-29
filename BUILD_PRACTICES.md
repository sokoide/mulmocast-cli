# Build Practices - Client and Server

## Problem Statement
Previously, TypeScript compilation was creating both source (`.ts`) and compiled (`.js`, `.d.ts`) files in the same directories (`./client` and `./server`), which is not a good practice because:

1. **Source/Build Confusion**: Makes it unclear which files are source vs generated
2. **Version Control Issues**: Risk of accidentally committing compiled files
3. **IDE Conflicts**: Code editors may get confused about import resolution
4. **Maintenance Problems**: Harder to clean up build artifacts

## Solution Implemented

### Option 2: Separate Build Management
We implemented a solution that keeps source files in their original locations but ensures compiled files don't pollute the source directories:

#### 1. Updated .gitignore
```gitignore
# Prevent committing compiled files in source directories
src/**/*.js
src/**/*.d.ts
server/**/*.js
server/**/*.d.ts
client/**/*.js
client/**/*.d.ts

# Keep original client JS files (these are source, not compiled)
!client/assets/js/*.js
!client/components/*.js
!client/client-example.js

# Keep shell scripts
!server/*.sh
!client/*.sh
```

#### 2. Build Scripts
```json
{
  "build": "npm run build:main && npm run clean:source-dirs",
  "build:main": "tsc",
  "clean:source-dirs": "find ./src -name '*.js' -delete && find ./src -name '*.d.ts' -delete && find ./server -name '*.js' -delete && find ./server -name '*.d.ts' -delete",
  "clean": "npm run clean:source-dirs && rm -rf lib/"
}
```

#### 3. Directory Structure
```
├── src/                    # Main library source (compiles to lib/)
├── server/                 # Server source files (TypeScript only)
│   ├── app.ts
│   ├── routes/
│   └── ...
├── client/                 # Client source files (JavaScript/CSS)
│   ├── assets/
│   ├── components/
│   └── ...
├── lib/                    # Compiled output for distribution
│   ├── (src compiled)
│   └── server/             # Manually maintained server build
└── lib-server.js           # Built server runner
```

## Current Build Process

### 1. Main Build
- `npm run build` compiles main library (`src/` → `lib/`)
- Automatically cleans any compiled artifacts from source directories
- Maintains manually-fixed SSE import paths in `lib/server/`

### 2. Source Directory Hygiene
- `.gitignore` prevents committing compiled files in source directories
- Build process automatically removes any `.js`/`.d.ts` files from `./src`, `./server`, and `./client`
- Client directory contains source JavaScript files (not compiled TypeScript)
- All TypeScript compilation artifacts are cleaned after build

### 3. Distribution
- All compiled code goes to `lib/` directory
- `lib/server/` contains manually maintained server build with correct import paths
- SSE functionality works correctly in built version

## Benefits

### ✅ Clean Source Directories
- Source directories contain only source files
- No confusion between source and compiled files
- Clean git history without compiled artifacts

### ✅ Working Distribution
- Built version (`npm run api-server-built`) works correctly
- SSE real-time progress messages function properly
- All functionality preserved from development version

### ✅ Maintainable Build Process
- Simple build scripts that prevent source pollution
- Automatic cleanup of unwanted artifacts
- Clear separation of concerns

## Testing

The solution has been tested and confirmed:
- ✅ `npm run build` works correctly
- ✅ Source directories remain clean after build
- ✅ `npm run api-server-built` works with SSE functionality
- ✅ All existing functionality preserved
- ✅ Git ignores compiled files in source directories

## Future Improvements

If further build improvements are needed:
1. **Option 1**: Move server source to `src/server/` for automatic compilation
2. **Option 3**: Implement proper TypeScript project references
3. **Option 4**: Use build tools like esbuild or webpack for more complex bundling

The current solution provides a clean, maintainable approach that solves the immediate problem while preserving all functionality.