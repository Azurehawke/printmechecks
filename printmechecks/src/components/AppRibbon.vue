<template>
    <header class="ribbon no-print">
        <div class="ribbon-tabs">
            <span class="app-name"><i class="bi bi-bank2"></i> Print Me Checks</span>
            <button v-for="t in tabs" :key="t" class="tab" :class="{ active: activeTab === t }" @click="selectTab(t)">{{ t }}</button>
        </div>

        <div class="ribbon-body">
            <!-- HOME -->
            <template v-if="activeTab === 'Home'">
                <div class="group">
                    <div class="group-items">
                        <button class="big" title="Print preview (Ctrl+P)" @click="preview"><i class="bi bi-printer"></i>Print</button>
                        <button class="big" title="Save the check as a PDF" @click="pdf"><i class="bi bi-file-earmark-pdf"></i>Save PDF</button>
                    </div>
                    <div class="group-label">Print</div>
                </div>
                <div class="group">
                    <div class="group-items">
                        <button class="big" title="Start the next check for this account" @click="store.newCheck()"><i class="bi bi-file-earmark-plus"></i>New Check</button>
                        <button class="big" title="Record this check in the register" @click="store.saveToRegister()"><i class="bi bi-journal-plus"></i>Save to<br>Register</button>
                    </div>
                    <div class="group-label">Check</div>
                </div>
                <div class="group">
                    <div class="group-items column">
                        <AccountPicker />
                        <button class="small" @click="store.startEditAccount()"><i class="bi bi-pencil"></i> Edit account</button>
                    </div>
                    <div class="group-label">Account</div>
                </div>
            </template>

            <!-- TEXT -->
            <template v-else-if="activeTab === 'Text'">
                <div class="group">
                    <div class="group-items column">
                        <div class="row-items">
                            <select class="form-select form-select-sm font-select" v-model="settings.fontFamily" title="Font for the whole check">
                                <option value="">Default</option>
                                <option v-for="f in fonts" :key="f" :value="f" :style="{ fontFamily: f }">{{ f }}</option>
                            </select>
                            <select class="form-select form-select-sm size-select" v-model.number="settings.fontSize" title="Font size">
                                <option v-for="s in sizes" :key="s" :value="s">{{ s }}</option>
                            </select>
                        </div>
                        <div class="row-items">
                            <button class="small" title="Smaller" @click="bump(-1)"><i class="bi bi-fonts"></i><i class="bi bi-dash"></i></button>
                            <button class="small" title="Larger" @click="bump(1)"><i class="bi bi-fonts"></i><i class="bi bi-plus"></i></button>
                            <button class="small" :class="{ on: settings.boldValues }" title="Bold filled-in values (payee, amount, date, …)" @click="settings.boldValues = !settings.boldValues"><i class="bi bi-type-bold"></i></button>
                            <button v-if="canListFonts" class="small" title="Add the fonts installed on this computer to the list" @click="loadLocalFonts"><i class="bi bi-download"></i> Installed fonts</button>
                        </div>
                    </div>
                    <div class="group-label">Font (whole check)</div>
                </div>
                <div class="group">
                    <div class="group-items">
                        <button class="big" @click="store.resetFont()"><i class="bi bi-arrow-counterclockwise"></i>Reset<br>Font</button>
                    </div>
                    <div class="group-label">Reset</div>
                </div>
            </template>

            <!-- LAYOUT -->
            <template v-else-if="activeTab === 'Layout'">
                <div class="group">
                    <div class="group-items">
                        <div class="nudge">
                            <span></span><button class="small" title="Up" @click="nudge(0, -1)" :disabled="!sel"><i class="bi bi-arrow-up"></i></button><span></span>
                            <button class="small" title="Left" @click="nudge(-1, 0)" :disabled="!sel"><i class="bi bi-arrow-left"></i></button>
                            <button class="small" title="Reset this field" @click="sel && store.resetField(sel)" :disabled="!sel"><i class="bi bi-bullseye"></i></button>
                            <button class="small" title="Right" @click="nudge(1, 0)" :disabled="!sel"><i class="bi bi-arrow-right"></i></button>
                            <span></span><button class="small" title="Down" @click="nudge(0, 1)" :disabled="!sel"><i class="bi bi-arrow-down"></i></button><span></span>
                        </div>
                        <div class="sel-info">
                            <strong>{{ sel ? FIELDS[sel].label : 'No field selected' }}</strong>
                            <span v-if="sel">Arrow keys move it.<br>Shift+arrow moves 10×.</span>
                            <span v-else>Click a field on the<br>check to move it.</span>
                        </div>
                    </div>
                    <div class="group-label">Move Field</div>
                </div>
                <div class="group">
                    <div class="group-items column">
                        <label class="inch">Right <input type="number" step="0.01" class="form-control form-control-sm" v-model.number="settings.offsetX"> in</label>
                        <label class="inch">Down <input type="number" step="0.01" class="form-control form-control-sm" v-model.number="settings.offsetY"> in</label>
                    </div>
                    <div class="group-label">Shift Whole Check</div>
                </div>
                <div class="group">
                    <div class="group-items">
                        <button class="big" :class="{ on: settings.showBackground }" @click="settings.showBackground = !settings.showBackground"><i class="bi bi-image"></i>Background</button>
                        <button class="big" :class="{ on: settings.showOutlines }" @click="settings.showOutlines = !settings.showOutlines"><i class="bi bi-bounding-box"></i>Outlines</button>
                    </div>
                    <div class="group-label">Show (screen only)</div>
                </div>
                <div class="group">
                    <div class="group-items">
                        <button class="big" @click="confirmReset"><i class="bi bi-arrow-counterclockwise"></i>Reset<br>Layout</button>
                    </div>
                    <div class="group-label">Reset</div>
                </div>
            </template>

            <!-- ACCOUNTS -->
            <template v-else-if="activeTab === 'Accounts'">
                <div class="group">
                    <div class="group-items column">
                        <AccountPicker />
                        <span class="hint">{{ store.accounts.length }} saved account{{ store.accounts.length === 1 ? '' : 's' }}</span>
                    </div>
                    <div class="group-label">Active Account</div>
                </div>
                <div class="group">
                    <div class="group-items">
                        <button class="big" @click="store.startNewAccount()"><i class="bi bi-plus-square"></i>New</button>
                        <button class="big" @click="store.startEditAccount()"><i class="bi bi-pencil-square"></i>Edit</button>
                        <button class="big" @click="store.duplicateAccount()"><i class="bi bi-copy"></i>Duplicate</button>
                        <button class="big" @click="removeAccount"><i class="bi bi-trash3"></i>Delete</button>
                    </div>
                    <div class="group-label">Manage</div>
                </div>
            </template>

            <!-- REGISTER -->
            <template v-else-if="activeTab === 'Register'">
                <div class="group">
                    <div class="group-items">
                        <button class="big" @click="$router.push('/register')"><i class="bi bi-journal-text"></i>Register</button>
                        <button class="big" @click="exportCsv" :disabled="!store.register.length"><i class="bi bi-filetype-csv"></i>Export<br>CSV</button>
                    </div>
                    <div class="group-label">Register</div>
                </div>
                <div class="group">
                    <div class="group-items">
                        <button class="big" @click="backToCheck"><i class="bi bi-arrow-left-square"></i>Back to<br>Check</button>
                    </div>
                    <div class="group-label">Check</div>
                </div>
            </template>
        </div>
    </header>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore, accountTitle } from '../stores/app'
