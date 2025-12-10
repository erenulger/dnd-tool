import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './lib/themes/light-theme.css'
import './lib/themes/dark-theme.css'
import './style.css'

import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import SessionView from './views/SessionView.vue'
import CharacterSheet from './views/CharacterSheet.vue'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', name: 'Login', component: Login },
  { path: '/dashboard', name: 'Dashboard', component: Dashboard },
  { path: '/session/:id', name: 'SessionView', component: SessionView },
  { path: '/session/:id/character', name: 'CharacterSheet', component: CharacterSheet }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const app = createApp(App)
app.use(router)
app.mount('#app')

