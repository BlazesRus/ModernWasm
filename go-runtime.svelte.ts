/**
 * Modern TypeScript Go WASM Runtime for Svelte 5
 * generated with Github copilot based on Go's wasm_exec.js
 * with improvements by Microsoft Copilot
 *
 * Based on Go's wasm_exec.js:
 * Copyright 2018 The Go Authors. All rights reserved.
 * Use of this source code is governed by a BSD-style
 * license that can be found in the LICENSE file.
 *
 * TypeScript/Svelte 5 adaptation with GitHub Copilot assistance
 * and fixes by Microsoft Copilot
 * by James Armstrong (github.com/BlazesRus)
 *
 * Complete TypeScript implementation of Go's wasm_exec.js with Svelte 5 runes
 * Provides full type safety, reactive state, and modern error handling
 */

import { browser } from '$app/environment';
import { addDebugMessage, captureError } from './debugLogger.svelte';

// Comprehensive type definitions for Go WASM
export interface GoInstance {
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
  env: Record<string, string>;
  argv: string[];
  _pendingEvent?: any;
  _scheduledTimeouts?: Map<number, any>;
  _nextCallbackTimeoutID?: number;
  exited?: boolean;
  mem?: DataView;
  _values?: any[];
  _goRefCounts: number[];
  _ids: Map<any, number>;
  _idPool: number[];
  _inst?: WebAssembly.Instance;
  _resolveExitPromise?: (value?: any) => void;
}

// Reactive state for the Go WASM runtime using Svelte 5 runes
export const goRuntimeState = $state({
  isInitialized: false,
  isRunning: false,
  hasExited: false,
  error: null as string | null,
  debugEnabled: true,
  logs: [] as string[],
  exports: {} as Record<string, any>,
  memoryUsage: 0,
  lastOperation: null as string | null,

  // internal place to stash the live WASM instance
  _wasmInstance: null as WebAssembly.Instance | null,

  // computed: spread-less copy of the live exports
  get rawExports(): Record<string, any> {
    // will re-run whenever `_wasmInstance` changes
    return (this._wasmInstance?.exports as Record<string, any>) ?? {};
  },

  // computed property in the same state object
  get isReady() {
    return this.isInitialized && this.isRunning && !this.hasExited && this.error === null;
  },

  // derived field built into the same state object
  get wasmExports() {
    // spread to new object to ensure change detection
    return { ...this.exports };
  }
});

// Internal debug logger that writes into goRuntimeState.logs with reactive state
function debugLog(message: string, level: 'info' | 'warn' | 'error' = 'info') {
  if (!browser || !goRuntimeState.debugEnabled) return;

  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;

  // Add to reactive logs
  goRuntimeState.logs = [...goRuntimeState.logs, logMessage];
  if (goRuntimeState.logs.length > 50) {
    goRuntimeState.logs = goRuntimeState.logs.slice(-50);
  }

  // Console output
  switch (level) {
    case 'error':
      addDebugMessage(`🚨 Go Runtime: ${message}`, 'error');
      break;
    case 'warn':
      addDebugMessage(`⚠️ Go Runtime: ${message}`, 'warn');
      break;
    default:
      addDebugMessage(`🔧 Go Runtime: ${message}`);
  }
}

