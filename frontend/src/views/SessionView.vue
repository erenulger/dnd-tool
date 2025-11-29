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
        <div class="session-header">
          <div>
            <h1>{{ session.name }}</h1>
            <div class="session-players">
              <div 
                v-if="currentUserMember"
                class="player-item"
              >
                <span 
                  class="player-name clickable" 
                  @click="showNicknameModal = true"
                  :title="'Click to change nickname'"
                >
                  {{ currentUserMember.nickname || currentUserMember.users?.email || 'Unknown' }}
                </span>
                <span 
                  v-if="currentUserMember.is_dm" 
                  class="badge badge-dm"
                >
                  DM
                </span>
                <span 
                  v-else-if="currentUserMember.character_class"
                  :class="['badge', 'badge-class', `badge-class-${getClassSlug(currentUserMember.character_class)}`]"
                  @click="showClassModal = true"
                  :title="'Click to change class'"
                  style="cursor: pointer;"
                >
                  {{ currentUserMember.character_class }}
                </span>
                <span 
                  v-else
                  class="badge badge-class badge-class-none clickable"
                  @click="showClassModal = true"
                  :title="'Click to set class'"
                >
                  Set Class
                </span>
              </div>
              <div v-else class="no-players">
                Loading...
              </div>
            </div>
          </div>
          <div class="session-actions">
            <button @click="showDndSearch = true" class="btn btn-primary">
              📚 D&D Reference
            </button>
            <button @click="showManageMembers = true" class="btn btn-primary">
              ⚙️ Manage Session
            </button>
            <button @click="showManageQuotes = true" class="btn btn-primary">
              💬 Manage Quotes
            </button>
          </div>
        </div>

        <!-- Enemy Statistics Widget -->
        <div class="enemy-stats-widget card">
          <div class="enemy-stats-header">
            <h3>⚔️ Enemy Statistics</h3>
            <button @click="showManageEnemies = true" class="btn btn-primary btn-small">
              Show All
            </button>
          </div>
          <div class="enemy-stats-content">
            <div class="stat-item">
              <span class="stat-label">Killed:</span>
              <span class="stat-value">{{ enemyStats.killed }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Fled:</span>
              <span class="stat-value">{{ enemyStats.fled }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Freed:</span>
              <span class="stat-value">{{ enemyStats.freed }}</span>
            </div>
          </div>
        </div>

        <!-- Cycling Quotes Widget -->
        <div class="quotes-widget card">
          <div class="quotes-widget-header">
            <h3>💬 Memorable Quotes</h3>
            <button @click="showManageQuotes = true" class="btn btn-primary btn-small">
              Manage
            </button>
          </div>
          <div class="quotes-cycler">
            <transition name="fade" mode="out-in">
              <div v-if="currentQuote" :key="currentQuoteIndex" class="quote-display">
                <div class="quote-display-text">"{{ currentQuote.quote_text }}"</div>
                <div class="quote-display-author">-<i>{{ currentQuote.author_name }}</i></div>
              </div>
              <div v-else class="quote-display-empty">
                <p>No quotes yet. Click "Manage Quotes" to add one!</p>
              </div>
            </transition>
            <div v-if="quotes.length > 1" class="quote-indicators">
              <span 
                v-for="(quote, index) in quotes" 
                :key="quote.id"
                :class="['quote-indicator', index === currentQuoteIndex ? 'active' : '']"
                @click="currentQuoteIndex = index"
              ></span>
            </div>
          </div>
        </div>

        <!-- Map Section -->
        <div class="card" id="area-map-section">
          <div class="map-section-header">
            <h2 class="area-map-title" @click="scrollToMap">Area Map</h2>
            <!-- DM Upload Button -->
            <button 
              v-if="session.is_dm" 
              @click="triggerFileInput"
              class="btn btn-primary upload-map-btn"
              :disabled="uploading"
            >
              {{ uploading ? `Uploading... ${uploadProgress}%` : '📤 Upload Map' }}
            </button>
          </div>
          
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="file-input"
            @change="handleFileSelect"
            style="display: none;"
          />

          <!-- Map Display -->
          <div v-if="currentMap" class="map-container">
            <MapViewer 
              v-if="session && currentMap"
              :map-url="getMapUrl(currentMap.file_path)"
              :map-name="currentMap.original_filename"
              :session-id="sessionId"
              :is-dm="session.is_dm"
              :current-user-id="session.user_id || ''"
              @enemy-status-changed="loadEnemyStats"
            />
            <p class="map-info">
              {{ currentMap.original_filename }} 
              <span v-if="session.is_dm">• Uploaded {{ formatDate(currentMap.uploaded_at) }}</span>
            </p>
          </div>

          <div v-else class="no-map">
            <p v-if="session.is_dm">No map uploaded yet. Click "Upload Map" to add one.</p>
            <p v-else>No map has been uploaded yet. The DM will upload a map soon!</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Personal Notes Modal -->
  <div v-if="showPersonalNotes" class="notes-modal-overlay" @click.self="showPersonalNotes = false">
    <div class="notes-modal apple-notes-style">
      <div class="notes-modal-header">
        <h2>📝 My Notes</h2>
        <button @click="showPersonalNotes = false" class="notes-close-btn">×</button>
      </div>
      <div class="notes-modal-content">
        <div class="notes-list-apple">
          <div 
            v-for="note in personalNotes" 
            :key="note.id"
            class="note-item-apple"
            :class="`note-color-${note.background_color || 'default'}`"
            :style="getNoteStyle(note.background_color)"
          >
            <div class="note-content-wrapper">
              <div v-if="note.title" class="note-title-apple">{{ note.title }}</div>
              <div class="note-text-apple">{{ note.note_text }}</div>
            </div>
            <button 
              @click="deletePersonalNote(note.id)" 
              class="note-delete-btn-apple"
              :disabled="deletingPersonalNoteId === note.id"
              title="Delete Note"
            >
              ×
            </button>
          </div>
          <div v-if="!personalNotes || personalNotes.length === 0" class="no-notes-apple">
            <p>No notes yet. Start writing below!</p>
          </div>
        </div>
        <div class="add-note-form-apple">
          <input 
            v-model="newPersonalNoteTitle" 
            placeholder="Note title (optional)"
            class="note-title-input-apple"
            maxlength="200"
          />
          <textarea 
            v-model="newPersonalNote" 
            placeholder="Write a note..."
            rows="4"
            class="note-input-apple"
            @keydown.ctrl.enter="addPersonalNote"
            @keydown.meta.enter="addPersonalNote"
          ></textarea>
          <div class="note-color-selector">
            <label>Background Color:</label>
            <div class="color-options">
              <button
                v-for="color in (isDarkTheme ? darkNoteColors : noteColors)"
                :key="color.value"
                @click="newPersonalNoteColor = color.value"
                :class="['color-option', { 'selected': newPersonalNoteColor === color.value }]"
                :style="{ backgroundColor: color.bg, borderColor: newPersonalNoteColor === color.value ? '#667eea' : 'transparent' }"
                :title="color.name"
              ></button>
            </div>
          </div>
          <button 
            @click="addPersonalNote" 
            class="note-add-btn-apple"
            :disabled="addingPersonalNote || !newPersonalNote.trim()"
          >
            {{ addingPersonalNote ? 'Adding...' : 'Add Note' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Shared Notes Modal -->
  <div v-if="showSharedNotes" class="notes-modal-overlay" @click.self="showSharedNotes = false">
    <div class="notes-modal apple-notes-style">
      <div class="notes-modal-header">
        <h2>📋 Shared Notes</h2>
        <button @click="showSharedNotes = false" class="notes-close-btn">×</button>
      </div>
      <div class="notes-modal-content">
        <div class="notes-list-apple">
          <div 
            v-for="note in sharedNotes" 
            :key="note.id"
            class="note-item-apple"
            :class="`note-color-${note.background_color || 'default'}`"
            :style="getNoteStyle(note.background_color)"
          >
            <div class="note-content-wrapper">
              <div v-if="note.title" class="note-title-apple">{{ note.title }}</div>
              <div class="note-text-apple">{{ note.note_text }}</div>
            </div>
            <button 
              @click="deleteSharedNote(note.id)" 
              class="note-delete-btn-apple"
              :disabled="deletingSharedNoteId === note.id"
              title="Delete Note"
            >
              ×
            </button>
          </div>
          <div v-if="!sharedNotes || sharedNotes.length === 0" class="no-notes-apple">
            <p>No shared notes yet. Start writing below!</p>
          </div>
        </div>
        <div class="add-note-form-apple">
          <input 
            v-model="newSharedNoteTitle" 
            placeholder="Note title (optional)"
            class="note-title-input-apple"
            maxlength="200"
          />
          <textarea 
            v-model="newSharedNote" 
            placeholder="Write a shared note..."
            rows="4"
            class="note-input-apple"
            @keydown.ctrl.enter="addSharedNote"
            @keydown.meta.enter="addSharedNote"
          ></textarea>
          <div class="note-color-selector">
            <label>Background Color:</label>
            <div class="color-options">
              <button
                v-for="color in (isDarkTheme ? darkNoteColors : noteColors)"
                :key="color.value"
                @click="newSharedNoteColor = color.value"
                :class="['color-option', { 'selected': newSharedNoteColor === color.value }]"
                :style="{ backgroundColor: color.bg, borderColor: newSharedNoteColor === color.value ? '#667eea' : 'transparent' }"
                :title="color.name"
              ></button>
            </div>
          </div>
          <button 
            @click="addSharedNote" 
            class="note-add-btn-apple"
            :disabled="addingSharedNote || !newSharedNote.trim()"
          >
            {{ addingSharedNote ? 'Adding...' : 'Add Note' }}
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- D&D Reference Search Modal -->
  <div v-if="showDndSearch" class="modal-overlay" @click.self="showDndSearch = false">
          <div class="modal-content dnd-search-modal">
            <div class="modal-header">
              <h2>📚 D&D 5e Reference</h2>
              <button @click="showDndSearch = false" class="modal-close-btn">×</button>
            </div>
            
            <div class="modal-body">
              <div class="dnd-search-tabs">
                <button 
                  v-for="category in dndCategories" 
                  :key="category.key"
                  @click="selectedDndCategory = category.key; searchDndQuery = ''; dndSearchResults = []"
                  :class="['dnd-tab', { 'active': selectedDndCategory === category.key }]"
                >
                  {{ category.label }}
                </button>
              </div>

              <div class="dnd-filter-option">
                <label class="dnd-filter-label">
                  <input 
                    type="checkbox" 
                    v-model="phbOnly"
                    @change="handlePhbFilterChange"
                  />
                  <span>Player's Handbook (2014) Only</span>
                </label>
              </div>

              <div class="dnd-search-box">
                <input 
                  type="text" 
                  v-model="searchDndQuery" 
                  @input="searchDndContent"
                  placeholder="Search for spells, classes, monsters, equipment..."
                  class="dnd-search-input"
                />
                <div v-if="searchingDnd" class="dnd-loading">Searching{{ phbOnly ? ' (PHB only)' : '' }}...</div>
              </div>

              <div v-if="dndSearchError" class="error" style="margin-top: 10px;">{{ dndSearchError }}</div>

              <div v-if="dndSearchResults.length > 0" class="dnd-results">
                <div 
                  v-for="item in dndSearchResults" 
                  :key="item.index"
                  class="dnd-result-item"
                  @click="viewDndItem(item)"
                >
                  <div class="dnd-result-name">{{ item.name }}</div>
                  <div v-if="item.level" class="dnd-result-meta">Level {{ item.level }}</div>
                  <div v-if="item.school" class="dnd-result-meta">{{ item.school.name }}</div>
                  <div v-if="item.hit_points" class="dnd-result-meta">HP: {{ item.hit_points }}</div>
                </div>
              </div>

              <div v-if="selectedDndItem" class="dnd-item-detail">
                <div class="dnd-detail-header">
                  <h3>{{ selectedDndItem.name }}</h3>
                  <button @click="selectedDndItem = null" class="btn btn-secondary btn-small">Back</button>
                </div>
                <div class="dnd-detail-content" v-html="formatDndItem(selectedDndItem)"></div>
              </div>

              <div v-if="!searchingDnd && searchDndQuery && dndSearchResults.length === 0 && !selectedDndItem" class="dnd-no-results">
                No results found. Try a different search term.
              </div>
            </div>
          </div>
  </div>

  <!-- Change Class Modal -->
  <div v-if="showClassModal" class="modal-overlay class-modal-overlay" @click.self="showClassModal = false">
          <div class="modal-content class-modal">
            <div class="modal-header">
              <h2>Choose Character Class</h2>
              <button @click="showClassModal = false" class="modal-close-btn">×</button>
            </div>
            
            <div class="modal-body">
              <div class="class-grid">
                <button
                  v-for="dndClass in dndClasses"
                  :key="dndClass.name"
                  @click="updateClass(dndClass.name)"
                  :class="['class-option', `class-${getClassSlug(dndClass.name)}`, { 'selected': getSelectedMemberClass() === dndClass.name }]"
                  :disabled="updatingClass"
                >
                  <span class="class-name">{{ dndClass.name }}</span>
                </button>
                <button
                  @click="updateClass(null)"
                  :class="['class-option', 'class-none', { 'selected': !getSelectedMemberClass() }]"
                  :disabled="updatingClass"
                >
                  <span class="class-name">None</span>
                </button>
              </div>
              <div v-if="classError" class="error" style="margin-top: 10px;">{{ classError }}</div>
              <div v-if="classSuccess" class="success" style="margin-top: 10px;">{{ classSuccess }}</div>
            </div>
          </div>
  </div>

  <!-- Change Nickname Modal -->
  <div v-if="showNicknameModal" class="modal-overlay" @click.self="showNicknameModal = false">
          <div class="modal-content nickname-modal">
            <div class="modal-header">
              <h2>Change Nickname</h2>
              <button @click="showNicknameModal = false" class="modal-close-btn">×</button>
            </div>
            
            <div class="modal-body">
              <form @submit.prevent="updateNickname">
                <div class="form-group">
                  <label>Nickname</label>
                  <input 
                    type="text" 
                    v-model="newNickname" 
                    placeholder="Enter your nickname for this session"
                    maxlength="100"
                    required
                  />
                  <small>This nickname will be visible to other session members</small>
                </div>
                <div v-if="nicknameError" class="error" style="margin-top: 10px;">{{ nicknameError }}</div>
                <div v-if="nicknameSuccess" class="success" style="margin-top: 10px;">{{ nicknameSuccess }}</div>
                <div class="modal-actions">
                  <button type="button" @click="showNicknameModal = false" class="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" class="btn btn-primary" :disabled="updatingNickname">
                    {{ updatingNickname ? 'Updating...' : 'Update Nickname' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
  </div>

  <!-- Delete Quote Confirmation Modal -->
  <div v-if="quoteToDelete" class="modal-overlay delete-quote-modal-overlay" @click.self="quoteToDelete = null">
          <div class="modal-content" @click.stop>
            <h3>Confirm Quote Deletion</h3>
            <p class="delete-warning">
              Are you sure you want to delete this quote?
            </p>
            <div v-if="quoteToDelete" class="quote-preview">
              <div class="quote-text">"{{ quoteToDelete.quote_text }}"</div>
              <div class="quote-author">-<i>{{ quoteToDelete.author_name }}</i></div>
            </div>
            <p class="delete-warning" style="margin-top: 12px;">
              This action cannot be undone.
            </p>
            <div class="modal-actions">
              <button type="button" @click="quoteToDelete = null" class="btn btn-secondary" :disabled="deletingQuoteId === quoteToDelete?.id">
                Cancel
              </button>
              <button type="button" @click="confirmDeleteQuote" class="btn btn-danger" :disabled="deletingQuoteId === quoteToDelete?.id">
                {{ deletingQuoteId === quoteToDelete?.id ? 'Deleting...' : 'Delete Quote' }}
              </button>
            </div>
          </div>
  </div>

  <!-- Manage Quotes Modal -->
  <div v-if="showManageQuotes" class="modal-overlay" @click.self="showManageQuotes = false">
          <div class="modal-content quotes-modal">
            <div class="modal-header">
              <h2>💬 Manage Memorable Quotes</h2>
              <button @click="showManageQuotes = false" class="modal-close-btn">×</button>
            </div>
            
            <div class="modal-body">
              <div class="quotes-content">
                <div class="quotes-list">
                  <div 
                    v-for="quote in quotes" 
                    :key="quote.id"
                    class="quote-item"
                  >
                    <div class="quote-content">
                      <div class="quote-text">"{{ quote.quote_text }}"</div>
                      <div class="quote-author">-<i>{{ quote.author_name }}</i></div>
                    </div>
                    <button 
                      type="button"
                      @click.stop="quoteToDelete = quote" 
                      class="btn btn-danger btn-small quote-delete-btn"
                      :disabled="deletingQuoteId === quote.id"
                      title="Delete Quote"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div v-if="quotes.length === 0" class="no-quotes">
                    <p>No quotes yet. Add the first memorable quote!</p>
                  </div>
                </div>
                
                <div class="add-quote-form">
                  <h3>Add New Quote</h3>
                  <form @submit.prevent="addQuote">
                    <div class="form-group">
                      <label>Quote</label>
                      <textarea 
                        v-model="newQuote.text" 
                        placeholder="Enter the memorable quote..."
                        rows="3"
                        required
                        maxlength="500"
                      ></textarea>
                    </div>
                    <div class="form-group">
                      <label>Author Name</label>
                      <input 
                        type="text" 
                        v-model="newQuote.author" 
                        placeholder="Character or player name"
                        required
                        maxlength="100"
                      />
                    </div>
                    <button type="submit" class="btn btn-primary" :disabled="addingQuote">
                      {{ addingQuote ? 'Adding...' : 'Add Quote' }}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
  </div>

  <!-- Manage Session Modal -->
  <div v-if="showManageMembers" class="modal-overlay" @click.self="showManageMembers = false">
          <div class="modal-content members-modal">
            <div class="modal-header">
              <h2>⚙️ Manage Session</h2>
              <button @click="showManageMembers = false" class="modal-close-btn">×</button>
            </div>
            
            <div class="modal-body">
              <!-- Invite Section (DM only) -->
              <div v-if="session.is_dm" class="invite-section">
                <h3>Invite Players</h3>
                <form @submit.prevent="sendInvitation" class="invite-form">
                  <div class="form-group">
                    <label>Email Address</label>
                    <div class="invite-input-group">
                      <input 
                        type="email" 
                        v-model="inviteEmail" 
                        placeholder="player@example.com"
                        required
                      />
                      <button type="submit" class="btn btn-primary" :disabled="inviting">
                        {{ inviting ? 'Sending...' : 'Send Invitation' }}
                      </button>
                    </div>
                  </div>
                </form>
                <div v-if="inviteError" class="error" style="margin-top: 10px;">{{ inviteError }}</div>
                <div v-if="inviteSuccess" class="success" style="margin-top: 10px;">{{ inviteSuccess }}</div>
              </div>

              <!-- Members Section -->
              <div class="members-section">
                <h3>Session Members</h3>
                <div class="members-list">
                  <div 
                    v-for="member in session.members" 
                    :key="member.user_id"
                    class="member-item"
                  >
                    <div class="member-info">
                      <span 
                        v-if="member.is_dm" 
                        class="badge badge-dm"
                      >
                        DM
                      </span>
                      <span 
                        v-else-if="member.character_class"
                        :class="['badge', 'badge-class', `badge-class-${getClassSlug(member.character_class)}`]"
                        @click="session.is_dm && showClassModalForMember(member.user_id)"
                        :style="session.is_dm ? 'cursor: pointer;' : ''"
                        :title="session.is_dm ? 'Click to change class' : ''"
                      >
                        {{ member.character_class }}
                      </span>
                      <span 
                        v-else
                        class="badge badge-class badge-class-none"
                        @click="session.is_dm && showClassModalForMember(member.user_id)"
                        :style="session.is_dm ? 'cursor: pointer;' : ''"
                        :title="session.is_dm ? 'Click to set class' : ''"
                      >
                        No Class
                      </span>
                      <span>
                        {{ member.nickname || member.users?.email || 'Unknown' }}
                        <small v-if="member.nickname" style="color: #999; margin-left: 8px;">
                          ({{ member.users?.email }})
                        </small>
                      </span>
                    </div>
                    <button 
                      v-if="session.is_dm && !member.is_dm"
                      @click="transferDM(member.user_id)"
                      class="btn btn-primary"
                      style="padding: 6px 12px; font-size: 14px;"
                    >
                      Transfer DM
                    </button>
                  </div>
                </div>
              </div>

              <!-- Delete Session Section (DM only) -->
              <div v-if="session.is_dm" class="delete-session-section">
                <h3>Danger Zone</h3>
                <div class="delete-session-warning">
                  <p><strong>Warning:</strong> Deleting this session is permanent and cannot be undone.</p>
                  <p>This will delete all maps, pawns, quotes, and member data associated with this session.</p>
                  <p>To confirm, type the session name <strong>"{{ session.name }}"</strong> below:</p>
                  <div class="delete-confirmation-input">
                    <input 
                      type="text" 
                      v-model="deleteConfirmation" 
                      placeholder="Type session name to confirm"
                      class="delete-input"
                    />
                  </div>
                  <button 
                    @click="deleteSession" 
                    class="btn btn-danger"
                    :disabled="deleting || deleteConfirmation !== session.name"
                  >
                    {{ deleting ? 'Deleting...' : '🗑️ Delete Session' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../lib/api'
import { supabase } from '../lib/supabase'
import MapViewer from '../components/MapViewer.vue'

export default {
  name: 'SessionView',
  components: {
    MapViewer
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const sessionId = route.params.id
    const session = ref(null)
    const currentMap = ref(null)
    const loading = ref(true)
    const error = ref('')
    const uploading = ref(false)
    const uploadProgress = ref(0)
    const fileInput = ref(null)
    const inviteEmail = ref('')
    const inviting = ref(false)
    const inviteError = ref('')
    const inviteSuccess = ref('')
    const showManageMembers = ref(false)
    const showManageQuotes = ref(false)
    const showManageEnemies = ref(false)
    const quotes = ref([])
    const deletingQuoteId = ref(null)
    const quoteToDelete = ref(null)
    const enemies = ref([])
    const personalNotes = ref([])
    const sharedNotes = ref([])
    const newPersonalNote = ref('')
    const newPersonalNoteTitle = ref('')
    const newPersonalNoteColor = ref('default')
    const newSharedNote = ref('')
    const newSharedNoteTitle = ref('')
    const newSharedNoteColor = ref('default')
    
    const noteColors = [
      { value: 'default', name: 'Default', bg: '#ffffff', text: '#000000' },
      { value: 'yellow', name: 'Yellow', bg: '#fef3c7', text: '#78350f' },
      { value: 'green', name: 'Green', bg: '#d1fae5', text: '#065f46' },
      { value: 'blue', name: 'Blue', bg: '#dbeafe', text: '#1e3a8a' },
      { value: 'pink', name: 'Pink', bg: '#fce7f3', text: '#831843' },
      { value: 'purple', name: 'Purple', bg: '#e9d5ff', text: '#581c87' },
      { value: 'orange', name: 'Orange', bg: '#fed7aa', text: '#7c2d12' }
    ]
    
    const darkNoteColors = [
      { value: 'default', name: 'Default', bg: '#2d2d2f', text: '#f5f5f7' },
      { value: 'yellow', name: 'Yellow', bg: '#4a3d1f', text: '#fef3c7' },
      { value: 'green', name: 'Green', bg: '#1a3a2e', text: '#d1fae5' },
      { value: 'blue', name: 'Blue', bg: '#1e2a3a', text: '#dbeafe' },
      { value: 'pink', name: 'Pink', bg: '#3a1a2a', text: '#fce7f3' },
      { value: 'purple', name: 'Purple', bg: '#2a1a3a', text: '#e9d5ff' },
      { value: 'orange', name: 'Orange', bg: '#3a2a1a', text: '#fed7aa' }
    ]
    
    const getNoteStyle = (color) => {
      if (!color || color === 'default') return {}
      
      const colors = isDarkTheme.value ? darkNoteColors : noteColors
      const colorObj = colors.find(c => c.value === color) || colors[0]
      
      return {
        backgroundColor: colorObj.bg,
        color: colorObj.text
      }
    }
    
    const isDarkTheme = computed(() => {
      return document.documentElement.classList.contains('dark-theme')
    })
    const addingPersonalNote = ref(false)
    const addingSharedNote = ref(false)
    const deletingPersonalNoteId = ref(null)
    const deletingSharedNoteId = ref(null)
    const showPersonalNotes = ref(false)
    const showSharedNotes = ref(false)
    const enemyStats = ref({
      killed: 0,
      fled: 0,
      freed: 0,
      total: 0
    })
    const addingQuote = ref(false)
    const newQuote = ref({
      text: '',
      author: ''
    })
    const currentQuoteIndex = ref(0)
    const deleting = ref(false)
    const deleteConfirmation = ref('')
    const currentUserId = ref('')
    const showNicknameModal = ref(false)
    const newNickname = ref('')
    const updatingNickname = ref(false)
    const nicknameError = ref('')
    const nicknameSuccess = ref('')
    const showClassModal = ref(false)
    const updatingClass = ref(false)
    const classError = ref('')
    const classSuccess = ref('')
    const targetUserIdForClass = ref(null) // null = current user, otherwise target user ID
    const showDndSearch = ref(false)
    const selectedDndCategory = ref('spells')
    const searchDndQuery = ref('')
    const dndSearchResults = ref([])
    const searchingDnd = ref(false)
    const dndSearchError = ref('')
    const selectedDndItem = ref(null)
    const phbOnly = ref(true) // Filter to Player's Handbook only
    const dndCategories = [
      { key: 'spells', label: 'Spells' },
      { key: 'classes', label: 'Classes' },
      { key: 'monsters', label: 'Monsters' },
      { key: 'equipment', label: 'Equipment' },
      { key: 'features', label: 'Features' }
    ]
    const dndClasses = [
      { name: 'Barbarian', color: '#8B4513' },
      { name: 'Bard', color: '#9370DB' },
      { name: 'Cleric', color: '#FFD700' },
      { name: 'Druid', color: '#228B22' },
      { name: 'Fighter', color: '#C0C0C0' },
      { name: 'Monk', color: '#FFA500' },
      { name: 'Paladin', color: '#FFD700' },
      { name: 'Ranger', color: '#228B22' },
      { name: 'Rogue', color: '#2F2F2F' },
      { name: 'Sorcerer', color: '#4B0082' },
      { name: 'Warlock', color: '#8B008B' },
      { name: 'Wizard', color: '#4169E1' }
    ]
    let pollInterval = null
    let quotesPollInterval = null
    let enemyStatsPollInterval = null
    let quoteCycleInterval = null

    const loadSession = async () => {
      loading.value = true
      error.value = ''

      try {
        console.log('Loading session:', sessionId)
        
        // Get current user ID first (before API call)
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
          currentMap.value = data.session.current_map
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

    const loadMap = async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}/map`)
        currentMap.value = data.map
      } catch (err) {
        console.error('Failed to load map:', err)
      }
    }

    const triggerFileInput = () => {
      fileInput.value?.click()
    }

    const handleFileSelect = async (event) => {
      const file = event.target.files[0]
      if (file) {
        await uploadMap(file)
      }
    }

    const uploadMap = async (file) => {
      if (!session.value?.is_dm) {
        error.value = 'Only the DM can upload maps'
        return
      }

      uploading.value = true
      uploadProgress.value = 0
      error.value = ''

      try {
        const formData = new FormData()
        formData.append('map', file)

        const { data } = await api.post(
          `/sessions/${sessionId}/maps`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
              uploadProgress.value = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              )
            }
          }
        )

        currentMap.value = data.map
        uploadProgress.value = 100
        
        // Reload session to get updated map
        await loadSession()
        
        // Reset file input
        if (fileInput.value) {
          fileInput.value.value = ''
        }
      } catch (err) {
        console.error('Upload error:', err)
        error.value = err.response?.data?.error || err.message || 'Failed to upload map'
      } finally {
        uploading.value = false
        setTimeout(() => {
          uploadProgress.value = 0
        }, 1000)
      }
    }

    const transferDM = async (newDmUserId) => {
      if (!confirm('Are you sure you want to transfer DM role to this user?')) {
        return
      }

      try {
        await api.post(`/sessions/${sessionId}/transfer-dm`, {
          newDmUserId
        })
        
        await loadSession()
        // Modal will stay open to show updated member list
      } catch (err) {
        error.value = err.response?.data?.error || 'Failed to transfer DM role'
      }
    }

    const getMapUrl = (filePath) => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      return `${apiUrl}${filePath}`
    }

    const handleImageError = () => {
      error.value = 'Failed to load map image'
    }

    const formatDate = (dateString) => {
      return new Date(dateString).toLocaleString()
    }

    const loadQuotes = async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}/quotes`)
        quotes.value = data.quotes || []
      } catch (err) {
        console.error('Error loading quotes:', err)
      }
    }

    const loadEnemyStats = async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}/enemies`)
        enemies.value = data.enemies || []
        enemyStats.value = data.stats || { killed: 0, fled: 0, freed: 0, total: 0 }
      } catch (err) {
        console.error('Error loading enemy stats:', err)
      }
    }

    const addQuote = async () => {
      addingQuote.value = true
      error.value = ''

      try {
        const { data } = await api.post(`/sessions/${sessionId}/quotes`, {
          quote_text: newQuote.value.text,
          author_name: newQuote.value.author
        })
        
        newQuote.value = { text: '', author: '' }
        await loadQuotes()
        // Modal stays open to show new quote
      } catch (err) {
        error.value = err.response?.data?.error || err.message || 'Failed to add quote'
      } finally {
        addingQuote.value = false
      }
    }

    const confirmDeleteQuote = async () => {
      if (!quoteToDelete.value) {
        return
      }

      const quoteId = quoteToDelete.value.id
      deletingQuoteId.value = quoteId

      try {
        await api.delete(`/quotes/${quoteId}`)
        await loadQuotes()
        quoteToDelete.value = null
        // Reset quote index if needed
        if (currentQuoteIndex.value >= quotes.value.length && quotes.value.length > 0) {
          currentQuoteIndex.value = 0
        }
      } catch (err) {
        console.error('Error deleting quote:', err)
        alert(err.response?.data?.error || 'Failed to delete quote')
      } finally {
        deletingQuoteId.value = null
      }
    }

    const scrollToMap = () => {
      const mapSection = document.getElementById('area-map-section')
      if (mapSection) {
        mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    const loadPersonalNotes = async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}/personal-notes`)
        personalNotes.value = data.notes || []
      } catch (err) {
        console.error('Error loading personal notes:', err)
      }
    }

    const loadSharedNotes = async () => {
      try {
        const { data } = await api.get(`/sessions/${sessionId}/shared-notes`)
        sharedNotes.value = data.notes || []
      } catch (err) {
        console.error('Error loading shared notes:', err)
      }
    }

    const addPersonalNote = async () => {
      if (!newPersonalNote.value.trim()) {
        return
      }

      addingPersonalNote.value = true

      try {
        await api.post(`/sessions/${sessionId}/personal-notes`, {
          note_text: newPersonalNote.value.trim()
        })
        newPersonalNote.value = ''
        await loadPersonalNotes()
      } catch (err) {
        console.error('Error adding personal note:', err)
        alert(err.response?.data?.error || 'Failed to add note')
      } finally {
        addingPersonalNote.value = false
      }
    }

    const addSharedNote = async () => {
      if (!newSharedNote.value.trim()) {
        return
      }

      addingSharedNote.value = true

      try {
        await api.post(`/sessions/${sessionId}/shared-notes`, {
          title: newSharedNoteTitle.value.trim() || null,
          note_text: newSharedNote.value.trim(),
          background_color: newSharedNoteColor.value
        })
        newSharedNote.value = ''
        newSharedNoteTitle.value = ''
        newSharedNoteColor.value = 'default'
        await loadSharedNotes()
      } catch (err) {
        console.error('Error adding shared note:', err)
        alert(err.response?.data?.error || 'Failed to add note')
      } finally {
        addingSharedNote.value = false
      }
    }

    const deletePersonalNote = async (noteId) => {
      if (!confirm('Are you sure you want to delete this note?')) {
        return
      }

      deletingPersonalNoteId.value = noteId

      try {
        await api.delete(`/personal-notes/${noteId}`)
        await loadPersonalNotes()
      } catch (err) {
        console.error('Error deleting personal note:', err)
        alert(err.response?.data?.error || 'Failed to delete note')
      } finally {
        deletingPersonalNoteId.value = null
      }
    }

    const deleteSharedNote = async (noteId) => {
      if (!confirm('Are you sure you want to delete this note?')) {
        return
      }

      deletingSharedNoteId.value = noteId

      try {
        await api.delete(`/shared-notes/${noteId}`)
        await loadSharedNotes()
      } catch (err) {
        console.error('Error deleting shared note:', err)
        alert(err.response?.data?.error || 'Failed to delete note')
      } finally {
        deletingSharedNoteId.value = null
      }
    }

    const updateNickname = async () => {
      updatingNickname.value = true
      nicknameError.value = ''
      nicknameSuccess.value = ''

      try {
        const { data } = await api.put(`/sessions/${sessionId}/nickname`, {
          nickname: newNickname.value.trim() || null
        })
        
        nicknameSuccess.value = 'Nickname updated successfully!'
        
        // Reload session to get updated member info
        await loadSession()
        
        // Clear success message and close modal after 1.5 seconds
        setTimeout(() => {
          nicknameSuccess.value = ''
          showNicknameModal.value = false
          newNickname.value = ''
        }, 1500)
      } catch (err) {
        nicknameError.value = err.response?.data?.error || err.message || 'Failed to update nickname'
      } finally {
        updatingNickname.value = false
      }
    }

    // Watch for modal opening to set initial nickname value
    watch(showNicknameModal, (isOpen) => {
      if (isOpen && currentUserMember.value) {
        newNickname.value = currentUserMember.value.nickname || ''
      }
    })

    const getClassSlug = (className) => {
      if (!className) return 'none'
      return className.toLowerCase().replace(/\s+/g, '-')
    }

    const showClassModalForMember = (userId) => {
      targetUserIdForClass.value = userId
      showClassModal.value = true
    }

    const getSelectedMemberClass = () => {
      if (targetUserIdForClass.value) {
        // DM is editing another member's class
        const member = session.value?.members?.find(m => m.user_id === targetUserIdForClass.value)
        return member?.character_class || null
      } else {
        // Current user editing their own class
        return currentUserMember.value?.character_class || null
      }
    }

    // Handle PHB filter change
    const handlePhbFilterChange = () => {
      if (searchDndQuery.value && searchDndQuery.value.length >= 2) {
        searchDndContent()
      }
    }

    // D&D 5e API Search Functions
    const searchDndContent = async () => {
      if (!searchDndQuery.value || searchDndQuery.value.length < 2) {
        dndSearchResults.value = []
        return
      }

      searchingDnd.value = true
      dndSearchError.value = ''
      dndSearchResults.value = []

      try {
        const category = selectedDndCategory.value
        const response = await fetch(`https://www.dnd5eapi.co/api/${category}`)
        const data = await response.json()
        
        if (data.results) {
          // Filter results by search query first
          let filtered = data.results.filter(item => 
            item.name.toLowerCase().includes(searchDndQuery.value.toLowerCase())
          )
          
          // If PHB only is enabled, filter by source
          if (phbOnly.value) {
            const phbFiltered = []
            
            // Check each item's source (limit to 40 for performance)
            const itemsToCheck = filtered.slice(0, 40)
            
            for (const item of itemsToCheck) {
              try {
                const itemResponse = await fetch(`https://www.dnd5eapi.co${item.url}`)
                const itemData = await itemResponse.json()
                
                // Check if item is from Player's Handbook 2014 (not 2024)
                // Exclude 2024 version explicitly
                const source = (itemData.document__slug || itemData.document_slug || '').toLowerCase()
                const title = (itemData.document__title || itemData.document_title || '').toLowerCase()
                const sourceField = (itemData.source || '').toLowerCase()
                
                // Debug: log first item to see structure
                if (phbFiltered.length === 0) {
                  console.log('Sample item data:', {
                    name: itemData.name,
                    document__slug: itemData.document__slug,
                    document_slug: itemData.document_slug,
                    document__title: itemData.document__title,
                    document_title: itemData.document_title,
                    source: itemData.source,
                    fullData: itemData
                  })
                }
                
                // Check for 2024 version - exclude these
                const is2024 = source.includes('2024') || 
                              title.includes('2024') || 
                              sourceField.includes('2024') ||
                              source.includes('phb24') ||
                              title.includes('phb24') ||
                              source.includes('phb-2024') ||
                              title.includes('phb-2024')
                
                if (is2024) {
                  continue // Skip 2024 version
                }
                
                // Check for PHB 2014 or SRD (which is from PHB 2014)
                // SRD content is from PHB 2014, so include it
                // Also include items that don't have source info (likely SRD/PHB 2014)
                const isPHB = source === 'wotc-srd' || // SRD is from PHB 2014
                             source === 'srd' ||
                             (!source && !title && !sourceField) || // No source info = likely SRD/PHB 2014
                             (source.includes('phb') && !source.includes('2024') && !source.includes('24')) ||
                             (title.includes("player's handbook") && !title.includes('2024') && !title.includes('24')) ||
                             (title.includes('phb') && !title.includes('2024') && !title.includes('24')) ||
                             (sourceField.includes("player's handbook") && !sourceField.includes('2024') && !sourceField.includes('24')) ||
                             (sourceField.includes('phb') && !sourceField.includes('2024') && !sourceField.includes('24'))
                
                if (isPHB) {
                  phbFiltered.push(item)
                }
              } catch (err) {
                console.error(`Error checking source for ${item.name}:`, err)
                // Skip items we can't verify (strict PHB filter)
              }
              
              // Limit to 20 results for performance
              if (phbFiltered.length >= 20) break
            }
            
            dndSearchResults.value = phbFiltered
            
            // If no results and we have filtered items, show a message
            if (phbFiltered.length === 0 && filtered.length > 0) {
              console.warn('No PHB 2014 results found. Try disabling the filter or check console for item structure.')
            }
          } else {
            // No PHB filter, just limit results
            dndSearchResults.value = filtered.slice(0, 20)
          }
        }
      } catch (err) {
        console.error('D&D API search error:', err)
        dndSearchError.value = 'Failed to search D&D content. Please try again.'
      } finally {
        searchingDnd.value = false
      }
    }

    const viewDndItem = async (item) => {
      try {
        const response = await fetch(`https://www.dnd5eapi.co${item.url}`)
        const data = await response.json()
        selectedDndItem.value = data
      } catch (err) {
        console.error('D&D API fetch error:', err)
        dndSearchError.value = 'Failed to load item details. Please try again.'
      }
    }

    const formatDndItem = (item) => {
      let html = ''
      
      if (item.desc) {
        html += `<div class="dnd-desc">${item.desc.join('<br><br>')}</div>`
      }
      
      if (item.higher_level) {
        html += `<div class="dnd-higher-level"><strong>At Higher Levels:</strong> ${item.higher_level.join('<br>')}</div>`
      }
      
      if (item.range) {
        html += `<div class="dnd-stat"><strong>Range:</strong> ${item.range}</div>`
      }
      
      if (item.components) {
        html += `<div class="dnd-stat"><strong>Components:</strong> ${item.components.join(', ')}</div>`
      }
      
      if (item.material) {
        html += `<div class="dnd-stat"><strong>Material:</strong> ${item.material}</div>`
      }
      
      if (item.ritual !== undefined) {
        html += `<div class="dnd-stat"><strong>Ritual:</strong> ${item.ritual ? 'Yes' : 'No'}</div>`
      }
      
      if (item.concentration !== undefined) {
        html += `<div class="dnd-stat"><strong>Concentration:</strong> ${item.concentration ? 'Yes' : 'No'}</div>`
      }
      
      if (item.duration) {
        html += `<div class="dnd-stat"><strong>Duration:</strong> ${item.duration}</div>`
      }
      
      if (item.casting_time) {
        html += `<div class="dnd-stat"><strong>Casting Time:</strong> ${item.casting_time}</div>`
      }
      
      if (item.level) {
        html += `<div class="dnd-stat"><strong>Level:</strong> ${item.level}</div>`
      }
      
      if (item.school) {
        html += `<div class="dnd-stat"><strong>School:</strong> ${item.school.name}</div>`
      }
      
      if (item.hit_points) {
        html += `<div class="dnd-stat"><strong>Hit Points:</strong> ${item.hit_points}</div>`
      }
      
      if (item.armor_class) {
        html += `<div class="dnd-stat"><strong>Armor Class:</strong> ${item.armor_class[0]?.value || item.armor_class[0]?.armor?.[0]?.value || 'N/A'}</div>`
      }
      
      if (item.speed) {
        html += `<div class="dnd-stat"><strong>Speed:</strong> ${typeof item.speed === 'object' ? JSON.stringify(item.speed) : item.speed}</div>`
      }
      
      if (item.strength !== undefined) {
        html += `<div class="dnd-stat"><strong>STR:</strong> ${item.strength}</div>`
      }
      
      if (item.dexterity !== undefined) {
        html += `<div class="dnd-stat"><strong>DEX:</strong> ${item.dexterity}</div>`
      }
      
      if (item.constitution !== undefined) {
        html += `<div class="dnd-stat"><strong>CON:</strong> ${item.constitution}</div>`
      }
      
      if (item.intelligence !== undefined) {
        html += `<div class="dnd-stat"><strong>INT:</strong> ${item.intelligence}</div>`
      }
      
      if (item.wisdom !== undefined) {
        html += `<div class="dnd-stat"><strong>WIS:</strong> ${item.wisdom}</div>`
      }
      
      if (item.charisma !== undefined) {
        html += `<div class="dnd-stat"><strong>CHA:</strong> ${item.charisma}</div>`
      }
      
      if (item.actions) {
        html += `<div class="dnd-actions"><strong>Actions:</strong><ul>`
        item.actions.forEach(action => {
          html += `<li><strong>${action.name}:</strong> ${action.desc || action.attack_bonus || ''}</li>`
        })
        html += `</ul></div>`
      }
      
      if (item.equipment_category) {
        html += `<div class="dnd-stat"><strong>Category:</strong> ${item.equipment_category.name}</div>`
      }
      
      if (item.gear_category) {
        html += `<div class="dnd-stat"><strong>Gear Category:</strong> ${item.gear_category.name}</div>`
      }
      
      if (item.cost) {
        html += `<div class="dnd-stat"><strong>Cost:</strong> ${item.cost.quantity} ${item.cost.unit}</div>`
      }
      
      if (item.weight) {
        html += `<div class="dnd-stat"><strong>Weight:</strong> ${item.weight} lbs</div>`
      }
      
      if (item.damage) {
        html += `<div class="dnd-stat"><strong>Damage:</strong> ${item.damage.damage_dice} ${item.damage.damage_type.name}</div>`
      }
      
      if (item.properties) {
        html += `<div class="dnd-stat"><strong>Properties:</strong> ${item.properties.map(p => p.name).join(', ')}</div>`
      }
      
      return html || '<div class="dnd-no-detail">No additional details available.</div>'
    }

    const updateClass = async (className) => {
      updatingClass.value = true
      classError.value = ''
      classSuccess.value = ''

      try {
        const { data } = await api.put(`/sessions/${sessionId}/class`, {
          characterClass: className,
          targetUserId: targetUserIdForClass.value
        })
        
        classSuccess.value = 'Character class updated successfully!'
        
        // Reload session to get updated member info
        await loadSession()
        
        // Clear success message and close modal after 1.5 seconds
        setTimeout(() => {
          classSuccess.value = ''
          showClassModal.value = false
          targetUserIdForClass.value = null
        }, 1500)
      } catch (err) {
        classError.value = err.response?.data?.error || err.message || 'Failed to update character class'
      } finally {
        updatingClass.value = false
      }
    }

    // Watch for class modal opening - reset target user
    watch(showClassModal, (isOpen) => {
      if (!isOpen) {
        targetUserIdForClass.value = null
      }
    })

    // Computed property for current quote
    const currentQuote = computed(() => {
      if (quotes.value.length === 0) return null
      return quotes.value[currentQuoteIndex.value % quotes.value.length]
    })

    // Computed property for current user's member info
    const currentUserMember = computed(() => {
      if (!session.value?.members || !currentUserId.value) return null
      return session.value.members.find(member => member.user_id === currentUserId.value) || null
    })

    // Cycle through quotes automatically
    const startQuoteCycle = () => {
      if (quotes.value.length <= 1) return
      
      quoteCycleInterval = setInterval(() => {
        currentQuoteIndex.value = (currentQuoteIndex.value + 1) % quotes.value.length
      }, 5000) // Change quote every 5 seconds
    }

    const stopQuoteCycle = () => {
      if (quoteCycleInterval) {
        clearInterval(quoteCycleInterval)
        quoteCycleInterval = null
      }
    }

    // Watch quotes to restart cycle when quotes change
    watch(quotes, (newQuotes) => {
      if (newQuotes.length > 0 && currentQuoteIndex.value >= newQuotes.length) {
        currentQuoteIndex.value = 0
      }
      stopQuoteCycle()
      startQuoteCycle()
    }, { immediate: true })

    const sendInvitation = async () => {
      if (!session.value?.is_dm) {
        inviteError.value = 'Only the DM can send invitations'
        return
      }

      inviting.value = true
      inviteError.value = ''
      inviteSuccess.value = ''

      try {
        const { data } = await api.post(`/sessions/${sessionId}/invite`, {
          email: inviteEmail.value
        })
        
        inviteSuccess.value = `Invitation sent to ${inviteEmail.value}!`
        inviteEmail.value = ''
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          inviteSuccess.value = ''
        }, 3000)
      } catch (err) {
        inviteError.value = err.response?.data?.error || err.message || 'Failed to send invitation'
      } finally {
        inviting.value = false
      }
    }

    const deleteSession = async () => {
      if (!session.value?.is_dm) {
        error.value = 'Only the session owner can delete the session'
        return
      }

      // Verify confirmation matches session name
      if (deleteConfirmation.value !== session.value.name) {
        error.value = 'Session name does not match. Please type the exact session name to confirm deletion.'
        return
      }

      deleting.value = true
      error.value = ''

      try {
        await api.delete(`/sessions/${sessionId}`)
        
        // Redirect to dashboard after successful deletion
        router.push('/dashboard')
      } catch (err) {
        console.error('Delete session error:', err)
        error.value = err.response?.data?.error || err.message || 'Failed to delete session'
        deleting.value = false
      }
    }

    // Poll for map updates (for non-DM users)
    const startPolling = () => {
      if (!session.value?.is_dm) {
        pollInterval = setInterval(() => {
          loadMap()
        }, 5000) // Poll every 5 seconds
      }
    }

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }
    }

    onMounted(async () => {
      await loadSession()
      startPolling()
      await loadQuotes()
      await loadEnemyStats()
      await loadPersonalNotes()
      await loadSharedNotes()
      
      // Poll for new quotes every 3 seconds
      quotesPollInterval = setInterval(() => {
        loadQuotes()
      }, 3000)
      
      // Poll for enemy stats every 5 seconds
      enemyStatsPollInterval = setInterval(() => {
        loadEnemyStats()
      }, 5000)
      
      // Poll for notes every 3 seconds
      const notesPollInterval = setInterval(() => {
        loadPersonalNotes()
        loadSharedNotes()
      }, 3000)
      
      // Store interval for cleanup
      onUnmounted(() => {
        if (notesPollInterval) {
          clearInterval(notesPollInterval)
        }
      })
      
      // Start cycling quotes
      startQuoteCycle()
    })

    onUnmounted(() => {
      stopPolling()
      stopQuoteCycle()
      if (quotesPollInterval) {
        clearInterval(quotesPollInterval)
      }
      if (enemyStatsPollInterval) {
        clearInterval(enemyStatsPollInterval)
      }
    })

    return {
      session,
      currentMap,
      loading,
      error,
      uploading,
      uploadProgress,
      fileInput,
      triggerFileInput,
      handleFileSelect,
      transferDM,
      getMapUrl,
      formatDate,
      inviteEmail,
      inviting,
      inviteError,
      inviteSuccess,
      sendInvitation,
      showManageMembers,
      showManageQuotes,
      showManageEnemies,
      sessionId,
      quotes,
      enemies,
      enemyStats,
      loadEnemyStats,
      currentQuote,
      currentQuoteIndex,
      newQuote,
      addingQuote,
      addQuote,
      quoteToDelete,
      confirmDeleteQuote,
      deletingQuoteId,
      scrollToMap,
      personalNotes,
      sharedNotes,
      newPersonalNote,
      newPersonalNoteTitle,
      newPersonalNoteColor,
      newSharedNote,
      newSharedNoteTitle,
      newSharedNoteColor,
      noteColors,
      darkNoteColors,
      isDarkTheme,
      getNoteStyle,
      addingPersonalNote,
      addingSharedNote,
      deletingPersonalNoteId,
      deletingSharedNoteId,
      addPersonalNote,
      addSharedNote,
      deletePersonalNote,
      deleteSharedNote,
      showPersonalNotes,
      showSharedNotes,
      deleteSession,
      deleting,
      deleteConfirmation,
      currentUserMember,
      showNicknameModal,
      newNickname,
      updateNickname,
      updatingNickname,
      nicknameError,
      nicknameSuccess,
      showClassModal,
      dndClasses,
      getClassSlug,
      updateClass,
      updatingClass,
      classError,
      classSuccess,
      showClassModalForMember,
      getSelectedMemberClass,
      showDndSearch,
      selectedDndCategory,
      searchDndQuery,
      dndSearchResults,
      searchingDnd,
      dndSearchError,
      selectedDndItem,
      dndCategories,
      phbOnly,
      handlePhbFilterChange,
      searchDndContent,
      viewDndItem,
      formatDndItem
    }
  }
}
</script>

