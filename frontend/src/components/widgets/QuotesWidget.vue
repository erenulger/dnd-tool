<template>
  <div class="quotes-widget card">
    <div class="quotes-widget-header">
      <h3>💬 Memorable Quotes</h3>
      <button @click="$emit('manage')" class="btn btn-primary btn-small">
        Manage
      </button>
    </div>
    <div class="quotes-cycler">
      <transition name="fade" mode="out-in">
        <div v-if="currentQuote" :key="currentIndex" class="quote-display">
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
          :class="['quote-indicator', index === currentIndex ? 'active' : '']"
          @click="$emit('select', index)"
        ></span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'QuotesWidget',
  props: {
    quotes: {
      type: Array,
      required: true,
      default: () => []
    },
    currentIndex: {
      type: Number,
      default: 0
    }
  },
  emits: ['manage', 'select'],
  computed: {
    currentQuote() {
      if (this.quotes.length === 0) return null
      return this.quotes[this.currentIndex % this.quotes.length]
    }
  }
}
</script>

<style scoped>
.quotes-widget {
  margin-bottom: 0;
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
  color: var(--quote-accent);
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
  background: var(--quote-accent);
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
</style>

