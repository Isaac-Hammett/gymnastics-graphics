/**
 * Unified name normalization utilities for athlete headshot matching.
 * Use these functions EVERYWHERE to ensure consistent matching between
 * saving headshots (Firebase) and looking them up (Virtius data).
 *
 * Edge cases handled:
 * - Accented characters: ö → oe, ä → ae, ü → ue, etc.
 * - Special characters: hyphens, apostrophes, periods
 * - Whitespace: multiple spaces, tabs, leading/trailing
 * - Case: all lowercase for comparison
 * - Firebase-unsafe characters: . # $ [ ]
 */

/**
 * Convert accented/special characters to ASCII equivalents.
 * Handles Swedish, German, Spanish, French, and Portuguese names.
 *
 * Examples:
 * - "Söderqvist" → "Soederqvist"
 * - "José García" → "Jose Garcia"
 * - "Müller" → "Mueller"
 *
 * @param {string} str - Input string with potential accents
 * @returns {string} String with accents converted to ASCII equivalents
 */
export function normalizeAccents(str) {
  if (!str) return '';
  return str
    // German/Swedish umlauts - convert to two-letter equivalents
    .replace(/ö/g, 'oe').replace(/Ö/g, 'Oe')
    .replace(/ä/g, 'ae').replace(/Ä/g, 'Ae')
    .replace(/ü/g, 'ue').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    // French/Spanish/Portuguese accents - convert to base letter
    .replace(/[éèêë]/g, 'e').replace(/[ÉÈÊË]/g, 'E')
    .replace(/[áàâãå]/g, 'a').replace(/[ÁÀÂÃÅ]/g, 'A')
    .replace(/[íìîï]/g, 'i').replace(/[ÍÌÎÏ]/g, 'I')
    .replace(/[óòôõø]/g, 'o').replace(/[ÓÒÔÕØ]/g, 'O')
    .replace(/[úùûü]/g, 'u').replace(/[ÚÙÛÜ]/g, 'U')
    .replace(/ñ/g, 'n').replace(/Ñ/g, 'N')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/ÿ/g, 'y').replace(/Ÿ/g, 'Y')
    // Ligatures
    .replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE');
}

/**
 * Remove common name suffixes (Jr., Sr., III, etc.) before normalization.
 * These suffixes can cause matching failures between data sources.
 *
 * @param {string} name - Name that may contain suffixes
 * @returns {string} Name with suffixes removed
 */
export function removeSuffixes(name) {
  if (!name) return '';
  // Match common suffixes at end of name (with optional comma/period)
  // Jr., Jr, Junior, Sr., Sr, Senior, I, II, III, IV, V, 1st, 2nd, 3rd, 4th, 5th
  return name
    .replace(/,?\s*(jr\.?|junior|sr\.?|senior|[iv]+|[1-5](?:st|nd|rd|th))$/i, '')
    .trim();
}

/**
 * Full normalization for athlete name matching.
 * This is the PRIMARY function to use for both saving AND looking up headshots.
 *
 * Process:
 * 1. Handle null/undefined
 * 2. Remove name suffixes (Jr., Sr., III, etc.)
 * 3. Convert accents to ASCII equivalents
 * 4. Lowercase everything
 * 5. Replace hyphens and underscores with spaces (for consistent matching)
 * 6. Remove apostrophes (O'Connor → OConnor → oconnor)
 * 7. Collapse multiple spaces
 * 8. Trim
 *
 * Examples:
 * - "Carl Jacob Söderqvist" → "carl jacob soederqvist"
 * - "Jean-Pierre Dubois" → "jean pierre dubois"
 * - "O'Connor" → "oconnor"
 * - "  John   Smith  " → "john smith"
 * - "Michael Smith Jr." → "michael smith"
 * - "Robert Jones III" → "robert jones"
 *
 * @param {string} name - Athlete name in any format
 * @returns {string} Normalized name for comparison/storage
 */