<style scoped>
.session-view {
  padding: 20px 0;
  min-height: calc(100vh - 80px);
}

.session-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
  background: var(--bg-secondary);
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px var(--shadow);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.session-header h1 {
  color: #667eea;
  margin: 0 0 4px 0;
  font-size: 24px;
}

.session-players {
  margin-top: 8px;
}

.player-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  padding: 4px 0;
}

.player-item:last-child {
  margin-bottom: 0;
}

.player-name {
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
}

.player-name.clickable {
  cursor: pointer;
  font-weight: 700;
  transition: opacity 0.2s ease;
}

.player-name.clickable:hover {
  opacity: 0.8;
}

.no-players {
  color: var(--text-tertiary);
  font-size: 13px;
  font-style: italic;
  padding: 4px 0;
}

.session-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-content {
  margin-top: 0;
}

.map-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.map-section-header h2 {
  margin: 0;
  font-size: 20px;
}

.area-map-title {
  cursor: pointer;
  transition: color 0.2s ease, opacity 0.2s ease;
  user-select: none;
}

.area-map-title:hover {
  color: #667eea;
  opacity: 0.8;
}

.upload-map-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 14px;
}

.map-container {
  margin-top: 12px;
}

.map-info {
  margin-top: 8px;
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
}

.no-map {
  text-align: center;
  padding: 40px;
  color: var(--text-tertiary);
}

