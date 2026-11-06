import { ToWords } from 'to-words'

export function formatMoney (value: string | number) {
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  if (isNaN(n)) return '0.00'
  return n.toLocaleString('en-US', { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const toWordsTool = new ToWords({
  localeCode: 'en-US',
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
    doNotAddOnly: true
  }
})

export function amountInWords (value: string | number) {
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ''))
  if (isNaN(n)) return ''
  try {
    return toWordsTool.convert(n)
  } catch (e) {
    return ''
  }
}

// ---------- Printing ----------
// The desktop app has its own preview window (see electron/preview.html);
// in a browser we fall back to the browser's print dialog and preview.

interface DesktopApi {
  isDesktop: boolean
  printPreview: (name: string) => Promise<void>
  savePdf: (name: string) => Promise<void>
  register?: unknown // .xlsx register file operations (see stores/app.ts)
}

export function desktop (): DesktopApi | undefined {
  return (window as unknown as { pmc?: DesktopApi }).pmc
}

export function printPreview (name: string) {
  const d = desktop()
  if (d?.printPreview) d.printPreview(name)
  else window.print()
}

export function savePdf (name: string) {
  const d = desktop()
  if (d?.savePdf) d.savePdf(name)
  else window.print() // browser: choose "Save as PDF" as the printer
}
