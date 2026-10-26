export const hasWebGpuAdapter = async (): Promise<boolean> => {
  try {
    return !!navigator.gpu && !!(await navigator.gpu.requestAdapter())
  } catch {
    return false
  }
}
