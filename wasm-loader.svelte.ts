/**
 * Modern WASM Loader with Svelte 5 Runes - Leaner Runes-Native Implementation
 * Following modern reactive patterns with single $state object and computed getters
 *
 * Copyright (C) 2025 James Armstrong (github.com/BlazesRus)
 * Generated with GitHub Copilot assistance and Microsoft Copilot assistance
 *
 * MIT License
 */
import { browser } from '$app/environment';
import { getModernWasmExecutor } from './wasm-exec.svelte';
import { addDebugMessage, captureError } from './debugLogger.svelte';

function debugLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  addDebugMessage(`🔧 WASM Loader: ${message}`, level);
}

// 1) Central reactive state - everything lives in one $state block
export const wasmLoaderState = $state({
  // Input URL
  url: '' as string,

  // Load flags
  isLoading: false,
  progress: 0,
  error: null as string | null,

  // The executor instance
  executor: null as ReturnType<typeof getModernWasmExecutor> | null,

  // History of progress values for debugging/visualization
  progressHistory: [] as number[],

  // 2) Derived getters - computed on the fly when underlying state changes
  get isReady() {
    return !this.isLoading && this.error === null && !!this.executor?.isReady();
  },

  get lastProgress() {
    return this.progressHistory.at(-1) ?? 0;
  },

  get hasError() {
    return this.error !== null;
  },

  get hasExports() {
    return !!this.executor && Object.keys(this.executor.getExports()).length > 0;
  },

  get exports() {
    return this.executor?.getExports() ?? {};
  }
});

// 4) Load function updates state in one place with immutable updates
export async function loadWasm(url: string): Promise<boolean> {
  if (!browser) {
    debugLog('Not in browser environment, skipping WASM load', 'warn');
    return false;
  }

  // Reset state with immutable updates
  wasmLoaderState.url = url;
  wasmLoaderState.isLoading = true;
  wasmLoaderState.progress = 0;
  wasmLoaderState.error = null;
  wasmLoaderState.progressHistory = [];

  // Get fresh executor instance
  const executor = getModernWasmExecutor();
  wasmLoaderState.executor = executor;

  // Progress tracking function that updates our state
  const updateProgress = (progress: number) => {
    wasmLoaderState.progress = progress;
    wasmLoaderState.progressHistory = [...wasmLoaderState.progressHistory, progress];

    // Manually trim history if it gets too long
    if (wasmLoaderState.progressHistory.length > 20) {
      wasmLoaderState.progressHistory = wasmLoaderState.progressHistory.slice(-20);
    }
  };

  try {
    debugLog(`Starting WASM load from ${url}`, 'info');

    // Initial progress
    updateProgress(10);

    // Load WASM - the executor will update its own reactive state
    const ok = await executor.loadWasm(url);

    if (!ok) {
      throw new Error('WASM executor reported failure');
    }

    // Wait for executor to be ready (reactive check)
    updateProgress(90);

    // Final check - use reactive readiness
    if (!executor.isReady()) {
      throw new Error('WASM loaded but executor not ready');
    }

    debugLog(`WASM loaded with exports: ${Object.keys(executor.getExports()).join(', ')}`, 'info');

    // Complete
    updateProgress(100);
    wasmLoaderState.isLoading = false;

    return true;
  } catch (err) {
    const msg = String(err);

    // Immutable error state update
    wasmLoaderState.error = msg;
    wasmLoaderState.isLoading = false;
    wasmLoaderState.progress = 0;

    captureError(err instanceof Error ? err : new Error(msg), 'WASM-Loader');
    debugLog(`WASM load failed: ${msg}`, 'error');

    return false;
  }
}