.invite-form {
  margin-top: 12px;
}

.invite-input-group {
  display: flex;
  gap: 8px;
}

.invite-input-group input {
  flex: 1;
  padding: 10px;
  font-size: 14px;
}

/* Quotes Widget */
.quotes-widget {
  margin-bottom: 16px;
}

.quotes-widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 8px;
  transition: border-color 0.3s ease;
}

.quotes-widget-header h3 {
  margin: 0;
  color: #667eea;
  font-size: 18px;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.quotes-cycler {
  min-height: 100px;
  position: relative;
}

.quote-display {
  padding: 16px;
  text-align: center;
}

.quote-display-text {
  font-size: 16px;
  line-height: 1.6;
  color: var(--text-primary);
  margin-bottom: 8px;
  font-style: normal;
  min-height: 50px;
}

.quote-display-author {
  font-size: 14px;
  color: var(--text-secondary);
  font-style: italic;
}

.quote-display-empty {
  padding: 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 14px;
}

.quote-indicators {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  transition: border-color 0.3s ease;
}

.quote-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-color);
  cursor: pointer;
  transition: all 0.2s ease;
}

.quote-indicator:hover {
  background: var(--text-secondary);
}

.quote-indicator.active {
  background: #667eea;
  width: 24px;
  border-radius: 4px;
}

