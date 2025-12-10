<template>
  <div v-if="show" class="notes-modal-overlay" @click.self="$emit('close')">
    <div class="notes-modal apple-notes-style">
      <div class="notes-modal-header">
        <h2>📝 My Notes</h2>
        <button @click="$emit('close')" class="notes-close-btn">×</button>
      </div>
      <div class="notes-modal-content">
        <div class="notes-list-apple">
          <div 
            v-for="note in notes" 
            :key="note.id"
            class="note-item-apple"
          >
            <div class="note-content-wrapper">
              <div v-if="note.title" class="note-title-apple">{{ note.title }}</div>
              <div class="note-text-apple">{{ note.note_text }}</div>
            </div>
            <button 
              @click="$emit('delete', note.id)" 
              class="note-delete-btn-apple"
              :disabled="deletingId === note.id"
              title="Delete Note"
            >
              ×
            </button>
          </div>
          <div v-if="!notes || notes.length === 0" class="no-notes-apple">
            <p>No notes yet. Start writing below!</p>
          </div>
        </div>
        <div class="add-note-form-apple">
          <input 
            v-model="newTitle" 
            placeholder="Note title (optional)"
            class="note-title-input-apple"
            maxlength="200"
          />
          <textarea 
            v-model="newText" 
            placeholder="Write a note..."
            rows="4"
            class="note-input-apple"
            @keydown.ctrl.enter="$emit('add', { title: newTitle, text: newText })"
            @keydown.meta.enter="$emit('add', { title: newTitle, text: newText })"
          ></textarea>
          <button 
            @click="$emit('add', { title: newTitle, text: newText })" 
            class="note-add-btn-apple"
            :disabled="adding || !newText.trim()"
          >
            {{ adding ? 'Adding...' : 'Add Note' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'PersonalNotesModal',
  props: {
    show: Boolean,
    notes: Array,
    adding: Boolean,
    deletingId: String
  },
  emits: ['close', 'add', 'delete'],
  data() {
    return {
      newTitle: '',
      newText: ''
    }
  },
  watch: {
    show(newVal) {
      if (!newVal) {
        this.newTitle = ''
        this.newText = ''
      }
    }
  }
}
</script>

<style scoped>
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
</style>

