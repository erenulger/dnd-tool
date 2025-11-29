<template>
  <div class="map-viewer-container" ref="containerRef">
    <div class="map-viewer-controls">
      <button @click="zoomIn" class="control-btn" title="Zoom In">+</button>
      <button @click="zoomOut" class="control-btn" title="Zoom Out">−</button>
      <button @click="resetView" class="control-btn" title="Reset View">⌂</button>
      <span class="zoom-level">{{ Math.round(scale * 100) }}%</span>
    </div>
    
    <div 
      class="map-viewer"
      ref="viewerRef"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @wheel="handleWheel"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <div class="map-image-wrapper" :style="imageStyle">
        <img
          :src="mapUrl"
          :alt="mapName"
          ref="imageRef"
          class="map-image"
          @load="handleImageLoad"
          draggable="false"
        />
      </div>
      <!-- Pawns overlay - positioned relative to viewer, not image wrapper -->
      <div class="pawns-overlay">
        <div
          v-for="pawn in pawns"
          :key="pawn.id"
          class="pawn"
          :class="{ 'pawn-dragging': draggingPawnId === pawn.id, 'pawn-owned': pawn.owned_by === currentUserId, 'pawn-dm-control': isDm }"
          :style="getPawnStyle(pawn)"
          @mousedown="handlePawnMouseDown($event, pawn)"
          @touchstart="handlePawnTouchStart($event, pawn)"
          :title="pawn.name"
        >
          <div class="pawn-circle" :style="{ backgroundColor: pawn.color }">
            <span class="pawn-initial">{{ getPawnInitial(pawn.name) }}</span>
          </div>
          <div class="pawn-label">{{ pawn.name }}</div>
          <div 
            v-if="(pawn.hp !== null && pawn.hp !== undefined) || (pawn.max_hp !== null && pawn.max_hp !== undefined)" 
            class="pawn-hp" 
            :class="{ 'pawn-hp-clickable': isDm }"
            @click.stop="isDm ? editPawnHp(pawn) : null"
            :title="isDm ? 'Click to edit HP' : ''"
          >
            HP: {{ pawn.hp !== null && pawn.hp !== undefined ? pawn.hp : '?' }}{{ pawn.max_hp ? ` (${pawn.max_hp})` : '' }}
          </div>
          <!-- Delete button for DM -->
          <button
            v-if="isDm"
            @click.stop="deletePawn(pawn)"
            class="pawn-delete-btn"
            :disabled="deletingPawnId === pawn.id"
            title="Delete Pawn"
          >
            ×
          </button>
        </div>
      </div>
    </div>
    
    <!-- Create Pawn Button (DM only) -->
    <button 
      v-if="isDm" 
      @click="showCreatePawnModal = true" 
      class="create-pawn-btn"
      title="Create New Pawn"
    >
      +
    </button>
    
    <!-- Create Pawn Modal -->
    <div v-if="showCreatePawnModal" class="modal-overlay" @click="showCreatePawnModal = false">
      <div class="modal-content" @click.stop>
        <h3>Create New Pawn</h3>
        <form @submit.prevent="createPawn">
          <div class="form-group">
            <label>Name</label>
            <input type="text" v-model="newPawn.name" required maxlength="100" />
          </div>
          <div class="form-group">
            <label>Color</label>
            <input type="color" v-model="newPawn.color" />
          </div>
          <div class="form-group">
            <label>Assign to Player</label>
            <select v-model="newPawn.owned_by">
              <option :value="null">NPC</option>
              <option v-for="member in sessionMembers" :key="member.user_id" :value="member.user_id">
                {{ member.nickname || member.users?.email || 'Unknown' }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label>Max HP (optional)</label>
            <input type="number" v-model.number="newPawn.max_hp" min="0" placeholder="Leave empty for no HP" />
            <small>Current HP will be set equal to Max HP</small>
          </div>
          <div class="modal-actions">
            <button type="button" @click="showCreatePawnModal = false" class="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="creatingPawn">
              {{ creatingPawn ? 'Creating...' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Set Enemy Status Modal (for NPCs) -->
    <div v-if="pawnToDelete && !pawnToDelete.owned_by" class="modal-overlay" @click="pawnToDelete = null">
      <div class="modal-content" @click.stop>
        <h3>Enemy Status - {{ pawnToDelete.name }}</h3>
        <p>What happened to this enemy?</p>
        <div class="enemy-status-buttons">
          <button 
            type="button" 
            @click="setEnemyStatus('killed')" 
            class="btn btn-danger btn-status"
            :disabled="settingStatus"
          >
            ⚔️ Killed
          </button>
          <button 
            type="button" 
            @click="setEnemyStatus('fled')" 
            class="btn btn-warning btn-status"
            :disabled="settingStatus"
          >
            🏃 Fled
          </button>
          <button 
            type="button" 
            @click="setEnemyStatus('freed')" 
            class="btn btn-info btn-status"
            :disabled="settingStatus"
          >
            🕊️ Freed
          </button>
        </div>
        <div class="modal-actions" style="margin-top: 20px;">
          <button type="button" @click="pawnToDelete = null" class="btn btn-secondary" :disabled="settingStatus">
            Cancel
          </button>
          <button type="button" @click="confirmDeletePawn" class="btn btn-danger btn-small" :disabled="settingStatus">
            Actually Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Pawn Confirmation Modal (for player pawns) -->
    <div v-if="pawnToDelete && pawnToDelete.owned_by" class="modal-overlay" @click="pawnToDelete = null">
      <div class="modal-content" @click.stop>
        <h3>Delete Pawn</h3>
        <p>Are you sure you want to delete the pawn <strong>"{{ pawnToDelete.name }}"</strong>?</p>
        <p class="delete-warning">This action cannot be undone.</p>
        <div class="modal-actions">
          <button type="button" @click="pawnToDelete = null" class="btn btn-secondary">
            Cancel
          </button>
          <button type="button" @click="confirmDeletePawn" class="btn btn-danger" :disabled="deletingPawnId === pawnToDelete.id">
            {{ deletingPawnId === pawnToDelete.id ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Pawn HP Modal -->
    <div v-if="pawnToEditHp" class="modal-overlay" @click="pawnToEditHp = null">
      <div class="modal-content" @click.stop>
        <h3>Edit HP - {{ pawnToEditHp.name }}</h3>
        <form @submit.prevent="savePawnHp">
          <div class="form-group">
            <label>Current HP</label>
            <input type="number" v-model.number="editingHp" min="0" required />
          </div>
          <div class="form-group">
            <label>Max HP</label>
            <input type="number" v-model.number="editingMaxHp" min="0" />
            <small>Leave empty if no max HP</small>
          </div>
          <div class="modal-actions">
            <button type="button" @click="pawnToEditHp = null" class="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="updatingHp">
              {{ updatingHp ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import api from '../lib/api'

export default {
  name: 'MapViewer',
  props: {
    mapUrl: {
      type: String,
      required: true
    },
    mapName: {
      type: String,
      default: 'Map'
    },
    sessionId: {
      type: String,
      required: true
    },
    isDm: {
      type: Boolean,
      default: false
    },
    currentUserId: {
      type: String,
      required: true
    }
  },
  emits: ['pawn-moved', 'pawn-created', 'enemy-status-changed'],
  setup(props, { emit }) {
    const containerRef = ref(null)
    const viewerRef = ref(null)
    const imageRef = ref(null)
    
    // Transform state
    const scale = ref(1)
    const translateX = ref(0)
    const translateY = ref(0)
    
    // Drag state
    const isDragging = ref(false)
    const dragStart = ref({ x: 0, y: 0 })
    const lastTranslate = ref({ x: 0, y: 0 })
    
    // Touch state
    const touchStartDistance = ref(0)
    const touchStartScale = ref(1)
    const touchStartTranslate = ref({ x: 0, y: 0 })
    const touches = ref([])
    
    // Image dimensions
    const imageWidth = ref(0)
    const imageHeight = ref(0)
    const containerWidth = ref(0)
    const containerHeight = ref(0)
    
    // Pawns
    const pawns = ref([])
    const sessionMembers = ref([])
    const draggingPawnId = ref(null)
    const dragPawnStart = ref({ x: 0, y: 0 })
    const showCreatePawnModal = ref(false)
    const creatingPawn = ref(false)
    const deletingPawnId = ref(null)
    const pawnToDelete = ref(null)
    const settingStatus = ref(false)
    const pawnToEditHp = ref(null)
    const editingHp = ref(0)
    const editingMaxHp = ref(null)
    const updatingHp = ref(false)
    const newPawn = ref({
      name: '',
      color: '#667eea',
      owned_by: null,
      max_hp: null
    })
    let pawnsPollInterval = null
    
    const imageStyle = computed(() => {
      if (imageWidth.value === 0 || imageHeight.value === 0) {
        return {
          transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
          transformOrigin: '0 0'
        }
      }
      return {
        transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
        transformOrigin: '0 0',
        width: `${imageWidth.value}px`,
        height: `${imageHeight.value}px`
      }
    })
    
    const handleImageLoad = async () => {
      if (imageRef.value) {
        imageWidth.value = imageRef.value.naturalWidth
        imageHeight.value = imageRef.value.naturalHeight
        console.log('Image loaded:', { width: imageWidth.value, height: imageHeight.value })
        resetView()
        
        // Load pawns after image dimensions are known
        if (props.sessionId) {
          await loadPawns()
        }
      }
    }
    
    const updateContainerSize = () => {
      if (containerRef.value) {
        containerWidth.value = containerRef.value.clientWidth
        containerHeight.value = containerRef.value.clientHeight
      }
    }
    
    const resetView = () => {
      if (!imageRef.value || !containerRef.value || imageWidth.value === 0 || imageHeight.value === 0) return
      
      updateContainerSize()
      
      // Calculate scale to fit image completely within container (contain mode)
      const scaleX = containerWidth.value / imageWidth.value
      const scaleY = containerHeight.value / imageHeight.value
      const initialScale = Math.min(scaleX, scaleY) // Use the smaller scale to fit both dimensions
      
      scale.value = initialScale
      
      // Calculate scaled dimensions
      const scaledWidth = imageWidth.value * scale.value
      const scaledHeight = imageHeight.value * scale.value
      
      // Center the image in the container
      translateX.value = (containerWidth.value - scaledWidth) / 2
      translateY.value = (containerHeight.value - scaledHeight) / 2
      
      lastTranslate.value = { x: translateX.value, y: translateY.value }
      
      console.log('Reset view:', {
        imageSize: { width: imageWidth.value, height: imageHeight.value },
        containerSize: { width: containerWidth.value, height: containerHeight.value },
        scale: scale.value,
        translate: { x: translateX.value, y: translateY.value }
      })
    }
    
    const zoomIn = () => {
      const zoomFactor = 1.1 // Reduced from 1.2 for less sensitivity
      zoomAtPoint(containerWidth.value / 2, containerHeight.value / 2, zoomFactor)
    }
    
    const zoomOut = () => {
      const zoomFactor = 1 / 1.1 // Reduced from 1/1.2 for less sensitivity
      zoomAtPoint(containerWidth.value / 2, containerHeight.value / 2, zoomFactor)
    }
    
    const constrainTranslation = () => {
      if (!imageRef.value || !containerRef.value || imageWidth.value === 0 || imageHeight.value === 0) return
      
      const scaledWidth = imageWidth.value * scale.value
      const scaledHeight = imageHeight.value * scale.value
      
      // Calculate bounds
      const minX = containerWidth.value - scaledWidth
      const maxX = 0
      const minY = containerHeight.value - scaledHeight
      const maxY = 0
      
      // If scaled image is smaller than container, center it
      if (scaledWidth <= containerWidth.value) {
        translateX.value = (containerWidth.value - scaledWidth) / 2
      } else {
        // Constrain to bounds
        translateX.value = Math.max(minX, Math.min(maxX, translateX.value))
      }
      
      if (scaledHeight <= containerHeight.value) {
        translateY.value = (containerHeight.value - scaledHeight) / 2
      } else {
        // Constrain to bounds
        translateY.value = Math.max(minY, Math.min(maxY, translateY.value))
      }
      
      lastTranslate.value = { x: translateX.value, y: translateY.value }
    }
    
    const zoomAtPoint = (clientX, clientY, zoomFactor) => {
      if (!viewerRef.value) return
      
      const rect = viewerRef.value.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top
      
      // Calculate point in image coordinates before zoom
      const imageX = (x - translateX.value) / scale.value
      const imageY = (y - translateY.value) / scale.value
      
      // Apply zoom with constraints
      const newScale = Math.max(0.1, Math.min(5, scale.value * zoomFactor))
      scale.value = newScale
      
      // Adjust translate to keep the point under cursor
      translateX.value = x - imageX * newScale
      translateY.value = y - imageY * newScale
      
      // Constrain translation to prevent dead zones
      constrainTranslation()
    }
    
    const handleWheel = (e) => {
      e.preventDefault()
      // Reduced sensitivity: smaller zoom increments
      const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05
      zoomAtPoint(e.clientX, e.clientY, zoomFactor)
    }
    
    const handleMouseDown = (e) => {
      if (e.button !== 0) return // Only left mouse button
      isDragging.value = true
      dragStart.value = { x: e.clientX, y: e.clientY }
      e.preventDefault()
    }
    
    const handleMouseMove = (e) => {
      if (!isDragging.value) return
      
      const deltaX = e.clientX - dragStart.value.x
      const deltaY = e.clientY - dragStart.value.y
      
      translateX.value = lastTranslate.value.x + deltaX
      translateY.value = lastTranslate.value.y + deltaY
      
      // Constrain during drag to prevent dead zones
      constrainTranslation()
    }
    
    const handleMouseUp = () => {
      if (isDragging.value) {
        // Final constraint check
        constrainTranslation()
        lastTranslate.value = { x: translateX.value, y: translateY.value }
        isDragging.value = false
      }
    }
    
    const getDistance = (touch1, touch2) => {
      const dx = touch2.clientX - touch1.clientX
      const dy = touch2.clientY - touch1.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }
    
    const getCenter = (touch1, touch2) => {
      return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      }
    }
    
    const handleTouchStart = (e) => {
      touches.value = Array.from(e.touches)
      
      if (touches.value.length === 2) {
        // Pinch zoom
        touchStartDistance.value = getDistance(touches.value[0], touches.value[1])
        touchStartScale.value = scale.value
        touchStartTranslate.value = { x: translateX.value, y: translateY.value }
      } else if (touches.value.length === 1) {
        // Single touch drag
        isDragging.value = true
        dragStart.value = { x: touches.value[0].clientX, y: touches.value[0].clientY }
      }
    }
    
    const handleTouchMove = (e) => {
      e.preventDefault()
      touches.value = Array.from(e.touches)
      
      if (touches.value.length === 2) {
        // Pinch zoom
        const distance = getDistance(touches.value[0], touches.value[1])
        const scaleChange = distance / touchStartDistance.value
        scale.value = Math.max(0.1, Math.min(5, touchStartScale.value * scaleChange))
        
        // Adjust translate to keep center point
        const center = getCenter(touches.value[0], touches.value[1])
        if (viewerRef.value) {
          const rect = viewerRef.value.getBoundingClientRect()
          const centerX = center.x - rect.left
          const centerY = center.y - rect.top
          
          const imageX = (centerX - touchStartTranslate.value.x) / touchStartScale.value
          const imageY = (centerY - touchStartTranslate.value.y) / touchStartScale.value
          
          translateX.value = centerX - imageX * scale.value
          translateY.value = centerY - imageY * scale.value
        }
        
        // Constrain during pinch zoom
        constrainTranslation()
      } else if (touches.value.length === 1 && isDragging.value) {
        // Single touch drag
        const deltaX = touches.value[0].clientX - dragStart.value.x
        const deltaY = touches.value[0].clientY - dragStart.value.y
        
        translateX.value = lastTranslate.value.x + deltaX
        translateY.value = lastTranslate.value.y + deltaY
        
        // Constrain during drag
        constrainTranslation()
      }
    }
    
    const handleTouchEnd = () => {
      if (touches.value.length <= 1) {
        // Final constraint check
        constrainTranslation()
        lastTranslate.value = { x: translateX.value, y: translateY.value }
        isDragging.value = false
      }
      touches.value = []
    }
    
    const loadPawns = async () => {
      try {
        const { data } = await api.get(`/sessions/${props.sessionId}/pawns`)
        const loadedPawns = data.pawns || []
        
        // Ensure all session members have pawns (auto-create if missing)
        if (props.isDm && sessionMembers.value.length > 0 && imageWidth.value > 0 && imageHeight.value > 0) {
          const memberIds = new Set(sessionMembers.value.map(m => m.user_id))
          const pawnOwnerIds = new Set(loadedPawns.map(p => p.owned_by).filter(Boolean))
          
          // Find members without pawns
          const membersWithoutPawns = sessionMembers.value.filter(m => 
            m.user_id && !pawnOwnerIds.has(m.user_id) && !m.is_dm
          )
          
          // Auto-create pawns for members without them
          for (const member of membersWithoutPawns) {
            try {
              const centerX = imageWidth.value / 2
              const centerY = imageHeight.value / 2
              
              await api.post(`/sessions/${props.sessionId}/pawns`, {
                name: member.nickname || member.users?.email?.split('@')[0] || 'Player',
                color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
                x_position: centerX,
                y_position: centerY,
                owned_by: member.user_id
              })
            } catch (err) {
              console.error('Error auto-creating pawn for member:', err)
            }
          }
          
          // Reload pawns after creating new ones
          if (membersWithoutPawns.length > 0) {
            const { data: reloadData } = await api.get(`/sessions/${props.sessionId}/pawns`)
            pawns.value = reloadData.pawns || []
            return
          }
        }
        
        pawns.value = loadedPawns
      } catch (err) {
        console.error('Error loading pawns:', err)
      }
    }
    
    const loadSessionMembers = async () => {
      try {
        const { data } = await api.get(`/sessions/${props.sessionId}`)
        sessionMembers.value = data.session.members || []
      } catch (err) {
        console.error('Error loading session members:', err)
      }
    }
    
    const getPawnStyle = (pawn) => {
      // Pawn positions are stored in image pixel coordinates (0 to imageWidth, 0 to imageHeight)
      // Convert to screen coordinates using current transform
      const imageX = parseFloat(pawn.x_position) || 0
      const imageY = parseFloat(pawn.y_position) || 0
      
      // Transform: screen = translate + (image * scale)
      const screenX = translateX.value + (imageX * scale.value)
      const screenY = translateY.value + (imageY * scale.value)
      
      return {
        position: 'absolute',
        left: `${screenX}px`,
        top: `${screenY}px`,
        transform: 'translate(-50%, -50%)', // Center the pawn on its position
        transformOrigin: 'center center'
      }
    }
    
    const getPawnInitial = (name) => {
      return name ? name.charAt(0).toUpperCase() : '?'
    }
    
    const handlePawnMouseDown = (e, pawn) => {
      // Check if user can move this pawn
      if (!props.isDm && pawn.owned_by !== props.currentUserId) {
        return
      }
      
      e.stopPropagation()
      e.preventDefault()
      
      if (!viewerRef.value) return
      
      const rect = viewerRef.value.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      
      draggingPawnId.value = pawn.id
      dragPawnStart.value = {
        x: e.clientX,
        y: e.clientY,
        mouseX: mouseX,
        mouseY: mouseY,
        pawnX: parseFloat(pawn.x_position),
        pawnY: parseFloat(pawn.y_position)
      }
      
      document.addEventListener('mousemove', handlePawnMouseMove)
      document.addEventListener('mouseup', handlePawnMouseUp)
    }
    
    const handlePawnMouseMove = (e) => {
      if (!draggingPawnId.value || !dragPawnStart.value || !viewerRef.value) return
      
      // Get the viewer's position relative to the viewport
      const rect = viewerRef.value.getBoundingClientRect()
      
      // Calculate mouse position relative to the viewer (screen coordinates)
      const screenX = e.clientX - rect.left
      const screenY = e.clientY - rect.top
      
      // Convert screen coordinates to image pixel coordinates
      // Reverse transform: image = (screen - translate) / scale
      const imageX = (screenX - translateX.value) / scale.value
      const imageY = (screenY - translateY.value) / scale.value
      
      // Clamp to image bounds
      const clampedX = Math.max(0, Math.min(imageWidth.value, imageX))
      const clampedY = Math.max(0, Math.min(imageHeight.value, imageY))
      
      // Update local state immediately for smooth dragging
      const pawn = pawns.value.find(p => p.id === draggingPawnId.value)
      if (pawn) {
        pawn.x_position = clampedX
        pawn.y_position = clampedY
      }
    }
    
    const handlePawnMouseUp = async () => {
      if (!draggingPawnId.value) return
      
      const pawn = pawns.value.find(p => p.id === draggingPawnId.value)
      if (pawn) {
        // Save position to server
        try {
          await api.put(`/pawns/${pawn.id}`, {
            x_position: pawn.x_position,
            y_position: pawn.y_position
          })
          emit('pawn-moved', pawn)
        } catch (err) {
          console.error('Error updating pawn position:', err)
          // Reload pawns to get correct position
          await loadPawns()
        }
      }
      
      draggingPawnId.value = null
      dragPawnStart.value = { x: 0, y: 0 }
      document.removeEventListener('mousemove', handlePawnMouseMove)
      document.removeEventListener('mouseup', handlePawnMouseUp)
    }
    
    const handlePawnTouchStart = (e, pawn) => {
      if (!props.isDm && pawn.owned_by !== props.currentUserId) {
        return
      }
      
      e.stopPropagation()
      if (e.touches.length === 1 && viewerRef.value) {
        const rect = viewerRef.value.getBoundingClientRect()
        const touchX = e.touches[0].clientX - rect.left
        const touchY = e.touches[0].clientY - rect.top
        
        draggingPawnId.value = pawn.id
        dragPawnStart.value = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          mouseX: touchX,
          mouseY: touchY,
          pawnX: parseFloat(pawn.x_position),
          pawnY: parseFloat(pawn.y_position)
        }
        
        document.addEventListener('touchmove', handlePawnTouchMove, { passive: false })
        document.addEventListener('touchend', handlePawnTouchEnd)
      }
    }
    
    const handlePawnTouchMove = (e) => {
      if (!draggingPawnId.value || !dragPawnStart.value || e.touches.length !== 1 || !viewerRef.value) return
      
      e.preventDefault()
      
      const rect = viewerRef.value.getBoundingClientRect()
      const screenX = e.touches[0].clientX - rect.left
      const screenY = e.touches[0].clientY - rect.top
      
      // Convert screen coordinates to image pixel coordinates
      const imageX = (screenX - translateX.value) / scale.value
      const imageY = (screenY - translateY.value) / scale.value
      
      // Clamp to image bounds
      const clampedX = Math.max(0, Math.min(imageWidth.value, imageX))
      const clampedY = Math.max(0, Math.min(imageHeight.value, imageY))
      
      const pawn = pawns.value.find(p => p.id === draggingPawnId.value)
      if (pawn) {
        pawn.x_position = clampedX
        pawn.y_position = clampedY
      }
    }
    
    const handlePawnTouchEnd = async () => {
      if (!draggingPawnId.value) return
      
      const pawn = pawns.value.find(p => p.id === draggingPawnId.value)
      if (pawn) {
        try {
          await api.put(`/pawns/${pawn.id}`, {
            x_position: pawn.x_position,
            y_position: pawn.y_position
          })
          emit('pawn-moved', pawn)
        } catch (err) {
          console.error('Error updating pawn position:', err)
          await loadPawns()
        }
      }
      
      draggingPawnId.value = null
      dragPawnStart.value = { x: 0, y: 0 }
      document.removeEventListener('touchmove', handlePawnTouchMove)
      document.removeEventListener('touchend', handlePawnTouchEnd)
    }
    
    const createPawn = async () => {
      creatingPawn.value = true
      
      try {
        // Get center of visible area in image pixel coordinates
        const screenCenterX = containerWidth.value / 2
        const screenCenterY = containerHeight.value / 2
        
        // Convert screen coordinates to image pixel coordinates
        const imageX = (screenCenterX - translateX.value) / scale.value
        const imageY = (screenCenterY - translateY.value) / scale.value
        
        // Clamp to image bounds
        const centerX = Math.max(0, Math.min(imageWidth.value, imageX))
        const centerY = Math.max(0, Math.min(imageHeight.value, imageY))
        
        // Set HP equal to max HP if max HP is provided
        const hp = newPawn.value.max_hp !== null && newPawn.value.max_hp !== undefined 
          ? newPawn.value.max_hp 
          : null

        const { data } = await api.post(`/sessions/${props.sessionId}/pawns`, {
          name: newPawn.value.name,
          color: newPawn.value.color,
          x_position: centerX, // Image pixel coordinate
          y_position: centerY, // Image pixel coordinate
          owned_by: newPawn.value.owned_by || null,
          hp: hp,
          max_hp: newPawn.value.max_hp || null
        })
        
        showCreatePawnModal.value = false
        newPawn.value = { name: '', color: '#667eea', owned_by: null, max_hp: null }
        await loadPawns()
        emit('pawn-created', data.pawn)
      } catch (err) {
        console.error('Error creating pawn:', err)
        alert(err.response?.data?.error || 'Failed to create pawn')
      } finally {
        creatingPawn.value = false
      }
    }

    const deletePawn = (pawn) => {
      if (!props.isDm) {
        return
      }
      pawnToDelete.value = pawn
    }

    const setEnemyStatus = async (status) => {
      if (!pawnToDelete.value) {
        return
      }

      settingStatus.value = true
      const pawn = pawnToDelete.value

      try {
        await api.put(`/pawns/${pawn.id}/status`, { status })
        await loadPawns()
        pawnToDelete.value = null
        // Emit event to parent to refresh enemy stats
        emit('enemy-status-changed')
      } catch (err) {
        console.error('Error setting enemy status:', err)
        alert(err.response?.data?.error || 'Failed to set enemy status')
      } finally {
        settingStatus.value = false
      }
    }

    const confirmDeletePawn = async () => {
      if (!pawnToDelete.value) {
        return
      }

      const pawn = pawnToDelete.value
      deletingPawnId.value = pawn.id

      try {
        await api.delete(`/pawns/${pawn.id}`)
        await loadPawns()
        pawnToDelete.value = null
      } catch (err) {
        console.error('Error deleting pawn:', err)
        alert(err.response?.data?.error || 'Failed to delete pawn')
      } finally {
        deletingPawnId.value = null
      }
    }

    const editPawnHp = (pawn) => {
      if (!props.isDm) {
        return
      }
      pawnToEditHp.value = pawn
      editingHp.value = pawn.hp !== null && pawn.hp !== undefined ? pawn.hp : 0
      editingMaxHp.value = pawn.max_hp !== null && pawn.max_hp !== undefined ? pawn.max_hp : null
    }

    const savePawnHp = async () => {
      if (!pawnToEditHp.value) {
        return
      }

      updatingHp.value = true

      try {
        await api.put(`/pawns/${pawnToEditHp.value.id}`, {
          hp: editingHp.value !== null && editingHp.value !== undefined ? editingHp.value : null,
          max_hp: editingMaxHp.value !== null && editingMaxHp.value !== undefined ? editingMaxHp.value : null
        })
        await loadPawns()
        pawnToEditHp.value = null
      } catch (err) {
        console.error('Error updating pawn HP:', err)
        alert(err.response?.data?.error || 'Failed to update pawn HP')
      } finally {
        updatingHp.value = false
      }
    }
    
    // Watch for scale/translate changes - pawn positions are recalculated in getPawnStyle
    // No action needed here as getPawnStyle is reactive
    
    onMounted(async () => {
      updateContainerSize()
      window.addEventListener('resize', updateContainerSize)
      
      // Only load pawns if sessionId is provided
      if (props.sessionId) {
        try {
          if (props.isDm) {
            await loadSessionMembers()
          }
          
          // Wait for image to load before loading pawns (so we have image dimensions)
          if (imageRef.value && imageRef.value.complete) {
            await loadPawns()
          } else {
            // Wait for image load event
            imageRef.value?.addEventListener('load', async () => {
              await loadPawns()
            }, { once: true })
          }
          
          // Poll for pawn updates every 2 seconds
          pawnsPollInterval = setInterval(() => {
            if (imageWidth.value > 0 && imageHeight.value > 0) {
              loadPawns()
            }
          }, 2000)
        } catch (err) {
          console.error('Error loading pawns:', err)
        }
      }
    })
    
    onUnmounted(() => {
      window.removeEventListener('resize', updateContainerSize)
      if (pawnsPollInterval) {
        clearInterval(pawnsPollInterval)
      }
      document.removeEventListener('mousemove', handlePawnMouseMove)
      document.removeEventListener('mouseup', handlePawnMouseUp)
      document.removeEventListener('touchmove', handlePawnTouchMove)
      document.removeEventListener('touchend', handlePawnTouchEnd)
    })
    
    return {
      containerRef,
      viewerRef,
      imageRef,
      scale,
      translateX,
      translateY,
      imageStyle,
      handleImageLoad,
      resetView,
      zoomIn,
      zoomOut,
      handleWheel,
      handleMouseDown,
      handleMouseMove,
      handleMouseUp,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      pawns,
      getPawnStyle,
      getPawnInitial,
      handlePawnMouseDown,
      handlePawnTouchStart,
      showCreatePawnModal,
      newPawn,
      creatingPawn,
      deletingPawnId,
      pawnToDelete,
      pawnToEditHp,
      editingHp,
      editingMaxHp,
      updatingHp,
      createPawn,
      deletePawn,
      confirmDeletePawn,
      setEnemyStatus,
      settingStatus,
      editPawnHp,
      savePawnHp,
      sessionMembers,
      draggingPawnId
    }
  }
}
</script>

<style scoped>
.map-viewer-container {
  position: relative;
  width: 100%;
  height: 500px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 2px 8px var(--shadow);
  border: 1px solid var(--border-color);
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.map-viewer-controls {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
  display: flex;
  gap: 6px;
  align-items: center;
  background: rgba(0, 0, 0, 0.7);
  padding: 6px;
  border-radius: 6px;
  backdrop-filter: blur(10px);
}

.control-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 5px;
  font-size: 18px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: scale(1.1);
}

.control-btn:active {
  transform: scale(0.95);
}

.zoom-level {
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 0 6px;
  min-width: 45px;
  text-align: center;
}

.map-viewer {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.map-viewer:active {
  cursor: grabbing;
}

.map-image-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  transition: transform 0.1s ease-out;
  will-change: transform;
}

.map-image {
  display: block;
  max-width: none;
  width: auto;
  height: auto;
}

/* Prevent image dragging */
.map-image {
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  user-drag: none;
}

.pawns-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.pawn {
  position: absolute;
  pointer-events: auto;
  cursor: move;
  z-index: 100;
  transition: left 0.05s linear, top 0.05s linear;
  will-change: left, top;
}

.pawn-dragging {
  z-index: 200;
  cursor: grabbing;
}

.pawn-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  transition: all 0.2s ease;
}

.pawn-owned .pawn-circle {
  border-color: #ffc107;
  box-shadow: 0 2px 12px rgba(255, 193, 7, 0.5);
}

.pawn-dm-control .pawn-circle {
  border-color: #28a745;
}

.pawn:hover .pawn-circle {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.pawn-initial {
  color: white;
  font-weight: bold;
  font-size: 16px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.pawn-label {
  margin-top: 3px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 10px;
  white-space: nowrap;
  text-align: center;
  backdrop-filter: blur(4px);
}

.pawn-hp {
  margin-top: 2px;
  background: rgba(0, 0, 0, 0.7);
  color: #ffc107;
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  text-align: center;
  backdrop-filter: blur(4px);
  transition: all 0.2s ease;
}

.pawn-hp-clickable {
  cursor: pointer;
}

.pawn-hp-clickable:hover {
  background: rgba(0, 0, 0, 0.9);
  transform: scale(1.05);
}

.pawn-delete-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #dc3545;
  color: white;
  border: 2px solid white;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.2s ease;
  z-index: 10;
}

.pawn-delete-btn:hover:not(:disabled) {
  background: #c82333;
  transform: scale(1.1);
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
}

.pawn-delete-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.create-pawn-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  width: 40px;
  height: 40px;
  border: none;
  background: #667eea;
  color: white;
  border-radius: 50%;
  font-size: 24px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
  z-index: 20;
  transition: all 0.2s ease;
}

.create-pawn-btn:hover {
  background: #5568d3;
  transform: scale(1.1);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
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
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 20px;
  width: 90%;
  max-width: 400px;
  transition: background 0.3s ease;
}

.modal-content h3 {
  margin-bottom: 12px;
  color: #667eea;
  font-size: 18px;
}

.modal-content p {
  margin: 12px 0;
  color: #333;
  line-height: 1.5;
}

.delete-warning {
  color: #dc3545;
  font-weight: 600;
  font-size: 13px;
}

.btn-danger {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-danger:hover:not(:disabled) {
  background: #c82333;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(220, 53, 69, 0.3);
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.enemy-status-buttons {
  display: flex;
  gap: 12px;
  margin: 20px 0;
  flex-wrap: wrap;
}

.btn-status {
  flex: 1;
  min-width: 120px;
  padding: 12px 20px;
  font-size: 16px;
  font-weight: 600;
}

.btn-warning {
  background: #ffc107;
  color: #333;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-warning:hover:not(:disabled) {
  background: #e0a800;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(255, 193, 7, 0.3);
}

.btn-info {
  background: #17a2b8;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-info:hover:not(:disabled) {
  background: #138496;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(23, 162, 184, 0.3);
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
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
  color: #555;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
}

.form-group small {
  display: block;
  margin-top: 4px;
  color: #666;
  font-size: 12px;
}

.form-group input[type="color"] {
  height: 40px;
  cursor: pointer;
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

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Touch device optimizations */
@media (max-width: 768px) {
  .map-viewer-container {
    height: 400px;
  }
  
  .map-viewer-controls {
    top: 8px;
    right: 8px;
    padding: 6px;
    gap: 6px;
  }
  
  .control-btn {
    width: 32px;
    height: 32px;
    font-size: 18px;
  }
  
  .pawn-circle {
    width: 32px;
    height: 32px;
  }
  
  .pawn-initial {
    font-size: 14px;
  }
  
  .pawn-label {
    font-size: 10px;
  }
  
  .create-pawn-btn {
    width: 40px;
    height: 40px;
    font-size: 24px;
  }
}
</style>

