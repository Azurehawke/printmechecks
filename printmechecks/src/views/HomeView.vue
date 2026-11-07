<template>
    <div class="workspace">
        <ToolRail @zoom="zoomStep" @print="print" />
        <div class="canvas-scroll" ref="scroller" :class="{ panning: store.tool === 'pan', dragging }"
             @mousedown="startPan" @click.self="store.selectedField = null">
            <div class="canvas-pad" @click.self="store.selectedField = null">
                <div class="canvas-zoom" :style="{ zoom }">
                    <CheckCanvas />
                </div>
            </div>
        </div>
        <DetailsPanel @print="print" />
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../stores/app'
import { printPreview } from '../utilities'
import CheckCanvas from '../components/CheckCanvas.vue'
import ToolRail from '../components/ToolRail.vue'
import DetailsPanel from '../components/DetailsPanel.vue'

const store = useAppStore()
const settings = store.settings

// ----- Zoom -----
const CHECK_WIDTH = 1200
const scroller = ref<HTMLElement | null>(null)
const fitZoom = ref(1)
const zoom = computed(() => (settings.zoom === 'fit' ? fitZoom.value : settings.zoom))
const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]

function measureFit () {
    const el = scroller.value
    if (!el) return
    fitZoom.value = Math.max(0.25, Math.min(1.5, (el.clientWidth - 48) / CHECK_WIDTH))
}

function zoomStep (dir: number) {
    const cur = zoom.value
    const next = dir > 0 ? STEPS.find(s => s > cur + 0.001) : [...STEPS].reverse().find(s => s < cur - 0.001)
    settings.zoom = next ?? cur
}

// ----- Pan tool -----
const dragging = ref(false)
function startPan (e: MouseEvent) {
    if (store.tool !== 'pan' || !scroller.value) return
    const el = scroller.value
    const start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop }
    dragging.value = true
    const move = (ev: MouseEvent) => {
        el.scrollLeft = start.left - (ev.clientX - start.x)
        el.scrollTop = start.top - (ev.clientY - start.y)
    }
    const up = () => {
        dragging.value = false
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    e.preventDefault()
}

// ----- Print -----
function print () {
    printPreview(`Check ${store.check.checkNumber || ''} ${store.check.payTo || ''}`.trim())
}

// ----- Keyboard -----
function typing (e: KeyboardEvent) {
    const t = e.target as HTMLElement | null
    return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
}

function onKey (e: KeyboardEvent) {
    if (store.editingAccount) return // dialog open
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        print()
        return
    }
    if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomStep(1); return }
    if (ctrl && e.key === '-') { e.preventDefault(); zoomStep(-1); return }
    if (ctrl && e.key === '0') { e.preventDefault(); settings.zoom = 'fit'; return }
    if (ctrl && e.key.toLowerCase() === 'a' && !typing(e)) {
        e.preventDefault()
        store.selectAllFields()
        return
    }
    if (typing(e) || ctrl || e.altKey) return

    const sel = store.selectedFields
    const step = e.shiftKey ? 10 : 1
    const moves: Record<string, [number, number]> = {
        ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0]
    }
    if (sel.length && moves[e.key]) {
        e.preventDefault()
        for (const k of sel) store.nudgeField(k, ...moves[e.key])
    } else if (e.key === 'Escape') {
        store.selectedField = null
    } else if (e.key.toLowerCase() === 'v') {
        store.tool = 'select'
    } else if (e.key.toLowerCase() === 'h') {
        store.tool = 'pan'
        store.selectedField = null
    }
}

let ro: ResizeObserver | undefined
onMounted(() => {
    measureFit()
    ro = new ResizeObserver(measureFit)
    if (scroller.value) ro.observe(scroller.value)
    window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
    ro?.disconnect()
    window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.workspace {
    flex: 1;
    display: flex;
    min-height: 0;
}
.canvas-scroll {
    flex: 1;
    overflow: auto;
    background: #e9eaec;
    min-width: 0;
}
.canvas-scroll.panning { cursor: grab; }
.canvas-scroll.dragging { cursor: grabbing; user-select: none; }
.canvas-pad {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 24px;
    min-width: max-content;
    min-height: 100%;
}
</style>
