import { ref } from 'vue'
import api from '../lib/api'

export function useNotes(sessionId) {
  const personalNotes = ref([])
  const sharedNotes = ref([])
  const newPersonalNote = ref('')
  const newPersonalNoteTitle = ref('')
  const newSharedNote = ref('')
  const newSharedNoteTitle = ref('')
  const addingPersonalNote = ref(false)
  const addingSharedNote = ref(false)
  const deletingPersonalNoteId = ref(null)
  const deletingSharedNoteId = ref(null)

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
        title: newPersonalNoteTitle.value.trim() || null,
        note_text: newPersonalNote.value.trim()
      })
      newPersonalNoteTitle.value = ''
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
        note_text: newSharedNote.value.trim()
      })
      newSharedNote.value = ''
      newSharedNoteTitle.value = ''
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

  return {
    personalNotes,
    sharedNotes,
    newPersonalNote,
    newPersonalNoteTitle,
    newSharedNote,
    newSharedNoteTitle,
    addingPersonalNote,
    addingSharedNote,
    deletingPersonalNoteId,
    deletingSharedNoteId,
    loadPersonalNotes,
    loadSharedNotes,
    addPersonalNote,
    addSharedNote,
    deletePersonalNote,
    deleteSharedNote
  }
}

