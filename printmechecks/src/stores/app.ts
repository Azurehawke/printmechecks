import { ref, reactive, computed, watch } from 'vue'
import { defineStore } from 'pinia'

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
  zoom: number | 'fit'
}

// Register (history) entries keep the original flat format so older saved
// checks still load.
export interface RegisterEntry {
  accountHolderName: string
  accountHolderAddress: string
  accountHolderCity: string
  accountHolderState: string
  accountHolderZip: string
  checkNumber: string
  date: string
  bankName: string
  amount: string
  payTo: string
  memo: string
  routingNumber: string
  bankAccountNumber: string
  accountId?: string
  savedAt?: string
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
  zoom: 'fit'
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

export function last4 (n: string) {
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
  // Register (saved checks)
  const register = ref<RegisterEntry[]>(load(KEYS.register, []))
  watch(register, v => save(KEYS.register, v), { deep: true })

  // Accounts. First run: build one from the most recent saved check, so
  // anyone upgrading keeps their details.
  let initialAccounts = load<Account[]>(KEYS.accounts, [])
  if (!initialAccounts.length) {
    const recent = register.value[register.value.length - 1]
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

  function saveToRegister () {
    const a = account.value
    register.value.push({
      accountHolderName: a.holderName,
      accountHolderAddress: a.address,
      accountHolderCity: a.city,
      accountHolderState: a.state,
      accountHolderZip: a.zip,
      bankName: a.bankName,
      routingNumber: a.routingNumber,
      bankAccountNumber: a.accountNumber,
      checkNumber: check.checkNumber,
      date: check.date,
      payTo: check.payTo,
      amount: check.amount,
      memo: check.memo,
      accountId: a.id,
      savedAt: new Date().toISOString()
    })
    // Advance the account's next number, unless this was an older check
    // (e.g. reprinting one from earlier in the same series).
    const following = nextCheckNumber(check.checkNumber)
    if (!isAfter(a.nextCheckNumber, following)) a.nextCheckNumber = following
    notify(`Check #${check.checkNumber} saved to the register. Next check number: ${a.nextCheckNumber}.`)
  }

  function openFromRegister (entry: RegisterEntry) {
    let a = accounts.value.find(x => x.id === entry.accountId) ||
      accounts.value.find(x => x.routingNumber === entry.routingNumber && x.accountNumber === entry.bankAccountNumber)
    if (!a) {
      a = accountFromEntry(entry)
      accounts.value.push(a)
      notify('That check used an account that wasn\'t saved, so it was added to your accounts.')
    }
    activeAccountId.value = a.id
    check.checkNumber = entry.checkNumber
    check.date = entry.date
    check.payTo = entry.payTo
    check.amount = entry.amount
    check.memo = entry.memo
  }

  function deleteFromRegister (index: number) {
    register.value.splice(index, 1)
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
    register, accounts, activeAccountId, account, settings, check,
    tool, selectedField, editingAccount, toast,
    notify, newCheck, switchAccount, saveToRegister, openFromRegister, deleteFromRegister,
    startNewAccount, startEditAccount, saveAccount, duplicateAccount, deleteAccount,
    nudgeField, resetField, resetLayout, resetFont
  }
})