// File system implementation for browser environment
function createBrowserFS() {
  const enosys = () => {
    const err = new Error('not implemented');
    (err as any).code = 'ENOSYS';
    return err;
  };

  let outputBuf = '';
  const decoder = new TextDecoder('utf-8');

  return {
    constants: {
      O_WRONLY: -1,
      O_RDWR: -1,
      O_CREAT: -1,
      O_TRUNC: -1,
      O_APPEND: -1,
      O_EXCL: -1
    },
    writeSync(fd: number, buf: Uint8Array): number {
      outputBuf += decoder.decode(buf);
      const nl = outputBuf.lastIndexOf('\n');
      if (nl !== -1) {
        const output = outputBuf.substring(0, nl);
        if (fd === 1) {
          debugLog(`stdout: ${output}`);
        } else if (fd === 2) {
          debugLog(`stderr: ${output}`, 'error');
        }
        outputBuf = outputBuf.substring(nl + 1);
      }
      return buf.length;
    },
    write(fd: number, buf: any, offset: number, length: number, position: any, callback: Function) {
      if (offset !== 0 || length !== buf.length || position !== null) {
        callback(enosys());
        return;
      }
      const n = this.writeSync(fd, buf);
      callback(null, n);
    },
    chmod: (path: any, mode: any, callback: Function) => callback(enosys()),
    chown: (path: any, uid: any, gid: any, callback: Function) => callback(enosys()),
    close: (fd: any, callback: Function) => callback(enosys()),
    fchmod: (fd: any, mode: any, callback: Function) => callback(enosys()),
    fchown: (fd: any, uid: any, gid: any, callback: Function) => callback(enosys()),
    fstat: (fd: any, callback: Function) => callback(enosys()),
    fsync: (fd: any, callback: Function) => callback(null),
    ftruncate: (fd: any, length: any, callback: Function) => callback(enosys()),
    lchown: (path: any, uid: any, gid: any, callback: Function) => callback(enosys()),
    link: (path: any, link: any, callback: Function) => callback(enosys()),
    lstat: (path: any, callback: Function) => callback(enosys()),
    mkdir: (path: any, perm: any, callback: Function) => callback(enosys()),
    open: (path: any, flags: any, mode: any, callback: Function) => callback(enosys()),
    read: (fd: any, buffer: any, offset: any, length: any, position: any, callback: Function) => callback(enosys()),
    readdir: (path: any, callback: Function) => callback(enosys()),
    readlink: (path: any, callback: Function) => callback(enosys()),
    rename: (from: any, to: any, callback: Function) => callback(enosys()),
    rmdir: (path: any, callback: Function) => callback(enosys()),
    stat: (path: any, callback: Function) => callback(enosys()),
    symlink: (path: any, link: any, callback: Function) => callback(enosys()),
    truncate: (path: any, length: any, callback: Function) => callback(enosys()),
    unlink: (path: any, callback: Function) => callback(enosys()),
    utimes: (path: any, atime: any, mtime: any, callback: Function) => callback(enosys())
  };
}

// Process implementation for browser environment
function createBrowserProcess() {
  return {
    getuid: () => -1,
    getgid: () => -1,
    geteuid: () => -1,
    getegid: () => -1,
    getgroups: () => {
      throw new Error('not implemented');
    },
    pid: -1,
    ppid: -1,
    umask: () => {
      throw new Error('not implemented');
    },
    cwd: () => {
      throw new Error('not implemented');
    },
    chdir: () => {
      throw new Error('not implemented');
    }
  };
}

// Modern Go class implementation with proper TypeScript types
export class ModernGo implements GoInstance {
  importObject: WebAssembly.Imports;
  env: Record<string, string> = {};
  argv: string[] = ['js'];
  _pendingEvent: any = null;
  _scheduledTimeouts = new Map<number, any>();
  _nextCallbackTimeoutID = 1;
  exited = false;
  mem?: DataView;

  // Initialize arrays and maps with default values so they're never undefined
  _values: any[] = [];
  _goRefCounts: number[] = [];
  _ids = new Map<any, number>();
  _idPool: number[] = [];

  _inst?: WebAssembly.Instance;
  _resolveExitPromise?: (value?: any) => void;

  constructor() {
    debugLog('Creating new ModernGo instance');

    // Initialize browser environment
    if (browser && !(globalThis as any).fs) {
      (globalThis as any).fs = createBrowserFS();
      debugLog('Browser filesystem initialized');
    }

    if (browser && !globalThis.process) {
      (globalThis as any).process = createBrowserProcess();
      debugLog('Browser process initialized');
    }

    this.importObject = { gojs: this.buildImports() };

    // initial Go value table
    this._values = [NaN, 0, null, true, false, globalThis, this];
    this._goRefCounts = new Array(this._values.length).fill(Infinity);
    this._ids = new Map<any, number>([
      [0, 1],
      [null, 2],
      [true, 3],
      [false, 4],
      [globalThis, 5],
      [this, 6]
    ]);
    this._idPool = [];
    this.exited = false;

    // Set up environment
    this.env = {
      GOOS: 'js',
      GOARCH: 'wasm',
      GO_WASM_DEBUG: goRuntimeState.debugEnabled ? 'true' : 'false'
    };

    goRuntimeState.isInitialized = true;
    debugLog('ModernGo constructor completed');
  }

