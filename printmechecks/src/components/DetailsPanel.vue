<template>
    <aside class="details no-print">
        <section>
            <h6>Account</h6>
            <AccountPicker />
            <div class="acct-summary">
                <div>{{ account.holderName || 'No name' }}</div>
                <div class="muted">{{ account.bankName }} {{ last4(account.accountNumber) }}</div>
            </div>
            <button class="btn btn-link btn-sm p-0" @click="store.startEditAccount()">Edit account details</button>
        </section>

        <section>
            <h6>Check</h6>
            <div class="row g-2">
                <div class="col-5">
                    <label class="form-label">Check #</label>
                    <input class="form-control form-control-sm" v-model="check.checkNumber" inputmode="numeric">
                </div>
                <div class="col-7">
                    <label class="form-label">Date</label>
                    <div class="input-group input-group-sm">
                        <input class="form-control" v-model="check.date">
                        <button class="btn btn-outline-secondary" title="Today" @click="check.date = today()"><i class="bi bi-calendar-check"></i></button>
                    </div>
                </div>
            </div>
            <label class="form-label">Pay to the order of</label>
            <input class="form-control form-control-sm" v-model="check.payTo" placeholder="Payee" ref="payee">
            <label class="form-label">Amount</label>
            <div class="input-group input-group-sm">
                <span class="input-group-text">$</span>
                <input class="form-control" v-model="check.amount" inputmode="decimal" @blur="tidyAmount">
            </div>
            <div class="words">{{ words || '—' }}</div>
            <label class="form-label">Memo</label>
            <input class="form-control form-control-sm" v-model="check.memo" placeholder="Optional">
        </section>

        <section class="actions">
            <button class="btn btn-primary btn-sm" @click="emit('print')"><i class="bi bi-printer"></i> Print…</button>
            <button class="btn btn-outline-primary btn-sm" @click="store.saveToRegister()"><i class="bi bi-journal-plus"></i> Save to Register</button>
            <button class="btn btn-outline-secondary btn-sm" @click="store.newCheck()"><i class="bi bi-file-earmark-plus"></i> New Check</button>
        </section>

        <section v-if="store.selectedField" class="selected">
            <h6>Selected field</h6>
            <div><strong>{{ FIELDS[store.selectedField].label }}</strong></div>
            <div class="muted">Arrow keys move it 1px, Shift+arrow 10px. Esc deselects.</div>
            <button class="btn btn-link btn-sm p-0" @click="store.resetField(store.selectedField)">Reset this field</button>
        </section>
    </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore, today, last4 } from '../stores/app'
import { amountInWords, formatMoney } from '../utilities'
import { FIELDS } from '../checkLayout'
import AccountPicker from './AccountPicker.vue'

const store = useAppStore()
const check = store.check
const account = computed(() => store.account)
const words = computed(() => amountInWords(check.amount))
const emit = defineEmits<{ (e: 'print'): void }>()

function tidyAmount () {
    check.amount = formatMoney(check.amount).replace(/,/g, '')
}
</script>

<style scoped>
.details {
    flex: 0 0 300px;
    overflow-y: auto;
    background: #f7f7f7;
    border-left: 1px solid #d6d6d6;
    padding: 12px 14px;
    font-size: 14px;
}
section {
    padding-bottom: 14px;
    margin-bottom: 14px;
    border-bottom: 1px solid #e2e2e2;
}
section:last-child { border-bottom: 0; }
h6 {
    text-transform: uppercase;
    font-size: 11.5px;
    letter-spacing: .05em;
    color: #2b579a;
    margin-bottom: 8px;
}
.form-label {
    font-size: 12.5px;
    font-weight: 600;
    margin: 8px 0 3px;
}
.acct-summary { margin: 6px 0 2px; line-height: 1.35; }
.muted { color: #6c757d; font-size: 12.5px; }
.words {
    font-size: 12.5px;
    color: #555;
    margin-top: 4px;
    text-transform: capitalize;
}
.actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.selected { background: #eef3fb; margin: 0 -14px; padding: 10px 14px; }
</style>