/* Fade transition for quotes */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Quotes Modal */
.quotes-modal {
  max-width: 800px;
}

.quotes-modal .quotes-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
}

.quotes-modal .quotes-list {
  max-height: 500px;
  overflow-y: auto;
  padding-right: 8px;
}

.quotes-modal .quotes-list::-webkit-scrollbar {
  width: 6px;
}

.quotes-modal .quotes-list::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.quotes-modal .quotes-list::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 3px;
}

.quotes-modal .quotes-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

.quotes-modal .quote-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  border-left: 3px solid #667eea;
  transition: background 0.3s ease;
}

.quotes-modal .quote-content {
  flex: 1;
}

.quotes-modal .quote-text {
  font-size: 15px;
  line-height: 1.5;
  color: var(--text-primary);
  margin-bottom: 6px;
  font-style: normal;
}

.quotes-modal .quote-author {
  font-size: 13px;
  color: var(--text-secondary);
  font-style: italic;
  text-align: right;
}

.quotes-modal .quote-delete-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  border-radius: 4px;
  min-width: 32px;
}

.quote-preview {
  background: var(--bg-tertiary);
  padding: 12px;
  border-radius: 6px;
  margin: 12px 0;
  border-left: 3px solid #667eea;
}

.quote-preview .quote-text {
  font-size: 15px;
  line-height: 1.5;
  color: var(--text-primary);
  margin-bottom: 6px;
  font-style: normal;
}

