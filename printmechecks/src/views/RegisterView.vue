<template>
    <div class="register">
        <div class="toolbar">
            <h5 class="m-0">Check Register</h5>
            <input class="form-control form-control-sm search" v-model="q" placeholder="Search payee, memo, check #…">
            <select class="form-select form-select-sm acct" v-model="acct">
                <option value="">All accounts</option>
                <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ accountTitle(a) }}</option>
            </select>
            <span class="total">{{ rows.length }} check{{ rows.length === 1 ? '' : 's' }} · ${{ formatMoney(total) }}</span>
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
                        <th>Account</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="r in rows" :key="r.index" @dblclick="open(r.entry)">
                        <td>{{ r.entry.date }}</td>
                        <td class="font-monospace">{{ r.entry.checkNumber }}</td>
                        <td>{{ r.entry.payTo }}</td>
                        <td class="text-end font-monospace pe-4">${{ formatMoney(r.entry.amount) }}</td>
                        <td class="memo">{{ r.entry.memo }}</td>
                        <td class="muted">{{ r.entry.bankName }} {{ last4(r.entry.bankAccountNumber) }}</td>
                        <td class="text-end text-nowrap">
                            <button class="btn btn-outline-primary btn-sm" @click="open(r.entry)"><i class="bi bi-box-arrow-up-right"></i> Open</button>
                            <button class="btn btn-outline-danger btn-sm ms-1" @click="remove(r.index)" title="Delete"><i class="bi bi-trash3"></i></button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore, accountTitle, last4, type RegisterEntry } from '../stores/app'
import { formatMoney } from '../utilities'

const store = useAppStore()
const router = useRouter()
const q = ref('')
const acct = ref('')

const rows = computed(() => {
    const needle = q.value.trim().toLowerCase()
    const account = store.accounts.find(a => a.id === acct.value)
    return store.register
        .map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => {
            if (account && !(entry.accountId === account.id ||
                (entry.routingNumber === account.routingNumber && entry.bankAccountNumber === account.accountNumber))) return false
            if (!needle) return true
            return [entry.payTo, entry.memo, entry.checkNumber, entry.date, entry.amount]
                .some(v => String(v ?? '').toLowerCase().includes(needle))
        })
        .reverse() // newest first
})

const total = computed(() => rows.value.reduce((s, r) => s + (parseFloat(r.entry.amount) || 0), 0))

function open (entry: RegisterEntry) {
    store.openFromRegister(entry)
    router.push('/')
}

function remove (index: number) {
    const e = store.register[index]
    if (confirm(`Delete check #${e.checkNumber} to ${e.payTo || '(no payee)'} from the register?`)) store.deleteFromRegister(index)
}
</script>

<style scoped>
.register {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: white;
}
.toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    border-bottom: 1px solid #e2e2e2;
}
.search { max-width: 280px; }
.acct { max-width: 240px; }
.total { margin-left: auto; color: #555; font-size: 14px; }
.table-wrap { flex: 1; overflow: auto; padding: 0 18px; }
thead th { position: sticky; top: 0; background: white; font-size: 13px; }
td { font-size: 14px; }
.memo { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.muted { color: #6c757d; }
.empty { margin: auto; text-align: center; color: #666; }
.empty i { font-size: 48px; color: #b8c5d9; }
</style>
