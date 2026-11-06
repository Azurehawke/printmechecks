// Check register stored in an .xlsx file (e.g. in an Obsidian vault).
//
// Layout: one sheet named "Register", a header row, one row per check.
// Columns are found by their header text, so you can reorder columns, widen
// them, add your own columns or formatting in Excel/GridCraft, and the app
// keeps working. Only the last 4 digits of account numbers are written.
const ExcelJS = require('exceljs')
const fs = require('fs')
const path = require('path')

const SHEET = 'Register'

// key -> header text, width, number format
const COLUMNS = [
  { key: 'date', header: 'Date', width: 12, numFmt: 'm/d/yyyy' },
  { key: 'checkNumber', header: 'Check #', width: 12 },
  { key: 'payTo', header: 'Payee', width: 30 },
  { key: 'amount', header: 'Amount', width: 13, numFmt: '"$"#,##0.00' },
  { key: 'memo', header: 'Memo', width: 30 },
  { key: 'status', header: 'Status', width: 10 },
  { key: 'accountLabel', header: 'Account', width: 24 },
  { key: 'bankName', header: 'Bank', width: 22 },
  { key: 'accountLast4', header: 'Acct (last 4)', width: 12 },
  { key: 'savedAt', header: 'Saved', width: 17, numFmt: 'yyyy-mm-dd hh:mm' },
  { key: 'id', header: 'Entry ID', width: 14, hidden: true },
  { key: 'accountId', header: 'Account ID', width: 14, hidden: true }
]

const STATUSES = ['Issued', 'Cleared', 'Void']

// ---------- Value conversion ----------

// "11/6/2026" -> Excel date (stored as UTC midnight so it never shifts a day)
function toExcelDate (s) {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/) ||
    String(s || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!m) return s || null
  const [y, mo, d] = m[3].length === 4 ? [+m[3], +m[1], +m[2]] : [+m[1], +m[2], +m[3]]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return isNaN(dt) ? s : dt
}

function fromExcelDate (v) {
  if (v instanceof Date && !isNaN(v)) return `${v.getUTCMonth() + 1}/${v.getUTCDate()}/${v.getUTCFullYear()}`
  return v == null ? '' : String(v)
}

function toAmount (s) {
  const n = parseFloat(String(s ?? '').replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? null : Math.round(n * 100) / 100
}

// Cell value -> plain string (handles rich text, formulas, hyperlinks)
function cellText (v) {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('')
    if ('result' in v) return cellText(v.result)
    if ('text' in v) return String(v.text)
    if ('hyperlink' in v) return String(v.hyperlink)
    return ''
  }
  return String(v)
}

function toRow (entry) {
  return {
    date: toExcelDate(entry.date),
    checkNumber: entry.checkNumber ?? '',
    payTo: entry.payTo ?? '',
    amount: toAmount(entry.amount),
    memo: entry.memo ?? '',
    status: entry.status || 'Issued',
    accountLabel: entry.accountLabel ?? '',
    bankName: entry.bankName ?? '',
    accountLast4: entry.accountLast4 ?? '',
    savedAt: entry.savedAt ? new Date(entry.savedAt) : new Date(),
    id: entry.id ?? '',
    accountId: entry.accountId ?? ''
  }
}

// ---------- Workbook helpers ----------

// Map header text -> column number from row 1.
function headerMap (ws) {
  const map = {}
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    const text = cellText(cell.value).trim().toLowerCase()
    const def = COLUMNS.find(c => c.header.toLowerCase() === text)
    if (def && !map[def.key]) map[def.key] = col
  })
  return map
}

function lastDataRow (ws) {
  for (let r = ws.rowCount; r > 1; r--) {
    const row = ws.getRow(r)
    let has = false
    row.eachCell({ includeEmpty: false }, c => { if (cellText(c.value).trim() !== '') has = true })
    if (has) return r
  }
  return 1
}

function styleHeader (ws) {
  const row = ws.getRow(1)
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2B579A' } }
    c.alignment = { vertical: 'middle' }
  })
  row.height = 20
}

function refreshFilter (ws, map) {
  const cols = Object.values(map)
  if (!cols.length) return
  // Status dropdown (Issued / Cleared / Void). Rebuilt on every write so it
  // never fragments as rows are added or removed.
  if (map.status && ws.dataValidations) {
    const L = colLetter(map.status)
    ws.dataValidations.model = {}
    ws.dataValidations.add(`${L}2:${L}5000`, {
      type: 'list', allowBlank: true, formulae: [`"${STATUSES.join(',')}"`]
    })
  }
  const max = Math.max(...cols, ws.getRow(1).cellCount)
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, lastDataRow(ws)), column: max } }
}

// Add any of our columns that are missing (e.g. an older file), at the end.
function ensureColumns (ws) {
  const map = headerMap(ws)
  let next = Math.max(ws.getRow(1).cellCount, 0) + 1
  for (const def of COLUMNS) {
    if (!map[def.key]) {
      ws.getRow(1).getCell(next).value = def.header
      const col = ws.getColumn(next)
      col.width = def.width
      if (def.hidden) col.hidden = true
      map[def.key] = next++
    }
  }
  return map
}

