<template>
    <div class="check-box" id="check-box" :class="{ 'no-bg': !settings.showBackground, 'show-outlines': settings.showOutlines, 'tool-select': store.tool === 'select' }">
        <div id="check-box-print" :style="pageOffset" class="check-text" @click.self="store.selectedField = null">
            <div v-bind="fld('holderName')" class="holder-name val">{{ account.holderName }}</div>
            <div v-bind="fld('holderAddress')" class="holder-address">
                {{ account.address }}<br>
                {{ cityLine }}
            </div>
            <div v-bind="fld('checkNumber')" class="check-number-human val">{{ check.checkNumber }}</div>

            <div v-bind="fld('dateLabel')" class="date">Date: <span class="date-line"></span></div>
            <div v-bind="fld('date')" class="date-data val">{{ check.date }}</div>

            <div v-bind="fld('payToLabel')" class="pay-to">Pay to the <br>Order of <span class="payto-line"></span></div>
            <div v-bind="fld('payTo')" class="pay-to-data val">{{ check.payTo }}</div>

            <div v-bind="fld('amountBox')" class="amount-box"></div>
            <div v-bind="fld('amount')" class="amount-data val">{{ formatMoney(check.amount) }}</div>

            <div v-bind="fld('amountWords')" class="amount-line-data">*** {{ words }} ***</div>
            <div v-bind="fld('amountLine')" class="amount-line"><span class="dollar-line"></span></div>

            <div v-bind="fld('bankName')" class="bank-name val">{{ account.bankName }}</div>

            <div v-bind="fld('memoLabel')" class="memo">Memo: <span class="memo-line"></span></div>
            <div v-bind="fld('memo')" class="memo-data val">{{ check.memo }}</div>

            <!-- Left blank: checks are signed by hand. -->
            <div v-bind="fld('signatureLine')" class="signature"><span class="sig-line"></span></div>

            <div v-bind="fld('micr')" class="banking">
                <!-- trailing space after the routing symbol, as in the original layout -->
                <span class="routing">a{{ account.routingNumber }}a&#32;</span>
                <span class="bank-account">{{ account.accountNumber }}c</span>
                <span class="check-number">{{ micrCheckNumber(check.checkNumber) }}</span>
            </div>

            <div v-if="settings.showStub" class="check-stub">
                <div>Check No. {{ check.checkNumber }} &nbsp;&nbsp;&nbsp; Date: {{ check.date }}</div>
                <div>Pay to: {{ check.payTo }} &nbsp;&nbsp;&nbsp; Amount: {{ formatMoney(check.amount) }}</div>
                <div>Memo: {{ check.memo }}</div>
            </div>
        </div>

        <!-- Millimetre grid: screen only, never printed, passes clicks through -->
        <div v-if="settings.showGrid" class="mm-grid no-print" aria-hidden="true">
            <span v-for="m in xMarks" :key="'x' + m.mm" class="mm-label" :style="{ left: m.px + 'px', top: '0px' }">{{ m.mm }}</span>
            <span v-for="m in yMarks" :key="'y' + m.mm" class="mm-label" :style="{ top: m.px + 'px', left: '0px' }">{{ m.mm }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore, micrCheckNumber } from '../stores/app'
import { formatMoney, amountInWords } from '../utilities'
import { FIELDS, PX_PER_INCH, PX_PER_MM, CHECK_WIDTH } from '../checkLayout'

const store = useAppStore()
const settings = store.settings
const check = store.check
const account = computed(() => store.account)

// Millimetre grid labels, measured from the check's top-left corner
const xMarks = Array.from({ length: 22 }, (_, i) => ({ mm: i * 10, px: i * 10 * PX_PER_MM })).filter(m => m.px < CHECK_WIDTH)
const yMarks = Array.from({ length: 9 }, (_, i) => ({ mm: i * 10, px: i * 10 * PX_PER_MM })).filter(m => m.px < 480)