  // --- Core run/resume methods ---
  async run(instance: WebAssembly.Instance): Promise<void> {
    if (!(instance instanceof WebAssembly.Instance)) {
      throw new Error('Go.run: WebAssembly.Instance expected');
    }

    debugLog('Starting Go program execution');
    goRuntimeState.isRunning = true;
    goRuntimeState.hasExited = false;
    goRuntimeState.error = null;

    // Store instance globally for runtime access
    this._inst = instance;
    (globalThis as any)._inst = instance;
    (globalThis as any).go = this;

    // Set up memory view
    this.mem = new DataView((instance.exports.mem as WebAssembly.Memory).buffer);
    goRuntimeState.memoryUsage = this.mem.buffer.byteLength;
    goRuntimeState.exports = { ...instance.exports };

    // Reset values
    this._values![0] = NaN;
    this._values![1] = 0;
    this._values![2] = null;
    this._values![3] = true;
    this._values![4] = false;
    this._values![5] = globalThis;
    this._values![6] = this;

    // Set up program arguments
    let offset = 4096;
    const strPtr = (str: string): number => {
      const ptr = offset;
      const bytes = new TextEncoder().encode(str + '\0');
      new Uint8Array(this.mem!.buffer, offset, bytes.length).set(bytes);
      offset += bytes.length;
      if (offset % 8 !== 0) {
        offset += 8 - (offset % 8);
      }
      return ptr;
    };

    // Prepare arguments
    const argc = this.argv.length;
    const argvPtrs: number[] = [];
    this.argv.forEach(arg => {
      argvPtrs.push(strPtr(arg));
    });

    // Set up argc and argv
    this.setBigInt64(offset, BigInt(argc), true);
    this.setBigInt64(offset + 8, BigInt(argvPtrs[0] || 0), true);

    try {
      // Create exit promise for proper cleanup
      const exitPromise = new Promise<void>(resolve => {
        this._resolveExitPromise = resolve;
      });

      // Start the Go program
      debugLog('Calling Go main function');
      goRuntimeState.lastOperation = 'main';
      (instance.exports.run as Function)(offset, offset + 8);

      // Wait for program to exit
      await exitPromise;
      debugLog('Go program completed');
    } catch (error) {
      const errorMsg = `Go program execution failed: ${error}`;
      goRuntimeState.error = errorMsg;
      debugLog(errorMsg, 'error');
      throw error;
    } finally {
      goRuntimeState.isRunning = false;
    }
  }

  /** Resume callback loop */
  _resume(): void {
    if (this.exited) {
      throw new Error('Go program has already exited');
    }
    debugLog('Resuming Go execution');
    goRuntimeState.lastOperation = 'resume';
    (this._inst!.exports.resume as Function)();
    if (this.exited && this._resolveExitPromise) {
      this._resolveExitPromise();
    }
  }

  _makeFuncWrapper(id: number): Function {
    const go = this;
    return function (this: any, ...args: any[]) {
      const event: any = { id: id, this: this, args: args };
      go._pendingEvent = event;
      go._resume();
      return event.result;
    };
  }

  // Helper methods for 64-bit integer operations
  private getBigInt64(addr: number, littleEndian: boolean): bigint {
    return this.mem!.getBigInt64(addr, littleEndian);
  }

  private setBigInt64(addr: number, value: bigint, littleEndian: boolean): void {
    this.mem!.setBigInt64(addr, value, littleEndian);
  }

  private getInt64(addr: number): bigint {
    return this.getBigInt64(addr, true);
  }

  private setInt64(addr: number, v: bigint): void {
    this.setBigInt64(addr, v, true);
  }

  private loadValue(addr: number): any {
    const f = this.mem!.getFloat64(addr, true);
    if (f === 0) {
      return undefined;
    }
    if (!isNaN(f)) {
      return f;
    }

    const id = this.mem!.getUint32(addr, true);
    return this._values![id]!;
  }

