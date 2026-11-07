<template>
    <div class="check-box" id="check-box" :class="{ 'no-bg': !settings.showBackground, 'show-outlines': settings.showOutlines, 'tool-select': store.tool === 'select' }" @mousedown="startMarquee">
        <div id="check-box-print" :style="pageOffset" class="check-text">
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
        <div v-if="marquee" class="marquee no-print" :style="{ left: marquee.x0 + 'px', top: marquee.y0 + 'px', width: (marquee.x1 - marquee.x0) + 'px', height: (marquee.y1 - marquee.y0) + 'px' }"></div>

        <div v-if="settings.showGrid" class="mm-grid no-print" aria-hidden="true" :style="{ backgroundSize: gridPx + 'px ' + gridPx + 'px' }">
            <span v-for="m in xMarks" :key="'x' + m.mm" class="mm-label" :style="{ left: m.px + 'px', top: '0px' }">{{ m.mm }}</span>
            <span v-for="m in yMarks" :key="'y' + m.mm" class="mm-label" :style="{ top: m.px + 'px', left: '0px' }">{{ m.mm }}</span>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
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

// Shift, Ctrl or Cmd add or remove fields from the selection instead of replacing it.
const isAdditive = (e: MouseEvent) => e.shiftKey || e.ctrlKey || e.metaKey

// Canvas px per screen px, so drags and marquees work at any zoom.
function canvasScale (box: HTMLElement) {
    return box.getBoundingClientRect().width / CHECK_WIDTH
}

// Drag a field (or every selected field, together). With snapping on, the
// field under the mouse lands on the grid and the rest keep their spacing.
function startFieldDrag (key: string, e: MouseEvent) {
    if (store.tool !== 'select' || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    if (isAdditive(e)) {
        store.toggleFieldSelection(key)
        return
    }
    if (!store.selectedFields.includes(key)) store.selectedFields = [key]
    const group = [...store.selectedFields]
    const box = (e.currentTarget as HTMLElement).closest('.check-box') as HTMLElement | null
    const scale = box ? canvasScale(box) : 1
    const startX = e.clientX
    const startY = e.clientY
    const anchor = FIELDS[key]
    const anchorOff = settings.fieldOffsets[key] || { x: 0, y: 0 }
    const anchorStart = { x: anchor.left + anchorOff.x, y: anchor.top + anchorOff.y }
    const origin: Record<string, { x: number, y: number }> = {}
    for (const k of group) origin[k] = { ...(settings.fieldOffsets[k] || { x: 0, y: 0 }) }
    let moved = false
    const move = (ev: MouseEvent) => {
        let dx = (ev.clientX - startX) / scale
        let dy = (ev.clientY - startY) / scale
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true
        if (settings.snap) {
            const step = settings.gridMm * PX_PER_MM
            dx = Math.round((anchorStart.x + dx) / step) * step - anchorStart.x
            dy = Math.round((anchorStart.y + dy) / step) * step - anchorStart.y
        }
        const next = { ...settings.fieldOffsets }
        for (const k of group) {
            next[k] = {
                x: Math.round((origin[k].x + dx) * 10) / 10,
                y: Math.round((origin[k].y + dy) * 10) / 10
            }
        }
        settings.fieldOffsets = next
    }
    const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        // A plain click on one field of a group selects just that field
        if (!moved && group.length > 1) store.selectedFields = [key]
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
}

// Rubber-band selection: drag on empty check area to select every field the
// box touches. A plain click on empty area clears the selection.
const marquee = ref<{ x0: number, y0: number, x1: number, y1: number } | null>(null)

function startMarquee (e: MouseEvent) {
    if (store.tool !== 'select' || e.button !== 0) return
    const box = e.currentTarget as HTMLElement
    const rect = box.getBoundingClientRect()
    const scale = canvasScale(box)
    const toCanvas = (x: number, y: number) => ({ x: (x - rect.left) / scale, y: (y - rect.top) / scale })
    const start = toCanvas(e.clientX, e.clientY)
    const additive = isAdditive(e)
    const before = [...store.selectedFields]
    let moved = false
    e.preventDefault()
    const move = (ev: MouseEvent) => {
        const p = toCanvas(ev.clientX, ev.clientY)
        if (!moved && Math.hypot(p.x - start.x, p.y - start.y) < 4) return
        moved = true
        const r = {
            x0: Math.min(start.x, p.x), y0: Math.min(start.y, p.y),
            x1: Math.max(start.x, p.x), y1: Math.max(start.y, p.y)
        }
        marquee.value = r
        const hit = [...box.querySelectorAll<HTMLElement>('[data-field]')].filter(el => {
            const f = el.getBoundingClientRect()
            const l = (f.left - rect.left) / scale
            const t = (f.top - rect.top) / scale
            const rt = (f.right - rect.left) / scale
            const b = (f.bottom - rect.top) / scale
            return l < r.x1 && rt > r.x0 && t < r.y1 && b > r.y0
        }).map(el => el.dataset.field as string)
        store.selectedFields = additive ? [...new Set([...before, ...hit])] : hit
    }
    const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        marquee.value = null
        if (!moved && !additive) store.selectedFields = []
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
}

// Grid spacing in canvas px (the grid and the snap step use the same value)
const gridPx = computed(() => settings.gridMm * PX_PER_MM)

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
        class: ['fld', { selected: store.selectedFields.includes(key) }],
        style: { position: 'absolute' as const, top: base.top + off.y + 'px', left: base.left + off.x + 'px' },
        onMousedown: (e: MouseEvent) => startFieldDrag(key, e)
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
}
.marquee {
    position: absolute;
    border: 1px dashed #0d6efd;
    background-color: rgba(13, 110, 253, .08);
    pointer-events: none;
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
