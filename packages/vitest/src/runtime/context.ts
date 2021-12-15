import type { Awaitable, TestFunction, RuntimeContext, SuiteCollector, DoneCallback } from '../types'

export const context: RuntimeContext = {
  tasks: [],
  currentSuite: null,
}

export function collectTask(task: SuiteCollector) {
  context.currentSuite?.tasks.push(task)
}

export async function runWithSuite(suite: SuiteCollector, fn: (() => Awaitable<void>)) {
  const prev = context.currentSuite
  context.currentSuite = suite
  await fn()
  context.currentSuite = prev
}

export function getDefaultTestTimeout() {
  return process.__vitest_worker__?.config?.testTimeout ?? 5000
}

export function getDefaultHookTimeout() {
  return process.__vitest_worker__?.config?.hookTimeout ?? 5000
}

export function withTimeout<T extends((...args: any[]) => any)>(fn: T, _timeout?: number): T {
  const timeout = _timeout ?? getDefaultTestTimeout()
  if (timeout <= 0 || timeout === Infinity)
    return fn

  return ((...args: (T extends ((...args: infer A) => any) ? A : never)) => {
    return Promise.race([fn(...args), new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer)
        reject(new Error(`Test timed out in ${timeout}ms.`))
      }, timeout)
      timer.unref()
    })]) as Awaitable<void>
  }) as T
}

function ensureAsyncTest(fn: TestFunction): () => Awaitable<void> {
  if (!fn.length)
    return fn as () => Awaitable<void>

  return () => new Promise((resolve, reject) => {
    const done: DoneCallback = (...args: any[]) => args[0] // rejest on truthy values
      ? reject(args[0])
      : resolve()
    fn(done)
  })
}

export function normalizeTest(fn: TestFunction, timeout?: number): () => Awaitable<void> {
  return withTimeout(ensureAsyncTest(fn), timeout)
}