  private storeValue(addr: number, v: any): void {
    const nanHead = 0x7ff80000;

    if (typeof v === 'number' && v !== 0) {
      if (isNaN(v)) {
        this.mem!.setUint32(addr + 4, nanHead, true);
        this.mem!.setUint32(addr, 0, true);
        return;
      }
      this.mem!.setFloat64(addr, v, true);
      return;
    }

    if (v === undefined) {
      this.mem!.setFloat64(addr, 0, true);
      return;
    }

    let id = this._ids!.get(v);
    if (id === undefined) {
      id = this._idPool!.pop();
      if (id === undefined) {
        id = this._values!.length;
      }
      this._values![id] = v;
      this._goRefCounts![id] = 0;
      this._ids!.set(v, id);
    }
    this._goRefCounts[id]!++;
    let typeFlag = 0;
    switch (typeof v) {
      case 'object':
        if (v !== null) {
          typeFlag = 1;
        }
        break;
      case 'string':
        typeFlag = 2;
        break;
      case 'symbol':
        typeFlag = 3;
        break;
      case 'function':
        typeFlag = 4;
        break;
    }
    this.mem!.setUint32(addr + 4, nanHead | typeFlag, true);
    this.mem!.setUint32(addr, id, true);
  }

  private loadString(addr: number): string {
    const saddr = Number(this.getBigInt64(addr + 0, true));
    const len = Number(this.getBigInt64(addr + 8, true));
    return new TextDecoder('utf-8').decode(new DataView(this.mem!.buffer, saddr, len));
  }

  private loadSliceOfValues(addr: number): any[] {
    const array = Number(this.getBigInt64(addr + 0, true));
    const len = Number(this.getBigInt64(addr + 8, true));
    const a = new Array(len);
    for (let i = 0; i < len; i++) {
      a[i] = this.loadValue(array + i * 8);
    }
    return a;
  }

  // --- Implementations of individual import handlers ---

  //runtime.wasmExit
  private wasmExit(sp: number) {
    sp >>>= 0;
    const code = this.mem!.getInt32(sp + 8, true);
    this.exited = true;
    goRuntimeState.hasExited = true;
    goRuntimeState.isRunning = false;
    delete (globalThis as any)._inst;
    delete (globalThis as any).go;
    debugLog(`Exited with code ${code}`, code !== 0 ? 'error' : 'info');
    this._resolveExitPromise?.(code);
  }

  //runtime.wasmWrite
  private wasmWrite(sp: number) {
    sp >>>= 0;
    const fd = this.getBigInt64(sp + 8, true);
    const p = this.getBigInt64(sp + 16, true);
    const n = this.mem!.getInt32(sp + 24, true);
    const bytes = new Uint8Array(this.mem!.buffer, Number(p), n);
    const text = new TextDecoder().decode(bytes);
    if (fd === 1n) debugLog(`stdout: ${text}`);
    else if (fd === 2n) debugLog(`stderr: ${text}`, 'error');
    else throw new Error(`unknown FD ${fd}`);
  }

  //runtime.resetMemory
  private resetMemory(sp: number) {
    sp >>>= 0;
    this.mem = new DataView((this._inst!.exports.mem as WebAssembly.Memory).buffer);
    goRuntimeState.memoryUsage = this.mem.buffer.byteLength;
  }

  //runtime.nanoTime
  private nanoTime(sp: number) {
    sp >>>= 0;
    this.setBigInt64(sp + 8, BigInt(Math.floor(performance.now() * 1e6)), true);
  }

  //runtime.wallTime
  private wallTime(sp: number) {
    sp >>>= 0;
    const ms = Date.now();
    this.setBigInt64(sp + 8, BigInt(Math.floor(ms / 1000)), true);
    this.mem!.setInt32(sp + 16, (ms % 1000) * 1e6, true);
  }

