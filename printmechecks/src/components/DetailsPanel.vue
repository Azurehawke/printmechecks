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
                    <input class="form-control form-control-sm" v-model="check.checkNumber" inputmode="numeric" @focus="store.beginCheckNumberEdit()" @change="store.lookupCheckNumber()">
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

        <section v-if="store.selectedFields.length === 1" class="selected">
            <h6>Selected field</h6>
            <div><strong>{{ FIELDS[store.selectedFields[0]].label }}</strong></div>
            <div class="muted">Drag it, or arrow keys (1px; Shift 10px). Esc deselects.</div>
            <div class="row g-2 mt-1">
                <div class="col-6">
                    <label class="form-label">Top (mm)</label>
                    <input class="form-control form-control-sm" type="number" step="0.5" :value="store.fieldPositionMm(store.selectedFields[0]).top" @change="setPosition('top', $event)">
                </div>
                <div class="col-6">
                    <label class="form-label">Left (mm)</label>
                    <input class="form-control form-control-sm" type="number" step="0.5" :value="store.fieldPositionMm(store.selectedFields[0]).left" @change="setPosition('left', $event)">
                </div>
            </div>
            <div class="muted small">From the check's top-left corner.</div>
            <button class="btn btn-link btn-sm p-0" @click="store.resetField(store.selectedFields[0])">Reset this field</button>
        </section>

        <section v-else-if="store.selectedFields.length > 1" class="selected">
            <h6>{{ store.selectedFields.length }} fields selected</h6>
            <div class="muted small">Shift-click or drag a box to add or remove fields.</div>
            <div class="align-label muted small mt-1">Align to</div>
            <div class="btn-group btn-group-sm d-flex mb-1">
                <button class="btn btn-outline-secondary" title="Align left edges" @click="store.alignSelected('left')">Left</button>
                <button class="btn btn-outline-secondary" title="Align centres horizontally" @click="store.alignSelected('hcenter')">Centre</button>
                <button class="btn btn-outline-secondary" title="Align right edges" @click="store.alignSelected('right')">Right</button>
            </div>
            <div class="btn-group btn-group-sm d-flex mb-1">
                <button class="btn btn-outline-secondary" title="Align top edges" @click="store.alignSelected('top')">Top</button>
                <button class="btn btn-outline-secondary" title="Align middles vertically" @click="store.alignSelected('vcenter')">Middle</button>
                <button class="btn btn-outline-secondary" title="Align bottom edges" @click="store.alignSelected('bottom')">Bottom</button>
            </div>
            <div class="align-label muted small mt-1">Space evenly (3 or more)</div>
            <div class="btn-group btn-group-sm d-flex mb-1">
                <button class="btn btn-outline-secondary" :disabled="store.selectedFields.length < 3" @click="store.distributeSelected('h')">Horizontally</button>
                <button class="btn btn-outline-secondary" :disabled="store.selectedFields.length < 3" @click="store.distributeSelected('v')">Vertically</button>
            </div>
            <button class="btn btn-link btn-sm p-0" @click="store.selectedFields.forEach(k => store.resetField(k))">Reset these fields</button>
        </section>

        <section class="grid-snap">
            <h6>Grid &amp; snap</h6>
            <div class="form-check form-switch">
                <input class="form-check-input" type="checkbox" id="pmc-snap" v-model="store.settings.snap">
                <label class="form-check-label" for="pmc-snap">Snap to grid</label>
            </div>
            <label class="form-label mt-1" for="pmc-grid-mm">Grid spacing</label>
            <select id="pmc-grid-mm" class="form-select form-select-sm" v-model.number="store.settings.gridMm">
                <option :value="0.5">0.5 mm</option>
                <option :value="1">1 mm</option>
                <option :value="2.5">2.5 mm</option>
                <option :value="5">5 mm</option>
            </select>
        </section>

        <section class="profiles">
            <h6>Stock profile</h6>
            <div class="input-group input-group-sm mb-1">
                <input class="form-control" v-model="profileName" placeholder="e.g. Schools First 9 mm">
                <button class="btn btn-outline-primary" :disabled="!profileName.trim()" @click="store.saveStockProfile(profileName); profileName = ''">Save</button>
            </div>
            <div class="input-group input-group-sm">
                <select class="form-select" v-model="chosenProfile">
                    <option value="">Choose…</option>
                    <option v-for="p in store.stockProfiles" :key="p.name" :value="p.name">{{ p.name }}</option>
                </select>
                <button class="btn btn-outline-secondary" :disabled="!chosenProfile" @click="store.applyStockProfile(chosenProfile)">Apply</button>
                <button class="btn btn-outline-danger" :disabled="!chosenProfile" @click="store.deleteStockProfile(chosenProfile); chosenProfile = ''">Delete</button>
            </div>
            <div class="muted small">Saves the whole-check shift and every field position.</div>
        </section>
    </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore, today, last4 } from '../stores/app'
import { amountInWords, formatMoney } from '../utilities'
import { FIELDS } from '../checkLayout'
import AccountPicker from './AccountPicker.vue'

const store = useAppStore()
const check = store.check
const account = computed(() => store.account)
const words = computed(() => amountInWords(check.amount))
const emit = defineEmits<{ (e: 'print'): void }>()

const profileName = ref('')
const chosenProfile = ref('')

// Typed positions are in mm from the check's top-left corner
function setPosition (which: 'top' | 'left', e: Event) {
    const key = store.selectedFields[0]
    if (!key) return
    const v = parseFloat((e.target as HTMLInputElement).value)
    const cur = store.fieldPositionMm(key)
    if (which === 'top') store.setFieldPosition(key, v, cur.left)
    else store.setFieldPosition(key, cur.top, v)
}

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
