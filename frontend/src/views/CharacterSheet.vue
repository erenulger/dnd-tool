<template>
  <div class="character-sheet">
    <div class="container">
      <div v-if="loading" class="loading">Loading character sheet...</div>
      
      <div v-if="error" class="error">
        {{ error }}
        <button @click="loadCharacterSheet" style="margin-top: 10px;" class="btn btn-primary">
          Retry
        </button>
      </div>

      <div v-if="characterSheet && !loading" class="sheet-content">
        <div class="sheet-header">
          <h1>📜 Character Sheet</h1>
          <div class="header-actions">
            <button @click="goBack" class="btn btn-secondary">← Back to Session</button>
            <button @click="saveCharacterSheet" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving...' : '💾 Save' }}
            </button>
          </div>
        </div>

        <div class="sheet-grid">
          <!-- Basic Information -->
          <div class="card section-basic">
            <h2>Basic Information</h2>
            <div class="form-grid">
              <div class="form-group">
                <label>Character Name</label>
                <input type="text" v-model="characterSheet.character_name" placeholder="Enter character name" />
              </div>
              <div class="form-group">
                <label>Class</label>
                <input type="text" v-model="characterSheet.character_class" placeholder="e.g., Fighter" />
              </div>
              <div class="form-group">
                <label>Level</label>
                <input type="number" v-model.number="characterSheet.level" min="1" max="20" />
              </div>
              <div class="form-group">
                <label>Race</label>
                <input type="text" v-model="characterSheet.race" placeholder="e.g., Human" />
              </div>
              <div class="form-group">
                <label>Background</label>
                <input type="text" v-model="characterSheet.background" placeholder="e.g., Soldier" />
              </div>
              <div class="form-group">
                <label>Alignment</label>
                <select v-model="characterSheet.alignment">
                  <option value="">Select alignment</option>
                  <option value="Lawful Good">Lawful Good</option>
                  <option value="Neutral Good">Neutral Good</option>
                  <option value="Chaotic Good">Chaotic Good</option>
                  <option value="Lawful Neutral">Lawful Neutral</option>
                  <option value="True Neutral">True Neutral</option>
                  <option value="Chaotic Neutral">Chaotic Neutral</option>
                  <option value="Lawful Evil">Lawful Evil</option>
                  <option value="Neutral Evil">Neutral Evil</option>
                  <option value="Chaotic Evil">Chaotic Evil</option>
                </select>
              </div>
              <div class="form-group">
                <label>Experience Points</label>
                <input type="number" v-model.number="characterSheet.experience_points" min="0" />
              </div>
            </div>
          </div>

          <!-- Ability Scores -->
          <div class="card section-abilities">
            <h2>Ability Scores</h2>
            <div class="abilities-grid">
              <div class="ability-score" v-for="ability in abilities" :key="ability.name">
                <div class="ability-name">{{ ability.abbr }}</div>
                <input 
                  type="number" 
                  v-model.number="characterSheet[ability.name.toLowerCase()]" 
                  class="ability-input"
                  min="1"
                  max="30"
                />
                <div class="ability-modifier">
                  {{ getModifier(characterSheet[ability.name.toLowerCase()]) >= 0 ? '+' : '' }}{{ getModifier(characterSheet[ability.name.toLowerCase()]) }}
                </div>
              </div>
            </div>
          </div>

          <!-- Combat Stats -->
          <div class="card section-combat">
            <h2>Combat Statistics</h2>
            <div class="form-grid">
              <div class="form-group">
                <label>Hit Points</label>
                <input type="number" v-model.number="characterSheet.hit_points" min="0" />
              </div>
              <div class="form-group">
                <label>Max Hit Points</label>
                <input type="number" v-model.number="characterSheet.max_hit_points" min="0" />
              </div>
              <div class="form-group">
                <label>Temporary Hit Points</label>
                <input type="number" v-model.number="characterSheet.temporary_hit_points" min="0" />
              </div>
              <div class="form-group">
                <label>Armor Class</label>
                <input type="number" v-model.number="characterSheet.armor_class" min="0" />
              </div>
              <div class="form-group">
                <label>Speed</label>
                <input type="number" v-model.number="characterSheet.speed" min="0" />
                <small>feet</small>
              </div>
              <div class="form-group">
                <label>Proficiency Bonus</label>
                <input type="number" v-model.number="characterSheet.proficiency_bonus" min="0" />
              </div>
            </div>
          </div>

          <!-- Saving Throws -->
          <div class="card section-saving-throws">
            <h2>Saving Throws</h2>
            <div class="saving-throws-list">
              <div 
                v-for="ability in abilities" 
                :key="ability.name"
                class="saving-throw-item"
              >
                <label class="checkbox-label">
                  <input 
                    type="checkbox" 
                    v-model="characterSheet.saving_throws[ability.name.toLowerCase()]"
                  />
                  <span class="saving-throw-name">{{ ability.name }}</span>
                  <span class="saving-throw-modifier">
                    {{ getSavingThrowModifier(ability.name.toLowerCase()) >= 0 ? '+' : '' }}{{ getSavingThrowModifier(ability.name.toLowerCase()) }}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <!-- Skills -->
          <div class="card section-skills">
            <h2>Skills</h2>
            <div class="skills-list">
              <div 
                v-for="skill in skills" 
                :key="skill.name"
                class="skill-item"
              >
                <label class="checkbox-label">
                  <input 
                    type="checkbox" 
                    v-model="characterSheet.skills[skill.name]"
                  />
                  <span class="skill-name">{{ skill.name }}</span>
                  <span class="skill-ability">({{ skill.ability }})</span>
                  <span class="skill-modifier">
                    {{ getSkillModifier(skill) >= 0 ? '+' : '' }}{{ getSkillModifier(skill) }}
                  </span>
                </label>
              </div>
            </div>
          </div>

          <!-- Equipment -->
          <div class="card section-equipment">
            <h2>Equipment</h2>
            <div class="equipment-list">
              <div 
                v-for="(item, index) in equipmentList" 
                :key="index"
                class="equipment-item"
              >
                <input 
                  type="text" 
                  v-model="equipmentList[index]" 
                  placeholder="Enter equipment item"
                  @blur="updateEquipment"
                />
                <button @click="removeEquipment(index)" class="btn-icon" title="Remove">×</button>
              </div>
              <button @click="addEquipment" class="btn btn-secondary btn-small">+ Add Item</button>
            </div>
          </div>

          <!-- Spells -->
          <div class="card section-spells">
            <h2>Spells</h2>
            <div class="spells-list">
              <div 
                v-for="(spell, index) in spellsList" 
                :key="index"
                class="spell-item"
              >
                <input 
                  type="text" 
                  v-model="spellsList[index]" 
                  placeholder="Enter spell name"
                  @blur="updateSpells"
                />
                <button @click="removeSpell(index)" class="btn-icon" title="Remove">×</button>
              </div>
              <button @click="addSpell" class="btn btn-secondary btn-small">+ Add Spell</button>
            </div>
          </div>

          <!-- Spell Slots -->
          <div class="card section-spell-slots">
            <h2>Spell Slots</h2>
            <div class="spell-slots-editor">
              <div 
                v-for="level in 9" 
                :key="level"
                class="spell-slot-level-editor"
              >
                <div class="spell-slot-level-header">
                  <label>Level {{ level }}</label>
                </div>
                <div class="spell-slot-inputs">
                  <div class="form-group">
                    <label>Total Slots</label>
                    <input 
                      type="number" 
                      :value="getSpellSlotTotal(level)"
                      @input="setSpellSlotTotal(level, $event.target.value)"
                      min="0"
                    />
                  </div>
                  <div class="form-group">
                    <label>Used</label>
                    <input 
                      type="number" 
                      :value="getSpellSlotUsed(level)"
                      @input="setSpellSlotUsed(level, $event.target.value)"
                      min="0"
                      :max="getSpellSlotTotal(level)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div class="card section-notes">
            <h2>Notes</h2>
            <textarea 
              v-model="characterSheet.notes" 
              placeholder="Add any additional notes about your character..."
              rows="8"
            ></textarea>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../lib/api'

