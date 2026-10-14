export type BrowserKind = 'firefox' | 'chromium' | 'safari' | 'other'

/** Rough UA sniffing, only to choose which instructions to show. */
export const detectBrowser = (ua: string): BrowserKind => {
  if (/Firefox\/|FxiOS\//.test(ua)) return 'firefox'
  if (/Edg\/|EdgA\/|OPR\/|Chrome\/|CriOS\/|Chromium\//.test(ua)) return 'chromium'
  if (/Safari\//.test(ua)) return 'safari'
  return 'other'
}

export const hasWebGpuAdapter = async (): Promise<boolean> => {
  try {
    return !!navigator.gpu && !!(await navigator.gpu.requestAdapter())
  } catch {
    return false
  }
}
