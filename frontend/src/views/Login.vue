<template>
  <div class="login-container">
    <div class="login-card">
      <h1>🎲 DND Helper Tool</h1>
      <p class="subtitle">Sign in to manage your D&D sessions</p>
      
      <div v-if="error" class="error">{{ error }}</div>
      
      <form @submit.prevent="handleLogin" v-if="!isSignUp">
        <div class="form-group">
          <label>Email</label>
          <input type="email" v-model="email" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" v-model="password" required />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
        <p class="toggle-text">
          Don't have an account? 
          <a href="#" @click.prevent="isSignUp = true">Sign up</a>
        </p>
      </form>

      <form @submit.prevent="handleSignUp" v-else>
        <div class="form-group">
          <label>Email</label>
          <input type="email" v-model="email" required />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" v-model="password" required minlength="6" />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Creating account...' : 'Sign Up' }}
        </button>
        <p class="toggle-text">
          Already have an account? 
          <a href="#" @click.prevent="isSignUp = false">Sign in</a>
        </p>
      </form>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'

export default {
  name: 'Login',
  setup() {
    const router = useRouter()
    const email = ref('')
    const password = ref('')
    const error = ref('')
    const loading = ref(false)
    const isSignUp = ref(false)

    const handleLogin = async () => {
      error.value = ''
      loading.value = true

      try {
        const { data, error: authError } = await supabase.auth.signInWithPassword({
          email: email.value,
          password: password.value
        })

        if (authError) throw authError

        router.push('/dashboard')
      } catch (err) {
        error.value = err.message || 'Failed to sign in'
      } finally {
        loading.value = false
      }
    }

    const handleSignUp = async () => {
      error.value = ''
      loading.value = true

      try {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.value,
          password: password.value
        })

        if (authError) throw authError

        error.value = 'Account created! Please check your email to verify your account, then sign in.'
        isSignUp.value = false
      } catch (err) {
        error.value = err.message || 'Failed to create account'
      } finally {
        loading.value = false
      }
    }

    return {
      email,
      password,
      error,
      loading,
      isSignUp,
      handleLogin,
      handleSignUp
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
}

.login-card {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 28px;
  box-shadow: 0 4px 12px var(--shadow-hover);
  width: 100%;
  max-width: 400px;
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.login-card h1 {
  text-align: center;
  color: #667eea;
  margin-bottom: 6px;
  font-size: 28px;
}

.subtitle {
  text-align: center;
  color: var(--text-secondary);
  margin-bottom: 20px;
  font-size: 14px;
}

.toggle-text {
  text-align: center;
  margin-top: 20px;
  color: var(--text-secondary);
}

.toggle-text a {
  color: #667eea;
  text-decoration: none;
  font-weight: 600;
}

.toggle-text a:hover {
  text-decoration: underline;
}
</style>

