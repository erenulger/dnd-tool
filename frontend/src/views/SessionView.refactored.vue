<template>
  <div class="session-view">
    <!-- Floating Note Buttons -->
    <button 
      @click="showPersonalNotes = true" 
      class="floating-note-btn floating-note-btn-left"
      title="My Notes"
    >
      📝
    </button>
    <button 
      @click="showSharedNotes = true" 
      class="floating-note-btn floating-note-btn-right"
      title="Shared Notes"
    >
      📋
    </button>

    <div class="container">
      <div v-if="loading" class="loading">
        Loading session...
        <div style="margin-top: 10px; font-size: 12px; color: #999;">
          If this takes too long, check your connection and try refreshing.
        </div>
      </div>
      
      <div v-if="error" class="error">
        {{ error }}
        <button @click="loadSession" style="margin-top: 10px;" class="btn btn-primary">
          Retry
        </button>
      </div>

      <div v-if="session && !loading" class="session-content">
        <SessionHeader
          :session="session"
          :current-user-member="currentUserMember"
          :get-class-slug="getClassSlug"
          @roll-dice="rollD20"
          @show-dnd-search="showDndSearch = true"
          @show-manage-members="showManageMembers = true"
          @show-nickname-modal="showNicknameModal = true"
          @show-class-modal="showClassModal = true"
        />

        <!-- Two Column Layout -->
        <div class="session-grid">
          <!-- Left Column -->
          <div class="session-column">
            <EnemyStatsWidget 
              :stats="enemyStats"
              @show-all="showManageEnemies = true"
            />
          </div>

          <!-- Right Column -->
          <div class="session-column">
            <QuotesWidget
              :quotes="quotes"
              :current-index="currentQuoteIndex"
              @manage="showManageQuotes = true"
              @select="currentQuoteIndex = $event"
            />

            <!-- Character Sheet Preview (for non-DM players) -->
            <CharacterSheetPreview 
              v-if="!currentUserMember?.is_dm" 
              :session-id="sessionId" 
              class="character-sheet-preview-section"
            />
          </div>

          <!-- Map Section - Spans Both Columns -->
          <MapSection
            :session-id="sessionId"
            :session="session"
            :current-map="currentMap"
            :unshared-map="unsharedMap"
            :is-dm-or-developer="isDmOrDeveloper"
            :uploading="uploading"
            :upload-progress="uploadProgress"
            :sharing-map="sharingMap"
            :show-create-initiative="showCreateInitiative"
            :initiative-table="initiativeTable"
            :current-initiative-pawn-id="currentInitiativePawnId"
            @upload-map="handleFileSelect"
            @share-map="shareMap"
            @unshare-map="unshareMap"
            @show-create-initiative="showCreateInitiative = true"
            @enemy-status-changed="loadEnemyStats"
            @fog-of-war-updated="handleFogOfWarUpdated"
            @pawn-clicked="handlePawnClickForInitiative"
            @prefab-dropped="handlePrefabDrop"
            @set-current-initiative-pawn="setCurrentInitiativePawn"
          />
        </div>
      </div>

      <!-- Pawn Prefab Library (DM only) -->
      <PawnPrefabLibrary
        v-if="isDmOrDeveloper"
        :session-id="sessionId"
        :session-members="session?.members || []"
      />
    </div>

    <!-- Modals -->
    <PersonalNotesModal
      :show="showPersonalNotes"
      :notes="personalNotes"
      :adding="addingPersonalNote"
      :deleting-id="deletingPersonalNoteId"
      @close="showPersonalNotes = false"
      @add="handleAddPersonalNote"
      @delete="deletePersonalNote"
    />

    <SharedNotesModal
      :show="showSharedNotes"
      :notes="sharedNotes"
      :adding="addingSharedNote"
      :deleting-id="deletingSharedNoteId"
      @close="showSharedNotes = false"
      @add="handleAddSharedNote"
      @delete="deleteSharedNote"
    />

    <!-- Other modals would go here - keeping original for now due to complexity -->
    <!-- D&D Search, Class, Nickname, Quotes, Dice, Initiative, Manage Session modals -->
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api, { getApiUrl } from '../lib/api'
import { supabase } from '../lib/supabase'
import MapViewer from '../components/MapViewer.vue'
import PawnPrefabLibrary from '../components/PawnPrefabLibrary.vue'
import CharacterSheetPreview from '../components/CharacterSheetPreview.vue'
import EnemyStatsWidget from '../components/widgets/EnemyStatsWidget.vue'
import QuotesWidget from '../components/widgets/QuotesWidget.vue'
import PersonalNotesModal from '../components/modals/PersonalNotesModal.vue'
import SharedNotesModal from '../components/modals/SharedNotesModal.vue'
import { useNotes } from '../composables/useNotes'
import { useQuotes } from '../composables/useQuotes'
import { useEnemyStats } from '../composables/useEnemyStats'
import { characterClasses, getClassSlug as getClassSlugFromConfig, generateBadgeClassCSS, generateClassOptionCSS } from '../lib/classColorConfig'

