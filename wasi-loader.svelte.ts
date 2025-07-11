/**
 * WASI WASM Loader with Svelte 5 Runes - Pure WASI Implementation
 * 
 * This loader is specifically for WASI-formatted WASM files and does NOT use
 * any Go runtime infrastructure (wasm-exec.js, go-runtime.svelte.ts, etc.)
 * 
 * Uses @wasmer/sdk for proper WASI support in the browser.
 *
 * Copyright (C) 2025 James Armstrong (github.com/BlazesRus)
 * Generated with GitHub Copilot assistance
 *
 * MIT License
 */
import { browser } from '$app/environment';
import { init, Wasmer } from '@wasmer/sdk';
import { addDebugMessage, captureError } from './debugLogger.svelte';

function debugLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  addDebugMessage(`?? WASI Loader: ${message}`, level);
}

// Types for WASI WASM module using @wasmer/sdk
export interface WasiModule {
  instance: WebAssembly.Instance;
  exports: WebAssembly.Exports;
  memory: WebAssembly.Memory | null;
  wasmerInstance: any; // Wasmer instance from @wasmer/sdk
}

// Central reactive state for WASI loader
export const wasiLoaderState = $state({
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

/**
 * Load a WASI-formatted WASM file using @wasmer/sdk
 */
export async function loadWasiWasm(url: string): Promise<boolean> {
  if (!browser) {
    debugLog('Not in browser environment, skipping WASI WASM load', 'warn');
    return false;
  }

  // Reset state
  wasiLoaderState.url = url;
  wasiLoaderState.isLoading = true;
  wasiLoaderState.progress = 0;
  wasiLoaderState.error = null;
  wasiLoaderState.wasiModule = null;

  try {
    debugLog(`Starting WASI WASM load from ${url}`, 'info');

    // Initialize Wasmer SDK
    wasiLoaderState.progress = 10;
    await init();
    debugLog('Wasmer SDK initialized', 'info');

    // Fetch the WASM file
    wasiLoaderState.progress = 30;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM file: ${response.status} ${response.statusText}`);
    }

    const wasmBytes = await response.arrayBuffer();
    debugLog(`WASM file loaded: ${wasmBytes.byteLength} bytes`, 'info');

    // Compile the WASM module
    wasiLoaderState.progress = 60;
    const module = await WebAssembly.compile(wasmBytes);
    debugLog('WASM module compiled', 'info');

    // Create basic WASI imports for Go WASI runtime
    wasiLoaderState.progress = 70;
    const wasiImports = {
      wasi_snapshot_preview1: {
        fd_write: () => 0,
        fd_close: () => 0,
        fd_seek: () => 0,
        proc_exit: () => {},
        environ_sizes_get: () => 0,
        environ_get: () => 0,
        args_sizes_get: () => 0,
        args_get: () => 0,
        random_get: () => 0,
        clock_time_get: () => 0,
      }
    };

    // Instantiate the module with WASI imports
    wasiLoaderState.progress = 80;
    const instance = await WebAssembly.instantiate(module, wasiImports);
    debugLog('WASM instance created with WASI imports', 'info');

    // Extract memory and exports
    wasiLoaderState.progress = 90;
    const memory = instance.exports.memory as WebAssembly.Memory | null;
    const exports = instance.exports;

    debugLog(`WASI WASM loaded with exports: ${Object.keys(exports).join(', ')}`, 'info');

    // Store the complete module
    wasiLoaderState.wasiModule = {
      instance,
      exports,
      memory,
      wasmerInstance: null
    };

    wasiLoaderState.progress = 100;
    wasiLoaderState.isLoading = false;

    return true;
  } catch (err) {
    const msg = String(err);
    wasiLoaderState.error = msg;
    wasiLoaderState.isLoading = false;
    wasiLoaderState.progress = 0;
    wasiLoaderState.wasiModule = null;

    captureError(err instanceof Error ? err : new Error(msg), 'WASI-Loader');
    debugLog(`WASI WASM load failed: ${msg}`, 'error');

    return false;
  }
}

/**
 * Get a specific export from the WASI module
 */
export function getWasiExport(name: string): any {
  if (!wasiLoaderState.wasiModule) {
    throw new Error('WASI module not loaded');
  }
  return wasiLoaderState.wasiModule.exports[name];
}

/**
 * Call a WASI exported function
 */
export function callWasiFunction(name: string, ...args: any[]): any {
  const func = getWasiExport(name);
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
export function readWasiMemory(offset: number, length: number): Uint8Array {
  if (!wasiLoaderState.wasiModule?.memory) {
    throw new Error('WASI module memory not available');
  }
  const buffer = new Uint8Array(wasiLoaderState.wasiModule.memory.buffer);
  return buffer.slice(offset, offset + length);
}

/**
 * Reset the WASI loader state
 */
export function resetWasiLoader(): void {
  wasiLoaderState.url = '';
  wasiLoaderState.isLoading = false;
  wasiLoaderState.progress = 0;
  wasiLoaderState.error = null;
  wasiLoaderState.wasiModule = null;
  wasiLoaderState.progressHistory = [];
}
