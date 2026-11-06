<template>
    <div class="register">
        <div class="source" :class="{ error: store.fileError }">
            <template v-if="store.registerSource === 'file'">
                <i class="bi bi-file-earmark-spreadsheet"></i>
                <span>Register file: <strong :title="store.settings.registerPath">{{ fileName }}</strong></span>
                <span v-if="store.fileBusy" class="muted">Reading…</span>
                <span v-else-if="store.fileError" class="err"><i class="bi bi-exclamation-triangle"></i> {{ store.fileError }}</span>
                <button class="btn btn-link btn-sm" @click="store.refreshRegisterFile()"><i class="bi bi-arrow-clockwise"></i> Reload</button>
            </template>
            <template v-else>
                <i class="bi bi-hdd"></i>
                <span>The register is kept in this app.</span>
                <span v-if="canUseFile" class="muted">Use <strong>Register → New File</strong> to keep it in an .xlsx file (e.g. in your Obsidian vault).</span>
            </template>
        </div>

        <div class="toolbar">
            <h5 class="m-0">Check Register</h5>
            <input class="form-control form-control-sm search" v-model="q" placeholder="Search payee, memo, check #…">
            <select class="form-select form-select-sm acct" v-model="acct">
                <option value="">All accounts</option>
                <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ accountTitle(a) }}</option>
            </select>
            <select class="form-select form-select-sm stat" v-model="statusFilter">
                <option value="">Any status</option>
                <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
            </select>
            <span class="total">{{ rows.length }} check{{ rows.length === 1 ? '' : 's' }} · ${{ formatMoney(total) }}<span v-if="voided" class="muted"> (excl. void)</span></span>
        </div>

        <div v-if="!store.register.length" class="empty">
            <i class="bi bi-journal"></i>
            <p>No checks saved yet. Use <strong>Save to Register</strong> after printing a check.</p>
        </div>
        <div v-else class="table-wrap">
            <table class="table table-sm table-hover align-middle">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Check #</th>
                        <th>Payee</th>
                        <th class="text-end pe-4">Amount</th>
                        <th>Memo</th>
                        <th>Status</th>
                        <th>Account</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="e in rows" :key="e.id" :class="{ void: e.status === 'Void' }" @dblclick="open(e)">
                        <td>{{ e.date }}</td>
                        <td class="font-monospace">{{ e.checkNumber }}</td>
                        <td class="payee">{{ e.payTo }}</td>
                        <td class="text-end font-monospace pe-4 amt">${{ formatMoney(e.amount) }}</td>
                        <td class="memo">{{ e.memo }}</td>
                        <td>
                            <select class="form-select form-select-sm status" :class="'st-' + (e.status || 'Issued')" :value="e.status || 'Issued'"
                                    @change="setStatus(e, ($event.target as HTMLSelectElement).value)">
                                <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
                            </select>
                        </td>
                        <td class="muted">{{ accountText(e) }}</td>
                        <td class="text-end text-nowrap">
                            <button class="btn btn-outline-primary btn-sm" @click="open(e)" title="Open this check"><i class="bi bi-box-arrow-up-right"></i> Open</button>
                            <button class="btn btn-outline-danger btn-sm ms-1" @click="remove(e)" title="Delete"><i class="bi bi-trash3"></i></button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore, accountTitle, last4, STATUSES, type RegisterEntry, type CheckStatus } from '../stores/app'
import { formatMoney, desktop } from '../utilities'

const store = useAppStore()
const router = useRouter()
const q = ref('')
const acct = ref('')
const statusFilter = ref('')
const canUseFile = !!(desktop() as unknown as { register?: unknown } | undefined)?.register

const fileName = computed(() => store.settings.registerPath.split(/[\\/]/).pop())

function accountText (e: RegisterEntry) {
    return e.accountLabel || [e.bankName, e.accountLast4 || last4(e.bankAccountNumber)].filter(Boolean).join(' ')
}

const rows = computed(() => {
    const needle = q.value.trim().toLowerCase()
    const account = store.accounts.find(a => a.id === acct.value)
    return store.register
        .filter(e => {
            if (account && !(e.accountId === account.id ||
                (e.bankAccountNumber && e.routingNumber === account.routingNumber && e.bankAccountNumber === account.accountNumber))) return false
            if (statusFilter.value && (e.status || 'Issued') !== statusFilter.value) return false
            if (!needle) return true
            return [e.payTo, e.memo, e.checkNumber, e.date, e.amount]
                .some(v => String(v ?? '').toLowerCase().includes(needle))
        })
        .slice()
        .reverse() // newest first
})

const voided = computed(() => rows.value.some(e => e.status === 'Void'))
const total = computed(() => rows.value
    .filter(e => e.status !== 'Void')
    .reduce((s, e) => s + (parseFloat(String(e.amount).replace(/[^0-9.-]/g, '')) || 0), 0))

function open (e: RegisterEntry) {
    store.openFromRegister(e)
    router.push('/')
}

function setStatus (e: RegisterEntry, s: string) {
    store.setStatus(e, s as CheckStatus)
}

function remove (e: RegisterEntry) {
    const where = store.registerSource === 'file' ? ' This removes the row from the register file.' : ''
    if (confirm(`Delete check #${e.checkNumber} to ${e.payTo || '(no payee)'} from the register?${where}\n\nTip: set its status to Void instead to keep a record.`)) {
        store.deleteFromRegister(e)
    }
}

onMounted(() => store.refreshRegisterFile())
</script>

<style scoped>
.register {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: white;
}
.source {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 18px;
    font-size: 13px;
    background: #eef3fb;
    border-bottom: 1px solid #d8e2f1;
}
.source.error { background: #fdf1f1; border-color: #f1d0d0; }
.source .err { color: #b02a37; }
.toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    border-bottom: 1px solid #e2e2e2;
}
.search { max-width: 260px; }
.acct { max-width: 220px; }
.stat { max-width: 140px; }
.total { margin-left: auto; color: #555; font-size: 14px; white-space: nowrap; }
.table-wrap { flex: 1; overflow: auto; padding: 0 18px; }
thead th { position: sticky; top: 0; background: white; font-size: 13px; z-index: 1; }
td { font-size: 14px; }
.memo { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: #6c757d; }
.status { width: 105px; font-size: 13px; padding-top: 1px; padding-bottom: 1px; }
.st-Cleared { color: #146c43; }
.st-Void { color: #b02a37; }
tr.void .payee, tr.void .amt { text-decoration: line-through; color: #888; }
.empty { margin: auto; text-align: center; color: #666; }
.empty i { font-size: 48px; color: #b8c5d9; }
</style>
