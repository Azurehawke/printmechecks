import { ref, reactive, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { desktop } from '../utilities'

// ---------- Types ----------

export interface Account {
  id: string
  label: string
  holderName: string
  address: string
  city: string
  state: string
  zip: string
  bankName: string
  routingNumber: string
  accountNumber: string
  nextCheckNumber: string
}

export interface CheckData {
  checkNumber: string
  date: string
  payTo: string
  amount: string
  memo: string
}

export interface FieldOffset { x: number, y: number }

export interface Settings {
  fontFamily: string // '' = app default
  fontSize: number // base size in px; every field scales from it
  boldValues: boolean // filled-in values (payee, amount, date…) in bold
  offsetX: number // whole-check offset in inches (printer alignment)
  offsetY: number
  fieldOffsets: Record<string, FieldOffset> // per-field nudges, canvas px
  showBackground: boolean
  showOutlines: boolean
  showStub: boolean // print a check stub below the check
  zoom: number | 'fit'
  registerPath: string // .xlsx register file ('' = keep the register in the app only)
}

export type CheckStatus = 'Issued' | 'Cleared' | 'Void'
export const STATUSES: CheckStatus[] = ['Issued', 'Cleared', 'Void']

// Register entries. Entries kept in the app keep the original flat format
// (so older saved checks still load) and include full account details.
// Entries read from the .xlsx file only carry the account's last 4 digits.
export interface RegisterEntry {
  id?: string
  checkNumber: string
  date: string
  payTo: string
  amount: string
  memo: string
  status?: CheckStatus | string
  bankName?: string
  accountId?: string
  accountLabel?: string
  accountLast4?: string
  savedAt?: string
  // In-app only:
  accountHolderName?: string
  accountHolderAddress?: string
  accountHolderCity?: string
  accountHolderState?: string
  accountHolderZip?: string
  routingNumber?: string
  bankAccountNumber?: string
}

export const DEFAULT_SETTINGS: Settings = {
  fontFamily: '',
  fontSize: 16,
  boldValues: true,
  offsetX: 0,
  offsetY: 0,
  fieldOffsets: {},
  showBackground: true,
  showOutlines: false,
  showStub: true,
  zoom: 'fit',
  registerPath: ''
}

// ---------- Storage helpers ----------

const KEYS = {
  accounts: 'pmc.accounts',
  activeAccount: 'pmc.activeAccountId',
  settings: 'pmc.settings',
  register: 'checkList' // original key, kept for existing history
}

function load<T> (key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save (key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  } catch (e) {
    console.error('Could not save', key, e)
  }
}

function newId () {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function today () {
  return new Date().toLocaleDateString()
}

export function last4 (n: string | undefined) {
  const d = String(n || '').replace(/\D/g, '')
  return d ? '••' + d.slice(-4) : ''
}

export function accountTitle (a: Account) {
  return a.label || [a.bankName, last4(a.accountNumber)].filter(Boolean).join(' ') || 'Untitled account'
}

// ABA routing number checksum (3-7-1 weighting).
export function routingLooksValid (r: string) {
  if (!/^\d{9}$/.test(r)) return false
  const d = r.split('').map(Number)
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8])
  return sum % 10 === 0
}

// ---------- Check numbers ----------
// Any format works: the last run of digits counts up and keeps its zero
// padding. 100-0001 -> 100-0002, 0099 -> 0100, A-999 -> A-1000, 100 -> 101.
function splitNumber (n: string) {
  const m = String(n ?? '').match(/^(.*?)(\d+)(\D*)$/)
  return m ? { prefix: m[1], digits: m[2], suffix: m[3] } : null
}

export function nextCheckNumber (n: string) {
  const p = splitNumber(n)
  if (!p) return n ? n + '-1' : '100'
  const next = String(BigInt(p.digits) + 1n).padStart(p.digits.length, '0')
  return p.prefix + next + p.suffix
}

// Is `a` later in the same series than `b`? (Different formats: no.)
export function isAfter (a: string, b: string) {
  const pa = splitNumber(a)
  const pb = splitNumber(b)
  if (!pa || !pb || pa.prefix !== pb.prefix || pa.suffix !== pb.suffix) return false
  return BigInt(pa.digits) > BigInt(pb.digits)
}

