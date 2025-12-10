import { ref, computed, watch } from 'vue'
import api from '../lib/api'

export function useQuotes(sessionId, currentUserId, isDmOrDeveloper) {
  const quotes = ref([])
  const deletingQuoteId = ref(null)
  const quoteToDelete = ref(null)
  const editingQuoteId = ref(null)
  const editQuote = ref({
    text: '',
    author: ''
  })
  const updatingQuote = ref(false)
  const addingQuote = ref(false)
  const newQuote = ref({
    text: '',
    author: ''
  })
  const currentQuoteIndex = ref(0)
  let quoteCycleInterval = null

  const loadQuotes = async () => {
    try {
      const { data } = await api.get(`/sessions/${sessionId}/quotes`)
      quotes.value = data.quotes || []
    } catch (err) {
      console.error('Error loading quotes:', err)
    }
  }

  const currentQuote = computed(() => {
    if (quotes.value.length === 0) return null
    return quotes.value[currentQuoteIndex.value % quotes.value.length]
  })

  const canEditQuote = (quote) => {
    if (!currentUserId.value || !isDmOrDeveloper.value) return false
    // Creator can edit their own quotes
    if (quote.created_by === currentUserId.value) return true
    // DM or developer can edit any quote
    if (isDmOrDeveloper.value) return true
    return false
  }

  const startEditQuote = (quote) => {
    editingQuoteId.value = quote.id
    editQuote.value = {
      text: quote.quote_text,
      author: quote.author_name
    }
  }

  const cancelEditQuote = () => {
    editingQuoteId.value = null
    editQuote.value = { text: '', author: '' }
  }

  const updateQuote = async (quoteId) => {
    if (!editQuote.value.text.trim() || !editQuote.value.author.trim()) {
      alert('Both quote text and author name are required')
      return
    }

    updatingQuote.value = true

    try {
      await api.put(`/quotes/${quoteId}`, {
        quote_text: editQuote.value.text,
        author_name: editQuote.value.author
      })
      
      await loadQuotes()
      cancelEditQuote()
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to update quote')
    } finally {
      updatingQuote.value = false
    }
  }

  const addQuote = async () => {
    addingQuote.value = true

    try {
      await api.post(`/sessions/${sessionId}/quotes`, {
        quote_text: newQuote.value.text,
        author_name: newQuote.value.author
      })
      
      newQuote.value = { text: '', author: '' }
      await loadQuotes()
    } catch (err) {
      alert(err.response?.data?.error || err.message || 'Failed to add quote')
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

  return {
    quotes,
    currentQuote,
    currentQuoteIndex,
    deletingQuoteId,
    quoteToDelete,
    editingQuoteId,
    editQuote,
    updatingQuote,
    addingQuote,
    newQuote,
    canEditQuote,
    startEditQuote,
    cancelEditQuote,
    updateQuote,
    addQuote,
    confirmDeleteQuote,
    loadQuotes,
    startQuoteCycle,
    stopQuoteCycle
  }
}

