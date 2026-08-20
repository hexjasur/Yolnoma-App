import * as React from 'react';
import * as ReactJSXRuntime from 'react/jsx-runtime';
import * as PluginSDK from '@yolnoma/plugin-sdk';

declare global {
  interface Window {
    __YOLNOMA_SHARED__?: {
      React: typeof React;
      jsxRuntime: typeof ReactJSXRuntime;
      sdk: typeof PluginSDK;
    };
  }
}

export interface SharedModuleUrls {
  readonly reactUrl: string;
  readonly jsxRuntimeUrl: string;
  readonly sdkUrl: string;
}

let cachedUrls: SharedModuleUrls | null = null;

/**
 * Exposes the host application's React and SDK runtime to window.__YOLNOMA_SHARED__
 * and generates virtual ES module Blob URLs so external plugins can import them
 * without bundling React into every plugin or causing dual-React hook conflicts.
 */
export function ensureSharedHostModules(): SharedModuleUrls {
  if (cachedUrls) {
    return cachedUrls;
  }

  // 1. Expose host instances
  window.__YOLNOMA_SHARED__ = {
    React,
    jsxRuntime: ReactJSXRuntime,
    sdk: PluginSDK,
  };

  // 2. Create virtual ES Module for 'react'
  const reactSource = `
    const React = window.__YOLNOMA_SHARED__.React;
    export const {
      useState,
      useEffect,
      useCallback,
      useMemo,
      useRef,
      useContext,
      createContext,
      useReducer,
      createElement,
      Fragment,
      Children,
      Component,
      PureComponent
    } = React;
    export default React;
  `;
  const reactBlob = new Blob([reactSource], { type: 'application/javascript' });
  const reactUrl = URL.createObjectURL(reactBlob);

  // 3. Create virtual ES Module for 'react/jsx-runtime'
  const jsxRuntimeSource = `
    const jsxRuntime = window.__YOLNOMA_SHARED__.jsxRuntime;
    export const { jsx, jsxs, Fragment } = jsxRuntime;
    export default jsxRuntime;
  `;
  const jsxRuntimeBlob = new Blob([jsxRuntimeSource], { type: 'application/javascript' });
  const jsxRuntimeUrl = URL.createObjectURL(jsxRuntimeBlob);

  // 4. Create virtual ES Module for '@yolnoma/plugin-sdk'
  const sdkSource = `
    const sdk = window.__YOLNOMA_SHARED__.sdk;
    export const { definePlugin } = sdk;
    export default sdk;
  `;
  const sdkBlob = new Blob([sdkSource], { type: 'application/javascript' });
  const sdkUrl = URL.createObjectURL(sdkBlob);

  cachedUrls = { reactUrl, jsxRuntimeUrl, sdkUrl };
  return cachedUrls;
}