function writeEntry (ws, map, rowNum, entry) {
  const values = toRow(entry)
  const row = ws.getRow(rowNum)
  for (const def of COLUMNS) {
    const cell = row.getCell(map[def.key])
    cell.value = values[def.key]
    if (def.numFmt) cell.numFmt = def.numFmt
  }
  row.commit()
}

function readEntry (ws, map, rowNum) {
  const row = ws.getRow(rowNum)
  const get = key => (map[key] ? row.getCell(map[key]).value : null)
  const amount = get('amount')
  const savedAt = get('savedAt')
  return {
    id: cellText(get('id')) || `row-${rowNum}`,
    row: rowNum,
    date: fromExcelDate(get('date')),
    checkNumber: cellText(get('checkNumber')),
    payTo: cellText(get('payTo')),
    amount: typeof amount === 'number' ? amount.toFixed(2) : cellText(amount),
    memo: cellText(get('memo')),
    status: cellText(get('status')) || 'Issued',
    accountLabel: cellText(get('accountLabel')),
    bankName: cellText(get('bankName')),
    accountLast4: cellText(get('accountLast4')),
    savedAt: savedAt instanceof Date ? savedAt.toISOString() : cellText(savedAt),
    accountId: cellText(get('accountId'))
  }
}

function sheetOf (wb) {
  return wb.getWorksheet(SHEET) || wb.worksheets[0]
}

async function loadWorkbook (file) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  const ws = sheetOf(wb)
  if (!ws) throw new Error('The file has no worksheets.')
  return { wb, ws }
}

// Write to a temp file, then replace, so a crash never leaves a broken file.
async function saveWorkbook (wb, file) {
  const tmp = path.join(path.dirname(file), `.~${path.basename(file)}.${process.pid}.tmp`)
  await wb.xlsx.writeFile(tmp)
  try {
    fs.renameSync(tmp, file)
  } catch (err) {
    fs.rmSync(tmp, { force: true })
    if (['EBUSY', 'EPERM', 'EACCES'].includes(err.code)) {
      throw new Error('The register file is open in another program (such as Excel). Close it there and try again.')
    }
    throw err
  }
}

function checkPath (file) {
  if (typeof file !== 'string' || !/\.xlsx$/i.test(file)) throw new Error('The register must be an .xlsx file.')
}

// ---------- Public API ----------

async function create (file, entries = []) {
  checkPath(file)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Print Me Checks'
  wb.created = new Date()
  const ws = wb.addWorksheet(SHEET, { views: [{ state: 'frozen', ySplit: 1 }] })
  ws.columns = COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width, hidden: !!c.hidden }))
  styleHeader(ws)
  const map = headerMap(ws)
  entries.forEach((e, i) => writeEntry(ws, map, i + 2, e))
  refreshFilter(ws, map)
  await saveWorkbook(wb, file)
  return read(file)
}

async function read (file) {
  checkPath(file)
  const { ws } = await loadWorkbook(file)
  const map = headerMap(ws)
  if (!map.checkNumber || !map.payTo || !map.amount) {
    throw new Error('This doesn\'t look like a check register: the first row needs "Check #", "Payee" and "Amount" headers.')
  }
  const entries = []
  const last = lastDataRow(ws)
  for (let r = 2; r <= last; r++) {
    const e = readEntry(ws, map, r)
    if (e.checkNumber || e.payTo || e.amount) entries.push(e)
  }
  return entries
}

async function append (file, entry) {
  checkPath(file)
  const { wb, ws } = await loadWorkbook(file)
  const map = ensureColumns(ws)
  writeEntry(ws, map, lastDataRow(ws) + 1, entry)
  refreshFilter(ws, map)
  await saveWorkbook(wb, file)
  return read(file)
}

function findRow (ws, map, id) {
  const last = lastDataRow(ws)
  for (let r = 2; r <= last; r++) {
    const rid = map.id ? cellText(ws.getRow(r).getCell(map.id).value) : ''
    if ((rid || `row-${r}`) === id) return r
  }
  return 0
}

async function update (file, id, patch) {
  checkPath(file)
  const { wb, ws } = await loadWorkbook(file)
  const map = ensureColumns(ws)
  const r = findRow(ws, map, id)
  if (!r) throw new Error('That check is no longer in the register file (it may have been edited elsewhere).')
  const row = ws.getRow(r)
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) throw new Error('Unknown status ' + patch.status)
    row.getCell(map.status).value = patch.status
  }
  row.commit()
  refreshFilter(ws, map)
  await saveWorkbook(wb, file)
  return read(file)
}

async function remove (file, id) {
  checkPath(file)
  const { wb, ws } = await loadWorkbook(file)
  const map = headerMap(ws)
  const r = findRow(ws, map, id)
  if (!r) throw new Error('That check is no longer in the register file.')
  ws.spliceRows(r, 1)
  refreshFilter(ws, map)
  await saveWorkbook(wb, file)
  return read(file)
}

function colLetter (n) {
  let s = ''
  while (n > 0) {
    const m = (n - 1) % 26
    s = String.fromCharCode(65 + m) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

module.exports = { create, read, append, update, remove, STATUSES, COLUMNS }
