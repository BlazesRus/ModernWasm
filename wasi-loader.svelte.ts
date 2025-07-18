/**
 * WASI WASM Loader with Svelte 5 Runes - Using @wasmer/sdk properly
 *
 * This loader uses @wasmer/sdk's runWasix() method for proper WASI support
 * following the official documentation and troubleshooting guidelines.
 *
 * Copyright (C) 2025 James Armstrong (github.com/BlazesRus)
 * Generated with GitHub Copilot assistance
 *
 * MIT License
 */
import { browser } from '$app/environment';
import { addDebugMessage, captureError } from './debugLogger.svelte';

function debugLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  addDebugMessage(`🔧 WASI Loader: ${message}`, level);
}

// Types for WASI WASM module using @wasmer/sdk
export interface WasiModule {
  instance: any; // Wasmer instance from @wasmer/sdk
  exports: Record<string, any>;
  memory: WebAssembly.Memory | null;
}

/**
 * WASI Loader class - uses @wasmer/sdk with proper dynamic imports
 * Each instance manages its own WASM module independently
 */
export class WasiLoader {
  // Private reactive state for this loader instance
  private state = $state({
    url: '',
    isLoading: false,
    progress: 0,
    error: null as string | null,
    wasiModule: null as WasiModule | null,
    progressHistory: [] as number[],

    get isReady() {
      return !this.isLoading && this.error === null && !!this.wasiModule;
    },

    get hasError() {
      return this.error !== null;
    },

    get exports() {
      return this.wasiModule?.exports ?? {};
    },

    get memory() {
      return this.wasiModule?.memory ?? null;
    }
  });

  // Public getters for accessing state
  get url() { return this.state.url; }
  get isLoading() { return this.state.isLoading; }
  get progress() { return this.state.progress; }
  get error() { return this.state.error; }
  get wasiModule() { return this.state.wasiModule; }
  get progressHistory() { return this.state.progressHistory; }
  get isReady() { return this.state.isReady; }
  get hasError() { return this.state.hasError; }
  get exports() { return this.state.exports; }
  get memory() { return this.state.memory; }

  /**
   * Load a WASI-formatted WASM file using @wasmer/sdk with proper dynamic imports
   */
  async loadWasm(url: string): Promise<boolean> {
    if (!browser) {
      debugLog('Not in browser environment, skipping WASI WASM load', 'warn');
      return false;
    }

    // Reset state
    this.state.url = url;
    this.state.isLoading = true;
    this.state.progress = 0;
    this.state.error = null;
    this.state.wasiModule = null;

    try {
      debugLog(`Starting WASI WASM load from ${url} using @wasmer/sdk`, 'info');

      // Dynamic import of @wasmer/sdk (recommended approach from troubleshooting docs)
      this.state.progress = 10;
      const { init, run } = await import('@wasmer/sdk');
      debugLog('✅ Dynamically imported @wasmer/sdk', 'info');

      // Initialize Wasmer SDK
      this.state.progress = 20;
      await init();
      debugLog('✅ Wasmer SDK initialized', 'info');

      // Fetch the WASM file bytes
      this.state.progress = 40;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM file: ${response.status} ${response.statusText}`);
      }

      const wasmBytes = await response.arrayBuffer();
      debugLog(`📦 WASM file loaded: ${wasmBytes.byteLength} bytes`, 'info');

      // Use run() to instantiate our custom WASI module
      // Pass the original *.wasm file's contents as Uint8Array to handle memory imports correctly
      this.state.progress = 70;
      debugLog('🚀 Creating WASI instance with run()...', 'info');

      const instance = await run(new Uint8Array(wasmBytes), {
        // WASI options for our TinyGo module
        program: 'main',
        args: [],
        env: {},
      });

      debugLog('✅ WASI instance created with run()', 'info');

      // Extract exports and memory from the instance
      this.state.progress = 90;
      const exports = instance.exports || {};
      const memory = exports.memory as WebAssembly.Memory | null;

      debugLog(`🔍 WASI WASM loaded with exports: ${Object.keys(exports).join(', ')}`, 'info');

      // Store the complete module
      this.state.wasiModule = {
        instance,
        exports,
        memory
      };

      this.state.progress = 100;
      this.state.isLoading = false;

      return true;
    } catch (err) {
      const msg = String(err);
      this.state.error = msg;
      this.state.isLoading = false;
      this.state.progress = 0;
      this.state.wasiModule = null;

      captureError(err instanceof Error ? err : new Error(msg), 'WASI-Loader');
      debugLog(`❌ WASI WASM load failed: ${msg}`, 'error');

      return false;
    }
  }

  /**
   * Get a specific export from the WASI module
   */
  getExport(name: string): any {
    if (!this.state.wasiModule) {
      throw new Error('WASI module not loaded');
    }
    return this.state.wasiModule.exports[name];
  }

  /**
   * Call a WASI exported function
   */
  callFunction(name: string, ...args: any[]): any {
    const func = this.getExport(name);
    if (typeof func !== 'function') {
      throw new Error(`Export '${name}' is not a function`);
    }
    try {
      debugLog(`Calling WASI function: ${name}`, 'info');
      return func(...args);
    } catch (err) {
      const msg = `Error calling WASI function '${name}': ${err}`;
      debugLog(msg, 'error');
      throw new Error(msg);
    }
  }

  /**
   * Read memory from the WASI module
   */
  readMemory(offset: number, length: number): Uint8Array {
    if (!this.state.wasiModule?.memory) {
      throw new Error('WASI module memory not available');
    }
    const buffer = new Uint8Array(this.state.wasiModule.memory.buffer);
    return buffer.slice(offset, offset + length);
  }

  /**
   * Reset the WASI loader state
   */
  reset(): void {
    this.state.url = '';
    this.state.isLoading = false;
    this.state.progress = 0;
    this.state.error = null;
    this.state.wasiModule = null;
    this.state.progressHistory = [];
  }
}

// Default global instance for backward compatibility and simple usage
export const defaultWasiLoader = new WasiLoader();

// Convenience functions that use the default instance (for backward compatibility)
export const wasiLoaderState = defaultWasiLoader; // For accessing state reactively
export const loadWasiWasm = (url: string) => defaultWasiLoader.loadWasm(url);
export const getWasiExport = (name: string) => defaultWasiLoader.getExport(name);
export const callWasiFunction = (name: string, ...args: any[]) => defaultWasiLoader.callFunction(name, ...args);
export const readWasiMemory = (offset: number, length: number) => defaultWasiLoader.readMemory(offset, length);
export const resetWasiLoader = () => defaultWasiLoader.reset();
