// One-off startup timing marks, logged as "[Startup] <label> +<ms>ms" from when the JS bundle
// started running (native launch time before that isn't included). Imported first in index.js.
// Measure on a release build with: adb logcat | grep Startup
const jsStart = Date.now();
const marked = new Set<string>();

export function markStartup(label: string) {
  if (marked.has(label)) return;
  marked.add(label);
  console.log(`[Startup] ${label} +${Date.now() - jsStart}ms`);
}