  //runtime.scheduleTimeout
  private scheduleTimeout(sp: number) {
    sp >>>= 0;
    const id = this._nextCallbackTimeoutID++;
    this._scheduledTimeouts.set(
      id,
      setTimeout(
        () => {
          this._resume();
        },
        Number(this.getBigInt64(sp + 8, true)) + 1
      )
    );
    this.mem!.setInt32(sp + 16, id, true);
  }

  //runtime.clearTimeout
  private clearTimeout(sp: number) {
    sp >>>= 0;
    const id = this.mem!.getInt32(sp + 8, true);
    clearTimeout(this._scheduledTimeouts.get(id));
    this._scheduledTimeouts.delete(id);
  }

  //runtime.getRandomData
  private getRandomData(sp: number) {
    sp >>>= 0;
    crypto.getRandomValues(new Uint8Array(this.mem!.buffer, Number(this.getBigInt64(sp + 8, true)), this.mem!.getInt32(sp + 16, true)));
  }

  //syscall/js.finalizeRef
  private finalizeRef(sp: number) {
    sp >>>= 0;
    const id = this.mem!.getUint32(sp + 8, true);
    this._goRefCounts[id]!--;
    if (this._goRefCounts[id]! === 0) {
      const v = this._values![id];
      this._values![id] = null;
      this._ids!.delete(v);
      this._idPool!.push(id);
    }
  }

  //syscall/js.stringVal
  private stringVal(sp: number) {
    sp >>>= 0;
    this.storeValue(sp + 24, this.loadString(sp + 8));
  }

  //syscall/js.valueGet
  private valueGet(sp: number) {
    sp >>>= 0;
    const result = Reflect.get(this.loadValue(sp + 8), this.loadString(sp + 16));
    (globalThis as any).sp = sp;
    this.storeValue(sp + 32, result);
  }

  //syscall/js.valueSet
  private valueSet(sp: number) {
    sp >>>= 0;
    Reflect.set(this.loadValue(sp + 8), this.loadString(sp + 16), this.loadValue(sp + 32));
  }

  //syscall/js.valueDelete
  private valueDelete(sp: number) {
    sp >>>= 0;
    Reflect.deleteProperty(this.loadValue(sp + 8), this.loadString(sp + 16));
  }

  //syscall/js.valueIndex
  private valueIndex(sp: number) {
    sp >>>= 0;
    this.storeValue(sp + 24, Reflect.get(this.loadValue(sp + 8), Number(this.getBigInt64(sp + 16, true))));
  }

  //syscall/js.valueSetIndex
  private valueSetIndex(sp: number) {
    sp >>>= 0;
    Reflect.set(this.loadValue(sp + 8), Number(this.getBigInt64(sp + 16, true)), this.loadValue(sp + 24));
  }

  //syscall/js.valueCall
  private valueCall(sp: number) {
    sp >>>= 0;
    try {
      const v = this.loadValue(sp + 8);
      const m = Reflect.get(v, this.loadString(sp + 16));
      const args = this.loadSliceOfValues(sp + 32);
      const result = Reflect.apply(m, v, args);
      (globalThis as any).sp = sp;
      this.storeValue(sp + 56, result);
      this.mem!.setUint8(sp + 64, 1);
    } catch (err) {
      (globalThis as any).sp = sp;
      this.storeValue(sp + 56, err);
      this.mem!.setUint8(sp + 64, 0);
    }
  }

  //syscall/js.valueInvoke
  private valueInvoke(sp: number) {
    sp >>>= 0;
    try {
      const v = this.loadValue(sp + 8);
      const args = this.loadSliceOfValues(sp + 16);
      const result = Reflect.apply(v, undefined, args);
      (globalThis as any).sp = sp;
      this.storeValue(sp + 40, result);
      this.mem!.setUint8(sp + 48, 1);
    } catch (err) {
      (globalThis as any).sp = sp;
      this.storeValue(sp + 40, err);
      this.mem!.setUint8(sp + 48, 0);
    }
  }

  //syscall/js.valueNew
  private valueNew(sp: number) {
    sp >>>= 0;
    try {
      const v = this.loadValue(sp + 8);
      const args = this.loadSliceOfValues(sp + 16);
      const result = Reflect.construct(v, args);
      (globalThis as any).sp = sp;
      this.storeValue(sp + 40, result);
      this.mem!.setUint8(sp + 48, 1);
    } catch (err) {
      (globalThis as any).sp = sp;
      this.storeValue(sp + 40, err);
      this.mem!.setUint8(sp + 48, 0);
    }
  }

