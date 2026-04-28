export function createProgressReporter(onProgress) {
  return ({ progress, stage, message, status } = {}) => {
    if (typeof onProgress !== "function") return;
    onProgress({ progress, stage, message, status });
  };
}
