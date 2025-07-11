# ModernWasm - Reusable WASM Loading Library

This library provides two different approaches for loading and working with WebAssembly modules in modern web applications using Svelte 5. It's designed to be used as a git submodule in other projects.

## Overview

The ModernWasm library supports two distinct WASM loading approaches:

1. **WASI Approach** (Recommended) - Modern, standards-based WASM loading
2. **Legacy Go Runtime Approach** - Traditional Go wasm_exec.js runtime

## Architecture

```
ModernWasm/
├── wasi-loader.svelte.ts           # WASI WASM loader (@wasmer/sdk)
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
- ✅ **Lightweight**: No heavy Go runtime required
- ✅ **Fast startup**: Direct WebAssembly instantiation
- ✅ **Browser native**: Uses `@wasmer/sdk` for WASI support
- ✅ **Type safe**: Strong TypeScript integration
- ✅ **Memory efficient**: Clean memory management

### Files Involved
- `wasi-loader.svelte.ts` - Main WASI loader with Svelte 5 runes
- `debugLogger.svelte.ts` - Shared logging utilities

### Usage Example
```typescript
import { loadWasiWasm, callWasiFunction, wasiLoaderState } from './wasi-loader.svelte';

// Load a WASI WASM module
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

## Shared Features

Both approaches provide:
- **Svelte 5 runes**: Reactive state management with `$state`
- **Progress tracking**: Loading progress with history
- **Error handling**: Comprehensive error capture and logging
- **Debug logging**: Detailed logging with categories
- **Memory management**: Utilities for reading/writing WASM memory
- **TypeScript support**: Full type safety

## State Management

Both loaders expose reactive state:

```typescript
// WASI approach
import { wasiLoaderState } from './wasi-loader.svelte';

// Legacy approach  
import { wasmLoaderState } from './wasm-loader.svelte';

// Both provide similar reactive interface
$effect(() => {
  if (loaderState.isReady) {
    console.log('WASM module loaded successfully');
    console.log('Available exports:', Object.keys(loaderState.exports));
  }
  
  if (loaderState.hasError) {
    console.error('WASM loading failed:', loaderState.error);
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
   
   # For legacy approach, copy wasm_exec.js from Go installation
   ```

3. **Import and use:**
   ```typescript
   // WASI approach
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

## License

MIT License - See LICENSE file for details.

Reusable Svelte 5 version of wasm.js
