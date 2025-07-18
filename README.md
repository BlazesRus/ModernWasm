# ModernWasm - Reusable WASM Loading Library

This library provides two different approaches for loading and working with WebAssembly modules in modern web applications using Svelte 5. It's designed to be used as a git submodule in other projects.

## Overview

The ModernWasm library supports two distinct WASM loading approaches:

1. **WASI Approach** (Recommended) - Modern, standards-based WASM loading with class-based architecture
2. **Legacy Go Runtime Approach** - Traditional Go wasm_exec.js runtime simulation

## Architecture

```
ModernWasm/
├── wasi-loader.svelte.ts           # WASI WASM loader (class-based, @wasmer/sdk)
├── wasm-loader.svelte.ts           # Legacy Go runtime loader
├── wasm-exec.svelte.ts            # Go wasm_exec.js wrapper
├── go-runtime.svelte.ts           # Go runtime management
├── go-runtime.worker.ts           # Web Worker for Go runtime
├── debugLogger.svelte.ts          # Shared debug logging
└── README.md                      # This file
```

## WASI Approach (Modern/Recommended)

### Features
- ✅ **Standards-based**: Uses WebAssembly System Interface (WASI)
- ✅ **Class-based**: Each `WasiLoader` instance manages its own WASM module
- ✅ **Lightweight**: No heavy Go runtime required
- ✅ **Fast startup**: Direct WebAssembly instantiation
- ✅ **Browser native**: Uses `@wasmer/sdk` for WASI support
- ✅ **Type safe**: Strong TypeScript integration
- ✅ **Memory efficient**: Clean memory management
- ✅ **Multiple modules**: Can load different WASM modules simultaneously

### Class-Based Usage (Recommended)

```typescript
import { WasiLoader } from './wasi-loader.svelte';

// Create a dedicated loader instance for your specific WASM module
const myWasiLoader = new WasiLoader();

// Load a WASI WASM module
const success = await myWasiLoader.loadWasm('/path/to/module.wasm');

if (success && myWasiLoader.isReady) {
  // Call exported functions
  const result = myWasiLoader.callFunction('YourExportedFunction', arg1, arg2);
  
  // Access exports directly
  const exports = myWasiLoader.exports;
  
  // Read memory
  const data = myWasiLoader.readMemory(offset, length);
}

// Each WasiLoader instance maintains its own state
const anotherLoader = new WasiLoader();
await anotherLoader.loadWasm('/another-module.wasm'); // Won't interfere with myWasiLoader
```

### Global Instance Usage (Backward Compatibility)

```typescript
import { loadWasiWasm, callWasiFunction, wasiLoaderState } from './wasi-loader.svelte';

// Uses the default global instance
const success = await loadWasiWasm('/path/to/module.wasm');

if (success && wasiLoaderState.isReady) {
  // Call exported functions
  const result = callWasiFunction('YourExportedFunction', arg1, arg2);
  
  // Access exports directly
  const exports = wasiLoaderState.exports;
}
```

### Go Build Command (WASI)
```bash
GOOS=wasip1 GOARCH=wasm go build -o module.wasm main.go
```

### Go Code Requirements (WASI)
```go
//go:wasmexport YourFunction
func YourFunction(param1, param2 int32) int32 {
    // Your implementation
    return result
}
```

## Legacy Go Runtime Approach

### Features
- ✅ **Go compatibility**: Full Go runtime available
- ✅ **Mature**: Well-tested approach
- ✅ **Rich API**: Access to full Go standard library
- ⚠️ **Heavier**: Larger runtime overhead
- ⚠️ **Go-specific**: Not standards-based
- ⚠️ **Experimental**: Simulates `wasm_exec.js` but may not work correctly for all Go WASM modules

### Files Involved
- `wasm-loader.svelte.ts` - Main legacy loader with Svelte 5 runes
- `wasm-exec.svelte.ts` - Go wasm_exec.js wrapper
- `go-runtime.svelte.ts` - Go runtime lifecycle management
- `go-runtime.worker.ts` - Web Worker for Go runtime
- `debugLogger.svelte.ts` - Shared logging utilities

### Usage Example
```typescript
import { loadWasm, wasmLoaderState } from './wasm-loader.svelte';

// Load a Go WASM module
const success = await loadWasm('/path/to/calculator.wasm');

if (success && wasmLoaderState.isReady) {
  // Access functions via exports
  const exports = wasmLoaderState.exports;
  const result = exports.YourFunction(arg1, arg2);
  
  // Or access data via globalThis (if exposed by Go code)
  const data = (globalThis as any).yourData;
}
```

### Go Build Command (Legacy)
```bash
GOOS=js GOARCH=wasm go build -o calculator.wasm main.go
```

