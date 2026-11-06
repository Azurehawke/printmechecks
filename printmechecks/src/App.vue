<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useAppStore, accountTitle } from './stores/app'
import AppRibbon from './components/AppRibbon.vue'
import AccountDialog from './components/AccountDialog.vue'

const store = useAppStore()
</script>

<template>
    <div class="app-shell">
        <AppRibbon />
        <RouterView />
        <footer class="status no-print">
            <span><i class="bi bi-bank"></i> {{ accountTitle(store.account) }}</span>
            <span>Next check #{{ store.account.nextCheckNumber }}</span>
            <span class="spacer"></span>
            <span>The check background and field outlines never print.</span>
        </footer>
        <transition name="fade">
            <div v-if="store.toast" class="toast-msg no-print">{{ store.toast }}</div>
        </transition>
        <AccountDialog />
    </div>
</template>

<style>
html, body, #app {
    height: 100%;
}
body {
    overflow: hidden;
}
.app-shell {
    height: 100vh;
    display: flex;
    flex-direction: column;
    min-width: 900px;
}
.status {
    flex: 0 0 auto;
    display: flex;
    gap: 18px;
    align-items: center;
    padding: 3px 12px;
    font-size: 12px;
    color: #f0f4fa;
    background: #2b579a;
}
.status .spacer { flex: 1; }
.toast-msg {
    position: fixed;
    bottom: 36px;
    left: 50%;
    transform: translateX(-50%);
    background: #323232;
    color: white;
    padding: 9px 18px;
    border-radius: 6px;
    font-size: 14px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, .25);
    z-index: 60;
}
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