// Drag a field with the mouse (select tool). Converts screen pixels to canvas
// pixels using the on-screen scale, so it works at any zoom.
function startFieldDrag (key: string, e: MouseEvent) {
    if (store.tool !== 'select' || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    store.selectedField = key
    const box = (e.currentTarget as HTMLElement).closest('.check-box') as HTMLElement | null
    const scale = box ? box.getBoundingClientRect().width / CHECK_WIDTH : 1
    const startX = e.clientX
    const startY = e.clientY
    const orig = { ...(settings.fieldOffsets[key] || { x: 0, y: 0 }) }
    const move = (ev: MouseEvent) => {
        settings.fieldOffsets = {
            ...settings.fieldOffsets,
            [key]: {
                x: Math.round(orig.x + (ev.clientX - startX) / scale),
                y: Math.round(orig.y + (ev.clientY - startY) / scale)
            }
        }
    }
    const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
}

const cityLine = computed(() => {
    const a = account.value
    const city = [a.city, a.state].filter(Boolean).join(', ')
    return [city, a.zip].filter(Boolean).join(' ')
})

const words = computed(() => amountInWords(check.amount))

const pageOffset = computed(() => ({
    top: settings.offsetY * PX_PER_INCH + 'px',
    left: settings.offsetX * PX_PER_INCH + 'px',
    fontFamily: settings.fontFamily || undefined,
    fontSize: settings.fontSize + 'px',
    '--val-weight': settings.boldValues ? 'bold' : 'normal'
}))

// Position + selection attributes for one field.
function fld (key: string) {
    const base = FIELDS[key]
    const off = settings.fieldOffsets[key] || { x: 0, y: 0 }
    return {
        'data-field': key,
        title: store.tool === 'select' ? base.label : undefined,
        class: ['fld', { selected: store.selectedField === key }],
        style: { position: 'absolute' as const, top: base.top + off.y + 'px', left: base.left + off.x + 'px' },
        onMousedown: (e: MouseEvent) => startFieldDrag(key, e),
        onClick: (e: MouseEvent) => {
            if (store.tool !== 'select') return
            e.stopPropagation()
            store.selectedField = key
        }
    }
}
</script>

<style>
/* ---------- The check (screen and print) ----------
   Sizes are in em so the Text tab's font size scales every field together.
   At the default 16px they match the original layout exactly. */
.check-box {
    /* Fixed canvas: fields are positioned in px against a 1200px-wide check */
    position: relative;
    width: 1200px;
    height: 480px;
    background: white url('../assets/checkbg.png') no-repeat top left;
    background-size: 1200px auto;
    box-shadow: 0 1px 4px rgba(0, 0, 0, .25);
}
.check-box.no-bg {
    background-image: none;
}
.check-text {
    position: relative;
    line-height: 1.5;
    color: #212529;
}
.check-text .val {
    font-weight: var(--val-weight, bold);
}
/* Millimetre grid: lines every 5 mm (1 mm = PX_PER_MM canvas px), labels every 10 mm */
.mm-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
        linear-gradient(to right, rgba(220, 53, 69, .22) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(220, 53, 69, .22) 1px, transparent 1px);
    background-size: 28.161px 28.161px;
}
.mm-label {
    position: absolute;
    font-size: 10px;
    line-height: 1;
    color: #dc3545;
    padding: 1px 2px;
}
/* Stub lines under the check, starting just below the first perforation */
.check-stub {
    position: absolute;
    top: 530px;
    left: 60px;
    white-space: nowrap;
    line-height: 1.6;
}
.holder-name, .check-number-human, .date-data, .pay-to-data, .amount-data, .bank-name {
    font-size: 1.25em;
}
.amount-line-data {
    text-transform: capitalize;
    white-space: nowrap;
}
.memo-data {
    font-size: 1.125em;
    white-space: nowrap;
}
.date, .memo {
    white-space: nowrap;
}
.date-line, .memo-line, .sig-line {
    display: inline-block;
    border-bottom: 1px solid black;
    vertical-align: baseline;
}
.date-line { width: 190px; }
.memo-line { width: 262px; }
.sig-line { width: 358px; }
.amount-box {
    width: 225px;
    height: 40px;
    border: 1px solid #c7c7c7;
    background-color: white;
}
.amount-box::before {
    content: "$";
    font-size: 1.25em;
    margin-left: -15px;
    font-weight: bold;
}
.dollar-line {
    width: 840px;
    display: block;
    border-bottom: 1px solid black;
    margin-left: 10px;
    margin-top: 20px;
}
.dollar-line::after {
    content: "Dollars";
    font-size: 1.125em;
    position: absolute;
    left: calc(100% + 17px);
    top: 0;
    white-space: nowrap;
}
.payto-line {
    width: 776px;
    display: block;
    border-bottom: 1px solid black;
    margin-left: 73px;
    border-right: 1px solid black;
    height: 28px;
    margin-top: -32px;
}
@font-face {
    font-family: 'banking';
    src: url('../assets/micrenc.ttf');
}
/* MICR line always uses the bank font, whatever the Text settings */
.banking {
    font-family: 'banking';
    font-size: 37px;
    font-weight: normal;
    line-height: 1.5;
    white-space: nowrap;
}
.banking .check-number {
    margin-left: 20px;
}

/* ---------- Editing aids (screen only) ---------- */
.check-box.tool-select .fld {
    cursor: pointer;
}
.check-box.show-outlines .fld,
.check-box.tool-select .fld:hover {
    outline: 1px dashed rgba(13, 110, 253, .55);
    outline-offset: 2px;
}
.check-box .fld.selected {
    outline: 2px solid #0d6efd !important;
    outline-offset: 2px;
    background-color: rgba(13, 110, 253, .06);
}

/* ---------- Print: only the check ----------
   Everything else (ribbon, panels, and any banner a web host injects) is
   hidden rather than just covered, so nothing bleeds into the check. */
@media print {
    @page {
        margin: 0;
    }
    html, body, #app {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        height: auto !important;
        overflow: visible !important;
    }
    body * {
        visibility: hidden !important;
    }
    .no-print {
        display: none !important;
    }
    #check-box-print,
    #check-box-print * {
        visibility: visible !important;
    }
    .check-box .fld,
    .check-box .fld.selected,
    .check-box.show-outlines .fld {
        outline: none !important;
        background-color: transparent !important;
    }
    /* Nothing on screen may widen the printed page: a wider page makes the
       browser shrink-to-fit and moves the check on the paper. */
    .app-shell, .workspace, .canvas-scroll, .canvas-pad {
        min-width: 0 !important;
        width: auto !important;
        height: auto !important;
        overflow: visible !important;
        padding: 0 !important;
    }
    /* Screen zoom never applies to print */
    .canvas-zoom {
        zoom: 1 !important;
    }
    /* The check is laid out on a 1216px-wide canvas and printed at
       816/1216 scale onto a Letter page (816 CSS px wide). */
    .check-box {
        position: fixed;
        top: 0;
        left: 0;
        width: 1216px !important;
        height: auto;
        zoom: 0.671053;
        margin: 0;
        padding: 0;
        background: none !important;
        border: none !important;
        box-shadow: none !important;
    }
}
</style>
