<template>
  <div id="app">
    <nav v-if="user" class="navbar">
      <div class="container">
        <div class="nav-content">
          <h1 @click="goToDashboard" class="nav-logo">🎲 DND Helper Tool</h1>
          <div class="nav-actions">
            <button @click="toggleTheme" class="theme-toggle" :title="isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'">
              {{ isDark ? '☀️' : '🌙' }}
            </button>
            <span class="user-email">{{ user.email }}</span>
            <button @click="handleLogout" class="btn btn-secondary">Logout</button>
          </div>
        </div>
      </div>
    </nav>
    <router-view />
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from './lib/supabase'

export default {
  name: 'App',
  setup() {
    const router = useRouter()
    const user = ref(null)
    const isDark = ref(false)

    const applyTheme = (dark) => {
      const root = document.documentElement
      if (dark) {
        root.classList.add('dark-theme')
        root.classList.remove('light-theme')
      } else {
        root.classList.add('light-theme')
        root.classList.remove('dark-theme')
      }
      localStorage.setItem('theme', dark ? 'dark' : 'light')
    }

    const toggleTheme = () => {
      isDark.value = !isDark.value
      applyTheme(isDark.value)
    }

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      user.value = session?.user || null
      
      if (!user.value && router.currentRoute.value.path !== '/login') {
        router.push('/login')
      }
    }

    const handleLogout = async () => {
      await supabase.auth.signOut()
      user.value = null
      router.push('/login')
    }

    const goToDashboard = () => {
      router.push('/dashboard')
    }

    onMounted(() => {
      // Load theme preference
      const savedTheme = localStorage.getItem('theme')
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      isDark.value = savedTheme ? savedTheme === 'dark' : prefersDark
      applyTheme(isDark.value)

      checkUser()
      
      // Listen for auth changes
      supabase.auth.onAuthStateChange((event, session) => {
        user.value = session?.user || null
        if (!user.value && router.currentRoute.value.path !== '/login') {
          router.push('/login')
        }
      })
    })

    return {
      user,
      handleLogout,
      goToDashboard,
      toggleTheme,
      isDark
    }
  }
}
</script>

<style scoped>
.navbar {
  background: var(--header-bg);
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 10px var(--header-shadow);
  padding: 16px 0;
  position: sticky;
  top: 0;
  z-index: 100;
  transition: background 0.3s ease;
}

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.nav-content h1 {
  color: var(--header-text);
  font-size: 24px;
}

.nav-logo {
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}

.nav-logo:hover {
  color: var(--primary-hover);
  transform: scale(1.05);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-email {
  color: var(--text-secondary);
  font-weight: 500;
  transition: color 0.3s ease;
}

.theme-toggle {
  background: none;
  border: 2px solid var(--primary-color);
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  height: 40px;
}

.theme-toggle:hover {
  background: var(--primary-color);
  transform: scale(1.05);
}
</style>

