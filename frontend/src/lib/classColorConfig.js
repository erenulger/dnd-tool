/**
 * Centralized configuration for D&D character classes
 * This file contains all class definitions including names, colors, and text colors
 */

export const characterClasses = [
  { 
    name: 'Artificer', 
    color: '#d59139 ',
    textColor: 'white'
  },
  { 
    name: 'Barbarian', 
    color: '#e7623e',
    textColor: 'white'
  },
  { 
    name: 'Bard', 
    color: '#ab6dac',
    textColor: 'white'
  },
  { 
    name: 'Cleric', 
    color: '#91a1b2',
    textColor: '#333'
  },
  { 
    name: 'Druid', 
    color: '#7a853b ',
    textColor: 'white'
  },
  { 
    name: 'Fighter', 
    color: '#7f513e ',
    textColor: '#333'
  },
  { 
    name: 'Monk', 
    color: '#51a5c5 ',
    textColor: 'white'
  },
  { 
    name: 'Paladin', 
    color: '#b59e54 ',
    textColor: '#333'
  },
  { 
    name: 'Ranger', 
    color: '#507f62 ',
    textColor: 'white'
  },
  { 
    name: 'Rogue', 
    color: '#555752 ',
    textColor: 'white'
  },
  { 
    name: 'Sorcerer', 
    color: '#992e2e ',
    textColor: 'white'
  },
  { 
    name: 'Warlock', 
    color: '#7b469b ',
    textColor: 'white'
  },
  { 
    name: 'Wizard', 
    color: '#2a50a1',
    textColor: 'white'
  }
]

/**
 * Get class configuration by name
 */
export const getClassConfig = (className) => {
  if (!className) return null
  return characterClasses.find(c => c.name === className) || null
}

/**
 * Get class slug (lowercase, hyphenated) for CSS classes
 */
export const getClassSlug = (className) => {
  if (!className) return 'none'
  return className.toLowerCase().replace(/\s+/g, '-')
}

/**
 * Generate CSS for badge classes dynamically
 * This generates all the CSS rules for .badge-class-* selectors
 */
export const generateBadgeClassCSS = () => {
  let css = '.badge-class { font-weight: 600; padding: 4px 10px; border-radius: 12px; font-size: 12px; }\n'
  
  characterClasses.forEach(cls => {
    const slug = getClassSlug(cls.name)
    css += `.badge-class-${slug} { background: ${cls.color}; color: ${cls.textColor}; }\n`
  })
  
  css += '.badge-class-none { background: #e0e0e0; color: #666; }\n'
  
  return css
}

/**
 * Generate all class-related CSS (both badge and option styles)
 * This is the main function to generate all CSS from the config
 */
export const generateAllClassCSS = () => {
  return generateBadgeClassCSS() + '\n' + generateClassOptionCSS()
}

/**
 * Generate CSS for class option styles (used in class selection modal)
 * This generates all the CSS rules for .class-* selectors
 */
export const generateClassOptionCSS = () => {
  let css = ''
  
  // Special text colors for certain classes (for better contrast)
  const specialTextColors = {
    'Cleric': '#FFA500',
    'Paladin': '#FFA500',
    'Monk': '#FF8C00',
    'Fighter': '#666'
  }
  
  characterClasses.forEach(cls => {
    const slug = getClassSlug(cls.name)
    const textColor = specialTextColors[cls.name] || cls.color
    const hoverTextColor = cls.textColor === 'white' ? 'white' : '#333'
    
    // Generate light gradient background color (approximate)
    const gradientEnd = getLightGradientColor(cls.color)
    
    css += `.class-${slug} { 
  border-color: ${cls.color}; 
  color: ${textColor}; 
  background: linear-gradient(135deg, #fff 0%, ${gradientEnd} 100%);
}\n`
    css += `.class-${slug}::before { background: ${cls.color}; }\n`
    css += `.class-${slug}:hover:not(:disabled) { 
  background: ${cls.color}; 
  color: ${hoverTextColor}; 
  text-shadow: none;
}\n`
    css += `.class-${slug}.selected { 
  border-color: ${cls.color}; 
  background: ${cls.color}; 
  color: ${hoverTextColor};
  text-shadow: none;
}\n`
  })
  
  // Add .class-none styles
  css += `.class-none { 
  border-color: #999; 
  color: #999; 
  background: linear-gradient(135deg, #fff 0%, #f5f5f5 100%);
}\n`
  css += `.class-none::before { background: #999; }\n`
  css += `.class-none:hover:not(:disabled) { 
  background: #f5f5f5; 
  color: #666;
}\n`
  css += `.class-none.selected { 
  border-color: #999; 
  background: #f5f5f5; 
  color: #666;
}\n`
  
  return css
}

/**
 * Helper to generate a light gradient color from a base color
 * This creates a lighter version for the gradient background
 */
function getLightGradientColor(hexColor) {
  // Remove # if present
  hexColor = hexColor.replace('#', '')
  
  // Convert to RGB
  const r = parseInt(hexColor.substr(0, 2), 16)
  const g = parseInt(hexColor.substr(2, 2), 16)
  const b = parseInt(hexColor.substr(4, 2), 16)
  
  // Lighten by mixing with white (80% white, 20% original)
  const lightR = Math.round(r * 0.2 + 255 * 0.8)
  const lightG = Math.round(g * 0.2 + 255 * 0.8)
  const lightB = Math.round(b * 0.2 + 255 * 0.8)
  
  return `rgb(${lightR}, ${lightG}, ${lightB})`
}