export function normalizeName(name) {
  if (!name) return '';

  return normalizeAccents(removeSuffixes(name))
    .toLowerCase()
    .replace(/[-_]/g, ' ')      // Hyphens and underscores to spaces
    .replace(/[''`]/g, '')      // Remove apostrophes (curly and straight)
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();
}

/**
 * Get a Firebase-safe key from a normalized name.
 * Firebase keys cannot contain: . # $ [ ] /
 *
 * @param {string} normalizedName - Already normalized name
 * @returns {string} Safe key for Firebase storage
 */
export function getSafeFirebaseKey(normalizedName) {
  if (!normalizedName) return '';
  // Replace Firebase-unsafe characters with underscores
  return normalizedName.replace(/[.#$[\]/]/g, '_');
}

/**
 * Generate all possible lookup keys for an athlete name.
 * This handles edge cases where names might be stored differently than looked up.
 *
 * Handles:
 * - Accented characters (ö → oe)
 * - Middle names (Benjamin Thurlow Lam → multiple variants)
 * - Hyphens, apostrophes
 * - Firebase-safe keys
 *
 * @param {string} firstName - First name (may include middle name)
 * @param {string} lastName - Last name
 * @returns {string[]} Array of possible lookup keys (most specific first)
 */
export function getLookupKeys(firstName, lastName) {
  const fullName = `${firstName || ''} ${lastName || ''}`.trim();
  if (!fullName) return [];

  const keys = new Set();

  // 1. Original lowercase (in case it's already stored without normalization)
  const lowercase = fullName.toLowerCase().trim().replace(/\s+/g, ' ');
  keys.add(lowercase);

  // 2. Fully normalized (main lookup key)
  const normalized = normalizeName(fullName);
  keys.add(normalized);

  // 3. With accents converted but keeping other special chars
  const accentsOnly = normalizeAccents(fullName).toLowerCase().trim().replace(/\s+/g, ' ');
  keys.add(accentsOnly);

  // 4. Stripped (only letters and spaces - handles unknown special chars)
  const stripped = normalized.replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
  if (stripped) keys.add(stripped);

  // 5. Firebase key variant (underscores instead of Firebase-unsafe chars)
  const firebaseKey = getSafeFirebaseKey(normalized);
  keys.add(firebaseKey);

  // 6. Handle 3+ part names (e.g., "Benjamin Thurlow Lam")
  // Try different combinations: first+last, first+middle+last, etc.
  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length >= 3) {
    // First + Last only (skip middle name)
    const firstLast = `${parts[0]} ${parts[parts.length - 1]}`;
    keys.add(firstLast);

    // First + Middle initial + Last (e.g., "benjamin t lam")
    const firstInitialLast = `${parts[0]} ${parts[1][0]} ${parts[parts.length - 1]}`;
    keys.add(firstInitialLast);

    // All parts combined (already added as normalized)
    // But also try without middle names for 4+ part names
    if (parts.length >= 4) {
      // First two + Last
      const firstTwoLast = `${parts[0]} ${parts[1]} ${parts[parts.length - 1]}`;
      keys.add(firstTwoLast);
    }
  }

  // 7. Handle case where firstName contains full name (common from Virtius)
  // e.g., firstName="Benjamin Thurlow", lastName="Lam"
  const firstParts = (firstName || '').trim().split(/\s+/).filter(Boolean);
  if (firstParts.length >= 2 && lastName) {
    // Just first part of firstName + lastName
    const firstPartOnly = `${normalizeName(firstParts[0])} ${normalizeName(lastName)}`;
    keys.add(firstPartOnly);

    // First part + initial + lastName
    const firstInitial = `${normalizeName(firstParts[0])} ${firstParts[1][0].toLowerCase()} ${normalizeName(lastName)}`;
    keys.add(firstInitial);
  }

  // Return unique keys, filter empty strings
  return Array.from(keys).filter(Boolean);
}

/**
 * Check if two names match using fuzzy normalization.
 * Useful for validation/debugging.
 *
 * @param {string} name1 - First name to compare
 * @param {string} name2 - Second name to compare
 * @returns {boolean} True if names match after normalization
 */
export function namesMatch(name1, name2) {
  return normalizeName(name1) === normalizeName(name2);
}

/**
 * Normalize a name for display (capitalize each word).
 * Use this when showing names to users, not for storage/lookup.
 *
 * @param {string} name - Name to format
 * @returns {string} Properly capitalized name
 */
export function formatNameForDisplay(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}
