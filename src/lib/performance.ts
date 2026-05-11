const enabled = import.meta.env.DEV;

export function markPerf(name: string) {
  if (!enabled || typeof performance === "undefined") return;
  performance.mark(name);
}

export function measurePerf(name: string, startMark: string, endMark: string) {
  if (!enabled || typeof performance === "undefined") return;
  try {
    performance.measure(name, startMark, endMark);
  } catch {
    // Missing marks are expected during hot reloads and partial flows.
  }
}