// MICR line: the bank font has digits and the E13B symbols a–d. A dash
// prints as the MICR dash symbol (d); anything else can't be printed.
export function micrCheckNumber (n: string) {
  return String(n ?? '').replace(/-/g, 'd').replace(/[^0-9d]/g, '')
}

export function blankAccount (): Account {
  return {
    id: newId(),
    label: '',
    holderName: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    bankName: '',
    routingNumber: '',
    accountNumber: '',
    nextCheckNumber: '100'
  }
}

function accountFromEntry (e: Partial<RegisterEntry>): Account {
  if (!e.routingNumber && !e.bankAccountNumber) {
    // From the .xlsx file: no full account details there
    return { ...blankAccount(), label: e.accountLabel || '', bankName: e.bankName || '' }
  }
  return {
    ...blankAccount(),
    holderName: e.accountHolderName || '',
    address: e.accountHolderAddress || '',
    city: e.accountHolderCity || '',
    state: e.accountHolderState || '',
    zip: e.accountHolderZip || '',
    bankName: e.bankName || '',
    routingNumber: e.routingNumber || '',
    accountNumber: e.bankAccountNumber || '',
    nextCheckNumber: e.checkNumber ? nextCheckNumber(e.checkNumber) : '100'
  }
}

// ---------- Store ----------

