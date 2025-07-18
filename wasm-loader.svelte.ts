/**
 * Modern WASM Loader with Svelte 5 Runes -
 * with Microsoft Copilot streamlined recommendation
 *
 * Copyright (C) 2025 James Armstrong (github.com/BlazesRus)
 * Generated with GitHub Copilot assistance and Microsoft Copilot assistance
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { browser } from '$app/environment';
import { getModernWasmExecutor, wasmState } from './wasm-exec.svelte';
import { debugLog, captureError } from './debugLogger';

export let enhancedWasmState = $state({
  isLoading: false,
  isReady: false,
  error: null as string | null,
  progress: 0,
  executor: null as ReturnType<typeof getModernWasmExecutor> | null,
  progressHistory: [] as number[]
});

export async function loadWasm(wasmUrl: string): Promise<boolean> {
  if (!browser) return false;

  debugLog.info(`Starting WASM load from URL: ${wasmUrl}`, 'WASM-Loader');

  enhancedWasmState.isLoading = true;
  enhancedWasmState.progress = 0;
  enhancedWasmState.error = null;
  enhancedWasmState.progressHistory = [];

  const executor = getModernWasmExecutor(p => {
    enhancedWasmState.progress = p;
    enhancedWasmState.progressHistory.push(p);
    if (enhancedWasmState.progressHistory.length > 20) {
      enhancedWasmState.progressHistory = enhancedWasmState.progressHistory.slice(-20);
    }
    debugLog.debug(`WASM loading progress: ${p}%`, 'WASM-Loader');
  });
  enhancedWasmState.executor = executor;

  try {
    debugLog.info('Executing WASM load...', 'WASM-Loader');
    const ok = await executor.loadWasm(wasmUrl);
    enhancedWasmState.isReady = ok;
    enhancedWasmState.isLoading = false;

    if (!ok) {
      throw new Error('Executor reported failure');
    }

    const exports = executor.getExports();
    debugLog.info(`WASM loaded successfully. Exports: ${Object.keys(exports).join(', ')}`, 'WASM-Loader');
    debugLog.info(`WASM loaded successfully. Exports: ${Object.keys(exports).join(', ')}`, 'WASM-Loader');
    return true;
  } catch (err) {
    const errorMsg = String(err);
    enhancedWasmState.error = errorMsg;
    enhancedWasmState.isLoading = false;
    enhancedWasmState.progress = 0;

    captureError(err instanceof Error ? err : new Error(errorMsg), 'WASM-Loader');
    console.error('❌ Wasm load failed:', err);
    return false;
  }
}

// Legacy aliases for compatibility
export const loadModernWasm = loadWasm;
export const getWasmState = () => enhancedWasmState;
export const getWasmExecutor = () => enhancedWasmState.executor;
export const isWasmReady = () => enhancedWasmState.isReady && enhancedWasmState.executor?.isReady() === true;

export { wasmState as lowLevelWasmState };
