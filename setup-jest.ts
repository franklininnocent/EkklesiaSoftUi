import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
setupZoneTestEnv();

// Workaround for Angular standalone tests where some browser APIs may be missing
Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true });

// Jasmine-style matcher shims
expect.extend({
  toBeTrue(received: any) {
    const pass = received === true;
    return { pass, message: () => `expected ${received} to be true` };
  },
  toBeFalse(received: any) {
    const pass = received === false;
    return { pass, message: () => `expected ${received} to be false` };
  }
} as any);

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeTrue(): R;
      toBeFalse(): R;
    }
  }
}

// Minimal jasmine shim to support existing specs using jasmine spies
(globalThis as any).jasmine = (globalThis as any).jasmine || {};
(globalThis as any).jasmine.createSpy = (name?: string) => {
  const spy = jest.fn();
  (spy as any).and = {
    returnValue: (val: any) => {
      spy.mockReturnValue(val);
      return spy;
    },
    callFake: (fn: (...args: any[]) => any) => {
      spy.mockImplementation(fn);
      return spy;
    }
  };
  return spy;
};

// Provide jasmine.any adapter using Jest's expect.any
(globalThis as any).jasmine.any = (ctor: any) => (expect as any).any(ctor);