export const useAppStore = defineStore('app', () => {
  // Register kept in the app (always, also as a backup when a file is used)
  const localRegister = ref<RegisterEntry[]>(load<RegisterEntry[]>(KEYS.register, []).map(e => ({
    ...e,
    id: e.id || newId(),
    status: e.status || 'Issued'
  })))
  watch(localRegister, v => save(KEYS.register, v), { deep: true, immediate: true })
  // Older code read from this name
  const register = computed(() => (registerSource.value === 'file' ? fileRegister.value : localRegister.value))

  // Accounts. First run: build one from the most recent saved check, so
  // anyone upgrading keeps their details.
  let initialAccounts = load<Account[]>(KEYS.accounts, [])
  if (!initialAccounts.length) {
    const recent = localRegister.value[localRegister.value.length - 1]
    initialAccounts = [recent
      ? accountFromEntry(recent)
      : {
          ...blankAccount(),
          label: 'Sample account',
          holderName: 'John Smith',
          address: '123 Cherry Tree Lane',
          city: 'New York',
          state: 'NY',
          zip: '10001',
          bankName: 'Bank Name, INC',
          routingNumber: '022303659',
          accountNumber: '000000000000'
        }]
  }
  const accounts = ref<Account[]>(initialAccounts)
  watch(accounts, v => save(KEYS.accounts, v), { deep: true, immediate: true })

  const activeAccountId = ref<string>(load(KEYS.activeAccount, '') || accounts.value[0].id)
  if (!accounts.value.some(a => a.id === activeAccountId.value)) activeAccountId.value = accounts.value[0].id
  watch(activeAccountId, v => save(KEYS.activeAccount, JSON.stringify(v)), { immediate: true })

  const account = computed<Account>(() =>
    accounts.value.find(a => a.id === activeAccountId.value) || accounts.value[0])

  // Settings
  const settings = reactive<Settings>({ ...DEFAULT_SETTINGS, ...load<Partial<Settings>>(KEYS.settings, {}) })
  watch(settings, v => save(KEYS.settings, v), { deep: true })

  // Register .xlsx file (desktop app only)
  const fileRegister = ref<RegisterEntry[]>([])
  const fileError = ref('')
  const fileBusy = ref(false)
  const registerSource = computed<'file' | 'local'>(() =>
    settings.registerPath && desktop()?.register ? 'file' : 'local')

  // Current check
  const check = reactive<CheckData>({
    checkNumber: account.value.nextCheckNumber || '100',
    date: today(),
    payTo: '',
    amount: '0.00',
    memo: ''
  })

  // UI state (not saved)
  const tool = ref<'select' | 'pan'>('select')
  const selectedField = ref<string | null>(null)
  const editingAccount = ref<Account | null>(null) // open in the account dialog
  const toast = ref('')
  let toastTimer: ReturnType<typeof setTimeout> | undefined

  function notify (msg: string) {
    toast.value = msg
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (toast.value = ''), 3500)
  }

  // ----- Check actions -----

  function newCheck () {
    check.checkNumber = account.value.nextCheckNumber || '100'
    check.date = today()
    check.payTo = ''
    check.amount = '0.00'
    check.memo = ''
  }

  function switchAccount (id: string) {
    if (id === activeAccountId.value) return
    activeAccountId.value = id
    check.checkNumber = account.value.nextCheckNumber || '100'
  }

  function entryForAccount (a: Account): RegisterEntry {
    return {
      id: newId(),
      accountHolderName: a.holderName,
      accountHolderAddress: a.address,
      accountHolderCity: a.city,
      accountHolderState: a.state,
      accountHolderZip: a.zip,
      bankName: a.bankName,
      routingNumber: a.routingNumber,
      bankAccountNumber: a.accountNumber,
      accountLabel: accountTitle(a),
      accountLast4: last4(a.accountNumber),
      checkNumber: check.checkNumber,
      date: check.date,
      payTo: check.payTo,
      amount: check.amount,
      memo: check.memo,
      status: 'Issued',
      accountId: a.id,
      savedAt: new Date().toISOString()
    }
  }

  // What goes into the .xlsx file: no full account or routing numbers.
  function fileEntry (e: RegisterEntry): RegisterEntry {
    const a = accounts.value.find(x => x.id === e.accountId)
    return {
      id: e.id,
      date: e.date,
      checkNumber: e.checkNumber,
      payTo: e.payTo,
      amount: e.amount,
      memo: e.memo,
      status: e.status || 'Issued',
      accountLabel: e.accountLabel || (a ? accountTitle(a) : e.bankName || ''),
      bankName: e.bankName || '',
      accountLast4: e.accountLast4 || last4(e.bankAccountNumber),
      savedAt: e.savedAt,
      accountId: e.accountId || ''
    }
  }

  async function saveToRegister () {
    const a = account.value
    const entry = entryForAccount(a)
    localRegister.value.push(entry)
    // Advance the account's next number, unless this was an older check
    // (e.g. reprinting one from earlier in the same series).
    const following = nextCheckNumber(check.checkNumber)
    if (!isAfter(a.nextCheckNumber, following)) a.nextCheckNumber = following
    let where = 'the register'
    if (registerSource.value === 'file') {
      const ok = await fileCall(api => api.append(settings.registerPath, fileEntry(entry)))
      if (!ok) {
        notify(`Check #${entry.checkNumber} was saved in the app, but not to the register file: ${fileError.value}`)
        return
      }
      where = 'the register file'
    }
    notify(`Check #${entry.checkNumber} saved to ${where}. Next check number: ${a.nextCheckNumber}.`)
  }

  // ----- Register file -----

  type FileResult = { ok: boolean, data?: unknown, error?: string, missing?: boolean }
  type RegisterApi = {
    choose: (mode: 'new' | 'open') => Promise<FileResult>
    read: (f: string) => Promise<FileResult>
    create: (f: string, e: RegisterEntry[]) => Promise<FileResult>
    append: (f: string, e: RegisterEntry) => Promise<FileResult>
    update: (f: string, id: string, p: object) => Promise<FileResult>
    remove: (f: string, id: string) => Promise<FileResult>
    show: (f: string) => Promise<void>
    open: (f: string) => Promise<string>
  }
  function api (): RegisterApi | undefined {
    return (desktop() as unknown as { register?: RegisterApi } | undefined)?.register
  }

  // Runs a file operation; on success the result (all entries) becomes the
  // register. Returns false and sets fileError on failure.
  async function fileCall (fn: (a: RegisterApi) => Promise<FileResult>) {
    const a = api()
    if (!a) return false
    fileBusy.value = true
    try {
      // Plain copies: reactive proxies can't be sent to the desktop side
      const res = await fn(a)
      if (!res.ok) {
        fileError.value = res.error || 'Unknown error'
        return false
      }
      fileError.value = ''
      if (Array.isArray(res.data)) fileRegister.value = res.data as RegisterEntry[]
      return true
    } finally {
      fileBusy.value = false
    }
  }

  async function refreshRegisterFile () {
    if (registerSource.value !== 'file' || fileBusy.value) return
    await fileCall(a => a.read(settings.registerPath))
  }

  async function connectRegisterFile (mode: 'new' | 'open') {
    const a = api()
    if (!a) return
    const picked = await a.choose(mode)
    if (!picked.ok || !picked.data) return
    const file = picked.data as string
    if (mode === 'new') {
      const existing = localRegister.value
      const copy = existing.length > 0 &&
        confirm(`Copy the ${existing.length} check${existing.length === 1 ? '' : 's'} already saved in the app into the new register file?`)
      const entries = copy ? existing.map(e => fileEntry(JSON.parse(JSON.stringify(e)))) : []
      const res = await a.create(file, entries)
      if (!res.ok) {
        notify('Could not create the register file: ' + res.error)
        return
      }
      fileRegister.value = res.data as RegisterEntry[]
    } else {
      const res = await a.read(file)
      if (!res.ok) {
        notify('Could not use that file: ' + res.error)
        return
      }
      fileRegister.value = res.data as RegisterEntry[]
    }
    fileError.value = ''
    settings.registerPath = file
    notify(`Register file: ${file}`)
  }

  function disconnectRegisterFile () {
    settings.registerPath = ''
    fileRegister.value = []
    fileError.value = ''
    notify('The register is kept in the app again. The .xlsx file was not changed.')
  }

  async function setStatus (entry: RegisterEntry, status: CheckStatus) {
    if (registerSource.value === 'file') {
      const ok = await fileCall(a => a.update(settings.registerPath, entry.id || '', { status }))
      if (!ok) notify('Could not update the register file: ' + fileError.value)
    }
    // Keep the in-app copy in step
    const local = localRegister.value.find(e => e.id === entry.id)
    if (local) local.status = status
  }

  function openFromRegister (entry: RegisterEntry) {
    let a = accounts.value.find(x => x.id === entry.accountId) ||
      (entry.bankAccountNumber
        ? accounts.value.find(x => x.routingNumber === entry.routingNumber && x.accountNumber === entry.bankAccountNumber)
        : undefined) ||
      (entry.accountLast4
        ? accounts.value.find(x => last4(x.accountNumber) === entry.accountLast4 && (!entry.bankName || x.bankName === entry.bankName))
        : undefined)
    if (!a && entry.bankAccountNumber) {
      a = accountFromEntry(entry)
      accounts.value.push(a)
      notify('That check used an account that wasn\'t saved, so it was added to your accounts.')
    } else if (!a) {
      notify(`No saved account matches ${entry.accountLabel || 'that check'}; it's shown on the current account.`)
    }
    if (a) activeAccountId.value = a.id
    check.checkNumber = entry.checkNumber
    check.date = entry.date
    check.payTo = entry.payTo
    check.amount = entry.amount
    check.memo = entry.memo
  }

  async function deleteFromRegister (entry: RegisterEntry) {
    if (registerSource.value === 'file') {
      const ok = await fileCall(a => a.remove(settings.registerPath, entry.id || ''))
      if (!ok) {
        notify('Could not delete from the register file: ' + fileError.value)
        return
      }
    }
    localRegister.value = localRegister.value.filter(e => e.id !== entry.id)
  }

  // ----- Account actions -----

  function startNewAccount () {
    editingAccount.value = blankAccount()
  }

  function startEditAccount (a: Account = account.value) {
    editingAccount.value = { ...a }
  }

  function saveAccount (a: Account) {
    const i = accounts.value.findIndex(x => x.id === a.id)
    // Editing the active account's next number also updates the check on
    // screen, if it was still showing the old next number.
    if (i >= 0 && a.id === activeAccountId.value && check.checkNumber === accounts.value[i].nextCheckNumber) {
      check.checkNumber = a.nextCheckNumber
    }
    if (i >= 0) accounts.value[i] = { ...a }
    else accounts.value.push({ ...a })
    const wasNew = i < 0
    if (wasNew || a.id === activeAccountId.value) {
      activeAccountId.value = a.id
      if (wasNew) check.checkNumber = a.nextCheckNumber || '100'
    }
    editingAccount.value = null
    notify(`Saved ${accountTitle(a)}.`)
  }

  function duplicateAccount () {
    const copy = { ...account.value, id: newId(), label: (account.value.label || accountTitle(account.value)) + ' (copy)' }
    editingAccount.value = copy
  }

  function deleteAccount (id: string) {
    if (accounts.value.length <= 1) {
      notify('You need at least one account.')
      return false
    }
    const a = accounts.value.find(x => x.id === id)
    accounts.value = accounts.value.filter(x => x.id !== id)
    if (activeAccountId.value === id) switchAccount(accounts.value[0].id)
    if (a) notify(`Deleted ${accountTitle(a)}.`)
    return true
  }

  // ----- Import / export (shared format with the Obsidian plugin) -----

  function exportAccounts () {
    const layout = {
      fontFamily: settings.fontFamily, fontSize: settings.fontSize, boldValues: settings.boldValues,
      offsetX: settings.offsetX, offsetY: settings.offsetY, fieldOffsets: settings.fieldOffsets
    }
    return { app: 'printmechecks', version: 1, exportedAt: new Date().toISOString(), accounts: accounts.value, layout }
  }

  function importAccounts (text: string) {
    let data: { app?: string, accounts?: Account[], layout?: Partial<Settings> }
    try { data = JSON.parse(text) } catch { throw new Error('That file isn\'t valid JSON.') }
    if (!data || data.app !== 'printmechecks' || !Array.isArray(data.accounts)) {
      throw new Error('That isn\'t a Print Me Checks accounts export.')
    }
    let added = 0
    let updated = 0
    for (const raw of data.accounts) {
      const a: Account = { ...blankAccount(), ...raw, id: raw.id || newId() }
      const i = accounts.value.findIndex(x => x.id === a.id ||
        (x.routingNumber && x.routingNumber === a.routingNumber && x.accountNumber === a.accountNumber))
      if (i >= 0) { accounts.value[i] = a; updated++ } else { accounts.value.push(a); added++ }
    }
    if (data.layout) {
      const l = data.layout
      for (const k of ['fontFamily', 'fontSize', 'boldValues', 'offsetX', 'offsetY', 'fieldOffsets'] as const) {
        if (l[k] !== undefined) (settings as unknown as Record<string, unknown>)[k] = l[k]
      }
    }
    if (!accounts.value.some(a => a.id === activeAccountId.value)) activeAccountId.value = accounts.value[0].id
    notify(`Imported accounts: ${added} added, ${updated} updated.${data.layout ? ' Font and alignment settings too.' : ''}`)
  }

  // ----- Layout actions -----

  function nudgeField (key: string, dx: number, dy: number) {
    const cur = settings.fieldOffsets[key] || { x: 0, y: 0 }
    settings.fieldOffsets = { ...settings.fieldOffsets, [key]: { x: cur.x + dx, y: cur.y + dy } }
  }

  function resetField (key: string) {
    const next = { ...settings.fieldOffsets }
    delete next[key]
    settings.fieldOffsets = next
  }

  function resetLayout () {
    settings.fieldOffsets = {}
    settings.offsetX = 0
    settings.offsetY = 0
    notify('Layout reset to default positions.')
  }

  function resetFont () {
    settings.fontFamily = DEFAULT_SETTINGS.fontFamily
    settings.fontSize = DEFAULT_SETTINGS.fontSize
    settings.boldValues = DEFAULT_SETTINGS.boldValues
  }

  return {
    register, localRegister, fileRegister, fileError, fileBusy, registerSource,
    accounts, activeAccountId, account, settings, check,
    tool, selectedField, editingAccount, toast,
    notify, newCheck, switchAccount, saveToRegister, openFromRegister, deleteFromRegister,
    refreshRegisterFile, connectRegisterFile, disconnectRegisterFile, setStatus,
    exportAccounts, importAccounts,
    startNewAccount, startEditAccount, saveAccount, duplicateAccount, deleteAccount,
    nudgeField, resetField, resetLayout, resetFont
  }
})
