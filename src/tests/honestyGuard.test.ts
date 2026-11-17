// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ALL_CASES } from '../cases';
import { runCaseIsolated } from '../cases/runner';
import { DEMO_START_MS } from '../domain/clock';
import { DEFAULT_FUSION_CONFIG } from '../domain/config';
import { generateBackgroundVehicle } from '../sim/traffic';

describe('Honesty guard: zero external network requests', () => {
  it('never invokes fetch or XMLHttpRequest to any external origin during engine, traffic, or case runs', () => {
    const externalCalls: string[] = [];
    const origin = window.location.origin;

    const origFetch = globalThis.fetch;
    const origXhrOpen = window.XMLHttpRequest.prototype.open;

    globalThis.fetch = ((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (!url.startsWith(origin) && !url.startsWith('/')) {
        externalCalls.push(`fetch:${url}`);
      }
      throw new Error(`Unexpected fetch call in offline simulation: ${url}`);
    }) as typeof fetch;

    window.XMLHttpRequest.prototype.open = function (
      _method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      const sUrl = String(url);
      if (!sUrl.startsWith(origin) && !sUrl.startsWith('/')) {
        externalCalls.push(`xhr:${sUrl}`);
      }
      return origXhrOpen.apply(this, [_method, url, ...rest] as Parameters<typeof origXhrOpen>);
    };

    try {
      generateBackgroundVehicle('L01', DEMO_START_MS, 1, 104729, false, DEFAULT_FUSION_CONFIG);
      for (const c of ALL_CASES.slice(0, 8)) {
        runCaseIsolated(c, 'L01', DEFAULT_FUSION_CONFIG, '999');
      }
      expect(externalCalls).toEqual([]);
    } finally {
      globalThis.fetch = origFetch;
      window.XMLHttpRequest.prototype.open = origXhrOpen;
    }
  });
});