import { FIELDS } from '../checkLayout'
import { printPreview, savePdf } from '../utilities'
import AccountPicker from './AccountPicker.vue'

const store = useAppStore()
const settings = store.settings
const route = useRoute()
const router = useRouter()

const tabs = ['Home', 'Text', 'Layout', 'Accounts', 'Register']
const activeTab = ref('Home')
watch(() => route.path, p => {
    if (p === '/register') activeTab.value = 'Register'
    else if (activeTab.value === 'Register') activeTab.value = 'Home'
})

function selectTab (t: string) {
    activeTab.value = t
    if (t === 'Register') router.push('/register')
    else if (route.path !== '/') router.push('/')
}

function backToCheck () {
    activeTab.value = 'Home'
    router.push('/')
}

const sel = computed(() => store.selectedField)
function nudge (dx: number, dy: number) {
    if (sel.value) store.nudgeField(sel.value, dx, dy)
}

const checkName = () => `Check ${store.check.checkNumber || ''} ${store.check.payTo || ''}`.trim()
function preview () { printPreview(checkName()) }
function pdf () { savePdf(checkName()) }

// ----- Fonts -----
const sizes = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22, 24]
const baseFonts = [
    'Arial', 'Book Antiqua', 'Calibri', 'Cambria', 'Candara', 'Century Gothic', 'Consolas',
    'Courier New', 'Franklin Gothic Medium', 'Garamond', 'Georgia', 'Lucida Sans', 'Palatino Linotype',
    'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'
]
const extraFonts = ref<string[]>([])
const fonts = computed(() => {
    const all = new Set([...baseFonts, ...extraFonts.value])
    if (settings.fontFamily) all.add(settings.fontFamily)
    return [...all].sort((a, b) => a.localeCompare(b))
})
const canListFonts = 'queryLocalFonts' in window
async function loadLocalFonts () {
    try {
        const list = await (window as unknown as { queryLocalFonts: () => Promise<{ family: string }[]> }).queryLocalFonts()
        extraFonts.value = [...new Set(list.map(f => f.family))]
        store.notify(`Added ${extraFonts.value.length} installed font families to the list.`)
    } catch (e) {
        store.notify('Could not read the installed fonts.')
    }
}
function bump (d: number) {
    const i = sizes.indexOf(settings.fontSize)
    const next = i < 0 ? settings.fontSize + d : sizes[Math.min(sizes.length - 1, Math.max(0, i + d))]
    settings.fontSize = next
}

