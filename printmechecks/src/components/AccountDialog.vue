<template>
    <div v-if="draft" class="overlay no-print" @mousedown.self="cancel">
        <form class="dialog" @submit.prevent="submit" @keydown.esc="cancel">
            <header>
                <h5>{{ isNew ? 'New account' : 'Edit account' }}</h5>
                <button type="button" class="btn-close" title="Close" @click="cancel"></button>
            </header>
            <div class="body">
                <div class="row g-2">
                    <div class="col-12">
                        <label class="form-label">Account nickname <span class="muted">(shown in the account list)</span></label>
                        <input class="form-control form-control-sm" v-model="draft.label" :placeholder="accountTitle({ ...draft, label: '' })" ref="first">
                    </div>

                    <div class="col-12 sect">Printed in the top-left corner</div>
                    <div class="col-12">
                        <label class="form-label">Account holder name</label>
                        <input class="form-control form-control-sm" v-model="draft.holderName" required>
                    </div>
                    <div class="col-12">
                        <label class="form-label">Street address</label>
                        <input class="form-control form-control-sm" v-model="draft.address">
                    </div>
                    <div class="col-6">
                        <label class="form-label">City</label>
                        <input class="form-control form-control-sm" v-model="draft.city">
                    </div>
                    <div class="col-2">
                        <label class="form-label">State</label>
                        <input class="form-control form-control-sm" v-model="draft.state" maxlength="3">
                    </div>
                    <div class="col-4">
                        <label class="form-label">ZIP</label>
                        <input class="form-control form-control-sm" v-model="draft.zip">
                    </div>

                    <div class="col-12 sect">Bank</div>
                    <div class="col-12">
                        <label class="form-label">Bank name</label>
                        <input class="form-control form-control-sm" v-model="draft.bankName">
                    </div>
                    <div class="col-6">
                        <label class="form-label">Routing number</label>
                        <input class="form-control form-control-sm font-monospace" v-model.trim="draft.routingNumber" inputmode="numeric" maxlength="9" required
                               :class="{ 'is-invalid': routingWarn }">
                        <div v-if="routingWarn" class="invalid-feedback d-block">{{ routingWarn }}</div>
                    </div>
                    <div class="col-6">
                        <label class="form-label">Account number</label>
                        <input class="form-control form-control-sm font-monospace" v-model.trim="draft.accountNumber" inputmode="numeric" required
                               :class="{ 'is-invalid': accountWarn }">
                        <div v-if="accountWarn" class="invalid-feedback d-block">{{ accountWarn }}</div>
                    </div>

                    <div class="col-12 sect">Check numbers</div>
                    <div class="col-6">
                        <label class="form-label">Next check number</label>
                        <input class="form-control form-control-sm font-monospace" v-model.trim="draft.nextCheckNumber" required>
                    </div>
                    <div class="col-6 preview-num">
                        <span class="muted me-2">Then:</span>{{ followingNumbers }}
                    </div>
                    <div class="col-12 muted small">
                        Any format works, e.g. <code>100</code> or <code>100-0001</code>. The last group of digits counts up
                        and keeps its leading zeros. On the MICR line a dash prints as the MICR dash symbol.
                    </div>
                </div>
            </div>
            <footer>
                <span class="muted small"><i class="bi bi-shield-lock"></i> Stored only on this computer.</span>
                <button type="button" class="btn btn-outline-secondary btn-sm" @click="cancel">Cancel</button>
                <button type="submit" class="btn btn-primary btn-sm">{{ isNew ? 'Add account' : 'Save' }}</button>
            </footer>
        </form>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useAppStore, accountTitle, routingLooksValid, nextCheckNumber } from '../stores/app'

const store = useAppStore()
const draft = computed(() => store.editingAccount)
const isNew = computed(() => !!draft.value && !store.accounts.some(a => a.id === draft.value!.id))
const first = ref<HTMLInputElement | null>(null)

watch(draft, async d => {
    if (d) {
        await nextTick()
        first.value?.focus()
    }
})

const routingWarn = computed(() => {
    const r = draft.value?.routingNumber || ''
    if (!r) return ''
    if (!/^\d{9}$/.test(r)) return 'Routing numbers are 9 digits.'
    if (!routingLooksValid(r)) return 'This doesn\'t pass the routing number checksum. Double-check it.'
    return ''
})
const accountWarn = computed(() => {
    const a = draft.value?.accountNumber || ''
    return a && !/^[0-9-]+$/.test(a) ? 'Use digits only (dashes allowed).' : ''
})
const followingNumbers = computed(() => {
    const n = draft.value?.nextCheckNumber || ''
    if (!n) return ''
    const a = nextCheckNumber(n)
    return `${a}, ${nextCheckNumber(a)}, …`
})

function submit () {
    if (!draft.value) return
    if (routingWarn.value && !confirm(routingWarn.value + '\n\nSave anyway?')) return
    store.saveAccount(draft.value)
}
function cancel () {
    store.editingAccount = null
}
</script>

<style scoped>
.overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, .35);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
}
.dialog {
    width: 560px;
    max-width: calc(100vw - 40px);
    max-height: calc(100vh - 40px);
    display: flex;
    flex-direction: column;
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, .3);
}
header, footer {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
}
header { border-bottom: 1px solid #e5e5e5; justify-content: space-between; }
header h5 { margin: 0; }
footer { border-top: 1px solid #e5e5e5; justify-content: flex-end; }
footer .muted { margin-right: auto; }
.body { padding: 10px 18px 16px; overflow-y: auto; }
.form-label { font-size: 12.5px; font-weight: 600; margin: 4px 0 2px; }
.sect {
    margin-top: 14px;
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: #2b579a;
    font-weight: 600;
}
.muted { color: #6c757d; font-weight: normal; }
.preview-num {
    display: flex;
    align-items: flex-end;
    padding-bottom: 6px;
    font-family: var(--bs-font-monospace);
    font-size: 13px;
}
</style>
