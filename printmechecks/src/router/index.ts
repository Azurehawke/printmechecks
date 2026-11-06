import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  // The desktop app loads from local files (file://), where only hash
  // routing works. The web version keeps normal URLs.
  history: window.location.protocol === 'file:'
    ? createWebHashHistory()
    : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue') },
    { path: '/history', redirect: '/register' }
  ]
})

export default router