// ----- Layout / accounts -----
function confirmReset () {
    if (confirm('Put every field back in its default position and clear the whole-check shift?')) store.resetLayout()
}
function removeAccount () {
    const a = store.account
    if (confirm(`Delete the account "${accountTitle(a)}"? Checks already in the register are kept.`)) store.deleteAccount(a.id)
}

// ----- Register export -----
function exportCsv () {
    const cols = ['date', 'checkNumber', 'payTo', 'amount', 'memo', 'bankName', 'account', 'accountHolderName']
    const head = ['Date', 'Check #', 'Payee', 'Amount', 'Memo', 'Bank', 'Account', 'Account holder']
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = store.register.map(e => cols.map(c => {
        if (c === 'account') return esc(String(e.bankAccountNumber || '').slice(-4).padStart(8, '•'))
        return esc((e as unknown as Record<string, unknown>)[c])
    }).join(','))
    const blob = new Blob([[head.map(esc).join(','), ...rows].join('\r\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'check-register.csv'
    a.click()
    URL.revokeObjectURL(a.href)
}
</script>

<style scoped>
.ribbon {
    background: #f3f3f3;
    border-bottom: 1px solid #d6d6d6;
    user-select: none;
    flex: 0 0 auto;
}
.ribbon-tabs {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    padding: 6px 10px 0;
    background: #2b579a;
}
.app-name {
    color: white;
    font-weight: 600;
    margin-right: 18px;
    padding: 0 6px 8px;
}
.tab {
    border: 0;
    background: transparent;
    color: #e8eef7;
    padding: 6px 16px 7px;
    border-radius: 4px 4px 0 0;
    font-size: 14px;
}
.tab:hover { background: rgba(255, 255, 255, .15); }
.tab.active {
    background: #f3f3f3;
    color: #2b579a;
    font-weight: 600;
}
.ribbon-body {
    display: flex;
    align-items: stretch;
    min-height: 96px;
    padding: 6px 6px 2px;
    overflow-x: auto;
}
.group {
    display: flex;
    flex-direction: column;
    padding: 0 10px;
    border-right: 1px solid #d6d6d6;
}
.group-items {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 4px;
}
.group-items.column {
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
    gap: 6px;
}
.row-items {
    display: flex;
    gap: 4px;
    align-items: center;
}
.group-label {
    text-align: center;
    font-size: 11.5px;
    color: #666;
    padding-top: 2px;
    white-space: nowrap;
}
button.big, button.small {
    border: 1px solid transparent;
    background: transparent;
    border-radius: 4px;
    color: #222;
}
button.big {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    min-width: 62px;
    padding: 4px 6px;
    font-size: 12px;
    line-height: 1.15;
}
button.big i {
    font-size: 26px;
    color: #2b579a;
    margin-bottom: 3px;
}
button.small {
    padding: 2px 7px;
    font-size: 13px;
    white-space: nowrap;
}
button.big:hover:not(:disabled), button.small:hover:not(:disabled) {
    background: #e1e8f3;
    border-color: #c5d3e8;
}
button.on {
    background: #d4e0f1;
    border-color: #a9bfe0;
}
button:disabled {
    opacity: .4;
}
.font-select { width: 200px; }
.size-select { width: 70px; }
.nudge {
    display: grid;
    grid-template-columns: repeat(3, 30px);
    grid-auto-rows: 24px;
    gap: 2px;
}
.nudge button { padding: 0; }
.sel-info {
    display: flex;
    flex-direction: column;
    font-size: 12px;
    color: #555;
    margin-left: 8px;
    max-width: 190px;
    line-height: 1.3;
}
.sel-info strong { color: #222; }
.inch {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    white-space: nowrap;
}
.inch input { width: 80px; }
.hint { font-size: 12px; color: #666; }
</style>
