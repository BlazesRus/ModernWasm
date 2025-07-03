/**
 * Modern WASM Loader with Svelte 5 Runes -
 * with Microsoft Copilot streamlined recommendation
 *
 * Copyright (C) 2025 James Armstrong (github.com/BlazesRus)
 * Generated with GitHub Copilot assistance and Microsoft Copilot assistance
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 */
import { browser } from '$app/environment';
import wasmUrl from '/calculator.wasm?url';
import { getModernWasmExecutor, wasmState } from './wasm-exec.svelte';

export let enhancedWasmState = $state({
  isLoading: false,
  isReady: false,
  error: null as string | null,
  progress: 0,
  executor: null as ReturnType<typeof getModernWasmExecutor> | null
});

export async function loadModernWasm(): Promise<boolean> {
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
export const loadWasm = loadModernWasm;
export const getWasmState = () => enhancedWasmState;
export const getWasmExecutor = () => enhancedWasmState.executor;
export const isWasmReady = () => enhancedWasmState.isReady && enhancedWasmState.executor?.isReady() === true;

export { wasmState as lowLevelWasmState };
