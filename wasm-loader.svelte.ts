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

export let enhancedWasmState = $state({
  isLoading: false,
  isReady: false,
  error: null as string | null,
  progress: 0,
  executor: null as ReturnType<typeof getModernWasmExecutor> | null
});

export async function loadWasm(wasmUrl: string): Promise<boolean> {
  if (!browser) return false;

  enhancedWasmState.isLoading = true;
  enhancedWasmState.progress = 0;
  enhancedWasmState.error = null;

  const executor = getModernWasmExecutor(p => (enhancedWasmState.progress = p));
  enhancedWasmState.executor = executor;

  try {
    const ok = await executor.loadWasm(wasmUrl);
    enhancedWasmState.isReady = ok;
    enhancedWasmState.isLoading = false;

    if (!ok) throw new Error('Executor reported failure');
    console.log('✅ Wasm exports:', Object.keys(executor.getExports()));
    return true;
  } catch (err) {
    enhancedWasmState.error = String(err);
    enhancedWasmState.isLoading = false;
    enhancedWasmState.progress = 0;
    console.error('❌ Wasm load failed:', err);
    return false;
  }
}

// Legacy aliases for compatibility
export const getWasmState = () => enhancedWasmState;
export const getWasmExecutor = () => enhancedWasmState.executor;
export const isWasmReady = () => enhancedWasmState.isReady && enhancedWasmState.executor?.isReady() === true;

export { wasmState as lowLevelWasmState };
