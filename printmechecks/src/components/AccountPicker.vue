<template>
    <select class="form-select form-select-sm account-picker" :value="store.activeAccountId"
            title="Account the check is drawn on" @change="onChange">
        <option v-for="a in store.accounts" :key="a.id" :value="a.id">{{ accountTitle(a) }}</option>
        <option value="__new">+ New account…</option>
    </select>
</template>

<script setup lang="ts">
import { useAppStore, accountTitle } from '../stores/app'

const store = useAppStore()

function onChange (e: Event) {
    const el = e.target as HTMLSelectElement
    if (el.value === '__new') {
        // Keep showing the current account until the new one is saved
        el.value = store.activeAccountId
        store.startNewAccount()
        return
    }
    store.switchAccount(el.value)
}
</script>

<style scoped>
.account-picker {
    min-width: 230px;
}
</style>