export default {
  name: 'CharacterSheet',
  setup() {
    const route = useRoute()
    const router = useRouter()
    const sessionId = route.params.id
    const characterSheet = ref(null)
    const loading = ref(true)
    const error = ref('')
    const saving = ref(false)
    const isNew = ref(false)

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

    const equipmentList = computed({
      get: () => {
        if (!characterSheet.value || !characterSheet.value.equipment) return []
        return Array.isArray(characterSheet.value.equipment) 
          ? characterSheet.value.equipment 
          : []
      },
      set: (val) => {
        if (characterSheet.value) {
          characterSheet.value.equipment = val
        }
      }
    })

    const spellsList = computed({
      get: () => {
        if (!characterSheet.value || !characterSheet.value.spells) return []
        return Array.isArray(characterSheet.value.spells) 
          ? characterSheet.value.spells 
          : []
      },
      set: (val) => {
        if (characterSheet.value) {
          characterSheet.value.spells = val
        }
      }
    })

    const spellSlots = computed({
      get: () => {
        if (!characterSheet.value || !characterSheet.value.spell_slots) return {}
        return characterSheet.value.spell_slots
      },
      set: (val) => {
        if (characterSheet.value) {
          characterSheet.value.spell_slots = val
        }
      }
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
        const { data } = await api.get(`/sessions/${sessionId}/character-sheet`)
        characterSheet.value = data.characterSheet
        isNew.value = data.isNew

        // Ensure saving_throws and skills are objects
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
        
        // Initialize spell slots object if needed
        if (typeof characterSheet.value.spell_slots !== 'object' || characterSheet.value.spell_slots === null) {
          characterSheet.value.spell_slots = {}
        }
      } catch (err) {
        console.error('Error loading character sheet:', err)
        error.value = err.response?.data?.error || err.message || 'Failed to load character sheet'
      } finally {
        loading.value = false
      }
    }

    const saveCharacterSheet = async () => {
      saving.value = true
      error.value = ''

      try {
        // Ensure equipment and spells are arrays
        const sheetData = {
          ...characterSheet.value,
          equipment: Array.isArray(characterSheet.value.equipment) 
            ? characterSheet.value.equipment 
            : [],
          spells: Array.isArray(characterSheet.value.spells) 
            ? characterSheet.value.spells 
            : []
        }

        await api.put(`/sessions/${sessionId}/character-sheet`, sheetData)
        
        // Show success message
        const successMsg = document.createElement('div')
        successMsg.className = 'success-message'
        successMsg.textContent = 'Character sheet saved!'
        successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4caf50; color: white; padding: 12px 24px; border-radius: 6px; z-index: 10000;'
        document.body.appendChild(successMsg)
        setTimeout(() => successMsg.remove(), 3000)
      } catch (err) {
        console.error('Error saving character sheet:', err)
        error.value = err.response?.data?.error || err.message || 'Failed to save character sheet'
      } finally {
        saving.value = false
      }
    }

    const addEquipment = () => {
      if (!characterSheet.value.equipment) {
        characterSheet.value.equipment = []
      }
      characterSheet.value.equipment.push('')
    }

    const removeEquipment = (index) => {
      characterSheet.value.equipment.splice(index, 1)
      updateEquipment()
    }

    const updateEquipment = () => {
      characterSheet.value.equipment = characterSheet.value.equipment.filter(item => item.trim() !== '')
    }

    const addSpell = () => {
      if (!characterSheet.value.spells) {
        characterSheet.value.spells = []
      }
      characterSheet.value.spells.push('')
    }

    const removeSpell = (index) => {
      characterSheet.value.spells.splice(index, 1)
      updateSpells()
    }

    const updateSpells = () => {
      characterSheet.value.spells = characterSheet.value.spells.filter(spell => spell.trim() !== '')
    }

    const getSpellSlotTotal = (level) => {
      if (!characterSheet.value.spell_slots || !characterSheet.value.spell_slots[level]) {
        return 0
      }
      return characterSheet.value.spell_slots[level].total || 0
    }

    const getSpellSlotUsed = (level) => {
      if (!characterSheet.value.spell_slots || !characterSheet.value.spell_slots[level]) {
        return 0
      }
      return characterSheet.value.spell_slots[level].used || 0
    }

    const setSpellSlotTotal = (level, value) => {
      if (!characterSheet.value.spell_slots) {
        characterSheet.value.spell_slots = {}
      }
      if (!characterSheet.value.spell_slots[level]) {
        characterSheet.value.spell_slots[level] = { total: 0, used: 0 }
      }
      const numValue = parseInt(value) || 0
      characterSheet.value.spell_slots[level].total = numValue
      // Ensure used doesn't exceed total
      if (characterSheet.value.spell_slots[level].used > numValue) {
        characterSheet.value.spell_slots[level].used = numValue
      }
    }

    const setSpellSlotUsed = (level, value) => {
      if (!characterSheet.value.spell_slots) {
        characterSheet.value.spell_slots = {}
      }
      if (!characterSheet.value.spell_slots[level]) {
        characterSheet.value.spell_slots[level] = { total: 0, used: 0 }
      }
      const numValue = parseInt(value) || 0
      const maxValue = characterSheet.value.spell_slots[level].total || 0
      characterSheet.value.spell_slots[level].used = Math.min(numValue, maxValue)
    }

    const updateSpellSlots = () => {
      // Ensure spell slots is an object
      if (!characterSheet.value.spell_slots) {
        characterSheet.value.spell_slots = {}
      }
      // Remove empty spell slot levels
      Object.keys(characterSheet.value.spell_slots).forEach(level => {
        const slot = characterSheet.value.spell_slots[level]
        if (!slot || (!slot.total && !slot.used)) {
          delete characterSheet.value.spell_slots[level]
        }
      })
    }

    const goBack = () => {
      router.push(`/session/${sessionId}`)
    }

    onMounted(() => {
      loadCharacterSheet()
    })

    return {
      characterSheet,
      loading,
      error,
      saving,
      abilities,
      skills,
      equipmentList,
      spellsList,
      spellSlots,
      getModifier,
      getSavingThrowModifier,
      getSkillModifier,
      loadCharacterSheet,
      saveCharacterSheet,
      addEquipment,
      removeEquipment,
      updateEquipment,
      addSpell,
      removeSpell,
      updateSpells,
      getSpellSlotTotal,
      getSpellSlotUsed,
      setSpellSlotTotal,
      setSpellSlotUsed,
      updateSpellSlots,
      goBack
    }
  }
}
</script>

