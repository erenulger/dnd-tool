<template>
  <div class="pawn-prefab-library" :class="{ 'library-open': isOpen }">
    <button 
      @click="toggleLibrary" 
      class="library-toggle-btn"
      :title="isOpen ? 'Close Library' : 'Open Pawn Library'"
    >
      {{ isOpen ? '✕' : '📚' }}
    </button>
    
    <div v-if="isOpen" class="library-content">
      <div class="library-header">
        <h3>Pawn Library</h3>
        <button @click="showCreateModal = true" class="btn btn-primary btn-small">
          + New
        </button>
      </div>
      
      <div class="prefabs-list">
        <div 
          v-for="prefab in prefabs" 
          :key="prefab.id"
          class="prefab-item"
          draggable="true"
          @dragstart="handleDragStart($event, prefab)"
          @dragend="handleDragEnd"
        >
          <div class="prefab-preview">
            <div 
              class="prefab-circle" 
              :style="{ backgroundColor: prefab.color }"
            >
              <span class="prefab-initial">{{ getPawnInitial(prefab.name) }}</span>
            </div>
            <div class="prefab-name">{{ prefab.name }}</div>
            <div v-if="prefab.hp !== null && prefab.hp !== undefined" class="prefab-hp">
              HP: {{ prefab.hp }}{{ prefab.max_hp ? ` (${prefab.max_hp})` : '' }}
            </div>
          </div>
          <div class="prefab-actions">
            <button 
              @click.stop="editPrefab(prefab)" 
              class="prefab-action-btn"
              title="Edit"
            >
              ✎
            </button>
            <button 
              @click.stop="deletePrefab(prefab)" 
              class="prefab-action-btn prefab-delete"
              title="Delete"
            >
              ×
            </button>
          </div>
        </div>
        <div v-if="prefabs.length === 0" class="prefabs-empty">
          <p>No prefabs yet. Create one to get started!</p>
        </div>
      </div>
    </div>

    <!-- Create Prefab Modal -->
    <div v-if="showCreateModal" class="modal-overlay" @click="showCreateModal = false">
      <div class="modal-content" @click.stop>
        <h3>Create Pawn Prefab</h3>
        <form @submit.prevent="createPrefab">
          <div class="form-group">
            <label>Name</label>
            <input type="text" v-model="newPrefab.name" required maxlength="100" />
          </div>
          <div class="form-group">
            <label>Color</label>
            <input type="color" v-model="newPrefab.color" />
          </div>
          <div class="form-group">
            <label>Assign to Player</label>
            <select v-model="newPrefab.owned_by">
              <option :value="null">NPC</option>
              <option v-for="member in sessionMembers" :key="member.user_id" :value="member.user_id">
                {{ member.nickname || member.users?.email || 'Unknown' }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Max HP (optional)</label>
            <input type="number" v-model.number="newPrefab.max_hp" min="0" placeholder="Leave empty for no HP" />
            <small>Current HP will be set equal to Max HP</small>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="newPrefab.visible" />
              Visible to Players
            </label>
            <small>If unchecked, only the DM can see this pawn</small>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showCreateModal = false" class="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="creating">
              {{ creating ? 'Creating...' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Prefab Modal -->
    <div v-if="prefabToEdit" class="modal-overlay" @click="prefabToEdit = null">
      <div class="modal-content" @click.stop>
        <h3>Edit Pawn Prefab - {{ prefabToEdit.name }}</h3>
        <form @submit.prevent="savePrefabEdit">
          <div class="form-group">
            <label>Name</label>
            <input type="text" v-model="editingPrefab.name" required maxlength="100" />
          </div>
          <div class="form-group">
            <label>Color</label>
            <input type="color" v-model="editingPrefab.color" />
          </div>
          <div class="form-group">
            <label>Assign to Player</label>
            <select v-model="editingPrefab.owned_by">
              <option :value="null">NPC</option>
              <option v-for="member in sessionMembers" :key="member.user_id" :value="member.user_id">
                {{ member.nickname || member.users?.email || 'Unknown' }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Current HP</label>
            <input type="number" v-model.number="editingPrefab.hp" min="0" />
            <small>Leave empty if no HP</small>
          </div>
          <div class="form-group">
            <label>Max HP</label>
            <input type="number" v-model.number="editingPrefab.max_hp" min="0" />
            <small>Leave empty if no max HP</small>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="editingPrefab.visible" />
              Visible to Players
            </label>
            <small>If unchecked, only the DM can see this pawn</small>
          </div>
          <div class="modal-actions">
            <button type="button" @click="prefabToEdit = null" class="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="updating">
              {{ updating ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="prefabToDelete" class="modal-overlay" @click="prefabToDelete = null">
      <div class="modal-content" @click.stop>
        <h3>Delete Prefab</h3>
        <p>Are you sure you want to delete the prefab <strong>"{{ prefabToDelete.name }}"</strong>?</p>
        <p class="delete-warning">This action cannot be undone.</p>
        <div class="modal-actions">
          <button type="button" @click="prefabToDelete = null" class="btn btn-secondary">
            Cancel
          </button>
          <button type="button" @click="confirmDeletePrefab" class="btn btn-danger" :disabled="deleting">
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from 'vue'
import api from '../lib/api'

export default {
  name: 'PawnPrefabLibrary',
  props: {
    sessionId: {
      type: String,
      required: true
    },
    sessionMembers: {
      type: Array,
      default: () => []
    }
  },
  emits: ['prefab-drag-start', 'prefab-drag-end', 'prefab-dropped'],
  setup(props, { emit }) {
    const isOpen = ref(false)
    const prefabs = ref([])
    const loading = ref(false)
    const showCreateModal = ref(false)
    const creating = ref(false)
    const prefabToEdit = ref(null)
    const editingPrefab = ref({
      name: '',
      color: '#667eea',
      status_color: null,
      owned_by: null,
      hp: null,
      max_hp: null,
      visible: true
    })
    const updating = ref(false)
    const prefabToDelete = ref(null)
    const deleting = ref(false)
    const draggedPrefab = ref(null)
    
    const newPrefab = ref({
      name: '',
      color: '#667eea',
      status_color: null,
      owned_by: null,
      max_hp: null,
      visible: true
    })

    // Ensure color is always valid hex format
    watch(() => newPrefab.value.color, (newColor) => {
      if (!newColor || !/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
        newPrefab.value.color = '#667eea'
      }
    })

    watch(() => editingPrefab.value.color, (newColor) => {
      if (!newColor || !/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
        editingPrefab.value.color = '#667eea'
      }
    })

    const toggleLibrary = () => {
      isOpen.value = !isOpen.value
      if (isOpen.value) {
        loadPrefabs()
      }
    }

    const loadPrefabs = async () => {
      loading.value = true
      try {
        const { data } = await api.get('/pawn-prefabs')
        prefabs.value = data.prefabs || []
      } catch (err) {
        console.error('Error loading prefabs:', err)
        alert(err.response?.data?.error || 'Failed to load prefabs')
      } finally {
        loading.value = false
      }
    }

    const createPrefab = async () => {
      creating.value = true
      try {
        // Set HP equal to max HP if max HP is provided
        const hp = newPrefab.value.max_hp !== null && newPrefab.value.max_hp !== undefined 
          ? newPrefab.value.max_hp 
          : null

        const { data } = await api.post('/pawn-prefabs', {
          name: newPrefab.value.name,
          color: newPrefab.value.color,
          status_color: newPrefab.value.status_color || null,
          owned_by: newPrefab.value.owned_by || null,
          hp: hp,
          max_hp: newPrefab.value.max_hp || null,
          visible: newPrefab.value.visible !== false
        })
        
        showCreateModal.value = false
        newPrefab.value = { name: '', color: '#667eea', status_color: null, owned_by: null, max_hp: null, visible: true }
        await loadPrefabs()
      } catch (err) {
        console.error('Error creating prefab:', err)
        alert(err.response?.data?.error || 'Failed to create prefab')
      } finally {
        creating.value = false
      }
    }

    const editPrefab = (prefab) => {
      prefabToEdit.value = prefab
      editingPrefab.value = {
        name: prefab.name || '',
        color: (prefab.color && prefab.color.trim() !== '') ? prefab.color : '#667eea',
        status_color: prefab.status_color || null,
        owned_by: prefab.owned_by || null,
        hp: prefab.hp !== null && prefab.hp !== undefined ? prefab.hp : null,
        max_hp: prefab.max_hp !== null && prefab.max_hp !== undefined ? prefab.max_hp : null,
        visible: prefab.visible !== false
      }
    }

    const savePrefabEdit = async () => {
      if (!prefabToEdit.value) return

      updating.value = true
      try {
        await api.put(`/pawn-prefabs/${prefabToEdit.value.id}`, {
          name: editingPrefab.value.name,
          color: editingPrefab.value.color,
          status_color: editingPrefab.value.status_color || null,
          owned_by: editingPrefab.value.owned_by || null,
          hp: editingPrefab.value.hp !== null && editingPrefab.value.hp !== undefined ? editingPrefab.value.hp : null,
          max_hp: editingPrefab.value.max_hp !== null && editingPrefab.value.max_hp !== undefined ? editingPrefab.value.max_hp : null,
          visible: editingPrefab.value.visible !== false
        })
        await loadPrefabs()
        prefabToEdit.value = null
      } catch (err) {
        console.error('Error updating prefab:', err)
        alert(err.response?.data?.error || 'Failed to update prefab')
      } finally {
        updating.value = false
      }
    }

    const deletePrefab = (prefab) => {
      prefabToDelete.value = prefab
    }

    const confirmDeletePrefab = async () => {
      if (!prefabToDelete.value) return

      deleting.value = true
      try {
        await api.delete(`/pawn-prefabs/${prefabToDelete.value.id}`)
        await loadPrefabs()
        prefabToDelete.value = null
      } catch (err) {
        console.error('Error deleting prefab:', err)
        alert(err.response?.data?.error || 'Failed to delete prefab')
      } finally {
        deleting.value = false
      }
    }

    const handleDragStart = (e, prefab) => {
      draggedPrefab.value = prefab
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'pawn-prefab', prefabId: prefab.id }))
      
      // Create a custom drag image showing only the circle
      const dragImage = document.createElement('div')
      dragImage.style.width = '48px'
      dragImage.style.height = '48px'
      dragImage.style.borderRadius = '50%'
      dragImage.style.backgroundColor = prefab.color || '#667eea'
      dragImage.style.border = '2px solid white'
      dragImage.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.3)'
      dragImage.style.display = 'flex'
      dragImage.style.alignItems = 'center'
      dragImage.style.justifyContent = 'center'
      dragImage.style.color = 'white'
      dragImage.style.fontWeight = 'bold'
      dragImage.style.fontSize = '18px'
      dragImage.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.5)'
      dragImage.style.position = 'absolute'
      dragImage.style.top = '-1000px'
      dragImage.style.left = '-1000px'
      dragImage.style.pointerEvents = 'none'
      dragImage.textContent = getPawnInitial(prefab.name)
      
      document.body.appendChild(dragImage)
      
      // Set the drag image - center it on cursor
      const offsetX = 24 // Half of width
      const offsetY = 24 // Half of height
      e.dataTransfer.setDragImage(dragImage, offsetX, offsetY)
      
      // Clean up after drag starts
      setTimeout(() => {
        if (document.body.contains(dragImage)) {
          document.body.removeChild(dragImage)
        }
      }, 0)
      
      emit('prefab-drag-start', prefab)
    }

    const handleDragEnd = () => {
      draggedPrefab.value = null
      emit('prefab-drag-end')
    }

    const getPawnInitial = (name) => {
      return name ? name.charAt(0).toUpperCase() : '?'
    }

    onMounted(() => {
      // Load prefabs when component mounts
      loadPrefabs()
    })

    return {
      isOpen,
      prefabs,
      loading,
      showCreateModal,
      creating,
      newPrefab,
      createPrefab,
      prefabToEdit,
      editingPrefab,
      updating,
      editPrefab,
      savePrefabEdit,
      prefabToDelete,
      deleting,
      deletePrefab,
      confirmDeletePrefab,
      toggleLibrary,
      handleDragStart,
      handleDragEnd,
      getPawnInitial
    }
  }
}
</script>

<style scoped>
.pawn-prefab-library {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 400;
  transition: transform 0.3s ease;
}

.pawn-prefab-library.library-open {
  transform: translateY(-50%) translateX(0);
}

.library-toggle-btn {
  position: absolute;
  left: -50px;
  top: 0;
  width: 50px;
  height: 50px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 8px 0 0 8px;
  font-size: 20px;
  cursor: pointer;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
  z-index: 401;
}

.library-toggle-btn:hover {
  background: #5568d3;
  transform: translateX(-5px);
}

.library-content {
  width: 280px;
  max-height: 80vh;
  background: var(--bg-secondary);
  border-left: 2px solid var(--border-color);
  box-shadow: -4px 0 16px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.library-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-primary);
}

