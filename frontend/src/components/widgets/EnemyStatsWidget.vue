<template>
  <div class="enemy-stats-widget card">
    <div class="enemy-stats-header">
      <h3>⚔️ Enemy Statistics</h3>
      <button @click="$emit('show-all')" class="btn btn-primary btn-small">
        Show All
      </button>
    </div>
    <div class="enemy-stats-content">
      <div class="stat-item">
        <span class="stat-label">Killed:</span>
        <span class="stat-value">{{ stats.killed }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Fled:</span>
        <span class="stat-value">{{ stats.fled }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Freed:</span>
        <span class="stat-value">{{ stats.freed }}</span>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EnemyStatsWidget',
  props: {
    stats: {
      type: Object,
      required: true,
      default: () => ({ killed: 0, fled: 0, freed: 0, total: 0 })
    }
  },
  emits: ['show-all']
}
</script>

<style scoped>
.enemy-stats-widget {
  margin-bottom: 0;
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
  color: var(--header-text);
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
  color: var(--primary-color);
}

@media (max-width: 768px) {
  .enemy-stats-content {
    flex-direction: column;
    gap: 8px;
  }
}
</style>