// TODO: Extract these into separate components
import SessionHeader from '../components/SessionHeader.vue'
import MapSection from '../components/MapSection.vue'

export default {
  name: 'SessionView',
  components: {
    MapViewer,
    PawnPrefabLibrary,
    CharacterSheetPreview,
    EnemyStatsWidget,
    QuotesWidget,
    PersonalNotesModal,
    SharedNotesModal,
    // SessionHeader,
    // MapSection
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const sessionId = route.params.id
    const session = ref(null)
    const currentMap = ref(null)
    const unsharedMap = ref(null)
    const loading = ref(true)
    const error = ref('')
    const uploading = ref(false)
    const uploadProgress = ref(0)
    const fileInput = ref(null)
    const mapViewerRef = ref(null)
    const sharingMap = ref(false)
    const currentUserId = ref('')
    
    // Modal states
    const showPersonalNotes = ref(false)
    const showSharedNotes = ref(false)
    const showDndSearch = ref(false)
    const showClassModal = ref(false)
    const showNicknameModal = ref(false)
    const showManageQuotes = ref(false)
    const showManageEnemies = ref(false)
    const showManageMembers = ref(false)
    const showCreateInitiative = ref(false)
    
    // Initiative
    const allPawns = ref([])
    const initiativeValues = ref({})
    const initiativeTable = ref([])
    const creatingInitiative = ref(false)
    const currentInitiativePawnId = ref(null)
    const initiativeInputPawn = ref(null)
    const tempInitiativeValue = ref(null)
    
    // Dice
    const diceResult = ref(null)
    const showDiceResult = ref(false)
    
    // Use composables
    const notesComposable = useNotes(sessionId)
    const {
      personalNotes,
      sharedNotes,
      addingPersonalNote,
      addingSharedNote,
      deletingPersonalNoteId,
      deletingSharedNoteId,
      loadPersonalNotes,
      loadSharedNotes,
      addPersonalNote: addPersonalNoteComposable,
      addSharedNote: addSharedNoteComposable,
      deletePersonalNote,
      deleteSharedNote
    } = notesComposable

    const currentUserIdRef = computed(() => currentUserId.value)
    const isDmOrDeveloperComputed = computed(() => session.value?.is_dm || session.value?.is_developer || false)
    
    const quotesComposable = useQuotes(sessionId, currentUserIdRef, isDmOrDeveloperComputed)
    const {
      quotes,
      currentQuoteIndex,
      loadQuotes,
      startQuoteCycle,
      stopQuoteCycle
    } = quotesComposable

    const enemyStatsComposable = useEnemyStats(sessionId)
    const {
      enemyStats,
      loadEnemyStats
    } = enemyStatsComposable

    // Computed properties
    const currentUserMember = computed(() => {
      if (!session.value?.members || !currentUserId.value) return null
      return session.value.members.find(member => member.user_id === currentUserId.value) || null
    })

    const isDmOrDeveloper = computed(() => {
      return session.value?.is_dm || session.value?.is_developer || false
    })

    const getClassSlug = getClassSlugFromConfig

    // Session loading
    const loadSession = async () => {
      loading.value = true
      error.value = ''

      try {
        console.log('Loading session:', sessionId)
        
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            currentUserId.value = user.id
          }
        } catch (authErr) {
          console.error('Error getting user:', authErr)
        }
        
        const { data } = await api.get(`/sessions/${sessionId}`)
        console.log('Session loaded:', data)
        
        if (data && data.session) {
          session.value = data.session
          if (currentUserId.value) {
            session.value.user_id = currentUserId.value
          }
          if (!uploading.value) {
            currentMap.value = null
            unsharedMap.value = null
          }
        } else {
          throw new Error('Invalid session data received')
        }
      } catch (err) {
        console.error('Error loading session:', err)
        if (err.code === 'ECONNABORTED') {
          error.value = 'Request timed out. Please check your connection and try again.'
        } else {
          error.value = err.response?.data?.error || err.message || 'Failed to load session'
        }
      } finally {
        loading.value = false
      }
    }

    // Map functions (simplified - would be in useMaps composable)
    const loadMap = async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}/map`)
        currentMap.value = data.map
        
        if (isDmOrDeveloper.value && !currentMap.value) {
          await loadUnsharedMap()
        } else {
          if (currentMap.value) {
            unsharedMap.value = null
          }
        }
      } catch (err) {
        console.error('Failed to load map:', err)
      }
    }

    const loadUnsharedMap = async () => {
      try {
        const { data: sessionData } = await api.get(`/sessions/${sessionId}`)
        if (sessionData?.session?.current_map_id) {
          const { data: mapData } = await api.get(`/sessions/${sessionId}/map`)
          if (mapData?.map && !mapData.map.shared) {
            unsharedMap.value = mapData.map
          } else {
            unsharedMap.value = null
          }
        }
      } catch (err) {
        console.error('Failed to load unshared map:', err)
      }
    }

    const handleFileSelect = async (event) => {
      const file = event.target.files[0]
      if (file) {
        // Upload logic would go here
        console.log('Upload file:', file)
      }
    }

    const shareMap = async (mapId) => {
      // Share map logic
      console.log('Share map:', mapId)
    }

    const unshareMap = async (mapId) => {
      // Unshare map logic
      console.log('Unshare map:', mapId)
    }

    const handleFogOfWarUpdated = async (fogOfWar) => {
      const map = currentMap.value || unsharedMap.value
      if (map) {
        map.fog_of_war = JSON.stringify(fogOfWar)
        await loadMap()
      }
    }

    const handlePawnClickForInitiative = (pawn) => {
      if (showCreateInitiative.value) {
        initiativeInputPawn.value = pawn
        tempInitiativeValue.value = initiativeValues.value[pawn.id] || null
      }
    }

    const handlePrefabDrop = async (prefabId, xPosition, yPosition) => {
      if (!prefabId || !sessionId) return
      
      try {
        await api.post(`/sessions/${sessionId}/pawns/from-prefab/${prefabId}`, {
          x_position: xPosition,
          y_position: yPosition
        })
        if (mapViewerRef.value && mapViewerRef.value.loadPawns) {
          mapViewerRef.value.loadPawns()
        }
      } catch (err) {
        console.error('Error creating pawn from prefab:', err)
        alert(err.response?.data?.error || 'Failed to create pawn from prefab')
      }
    }

    const setCurrentInitiativePawn = (pawnId) => {
      currentInitiativePawnId.value = pawnId
    }

    const rollD20 = () => {
      const result = Math.floor(Math.random() * 20) + 1
      diceResult.value = result
      showDiceResult.value = true
    }

    const handleAddPersonalNote = async (noteData) => {
      // Set the values and call the composable function
      notesComposable.newPersonalNoteTitle.value = noteData.title || ''
      notesComposable.newPersonalNote.value = noteData.text
      await addPersonalNoteComposable()
    }

    const handleAddSharedNote = async (noteData) => {
      notesComposable.newSharedNoteTitle.value = noteData.title || ''
      notesComposable.newSharedNote.value = noteData.text
      await addSharedNoteComposable()
    }

    // Polling
    let pollInterval = null
    let enemyStatsPollInterval = null

    const startPolling = () => {
      if (!isDmOrDeveloper.value) {
        pollInterval = setInterval(() => {
          loadMap()
        }, 5000)
      }
    }

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
    }

    // CSS injection
    const injectClassCSS = () => {
      const existingBadgeStyle = document.getElementById('class-badge-styles')
      const existingOptionStyle = document.getElementById('class-option-styles')
      if (existingBadgeStyle) existingBadgeStyle.remove()
      if (existingOptionStyle) existingOptionStyle.remove()
      
      const badgeStyle = document.createElement('style')
      badgeStyle.id = 'class-badge-styles'
      badgeStyle.textContent = generateBadgeClassCSS()
      document.head.appendChild(badgeStyle)
      
      const optionStyle = document.createElement('style')
      optionStyle.id = 'class-option-styles'
      optionStyle.textContent = generateClassOptionCSS()
      document.head.appendChild(optionStyle)
    }
    
    onMounted(async () => {
      injectClassCSS()
      await loadSession()
      await loadMap()
      startPolling()
      await loadQuotes()
      await loadEnemyStats()
      await loadPersonalNotes()
      await loadSharedNotes()
      
      enemyStatsPollInterval = setInterval(() => {
        loadEnemyStats()
      }, 5000)
      
      startQuoteCycle()
    })

    onUnmounted(() => {
      stopPolling()
      stopQuoteCycle()
      if (enemyStatsPollInterval) {
        clearInterval(enemyStatsPollInterval)
      }
    })

    return {
      sessionId,
      session,
      currentMap,
      unsharedMap,
      loading,
      error,
      uploading,
      uploadProgress,
      sharingMap,
      currentUserId,
      showPersonalNotes,
      showSharedNotes,
      showDndSearch,
      showClassModal,
      showNicknameModal,
      showManageQuotes,
      showManageEnemies,
      showManageMembers,
      showCreateInitiative,
      allPawns,
      initiativeValues,
      initiativeTable,
      currentInitiativePawnId,
      diceResult,
      showDiceResult,
      personalNotes,
      sharedNotes,
      addingPersonalNote,
      addingSharedNote,
      deletingPersonalNoteId,
      deletingSharedNoteId,
      quotes,
      currentQuoteIndex,
      enemyStats,
      currentUserMember,
      isDmOrDeveloper,
      getClassSlug,
      loadSession,
      handleFileSelect,
      shareMap,
      unshareMap,
      handleFogOfWarUpdated,
      handlePawnClickForInitiative,
      handlePrefabDrop,
      setCurrentInitiativePawn,
      rollD20,
      loadEnemyStats,
      deletePersonalNote,
      deleteSharedNote,
      handleAddPersonalNote,
      handleAddSharedNote
    }
  }
}
</script>

<style scoped>
/* Styles would be moved to component-specific files or shared stylesheets */
.session-view {
  padding: 20px 0;
  min-height: calc(100vh - 80px);
}

.session-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

.session-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.map-section-full-width {
  grid-column: 1 / -1;
  margin-top: 0;
}

@media (max-width: 768px) {
  .session-grid {
    grid-template-columns: 1fr;
  }
  
  .map-section-full-width {
    grid-column: 1;
  }
}

.floating-note-btn {
  position: fixed;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  user-select: none;
}

.floating-note-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

.floating-note-btn:active {
  transform: scale(0.95);
}

.floating-note-btn-left {
  left: 20px;
  bottom: 20px;
}

.floating-note-btn-right {
  right: 20px;
  bottom: 20px;
}

.character-sheet-preview-section {
  margin-bottom: 0;
}
</style>