.quote-preview .quote-author {
  font-size: 13px;
  color: var(--text-secondary);
  font-style: italic;
  text-align: right;
}

.delete-warning {
  color: var(--text-secondary);
  margin: 12px 0;
}

.quotes-modal .no-quotes {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-tertiary);
  font-size: 14px;
}

.quotes-modal .add-quote-form {
  border-left: 2px solid var(--border-color);
  padding-left: 20px;
  transition: border-color 0.3s ease;
}

.quotes-modal .add-quote-form h3 {
  margin: 0 0 12px 0;
  color: #667eea;
  font-size: 16px;
}

.quotes-modal .add-quote-form .form-group {
  margin-bottom: 10px;
}

.quotes-modal .add-quote-form label {
  display: block;
  margin-bottom: 4px;
  font-weight: 600;
  color: var(--text-secondary);
  font-size: 13px;
}

.quotes-modal .add-quote-form textarea,
.quotes-modal .add-quote-form input {
  width: 100%;
  padding: 8px;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  background: var(--bg-secondary);
  color: var(--text-primary);
  transition: border-color 0.2s ease, background 0.3s ease, color 0.3s ease;
}

.quotes-modal .add-quote-form textarea {
  resize: vertical;
  min-height: 50px;
}

.quotes-modal .add-quote-form textarea:focus,
.quotes-modal .add-quote-form input:focus {
  outline: none;
  border-color: #667eea;
}