.library-header h3 {
  margin: 0;
  color: #667eea;
  font-size: 18px;
}

.prefabs-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.prefab-item {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  cursor: grab;
  transition: all 0.2s ease;
  position: relative;
}

.prefab-item:hover {
  transform: translateX(-4px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-color: #667eea;
}

.prefab-item:active {
  cursor: grabbing;
  opacity: 0.7;
}

.prefab-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.prefab-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.prefab-initial {
  color: white;
  font-weight: bold;
  font-size: 18px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.prefab-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
  text-align: center;
}

.prefab-hp {
  font-size: 11px;
  color: #ffc107;
  font-weight: 600;
}

.prefab-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.prefab-item:hover .prefab-actions {
  opacity: 1;
}

.prefab-action-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  border: none;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.prefab-action-btn:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.1);
}

.prefab-delete {
  background: rgba(220, 53, 69, 0.8);
}

.prefab-delete:hover {
  background: rgba(220, 53, 69, 1);
}

.prefabs-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-tertiary);
  font-size: 14px;
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
  z-index: 2000;
}

.modal-content {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 20px;
  width: 90%;
  max-width: 400px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-content h3 {
  margin-bottom: 12px;
  color: #667eea;
  font-size: 18px;
}

.modal-content p {
  margin: 12px 0;
  color: var(--text-primary);
  line-height: 1.5;
}

.delete-warning {
  color: #dc3545;
  font-weight: 600;
  font-size: 13px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #5568d3;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: var(--text-primary);
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 2px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-group input[type="color"] {
  height: 40px;
  cursor: pointer;
}

.form-group small {
  display: block;
  margin-top: 4px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.form-group input[type="checkbox"] {
  width: auto;
  margin-right: 8px;
}
</style>