  //syscall/js.valueLength
  private valueLength(sp: number) {
    sp >>>= 0;
    this.setBigInt64(sp + 16, BigInt(this.loadValue(sp + 8).length), true);
  }

  //syscall/js.valuePrepareString
  private valuePrepareString(sp: number) {
    sp >>>= 0;
    const str = String(this.loadValue(sp + 8));
    const utf8 = new TextEncoder().encode(str);
    this.storeValue(sp + 16, utf8);
    this.setBigInt64(sp + 24, BigInt(utf8.length), true);
  }

  //syscall/js.valueLoadString
  private valueLoadString(sp: number) {
    sp >>>= 0;
    const str = this.loadValue(sp + 8);
    new Uint8Array(this.mem!.buffer, Number(this.getBigInt64(sp + 16, true)), Number(this.getBigInt64(sp + 24, true))).set(str);
  }

  //syscall/js.valueInstanceOf
  private valueInstanceOf(sp: number) {
    sp >>>= 0;
    this.mem!.setUint8(sp + 24, this.loadValue(sp + 8) instanceof this.loadValue(sp + 16) ? 1 : 0);
  }

  //syscall/js.copyBytesToGo
  private copyBytesToGo(sp: number) {
    sp >>>= 0;
    const dst = new Uint8Array(this.mem!.buffer, Number(this.getBigInt64(sp + 8, true)), Number(this.getBigInt64(sp + 16, true)));
    const src = this.loadValue(sp + 32);
    if (!(src instanceof Uint8Array || src instanceof Uint8ClampedArray)) {
      this.mem!.setUint8(sp + 48, 0);
      return;
    }
    const toCopy = Math.min(dst.length, src.length);
    dst.set(src.subarray(0, toCopy));
    this.setBigInt64(sp + 40, BigInt(toCopy), true);
    this.mem!.setUint8(sp + 48, 1);
  }

  //syscall/js.copyBytesToJS
  private copyBytesToJS(sp: number) {
    sp >>>= 0;
    const dst = this.loadValue(sp + 8);
    const src = new Uint8Array(this.mem!.buffer, Number(this.getBigInt64(sp + 16, true)), Number(this.getBigInt64(sp + 24, true)));
    if (!(dst instanceof Uint8Array || dst instanceof Uint8ClampedArray)) {
      this.mem!.setUint8(sp + 48, 0);
      return;
    }
    const toCopy = Math.min(dst.length, src.length);
    dst.set(src.subarray(0, toCopy));
    this.setBigInt64(sp + 40, BigInt(toCopy), true);
    this.mem!.setUint8(sp + 48, 1);
  }

  //Place new go functions added here

  private buildJsSyscalls() {
    return {
      'syscall/js.finalizeRef': this.finalizeRef.bind(this),
      'syscall/js.stringVal': this.stringVal.bind(this),
      'syscall/js.valueGet': this.valueGet.bind(this),
      'syscall/js.valueSet': this.valueSet.bind(this),
      'syscall/js.valueDelete': this.valueDelete.bind(this),
      'syscall/js.valueIndex': this.valueIndex.bind(this),
      'syscall/js.valueSetIndex': this.valueSetIndex.bind(this),
      'syscall/js.valueCall': this.valueCall.bind(this),
      'syscall/js.valueInvoke': this.valueInvoke.bind(this),
      'syscall/js.valueNew': this.valueNew.bind(this),
      'syscall/js.valueLength': this.valueLength.bind(this),
      'syscall/js.valuePrepareString': this.valuePrepareString.bind(this),
      'syscall/js.valueLoadString': this.valueLoadString.bind(this),
      'syscall/js.valueInstanceOf': this.valueInstanceOf.bind(this),
      'syscall/js.copyBytesToGo': this.copyBytesToGo.bind(this),
      'syscall/js.copyBytesToJS': this.copyBytesToJS.bind(this),
      debug: (v: any) => debugLog(`Go debug: ${v}`)
    };
  }