.quotes-modal .add-quote-form .btn {
  width: 100%;
  margin-top: 8px;
}

@media (max-width: 768px) {
  .quotes-modal .quotes-content {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  
  .quotes-modal .add-quote-form {
    border-left: none;
    border-top: 2px solid var(--border-color);
    padding-left: 0;
    padding-top: 12px;
  }
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  backdrop-filter: blur(4px);
}

/* Class modal should appear above other modals */
.class-modal-overlay {
  z-index: 1100 !important;
}

/* Delete quote confirmation modal should appear above manage quotes modal */
.delete-quote-modal-overlay {
  z-index: 1200 !important;
}

.members-modal,
.nickname-modal,
.class-modal {
  background: var(--bg-secondary);
  border-radius: 8px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px var(--shadow-hover);
  transition: background 0.3s ease, box-shadow 0.3s ease;
}

.nickname-modal {
  max-width: 400px;
}

.class-modal {
  max-width: 700px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 2px solid var(--border-color);
  transition: border-color 0.3s ease;
}

.modal-header h2 {
  margin: 0;
  color: #667eea;
  font-size: 20px;
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 32px;
  color: var(--text-tertiary);
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.modal-close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.nickname-modal .form-group {
  margin-bottom: 16px;
}

.nickname-modal .form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: #555;
  font-size: 14px;
}

.nickname-modal .form-group input {
  width: 100%;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
}

.nickname-modal .form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.nickname-modal .form-group small {
  display: block;
  margin-top: 6px;
  color: #999;
  font-size: 12px;
}

.invite-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 2px solid var(--border-color);
  transition: border-color 0.3s ease;
}

