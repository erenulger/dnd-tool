<template>
  <div class="character-sheet-preview card">
    <div class="preview-header">
      <h3>📜 Character Sheet</h3>
      <button @click="goToFullSheet" class="btn-icon-small" title="Open Full Sheet">→</button>
    </div>

    <div v-if="loading" class="preview-loading">
      Loading...
    </div>

    <div v-else-if="error" class="preview-error">
      {{ error }}
    </div>

    <div v-else-if="characterSheet" class="preview-content">
      <!-- Tab Indicators -->
      <div class="tab-indicators">
        <div 
          v-for="(tab, index) in tabs" 
          :key="index"
          :class="['tab-indicator', { active: currentTab === index }]"
          @click="currentTab = index"
        ></div>
      </div>

      <!-- Swipeable Content Container -->
      <div 
        class="swipe-container"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="handleTouchEnd"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseEnd"
        @mouseleave="handleMouseEnd"
      >
        <div 
          class="swipe-wrapper"
          :style="{ transform: `translateX(${-currentTab * 100 + dragOffset}%)` }"
        >
          <!-- Tab 1: Ability Scores, Saving Throws & Skills -->
          <div class="swipe-panel">
            <div class="panel-section abilities-saves-section">
              <div class="abilities-column">
                <h4>Ability Scores</h4>
                <div class="abilities-compact">
                  <div 
                    v-for="ability in abilities" 
                    :key="ability.name"
                    class="ability-compact"
                  >
                    <div class="ability-label">{{ ability.abbr }}</div>
                    <div class="ability-value">
                      {{ getModifier(characterSheet[ability.name.toLowerCase()]) >= 0 ? '+' : '' }}{{ getModifier(characterSheet[ability.name.toLowerCase()]) }}
                    </div>
                  </div>
                </div>
              </div>
              <div class="saving-throws-column">
                <h4>Saving Throws</h4>
                <div class="saving-throws-compact">
                  <div 
                    v-for="ability in abilities" 
                    :key="ability.name"
                    class="saving-throw-compact"
                  >
                    <span class="saving-throw-label">
                      {{ ability.abbr }}
                      <span v-if="characterSheet.saving_throws?.[ability.name.toLowerCase()]" class="proficient-badge">★</span>
                    </span>
                    <span class="saving-throw-value">
                      {{ getSavingThrowModifier(ability.name.toLowerCase()) >= 0 ? '+' : '' }}{{ getSavingThrowModifier(ability.name.toLowerCase()) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="skills-column">
                <h4>Skills</h4>
                <div class="skills-compact">
                  <div 
                    v-for="skill in firstHalfSkills" 
                    :key="skill.name"
                    class="skill-compact"
                  >
                    <span class="skill-label">
                      {{ skill.name }}
                      <span v-if="characterSheet.skills?.[skill.name]" class="proficient-badge">★</span>
                    </span>
                    <span class="skill-value">
                      {{ getSkillModifier(skill) >= 0 ? '+' : '' }}{{ getSkillModifier(skill) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="skills-column">
                <h4 style="opacity: 0;">Skills</h4>
                <div class="skills-compact">
                  <div 
                    v-for="skill in secondHalfSkills" 
                    :key="skill.name"
                    class="skill-compact"
                  >
                    <span class="skill-label">
                      {{ skill.name }}
                      <span v-if="characterSheet.skills?.[skill.name]" class="proficient-badge">★</span>
                    </span>
                    <span class="skill-value">
                      {{ getSkillModifier(skill) >= 0 ? '+' : '' }}{{ getSkillModifier(skill) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 2: Equipment -->
          <div class="swipe-panel">
            <div class="panel-section">
              <h4>Equipment</h4>
              <div v-if="equipmentList.length === 0" class="empty-state">
                No equipment
              </div>
              <div v-else class="equipment-compact">
                <div 
                  v-for="(item, index) in equipmentList.slice(0, 10)" 
                  :key="index"
                  class="equipment-item-compact"
                >
                  {{ item }}
                </div>
                <div v-if="equipmentList.length > 10" class="more-items">
                  +{{ equipmentList.length - 10 }} more
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 4: Spell Slots (renumbered from Tab 4) -->
          <div class="swipe-panel">
            <div class="panel-section">
              <h4>Spell Slots</h4>
              <div v-if="!spellSlots || Object.keys(spellSlots).length === 0" class="empty-state">
                No spell slots configured
              </div>
              <div v-else class="spell-slots-compact">
                <div 
                  v-for="(slot, level) in spellSlots" 
                  :key="level"
                  class="spell-slot-level"
                >
                  <div class="spell-slot-header">
                    <span class="spell-slot-level-label">Level {{ level }}</span>
                    <span class="spell-slot-count">{{ slot.used || 0 }} / {{ slot.total || 0 }}</span>
                  </div>
                  <div class="spell-slot-bars">
                    <div 
                      v-for="i in (slot.total || 0)" 
                      :key="i"
                      :class="['spell-slot-bar', { used: i <= (slot.used || 0) }]"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="spellsList.length > 0" class="panel-section">
              <h4>Known Spells ({{ spellsList.length }})</h4>
              <div class="spells-compact">
                <div 
                  v-for="(spell, index) in spellsList.slice(0, 5)" 
                  :key="index"
                  class="spell-item-compact"
                >
                  {{ spell }}
                </div>
                <div v-if="spellsList.length > 5" class="more-items">
                  +{{ spellsList.length - 5 }} more
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '../lib/api'

export default {
  name: 'CharacterSheetPreview',
  props: {
    sessionId: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const router = useRouter()
    const characterSheet = ref(null)
    const loading = ref(true)
    const error = ref('')
    const currentTab = ref(0)
    const dragStart = ref(0)
    const dragOffset = ref(0)
    const isDragging = ref(false)

    const tabs = [
      { name: 'Abilities', icon: '⚔️' },
      { name: 'Skills', icon: '🎯' },
      { name: 'Equipment', icon: '🎒' },
      { name: 'Spells', icon: '✨' }
    ]

    const abilities = [
      { name: 'Strength', abbr: 'STR' },
      { name: 'Dexterity', abbr: 'DEX' },
      { name: 'Constitution', abbr: 'CON' },
      { name: 'Intelligence', abbr: 'INT' },
      { name: 'Wisdom', abbr: 'WIS' },
      { name: 'Charisma', abbr: 'CHA' }
    ]

    const skills = [
      { name: 'Acrobatics', ability: 'DEX' },
      { name: 'Animal Handling', ability: 'WIS' },
      { name: 'Arcana', ability: 'INT' },
      { name: 'Athletics', ability: 'STR' },
      { name: 'Deception', ability: 'CHA' },
      { name: 'History', ability: 'INT' },
      { name: 'Insight', ability: 'WIS' },
      { name: 'Intimidation', ability: 'CHA' },
      { name: 'Investigation', ability: 'INT' },
      { name: 'Medicine', ability: 'WIS' },
      { name: 'Nature', ability: 'INT' },
      { name: 'Perception', ability: 'WIS' },
      { name: 'Performance', ability: 'CHA' },
      { name: 'Persuasion', ability: 'CHA' },
      { name: 'Religion', ability: 'INT' },
      { name: 'Sleight of Hand', ability: 'DEX' },
      { name: 'Stealth', ability: 'DEX' },
      { name: 'Survival', ability: 'WIS' }
    ]

    // Split skills into two halves for two columns
    const firstHalfSkills = computed(() => {
      return skills.slice(0, Math.ceil(skills.length / 2))
    })

    const secondHalfSkills = computed(() => {
      return skills.slice(Math.ceil(skills.length / 2))
    })

    const equipmentList = computed(() => {
      if (!characterSheet.value || !characterSheet.value.equipment) return []
      return Array.isArray(characterSheet.value.equipment) 
        ? characterSheet.value.equipment.filter(item => item && item.trim() !== '')
        : []
    })

    const spellsList = computed(() => {
      if (!characterSheet.value || !characterSheet.value.spells) return []
      return Array.isArray(characterSheet.value.spells) 
        ? characterSheet.value.spells.filter(spell => spell && spell.trim() !== '')
        : []
    })

    const spellSlots = computed(() => {
      if (!characterSheet.value || !characterSheet.value.spell_slots) return {}
      return characterSheet.value.spell_slots
    })

    const getModifier = (score) => {
      if (!score) return 0
      return Math.floor((score - 10) / 2)
    }

    const getSavingThrowModifier = (abilityName) => {
      if (!characterSheet.value) return 0
      const score = characterSheet.value[abilityName] || 10
      const baseModifier = getModifier(score)
      const isProficient = characterSheet.value.saving_throws?.[abilityName] || false
      const proficiencyBonus = characterSheet.value.proficiency_bonus || 0
      return baseModifier + (isProficient ? proficiencyBonus : 0)
    }

    const getSkillModifier = (skill) => {
      if (!characterSheet.value) return 0
      const abilityName = skill.ability.toLowerCase()
      const score = characterSheet.value[abilityName] || 10
      const baseModifier = getModifier(score)
      const isProficient = characterSheet.value.skills?.[skill.name] || false
      const proficiencyBonus = characterSheet.value.proficiency_bonus || 0
      return baseModifier + (isProficient ? proficiencyBonus : 0)
    }

    const loadCharacterSheet = async () => {
      loading.value = true
      error.value = ''
      
      try {
        const { data } = await api.get(`/sessions/${props.sessionId}/character-sheet`)
        characterSheet.value = data.characterSheet

        // Ensure objects exist
        if (!characterSheet.value.saving_throws) {
          characterSheet.value.saving_throws = {}
        }
        if (!characterSheet.value.skills) {
          characterSheet.value.skills = {}
        }
        if (!characterSheet.value.equipment) {
          characterSheet.value.equipment = []
        }
        if (!characterSheet.value.spells) {
          characterSheet.value.spells = []
        }
        if (!characterSheet.value.spell_slots) {
          characterSheet.value.spell_slots = {}
        }
      } catch (err) {
        console.error('Error loading character sheet:', err)
        error.value = err.response?.data?.error || err.message || 'Failed to load character sheet'
      } finally {
        loading.value = false
      }
    }

    const goToFullSheet = () => {
      router.push(`/session/${props.sessionId}/character`)
    }

    // Touch handlers for mobile swipe
    const handleTouchStart = (e) => {
      dragStart.value = e.touches[0].clientX
      isDragging.value = true
    }

    const handleTouchMove = (e) => {
      if (!isDragging.value) return
      const currentX = e.touches[0].clientX
      const diff = dragStart.value - currentX
      const panelWidth = e.currentTarget.offsetWidth
      dragOffset.value = (diff / panelWidth) * 100
    }

    const handleTouchEnd = () => {
      if (!isDragging.value) return
      isDragging.value = false
      
      const threshold = 30 // 30% of panel width to trigger swipe
      if (Math.abs(dragOffset.value) > threshold) {
        if (dragOffset.value > 0 && currentTab.value < tabs.length - 1) {
          currentTab.value++
        } else if (dragOffset.value < 0 && currentTab.value > 0) {
          currentTab.value--
        }
      }
      
      dragOffset.value = 0
    }

    // Mouse handlers for desktop drag
    const handleMouseDown = (e) => {
      dragStart.value = e.clientX
      isDragging.value = true
    }

    const handleMouseMove = (e) => {
      if (!isDragging.value) return
      const currentX = e.clientX
      const diff = dragStart.value - currentX
      const panelWidth = e.currentTarget.offsetWidth
      dragOffset.value = (diff / panelWidth) * 100
    }

    const handleMouseEnd = () => {
      if (!isDragging.value) return
      isDragging.value = false
      
      const threshold = 30
      if (Math.abs(dragOffset.value) > threshold) {
        if (dragOffset.value > 0 && currentTab.value < tabs.length - 1) {
          currentTab.value++
        } else if (dragOffset.value < 0 && currentTab.value > 0) {
          currentTab.value--
        }
      }
      
      dragOffset.value = 0
    }

    onMounted(() => {
      loadCharacterSheet()
    })

    return {
      characterSheet,
      loading,
      error,
      currentTab,
      tabs,
      abilities,
      skills,
      firstHalfSkills,
      secondHalfSkills,
      equipmentList,
      spellsList,
      spellSlots,
      dragOffset,
      getModifier,
      getSavingThrowModifier,
      getSkillModifier,
      goToFullSheet,
      handleTouchStart,
      handleTouchMove,
      handleTouchEnd,
      handleMouseDown,
      handleMouseMove,
      handleMouseEnd
    }
  }
}
</script>

<style scoped>
.character-sheet-preview {
  max-height: 500px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #667eea;
}

.preview-header h3 {
  margin: 0;
  font-size: 16px;
  color: #667eea;
}

.btn-icon-small {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #667eea;
  padding: 4px 8px;
  transition: transform 0.2s;
}

.btn-icon-small:hover {
  transform: translateX(2px);
}

.preview-loading,
.preview-error {
  padding: 20px;
  text-align: center;
  color: var(--text-secondary);
}

.preview-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tab-indicators {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.tab-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ddd;
  cursor: pointer;
  transition: background 0.2s;
}

.dark-theme .tab-indicator {
  background: #555;
}

.tab-indicator.active {
  background: #667eea;
  width: 24px;
  border-radius: 4px;
}

.swipe-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  cursor: grab;
  user-select: none;
}

.swipe-container:active {
  cursor: grabbing;
}

.swipe-wrapper {
  display: flex;
  height: 100%;
  transition: transform 0.3s ease;
  will-change: transform;
}

.swipe-panel {
  min-width: 100%;
  flex-shrink: 0;
  overflow-y: auto;
  padding-right: 8px;
}

.panel-section {
  margin-bottom: 16px;
}

.panel-section:last-child {
  margin-bottom: 0;
}

.panel-section h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
}

/* Abilities & Saving Throws - Four Column Layout */
.abilities-saves-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 8px;
}

.column-spacer {
  /* Empty column for spacing */
}

.abilities-column,
.saving-throws-column,
.skills-column {
  display: flex;
  flex-direction: column;
}

.abilities-column h4,
.saving-throws-column h4,
.skills-column h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
}

/* Abilities */
.abilities-compact {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.ability-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  background: #f8f9fa;
  border-radius: 4px;
}

.dark-theme .ability-compact {
  background: var(--bg-secondary);
}

.ability-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 32px;
}

.ability-value {
  font-size: 13px;
  font-weight: 700;
  color: #667eea;
}

/* Saving Throws */
.saving-throws-compact {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.saving-throw-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  background: #f8f9fa;
  border-radius: 4px;
}

.dark-theme .saving-throw-compact {
  background: var(--bg-secondary);
}

.saving-throw-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 32px;
  display: flex;
  align-items: center;
}