  private buildImports(): Record<string, Function> {
    return {
      'runtime.wasmExit': this.wasmExit.bind(this),
      'runtime.wasmWrite': this.wasmWrite.bind(this),
      'runtime.resetMemoryDataView': this.resetMemory.bind(this),
      'runtime.nanotime1': this.nanoTime.bind(this),
      'runtime.walltime': this.wallTime.bind(this),
      'runtime.scheduleTimeoutEvent': this.scheduleTimeout.bind(this),
      'runtime.clearTimeoutEvent': this.clearTimeout.bind(this),
      'runtime.getRandomData': this.getRandomData.bind(this),
      ...this.buildJsSyscalls()
      //Add new import bindings here
    };
  }
}

// Export the modern Go class and compatibility
export const Go = ModernGo;

// Enhanced runtime manager with Svelte 5 runes
export class ModernGoWasmRuntimeManager {
  private goInstance: ModernGo | null = null;
  private wasmInstance: WebAssembly.Instance | null = null;

  constructor() {
    debugLog('Creating ModernGoWasmRuntimeManager');
  }

  /** Load and start WASM; no forced timeout */
  async loadAndRun(wasmPath: string): Promise<boolean> {
    if (!browser) {
      debugLog('Not in browser environment', 'warn');
      return false;
    }
    try {
      debugLog(`Loading WASM from: ${wasmPath}`);
      goRuntimeState.error = null;

      // Create Go instance
      this.goInstance = new ModernGo();

      // Fetch and instantiate WASM
      debugLog('Fetching WASM binary...');
      const resp = await fetch(wasmPath);
      if (!resp.ok) {
        throw new Error(`Failed to fetch WASM: ${resp.status} ${resp.statusText}`);
      }
      debugLog('Compiling WASM module...');
      const bytes = await resp.arrayBuffer();
      const module = await WebAssembly.compile(bytes);

      debugLog('Instantiating WASM...');
      this.wasmInstance = await WebAssembly.instantiate(module, this.goInstance.importObject);

      // stash it into state for reactivity
      goRuntimeState._wasmInstance = this.wasmInstance;

      debugLog('Starting Go program (fire-and-forget)');
      goRuntimeState.isRunning = true;
      this.goInstance
        .run(this.wasmInstance)
        .then(() => debugLog('Go runtime exited'))
        .catch(err => {
          const msg = `Go.run() failed: ${err}`;
          debugLog(msg, 'error');
          goRuntimeState.error = msg;
        });

      debugLog('WASM loaded & Go.run() dispatched');
      return true;
    } catch (err) {
      const msg = `WASM loading failed: ${err}`;
      goRuntimeState.error = msg;
      goRuntimeState.isRunning = false;
      captureError(err instanceof Error ? err : new Error(String(err)), 'WasmLoading');
      return false;
    }
  }

  getExports(): Record<string, any> {
    return goRuntimeState.exports;
  }

  callExport(functionName: string, ...args: any[]): any {
    if (!this.wasmInstance) {
      throw new Error('WASM not loaded');
    }

    const func = this.wasmInstance.exports[functionName];
    if (typeof func !== 'function') {
      throw new Error(`Export '${functionName}' is not a function`);
    }

    debugLog(`Calling export: ${functionName}`);
    goRuntimeState.lastOperation = functionName;
    return func(...args);
  }

  isReady(): boolean {
    return goRuntimeState.isReady;
  }

  getState() {
    return goRuntimeState;
  }
}

// Global instance for easy access
let globalRuntimeManager: ModernGoWasmRuntimeManager | null = null;

export function getModernWasmRuntime(): ModernGoWasmRuntimeManager {
  if (!globalRuntimeManager) globalRuntimeManager = new ModernGoWasmRuntimeManager();
  return globalRuntimeManager;
}

// Export reactive state for components
export { goRuntimeState as wasmStatus };

// Set up global Go object for compatibility with legacy code
if (browser) {
  (globalThis as any).Go = ModernGo;
  debugLog('✅ Modern Go WASM runtime loaded and ready');
}