.invite-section h3 {
  margin: 0 0 12px 0;
  color: #667eea;
  font-size: 18px;
}

.members-section h3 {
  margin: 0 0 12px 0;
  color: #667eea;
  font-size: 18px;
}

.members-list {
  max-height: 400px;
  overflow-y: auto;
}

.members-list::-webkit-scrollbar {
  width: 6px;
}

.members-list::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.members-list::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 3px;
}

.members-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

.delete-session-section {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 2px solid var(--border-color);
  transition: border-color 0.3s ease;
}

.delete-session-section h3 {
  margin: 0 0 12px 0;
  color: #dc3545;
  font-size: 18px;
}

.delete-session-warning {
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 6px;
  padding: 16px;
}

.delete-session-warning p {
  margin: 0 0 8px 0;
  color: #856404;
  font-size: 14px;
}

.delete-session-warning p:last-of-type {
  margin-bottom: 12px;
}

.delete-confirmation-input {
  margin: 16px 0;
}

.delete-input {
  width: 100%;
  padding: 10px;
  border: 2px solid #dc3545;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
}

.delete-input:focus {
  outline: none;
  border-color: #c82333;
  box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1);
}

.delete-session-warning .btn-danger {
  width: 100%;
  margin-top: 8px;
}

.delete-session-warning .btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Class Modal Styles */
.class-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.class-option {
  padding: 20px 16px;
  border: 3px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-secondary);
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
  font-weight: 700;
  font-size: 15px;
  position: relative;
  overflow: hidden;
  min-height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.class-option::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.1;
  transition: opacity 0.3s ease;
}

.class-option:hover:not(:disabled) {
  transform: translateY(-4px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
  border-width: 3px;
}

.class-option:hover:not(:disabled)::before {
  opacity: 0.2;
}

.class-option:active:not(:disabled) {
  transform: translateY(-2px);
}

.class-option:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.class-option.selected {
  border-width: 4px;
  box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.2);
  transform: scale(1.05);
}

.class-name {
  display: block;
  position: relative;
  z-index: 1;
  text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
}

