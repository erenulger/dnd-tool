<template>
  <div class="dashboard">
    <div class="container">
      <div class="dashboard-header">
        <h1>My Sessions</h1>
        <button @click="showCreateModal = true" class="btn btn-primary">
          + Create New Session
        </button>
      </div>

      <!-- Pending Invitations Section -->
      <div v-if="pendingInvitations.length > 0" class="card invitations-section">
        <h2>📬 Pending Invitations</h2>
        <div class="invitations-list">
          <div 
            v-for="invitation in pendingInvitations" 
            :key="invitation.id"
            class="invitation-item"
          >
            <div class="invitation-info">
              <strong>{{ invitation.sessions?.name || 'Unknown Session' }}</strong>
              <p>Invited by: {{ invitation.inviter_email }}</p>
              <small>{{ formatDate(invitation.created_at) }}</small>
            </div>
            <div class="invitation-actions">
              <button @click="showAcceptModal(invitation)" class="btn btn-primary">
                Accept
              </button>
              <button @click="declineInvitation(invitation.id)" class="btn btn-secondary">
                Decline
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="loading" class="loading">Loading sessions...</div>
      
      <div v-if="error" class="error">
        {{ error }}
        <div style="margin-top: 10px; font-size: 14px;">
          <strong>Troubleshooting:</strong>
          <ul style="margin-top: 8px; padding-left: 20px;">
            <li>Make sure the backend server is running: <code>npm run dev:backend</code></li>
            <li>Check if backend is accessible at: <code>{{ apiUrl || 'http://' + window.location.hostname + ':3000' }}</code></li>
            <li>Verify both devices are on the same network</li>
            <li>Check firewall settings (ports 3000 and 5173 should be open)</li>
          </ul>
        </div>
      </div>

      <div v-if="!loading && sessions.length === 0 && pendingInvitations.length === 0" class="empty-state">
        <p>No sessions yet. Create your first session to get started!</p>
      </div>

      <div v-else class="session-grid">
        <div 
          v-for="session in sessions" 
          :key="session.id" 
          class="session-card"
          @click="openSession(session.id)"
        >
          <h3>{{ session.name }}</h3>
          <div class="session-players">
            <div 
              v-for="member in session.members || []" 
              :key="member.user_id"
              class="player-item"
            >
              <span class="player-name">{{ member.nickname || member.email || 'Unknown' }}</span>
              <span 
                v-if="member.is_dm" 
                class="badge badge-dm"
              >
                DM
              </span>
              <span 
                v-else-if="member.character_class"
                :class="['badge', 'badge-class', `badge-class-${getClassSlug(member.character_class)}`]"
              >
                {{ member.character_class }}
              </span>
              <span 
                v-else
                class="badge badge-class badge-class-none"
              >
                No Class
              </span>
            </div>
            <div v-if="!session.members || session.members.length === 0" class="no-players">
              No members yet
            </div>
          </div>
          <div class="session-footer">
            <span :class="['badge', session.is_dm ? 'badge-dm' : 'badge-member']">
              {{ session.is_dm ? 'DM' : 'Member' }}
            </span>
            <span class="session-date">{{ formatDate(session.created_at) }}</span>
          </div>
        </div>
      </div>

      <!-- Create Session Modal -->
      <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
        <div class="modal-content" @click.stop>
          <h2>Create New Session</h2>
          <form @submit.prevent="createSession">
            <div class="form-group">
              <label>Session Name</label>
              <input type="text" v-model="newSession.name" required />
            </div>
            <div class="form-group">
              <label>Description (optional)</label>
              <textarea v-model="newSession.description" rows="3"></textarea>
            </div>
            <div class="modal-actions">
              <button type="button" @click="showCreateModal = false" class="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" :disabled="creating">
                {{ creating ? 'Creating...' : 'Create Session' }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Accept Invitation Modal -->
      <div v-if="selectedInvitation" class="modal-overlay" @click="selectedInvitation = null">
        <div class="modal-content" @click.stop>
          <h2>Accept Invitation</h2>
          <p>You've been invited to join: <strong>{{ selectedInvitation.sessions?.name }}</strong></p>
          <form @submit.prevent="acceptInvitation">
            <div class="form-group">
              <label>Choose a nickname for this session (optional)</label>
              <input 
                type="text" 
                v-model="invitationNickname" 
                placeholder="Your character name or nickname"
                maxlength="100"
              />
              <small>This nickname will be visible to other session members</small>
            </div>
            <div class="modal-actions">
              <button type="button" @click="selectedInvitation = null" class="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary" :disabled="accepting">
                {{ accepting ? 'Accepting...' : 'Accept & Join' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../lib/api'
import { generateBadgeClassCSS } from '../lib/classColorConfig'

export default {
  name: 'Dashboard',
  setup() {
    const router = useRouter()
    const sessions = ref([])
    const pendingInvitations = ref([])
    const loading = ref(true)
    const error = ref('')
    const showCreateModal = ref(false)
    const creating = ref(false)
    const selectedInvitation = ref(null)
    const invitationNickname = ref('')
    const accepting = ref(false)
    const newSession = ref({
      name: '',
      description: ''
    })

    const loadSessions = async () => {
      loading.value = true
      error.value = ''
      
      try {
        const { data } = await api.get('/sessions')
        console.log('Sessions response:', data)
        sessions.value = data.sessions || []
        
        if (sessions.value.length === 0 && !error.value) {
          console.log('No sessions found for user')
        }
      } catch (err) {
        console.error('Error loading sessions:', err)
        // Use user-friendly error message if available
        error.value = err.userMessage || err.response?.data?.error || err.message || 'Failed to load sessions'
        
        // Additional debugging info
        if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
          console.error('Network error details:', {
            message: err.message,
            code: err.code,
            config: err.config
          })
        }
      } finally {
        loading.value = false
      }
    }

    const loadInvitations = async () => {
      try {
        const { data } = await api.get('/invitations')
        pendingInvitations.value = data.invitations || []
      } catch (err) {
        console.error('Error loading invitations:', err)
        // Don't show error for invitations, just log it
      }
    }

    const showAcceptModal = (invitation) => {
      selectedInvitation.value = invitation
      invitationNickname.value = ''
    }

    const acceptInvitation = async () => {
      if (!selectedInvitation.value) return
      
      accepting.value = true
      error.value = ''
      const sessionId = selectedInvitation.value.session_id

      try {
        const { data } = await api.post(`/invitations/${selectedInvitation.value.id}/accept`, {
          nickname: invitationNickname.value || null
        })
        
        // Reload sessions and invitations
        await loadSessions()
        await loadInvitations()
        
        // Clear modal
        selectedInvitation.value = null
        invitationNickname.value = ''
        
        // Navigate to the session
        router.push(`/session/${sessionId}`)
      } catch (err) {
        error.value = err.response?.data?.error || err.message || 'Failed to accept invitation'
      } finally {
        accepting.value = false
      }
    }

    const declineInvitation = async (invitationId) => {
      if (!confirm('Are you sure you want to decline this invitation?')) {
        return
      }

      try {
        await api.post(`/invitations/${invitationId}/decline`)
        await loadInvitations()
      } catch (err) {
        error.value = err.response?.data?.error || err.message || 'Failed to decline invitation'
      }
    }

    const createSession = async () => {
      creating.value = true
      error.value = ''

      try {
        const { data } = await api.post('/sessions', newSession.value)
        showCreateModal.value = false
        newSession.value = { name: '', description: '' }
        await loadSessions()
      } catch (err) {
        error.value = err.response?.data?.error || 'Failed to create session'
      } finally {
        creating.value = false
      }
    }

    const openSession = (sessionId) => {
      router.push(`/session/${sessionId}`)
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleDateString()
    }

    const getClassSlug = (className) => {
      if (!className) return 'none'
      return className.toLowerCase().replace(/\s+/g, '-')
    }

    const apiUrl = ref('')

    const testConnection = async () => {
      try {
        const url = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`
        apiUrl.value = url
        const response = await fetch(`${url}/api/health`, { 
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache'
        })
        if (response.ok) {
          console.log('Backend connection successful')
          return true
        } else {
          console.error('Backend health check failed:', response.status)
          return false
        }
      } catch (err) {
        console.error('Backend connection test failed:', err)
        const url = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000`
        apiUrl.value = url
        error.value = `Cannot connect to backend server at ${url}. Make sure it's running and accessible.`
        return false
      }
    }

    // Inject dynamically generated badge CSS
    const injectBadgeCSS = () => {
      // Remove existing style tag if it exists
      const existingStyle = document.getElementById('class-badge-styles')
      if (existingStyle) {
        existingStyle.remove()
      }
      
      // Create and inject new style tag
      const style = document.createElement('style')
      style.id = 'class-badge-styles'
      style.textContent = generateBadgeClassCSS()
      document.head.appendChild(style)
    }
    
    onMounted(async () => {
      // Inject badge CSS from config
      injectBadgeCSS()
      // Test connection first
      const connected = await testConnection()
      if (connected) {
        await loadSessions()
        await loadInvitations()
      }
    })

    return {
      sessions,
      loading,
      error,
      showCreateModal,
      creating,
      newSession,
      createSession,
      openSession,
      formatDate,
      getClassSlug,
      apiUrl,
      pendingInvitations,
      selectedInvitation,
      invitationNickname,
      accepting,
      showAcceptModal,
      acceptInvitation,
      declineInvitation
    }
  }
}
</script>

<style scoped>
.dashboard {
  padding: 20px 0;
  min-height: calc(100vh - 80px);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.dashboard-header h1 {
  color: white;
  font-size: 28px;
  margin: 0;
}

.dark-theme .dashboard-header h1 {
  color: var(--text-primary);
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: white;
  font-size: 18px;
}

.dark-theme .empty-state {
  color: var(--text-primary);
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 30px;
  width: 90%;
  max-width: 500px;
}

.modal-content h2 {
  margin-bottom: 20px;
  color: #667eea;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.session-date {
  color: var(--text-tertiary);
  font-size: 14px;
}

.session-players {
  margin: 12px 0;
  min-height: 40px;
}

.player-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 6px 0;
}

.player-item:last-child {
  margin-bottom: 0;
}

.player-name {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
}

.no-players {
  color: #999;
  font-size: 13px;
  font-style: italic;
  padding: 8px 0;
}

.session-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e0e0e0;
}

.invitations-section {
  margin-bottom: 30px;
}

.invitations-section h2 {
  margin-bottom: 20px;
  color: #667eea;
}

.invitations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.invitation-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid #667eea;
}

.invitation-info {
  flex: 1;
}

.invitation-info strong {
  display: block;
  color: #333;
  margin-bottom: 4px;
  font-size: 16px;
}

.invitation-info p {
  color: #666;
  margin: 4px 0;
  font-size: 14px;
}

.invitation-info small {
  color: #999;
  font-size: 12px;
}

.invitation-actions {
  display: flex;
  gap: 8px;
}

/* Class Badge Styles - Dynamically generated from classColorConfig.js */
/* Styles are injected via JavaScript in onMounted hook */
</style>

