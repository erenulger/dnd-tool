import { ref } from 'vue'
import api from '../lib/api'

export function useEnemyStats(sessionId) {
  const enemies = ref([])
  const enemyStats = ref({
    killed: 0,
    fled: 0,
    freed: 0,
    total: 0
  })

  const loadEnemyStats = async () => {
    try {
      const { data } = await api.get(`/sessions/${sessionId}/enemies`)
      enemies.value = data.enemies || []
      enemyStats.value = data.stats || { killed: 0, fled: 0, freed: 0, total: 0 }
    } catch (err) {
      console.error('Error loading enemy stats:', err)
    }
  }

  return {
    enemies,
    enemyStats,
    loadEnemyStats
  }
}