.proficient-badge {
  color: #ffa500;
  margin-left: 3px;
  font-size: 9px;
}

.saving-throw-value {
  font-size: 13px;
  font-weight: 700;
  color: #667eea;
}

/* Skills */
.skills-compact {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.skill-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  background: #f8f9fa;
  border-radius: 4px;
}

.dark-theme .skill-compact {
  background: var(--bg-secondary);
}

.skill-label {
  font-size: 12px;
  color: var(--text-primary);
}

.skill-value {
  font-size: 14px;
  font-weight: 600;
  color: #667eea;
}

/* Equipment */
.equipment-compact {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.equipment-item-compact {
  padding: 6px 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
}

.dark-theme .equipment-item-compact {
  background: var(--bg-secondary);
}

/* Spell Slots */
.spell-slots-compact {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spell-slot-level {
  padding: 8px;
  background: #f8f9fa;
  border-radius: 6px;
}

.dark-theme .spell-slot-level {
  background: var(--bg-secondary);
}

.spell-slot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.spell-slot-level-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.spell-slot-count {
  font-size: 11px;
  color: var(--text-secondary);
}

.spell-slot-bars {
  display: flex;
  gap: 4px;
}

.spell-slot-bar {
  flex: 1;
  height: 8px;
  background: #e0e0e0;
  border-radius: 2px;
  transition: background 0.2s;
}

.dark-theme .spell-slot-bar {
  background: #444;
}

.spell-slot-bar.used {
  background: #667eea;
}

/* Spells List */
.spells-compact {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}

.spell-item-compact {
  padding: 6px 8px;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
}

.dark-theme .spell-item-compact {
  background: var(--bg-secondary);
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
  font-size: 12px;
  font-style: italic;
}

.more-items {
  text-align: center;
  padding: 8px;
  color: var(--text-secondary);
  font-size: 11px;
  font-style: italic;
}

/* Scrollbar styling */
.swipe-panel::-webkit-scrollbar,
.skills-compact::-webkit-scrollbar,
.equipment-compact::-webkit-scrollbar,
.spells-compact::-webkit-scrollbar {
  width: 6px;
}

.swipe-panel::-webkit-scrollbar-track,
.skills-compact::-webkit-scrollbar-track,
.equipment-compact::-webkit-scrollbar-track,
.spells-compact::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.dark-theme .swipe-panel::-webkit-scrollbar-track,
.dark-theme .skills-compact::-webkit-scrollbar-track,
.dark-theme .equipment-compact::-webkit-scrollbar-track,
.dark-theme .spells-compact::-webkit-scrollbar-track {
  background: #333;
}

.swipe-panel::-webkit-scrollbar-thumb,
.skills-compact::-webkit-scrollbar-thumb,
.equipment-compact::-webkit-scrollbar-thumb,
.spells-compact::-webkit-scrollbar-thumb {
  background: #667eea;
  border-radius: 3px;
}

.swipe-panel::-webkit-scrollbar-thumb:hover,
.skills-compact::-webkit-scrollbar-thumb:hover,
.equipment-compact::-webkit-scrollbar-thumb:hover,
.spells-compact::-webkit-scrollbar-thumb:hover {
  background: #5568d3;
}
</style>

