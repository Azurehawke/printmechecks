<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>

    <div class="container app-container no-print">
        <div style="padding-bottom: 20px; padding-top: 20px;">
            <img src="@/assets/pmc.png"  />
        </div>
        <ul class="nav nav-tabs">
            <li class="nav-item">
                <RouterLink to="/" class="nav-link" :class="{'active': $route.path == '/'}">Check</RouterLink>
            </li>
            <li class="nav-item">
                <RouterLink to="/history" class="nav-link" :class="{'active': $route.path == '/history'}">History</RouterLink>
            </li>
        </ul>
      <nav>
      </nav>
    </div>

    <div class="container app-container">
      <RouterView />
    </div>
</template>

<style>
/* The check preview is a fixed 1200px canvas; keep the page wide enough
   for it at every window size (narrow windows scroll sideways instead of
   squeezing the check). */
.app-container {
  max-width: 1250px !important;
  min-width: 1250px;
}
</style>

<style scoped>

nav {
  width: 100%;
  font-size: 12px;
  text-align: center;
  margin-top: 2rem;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a:first-of-type {
  border: 0;
}

</style>