### Go Code Requirements (Legacy)
```go
import "syscall/js"

func main() {
    // Register functions on global object
    js.Global().Set("YourFunction", js.FuncOf(yourFunctionWrapper))
    
    // Keep the program running
    select {}
}
```

## Dependencies

### WASI Approach
```json
{
  "@wasmer/sdk": "^0.9.0"
}
```

### Legacy Approach
Experimental Svelte 5 version of `wasm_exec.js`. Simulates the Go runtime in the browser and does **not** require the actual `wasm_exec.js` from your Go installation.

⚠️ **Note:** This approach is experimental and may not work correctly for all Go WASM modules. Considerable effort was spent attempting to get a modern Svelte 5-compatible version of `wasm_exec.js` working, but results may vary and some features may be incomplete or unreliable.

## UTF-8 Encoding Setup

This library requires proper UTF-8 encoding. The project includes:

- `.editorconfig` - Ensures UTF-8 encoding for all text files
- `.gitattributes` - Forces UTF-8 encoding in Git
- VS Code settings - Configured for UTF-8
- PowerShell setup script (`setup-utf8.ps1`) - Configures terminal for UTF-8

## Browser Compatibility & Error Resolution

### Buffer Polyfill (REQUIRED for WASI)

The WASI loader requires Node.js Buffer API for binary data handling. This project includes automatic Buffer polyfill injection:

- **Vite Configuration**: Automatically includes Buffer polyfill in builds
- **Client Hooks**: Injects Buffer globally before app initialization  
- **Dependencies**: `buffer` package provides browser-compatible Buffer implementation

If you see `ReferenceError: Buffer is not defined`, ensure:
1. The `buffer` package is installed: `pnpm add buffer`
2. Vite config includes Buffer polyfill settings
3. Client hooks (`src/hooks.client.ts`) are properly configured

### Session Storage Issues

SvelteKit may encounter JSON parse errors from corrupted session storage. The app includes automatic cleanup:

- **Automatic Recovery**: Detects and removes corrupted session storage entries
- **Manual Cleanup**: Use `scripts/clear-session-storage.js` in browser console
- **Complete Reset**: Run `sessionStorage.clear()` in console if needed

See `BROWSER_ERROR_FIXES.md` for detailed troubleshooting.

## State Management

Both loaders expose reactive state using Svelte 5 runes:

### WASI Approach (Class-based)
```typescript
import { WasiLoader } from './wasi-loader.svelte';

const loader = new WasiLoader();

$effect(() => {
  if (loader.isReady) {
    console.log('WASM module loaded successfully');
    console.log('Available exports:', Object.keys(loader.exports));
  }
  
  if (loader.hasError) {
    console.error('WASM loading failed:', loader.error);
  }
});
```

### Legacy Approach
```typescript
import { wasmLoaderState } from './wasm-loader.svelte';

$effect(() => {
  if (wasmLoaderState.isReady) {
    console.log('WASM module loaded successfully');
    console.log('Available exports:', Object.keys(wasmLoaderState.exports));
  }
  
  if (wasmLoaderState.hasError) {
    console.error('WASM loading failed:', wasmLoaderState.error);
  }
});
```

## Choosing an Approach

### Use WASI When:
- Building new projects
- Want modern, standards-based approach
- Need lightweight, fast-loading modules
- Prioritize performance and browser compatibility
- Using simple exported functions
- Need to load multiple WASM modules simultaneously

### Use Legacy When:
- Migrating existing Go WASM projects
- Need full Go runtime features
- Have complex Go code dependencies
- Already invested in Go wasm_exec.js approach

## Integration as Git Submodule

To use this library in another project:

1. **Add as submodule:**
   ```bash
   git submodule add <repo-url> src/lib/ModernWasm
   ```

2. **Install dependencies:**
   ```bash
   # For WASI approach
   npm install @wasmer/sdk
   ```

3. **Set up UTF-8 encoding:**
   ```bash
   # Run the setup script (Windows/PowerShell)
   .\setup-utf8.ps1
   ```

4. **Import and use:**
   ```typescript
   // WASI approach (class-based)
   import { WasiLoader } from '$lib/ModernWasm/wasi-loader.svelte';
   const loader = new WasiLoader();
   
   // WASI approach (global instance)
   import { loadWasiWasm } from '$lib/ModernWasm/wasi-loader.svelte';
   
   // Legacy approach
   import { loadWasm } from '$lib/ModernWasm/wasm-loader.svelte';
   ```

## Contributing

When contributing to this library:
- Maintain compatibility with both approaches
- Update both README sections for new features
- Ensure TypeScript types are complete
- Test with real WASM modules
- Keep debug logging comprehensive
- Ensure proper UTF-8 encoding

## License

MIT License - See LICENSE file for details.