/* Class Colors - Background and Border */
.class-barbarian { 
  border-color: #8B4513; 
  color: #8B4513; 
  background: linear-gradient(135deg, #fff 0%, #f5e6d3 100%);
}
.class-barbarian::before { background: #8B4513; }
.class-barbarian:hover:not(:disabled) { 
  background: #8B4513; 
  color: white; 
  text-shadow: none;
}
.class-barbarian.selected { 
  border-color: #8B4513; 
  background: #8B4513; 
  color: white;
  text-shadow: none;
}

.class-bard { 
  border-color: #9370DB; 
  color: #9370DB; 
  background: linear-gradient(135deg, #fff 0%, #e6d9f5 100%);
}
.class-bard::before { background: #9370DB; }
.class-bard:hover:not(:disabled) { 
  background: #9370DB; 
  color: white; 
  text-shadow: none;
}
.class-bard.selected { 
  border-color: #9370DB; 
  background: #9370DB; 
  color: white;
  text-shadow: none;
}

.class-cleric { 
  border-color: #FFD700; 
  color: #FFA500; 
  background: linear-gradient(135deg, #fff 0%, #fff9e6 100%);
}
.class-cleric::before { background: #FFD700; }
.class-cleric:hover:not(:disabled) { 
  background: #FFD700; 
  color: #333; 
  text-shadow: none;
}
.class-cleric.selected { 
  border-color: #FFD700; 
  background: #FFD700; 
  color: #333;
  text-shadow: none;
}

.class-druid { 
  border-color: #228B22; 
  color: #228B22; 
  background: linear-gradient(135deg, #fff 0%, #e6f5e6 100%);
}
.class-druid::before { background: #228B22; }
.class-druid:hover:not(:disabled) { 
  background: #228B22; 
  color: white; 
  text-shadow: none;
}
.class-druid.selected { 
  border-color: #228B22; 
  background: #228B22; 
  color: white;
  text-shadow: none;
}

.class-fighter { 
  border-color: #C0C0C0; 
  color: #666; 
  background: linear-gradient(135deg, #fff 0%, #f5f5f5 100%);
}
.class-fighter::before { background: #C0C0C0; }
.class-fighter:hover:not(:disabled) { 
  background: #C0C0C0; 
  color: #333; 
  text-shadow: none;
}
.class-fighter.selected { 
  border-color: #C0C0C0; 
  background: #C0C0C0; 
  color: #333;
  text-shadow: none;
}

.class-monk { 
  border-color: #FFA500; 
  color: #FF8C00; 
  background: linear-gradient(135deg, #fff 0%, #fff5e6 100%);
}
.class-monk::before { background: #FFA500; }
.class-monk:hover:not(:disabled) { 
  background: #FFA500; 
  color: white; 
  text-shadow: none;
}
.class-monk.selected { 
  border-color: #FFA500; 
  background: #FFA500; 
  color: white;
  text-shadow: none;
}

.class-paladin { 
  border-color: #FFD700; 
  color: #FFA500; 
  background: linear-gradient(135deg, #fff 0%, #fff9e6 100%);
}
.class-paladin::before { background: #FFD700; }
.class-paladin:hover:not(:disabled) { 
  background: #FFD700; 
  color: #333; 
  text-shadow: none;
}
.class-paladin.selected { 
  border-color: #FFD700; 
  background: #FFD700; 
  color: #333;
  text-shadow: none;
}

.class-ranger { 
  border-color: #228B22; 
  color: #228B22; 
  background: linear-gradient(135deg, #fff 0%, #e6f5e6 100%);
}
.class-ranger::before { background: #228B22; }
.class-ranger:hover:not(:disabled) { 
  background: #228B22; 
  color: white; 
  text-shadow: none;
}
.class-ranger.selected { 
  border-color: #228B22; 
  background: #228B22; 
  color: white;
  text-shadow: none;
}

.class-rogue { 
  border-color: #2F2F2F; 
  color: #2F2F2F; 
  background: linear-gradient(135deg, #fff 0%, #e8e8e8 100%);
}
.class-rogue::before { background: #2F2F2F; }
.class-rogue:hover:not(:disabled) { 
  background: #2F2F2F; 
  color: white; 
  text-shadow: none;
}
.class-rogue.selected { 
  border-color: #2F2F2F; 
  background: #2F2F2F; 
  color: white;
  text-shadow: none;
}

.class-sorcerer { 
  border-color: #4B0082; 
  color: #4B0082; 
  background: linear-gradient(135deg, #fff 0%, #e6d9f0 100%);
}
.class-sorcerer::before { background: #4B0082; }
.class-sorcerer:hover:not(:disabled) { 
  background: #4B0082; 
  color: white; 
  text-shadow: none;
}
.class-sorcerer.selected { 
  border-color: #4B0082; 
  background: #4B0082; 
  color: white;
  text-shadow: none;
}

.class-warlock { 
  border-color: #8B008B; 
  color: #8B008B; 
  background: linear-gradient(135deg, #fff 0%, #f0d9f0 100%);
}
.class-warlock::before { background: #8B008B; }
.class-warlock:hover:not(:disabled) { 
  background: #8B008B; 
  color: white; 
  text-shadow: none;
}
.class-warlock.selected { 
  border-color: #8B008B; 
  background: #8B008B; 
  color: white;
  text-shadow: none;
}

.class-wizard { 
  border-color: #4169E1; 
  color: #4169E1; 
  background: linear-gradient(135deg, #fff 0%, #e6e9f5 100%);
}
.class-wizard::before { background: #4169E1; }
.class-wizard:hover:not(:disabled) { 
  background: #4169E1; 
  color: white; 
  text-shadow: none;
}
.class-wizard.selected { 
  border-color: #4169E1; 
  background: #4169E1; 
  color: white;
  text-shadow: none;
}

.class-none { 
  border-color: #999; 
  color: #999; 
  background: linear-gradient(135deg, #fff 0%, #f5f5f5 100%);
}
.class-none::before { background: #999; }
.class-none:hover:not(:disabled) { 
  background: #f5f5f5; 
  color: #666;
}
.class-none.selected { 
  border-color: #999; 
  background: #f5f5f5; 
  color: #666;
}

/* D&D Search Modal Styles */
.dnd-search-modal {
  max-width: 900px;
  max-height: 90vh;
}

.dnd-search-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.dnd-filter-option {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
}

.dnd-filter-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-primary);
  user-select: none;
}

.dnd-filter-label input[type="checkbox"] {
  cursor: pointer;
  width: 18px;
  height: 18px;
}

.dnd-tab {
  padding: 8px 16px;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
}

.dnd-tab:hover {
  background: var(--bg-secondary);
  border-color: #667eea;
}

.dnd-tab.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.dnd-search-box {
  position: relative;
  margin-bottom: 16px;
}

.dnd-search-input {
  width: 100%;
  padding: 12px;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.dnd-search-input:focus {
  outline: none;
  border-color: #667eea;
}

.dnd-loading {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
  font-size: 12px;
}

.dnd-results {
  max-height: 400px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.dnd-results::-webkit-scrollbar {
  width: 6px;
}

.dnd-results::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.dnd-results::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 3px;
}

.dnd-result-item {
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.dnd-result-item:hover {
  background: var(--bg-secondary);
  border-color: #667eea;
  transform: translateX(4px);
}

.dnd-result-name {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.dnd-result-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

.dnd-item-detail {
  background: var(--bg-tertiary);
  border-radius: 6px;
  padding: 16px;
  margin-top: 16px;
}

.dnd-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid var(--border-color);
}

.dnd-detail-header h3 {
  margin: 0;
  color: #667eea;
}

.dnd-detail-content {
  color: var(--text-primary);
  line-height: 1.6;
}

.dnd-desc {
  margin-bottom: 16px;
}

.dnd-stat {
  margin-bottom: 8px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border-color);
}

.dnd-stat strong {
  color: var(--text-primary);
  margin-right: 8px;
}

.dnd-higher-level {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  border-left: 3px solid #667eea;
}

.dnd-actions ul {
  margin: 8px 0;
  padding-left: 20px;
}

.dnd-actions li {
  margin-bottom: 8px;
}

.dnd-no-results,
.dnd-no-detail {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-tertiary);
  font-size: 14px;
}

/* Enemy Statistics Widget */
.enemy-stats-widget {
  margin-bottom: 16px;
}

.enemy-stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 8px;
  transition: border-color 0.3s ease;
}

.enemy-stats-header h3 {
  margin: 0;
  color: #667eea;
  font-size: 18px;
}

.enemy-stats-content {
  display: flex;
  gap: 16px;
  justify-content: space-around;
  padding: 8px 0;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: #667eea;
}

/* Enemies Modal */
.enemies-modal {
  max-width: 700px;
}

.enemies-stats-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.stat-summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-summary-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.stat-summary-value {
  font-size: 24px;
  font-weight: 700;
  color: #667eea;
}

.enemies-list {
  max-height: 400px;
  overflow-y: auto;
}

.enemies-list::-webkit-scrollbar {
  width: 6px;
}

.enemies-list::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.enemies-list::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 3px;
}

.enemies-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

.enemy-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  margin-bottom: 8px;
  border-left: 3px solid #667eea;
  transition: background 0.3s ease;
}

.enemy-item.enemy-killed {
  border-left-color: #dc3545;
}

.enemy-item.enemy-fled {
  border-left-color: #ffc107;
}

.enemy-item.enemy-freed {
  border-left-color: #17a2b8;
}

.enemy-name {
  flex: 1;
  font-weight: 600;
  color: var(--text-primary);
  font-size: 15px;
}

.enemy-status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.badge-killed {
  background: #dc3545;
  color: white;
}

.badge-fled {
  background: #ffc107;
  color: #333;
}

.badge-freed {
  background: #17a2b8;
  color: white;
}

.enemy-date {
  font-size: 11px;
  color: var(--text-tertiary);
}

.no-enemies {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-tertiary);
  font-size: 14px;
}

@media (max-width: 768px) {
  .members-modal,
  .class-modal,
  .dnd-search-modal,
  .enemies-modal {
    max-width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }
  
  .modal-overlay {
    padding: 0;
  }
  
  .class-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  
  .class-option {
    padding: 16px 12px;
    min-height: 60px;
    font-size: 14px;
  }
  
  .dnd-search-tabs {
    gap: 6px;
  }
  
  .dnd-tab {
    padding: 6px 12px;
    font-size: 12px;
  }
  
  .enemies-stats-summary {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .enemy-stats-content {
    flex-direction: column;
    gap: 8px;
  }
}

/* Floating Note Buttons */
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

/* Apple Notes Style Modal */
.notes-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.notes-modal {
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  background: var(--bg-secondary);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.apple-notes-style {
  background: #f5f5f7;
}

.dark-theme .apple-notes-style {
  background: #1d1d1f;
}

.notes-modal-header {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
}

.dark-theme .notes-modal-header {
  background: rgba(29, 29, 31, 0.8);
  border-bottom-color: rgba(255, 255, 255, 0.1);
}

.notes-modal-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.notes-close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 24px;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.notes-close-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary);
}

.dark-theme .notes-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.notes-modal-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24px;
}

.notes-list-apple {
  flex: 1;
  overflow-y: auto;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notes-list-apple::-webkit-scrollbar {
  width: 8px;
}

.notes-list-apple::-webkit-scrollbar-track {
  background: transparent;
}

.notes-list-apple::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.dark-theme .notes-list-apple::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
}

.note-item-apple {
  background: white;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  transition: all 0.2s ease;
}

.dark-theme .note-item-apple {
  background: #2d2d2f;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.note-item-apple:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.dark-theme .note-item-apple:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
}

.note-content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.note-title-apple {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 4px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.note-text-apple {
  font-size: 15px;
  line-height: 1.6;
  word-wrap: break-word;
  white-space: pre-wrap;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.note-delete-btn-apple {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  opacity: 0;
}

.note-item-apple:hover .note-delete-btn-apple {
  opacity: 1;
}

.note-delete-btn-apple:hover {
  background: rgba(255, 59, 48, 0.1);
  color: #ff3b30;
}

.no-notes-apple {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-tertiary);
  font-size: 15px;
}

.add-note-form-apple {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding-top: 24px;
}

.dark-theme .add-note-form-apple {
  border-top-color: rgba(255, 255, 255, 0.1);
}

.note-title-input-apple {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: white;
  color: #000000;
  transition: all 0.2s ease;
  margin-bottom: 12px;
}

.dark-theme .note-title-input-apple {
  background: #2d2d2f;
  border-color: rgba(255, 255, 255, 0.1);
  color: #f5f5f7;
}

.note-title-input-apple:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.note-input-apple {
  width: 100%;
  padding: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 8px;
  font-size: 15px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: white;
  color: #000000;
  resize: vertical;
  min-height: 80px;
  transition: all 0.2s ease;
  margin-bottom: 12px;
}

.dark-theme .note-input-apple {
  background: #2d2d2f;
  border-color: rgba(255, 255, 255, 0.1);
  color: #f5f5f7;
}

.note-input-apple:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.note-color-selector {
  margin-bottom: 12px;
}

.note-color-selector label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.color-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.color-option:hover {
  transform: scale(1.1);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.color-option.selected {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3);
}

.note-add-btn-apple {
  padding: 10px 20px;
  border: none;
  background: #667eea;
  color: white;
  font-size: 15px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.note-add-btn-apple:hover:not(:disabled) {
  background: #5568d3;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.note-add-btn-apple:active:not(:disabled) {
  transform: translateY(0);
}

.note-add-btn-apple:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .floating-note-btn {
    width: 48px;
    height: 48px;
    font-size: 20px;
  }
  
  .floating-note-btn-left {
    left: 16px;
    bottom: 16px;
  }
  
  .floating-note-btn-right {
    right: 16px;
    bottom: 16px;
  }
  
  .notes-modal {
    width: 95%;
    max-height: 90vh;
  }
}
</style>

