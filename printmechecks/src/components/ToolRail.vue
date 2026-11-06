<template>
    <nav class="tool-rail no-print">
        <button :class="{ on: store.tool === 'select' }" title="Select and move fields (V)" @click="store.tool = 'select'"><i class="bi bi-cursor"></i></button>
        <button :class="{ on: store.tool === 'pan' }" title="Pan: drag to scroll (H)" @click="setPan"><i class="bi bi-hand-index-thumb"></i></button>
        <hr>
        <button title="Zoom in (Ctrl +)" @click="emit('zoom', 1)"><i class="bi bi-zoom-in"></i></button>
        <button title="Zoom out (Ctrl -)" @click="emit('zoom', -1)"><i class="bi bi-zoom-out"></i></button>
        <button :class="{ on: settings.zoom === 'fit' }" title="Fit to window (Ctrl 0)" @click="settings.zoom = 'fit'"><i class="bi bi-arrows-angle-expand"></i></button>
        <hr>
        <button :class="{ on: settings.showOutlines }" title="Show field outlines" @click="settings.showOutlines = !settings.showOutlines"><i class="bi bi-bounding-box"></i></button>
        <button :class="{ on: settings.showBackground }" title="Show check background (never printed)" @click="settings.showBackground = !settings.showBackground"><i class="bi bi-image"></i></button>
        <hr>
        <button title="Print preview (Ctrl+P)" @click="emit('print')"><i class="bi bi-printer"></i></button>
    </nav>
</template>

<script setup lang="ts">
import { useAppStore } from '../stores/app'

const store = useAppStore()
const settings = store.settings
const emit = defineEmits<{ (e: 'zoom', dir: number): void, (e: 'print'): void }>()

function setPan () {
    store.tool = 'pan'
    store.selectedField = null
}
</script>

<style scoped>
.tool-rail {
    flex: 0 0 46px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 8px 0;
    background: #f7f7f7;
    border-right: 1px solid #d6d6d6;
}
button {
    width: 34px;
    height: 34px;
    border: 1px solid transparent;
    border-radius: 5px;
    background: transparent;
    font-size: 18px;
    color: #333;
}
button:hover {
    background: #e1e8f3;
    border-color: #c5d3e8;
}
button.on {
    background: #d4e0f1;
    border-color: #a9bfe0;
    color: #2b579a;
}
hr {
    width: 26px;
    margin: 4px 0;
}
</style>
