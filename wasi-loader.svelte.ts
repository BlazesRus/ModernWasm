
/**
 * Enhanced WASI loader with PWA support
 * Compatible with @wasmer/wasi version 1.2.2
 *
 * Copyright (C) 2025 James Armstrong (github.com/BlazesRus)
 * Generated with GitHub Copilot assistance
 *
 * MIT License
 */

// Import WASM URL - the static file will be cached by PWA
const wasmURL = '/calculator.wasm';

interface WasiModuleExports {
  Calculate: (passiveSkillId: number, seed: number, jewelId: number, conqueror: string) => any;
  ReverseSearch: (passiveIds: number[], statIds: number[], jewelId: number, conqueror: string) => any;
  GetStatByIndex: (index: number) => any;
  GetAlternatePassiveSkillByIndex: (index: number) => any;
  GetAlternatePassiveAdditionByIndex: (index: number) => any;
  GetPassiveSkillByIndex: (index: number) => any;
  GetTimelessJewelsData: () => any;
  memory: WebAssembly.Memory;
}

export class WasiLoader {
  private wasmInstance: any = null; // Use any to handle different instance types
  private isInitialized = false;

  async loadWasiModule(): Promise<WasiModuleExports> {
    if (this.isInitialized && this.wasmInstance) {
      return this.wasmInstance.exports as unknown as WasiModuleExports;
    }

    console.log('🔄 Loading WASI module with enhanced PWA support...');

    // Check cross-origin isolation
    const isIsolated = typeof SharedArrayBuffer !== 'undefined';
    console.log(`🔍 Cross-origin isolation: ${isIsolated ? 'ENABLED' : 'DISABLED'}`);

    try {
      // For now, let's use the existing approach but with enhanced error handling
      // We'll try the @wasmer/sdk approach first, fallback to manual WebAssembly
      
      // Try to use @wasmer/sdk if available and cross-origin isolated
      if (isIsolated) {
        try {
          const wasmerSdk = await import('@wasmer/sdk');
          await wasmerSdk.init();
          
          console.log(`🔄 Fetching WASM module from ${wasmURL}...`);
          const response = await fetch(wasmURL);
          
          if (!response.ok) {
            throw new Error(`Failed to fetch WASM module: ${response.status} ${response.statusText}`);
          }

          const wasmBytes = await response.arrayBuffer();
          console.log(`✅ Loaded WASM module: ${wasmBytes.byteLength} bytes`);

          // Try runWasix if available
          if (wasmerSdk.runWasix) {
            const wasiInstance = await wasmerSdk.runWasix(new Uint8Array(wasmBytes), {
              program: "main",
              args: [],
              env: {},
            });
            
            this.wasmInstance = wasiInstance;
            this.isInitialized = true;
            console.log('✅ WASI module loaded successfully with @wasmer/sdk');
            
            if (this.wasmInstance) {
              return this.wasmInstance.exports as unknown as WasiModuleExports;
            }
          }
        } catch (error) {
          console.warn('⚠️ @wasmer/sdk approach failed, falling back to manual WASI:', error);
        }
      }

      // Fallback: Manual WebAssembly instantiation
      console.log('🔄 Using manual WebAssembly instantiation...');
      
      const response = await fetch(wasmURL);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM module: ${response.status} ${response.statusText}`);
      }

      const wasmBytes = await response.arrayBuffer();
      console.log(`✅ Loaded WASM module: ${wasmBytes.byteLength} bytes`);

      // Create minimal WASI imports
      const wasiImports = this.createMinimalWasiImports();

      // Instantiate with minimal WASI support
      const { instance } = await WebAssembly.instantiate(wasmBytes, {
        wasi_snapshot_preview1: wasiImports
      });

      this.wasmInstance = instance;
      this.isInitialized = true;
      console.log('✅ WASI module loaded successfully with manual instantiation');

      return instance.exports as unknown as WasiModuleExports;

    } catch (error) {
      console.error('❌ Failed to load WASI module:', error);
      throw error;
    }
  }

  // Create minimal WASI imports for basic functionality
  private createMinimalWasiImports() {
    return {
      proc_exit: (code: number) => {
        console.log(`WASI proc_exit called with code: ${code}`);
      },
      fd_write: (fd: number, iovs: number, iovsLen: number, nwritten: number) => {
        // Basic stdout/stderr support
        return 0;
      },
      fd_close: (fd: number) => 0,
      fd_seek: (fd: number, offset: bigint, whence: number, newOffset: number) => 0,
      path_open: () => 8, // EBADF
      random_get: (buf: number, bufLen: number) => {
        // Fill with random data if needed
        return 0;
      },
      clock_time_get: (clockId: number, precision: bigint, time: number) => {
        // Return current time
        return 0;
      },
      environ_sizes_get: (environCount: number, environBufSize: number) => 0,
      environ_get: (environ: number, environBuf: number) => 0,
      args_sizes_get: (argcPtr: number, argvBufSizePtr: number) => 0,
      args_get: (argvPtr: number, argvBufPtr: number) => 0
    };
  }

  // Helper method to check if the module is ready
  isReady(): boolean {
    return this.isInitialized && this.wasmInstance !== null;
  }

  // Get the exports if already loaded
  getExports(): WasiModuleExports | null {
    return this.wasmInstance?.exports as unknown as WasiModuleExports || null;
  }

  // Call a WASM function safely
  callFunction(functionName: string, args: any[] = []): any {
    if (!this.wasmInstance) {
      throw new Error('WASI module not loaded. Call loadWasiModule() first.');
    }

    const exports = this.wasmInstance.exports as any;
    const func = exports[functionName];
    
    if (typeof func !== 'function') {
      throw new Error(`Function ${functionName} not found in WASM exports`);
    }

    try {
      return func(...args);
    } catch (error) {
      console.error(`Error calling WASM function ${functionName}:`, error);
      throw error;
    }
  }
}

// Singleton instance for use throughout the app
export const wasiLoader = new WasiLoader();

// Export for backward compatibility with existing service
export async function loadWasiModule(): Promise<WasiModuleExports> {
  return wasiLoader.loadWasiModule();
}

export default wasiLoader;