<style scoped>
.character-sheet {
  padding: 20px 0;
  min-height: calc(100vh - 80px);
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.sheet-header h1 {
  color: white;
  font-size: 28px;
  margin: 0;
}

.dark-theme .sheet-header h1 {
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.sheet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.dark-theme .card {
  background: var(--card-bg);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.card h2 {
  margin-top: 0;
  margin-bottom: 20px;
  color: #667eea;
  font-size: 20px;
  border-bottom: 2px solid #667eea;
  padding-bottom: 8px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--text-primary);
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.dark-theme .form-group input,
.dark-theme .form-group select,
.dark-theme .form-group textarea {
  background: var(--bg-secondary);
  border-color: #444;
  color: var(--text-primary);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.form-group small {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: 12px;
}

/* Ability Scores */
.abilities-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.ability-score {
  text-align: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.dark-theme .ability-score {
  background: var(--bg-secondary);
}

.ability-name {
  font-weight: 700;
  font-size: 16px;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.ability-input {
  width: 100%;
  padding: 8px;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  margin-bottom: 8px;
}

.ability-modifier {
  font-size: 20px;
  font-weight: 700;
  color: #667eea;
}

/* Saving Throws & Skills */
.saving-throws-list,
.skills-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.saving-throw-item,
.skill-item {
  padding: 8px;
  background: #f8f9fa;
  border-radius: 6px;
}

.dark-theme .saving-throw-item,
.dark-theme .skill-item {
  background: var(--bg-secondary);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.saving-throw-name,
.skill-name {
  flex: 1;
  font-weight: 500;
  color: var(--text-primary);
}

.skill-ability {
  font-size: 12px;
  color: var(--text-secondary);
  font-style: italic;
}

.saving-throw-modifier,
.skill-modifier {
  font-weight: 600;
  color: #667eea;
  min-width: 40px;
  text-align: right;
}

/* Equipment & Spells */
.equipment-list,
.spells-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.equipment-item,
.spell-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.equipment-item input,
.spell-item input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
}

.dark-theme .equipment-item input,
.dark-theme .spell-item input {
  background: var(--bg-secondary);
  border-color: #444;
  color: var(--text-primary);
}

.btn-icon {
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 6px;
  width: 32px;
  height: 32px;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.btn-icon:hover {
  background: #cc0000;
}

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
}

/* Spell Slots */
.section-spell-slots {
  grid-column: 1 / -1;
}

.spell-slots-editor {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.spell-slot-level-editor {
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
}

.dark-theme .spell-slot-level-editor {
  background: var(--bg-secondary);
}

.spell-slot-level-header {
  margin-bottom: 8px;
}

.spell-slot-level-header label {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 14px;
}

.spell-slot-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* Notes */
.section-notes {
  grid-column: 1 / -1;
}

.section-notes textarea {
  width: 100%;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-family: inherit;
  resize: vertical;
}

.dark-theme .section-notes textarea {
  background: var(--bg-secondary);
  border-color: #444;
  color: var(--text-primary);
}

/* Responsive */
@media (max-width: 768px) {
  .sheet-grid {
    grid-template-columns: 1fr;
  }

  .sheet-header {
    flex-direction: column;
    gap: 16px;
    align-items: flex-start;
  }

  .abilities-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>

