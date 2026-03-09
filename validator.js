// Summon Session — Validation JSON Schema (Story 1.3)
// Responsabilité unique : validation du contrat de données Web ↔ LISP
// Aucun import de state.js / parser.js / generator.js — module dépendance pur

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 : SCHEMA_VERSION (AC #7)
// ─────────────────────────────────────────────────────────────────────────────
export const SCHEMA_VERSION = '1.0';

// ─────────────────────────────────────────────────────────────────────────────
// Task 1 : RESERVED_AUTOCAD_COMMANDS (AC #5)
// Liste des commandes natives AutoCAD — comparaison insensible à la casse
// ─────────────────────────────────────────────────────────────────────────────
// Initialisation d'un Set pour des recherches en O(1)
export const RESERVED_AUTOCAD_COMMANDS = new Set([
  // Dessin 2D
  'LINE', 'CIRCLE', 'ARC', 'ELLIPSE', 'RECTANG', 'RECTANGLE', 'POLYGON',
  'PLINE', 'POLYLINE', 'SPLINE', 'POINT', 'XLINE', 'RAY', 'MLINE',
  'DONUT', 'SOLID', 'TRACE', 'DIVIDE', 'MEASURE',
  // Modification
  'OFFSET', 'COPY', 'MOVE', 'ROTATE', 'SCALE', 'ARRAY',
  'TRIM', 'EXTEND', 'FILLET', 'CHAMFER', 'BREAK', 'JOIN',
  'MIRROR', 'STRETCH', 'LENGTHEN', 'EXPLODE', 'PEDIT',
  'ALIGN', 'REVERSE', 'MATCHPROP',
  // Hachures & remplissage
  'HATCH', 'BHATCH', 'GRADIENT', 'BOUNDARY',
  // Texte & dimensions
  'TEXT', 'MTEXT', 'DTEXT', 'STYLE', 'QLEADER',
  'DIM', 'DIMSTYLE', 'DIMLINEAR', 'DIMALIGNED', 'DIMRADIUS',
  'DIMDIAMETER', 'DIMANGULAR', 'DIMBASELINE', 'DIMCONTINUE', 'DIMCENTER',
  // Blocs & XRefs
  'BLOCK', 'BBLOCK', 'INSERT', 'INSBASE', 'WBLOCK', 'REFEDIT',
  'XREF', 'XATTACH', 'XBIND', 'XCLIP', 'XOPEN',
  'ATTDEF', 'ATTDIT', 'ATTEDIT', 'ATTEXT', 'EATTEDIT', 'EATTEXT',
  // Calques & propriétés
  'LAYER', 'DDLMODES', 'LINETYPE', 'LTYPE', 'LTSCALE', 'LWEIGHT',
  'COLOR', 'COLOUR', 'PROPERTIES', 'CHANGE', 'CHPROP',
  // Vues & navigation
  'ZOOM', 'PAN', 'VIEW', 'VPOINT', 'DVIEW', 'VPORTS', '3DORBIT',
  'REGEN', 'REGENALL', 'REDRAW', 'REDRAWALL',
  'DSETTINGS', 'GRID', 'SNAP', 'ORTHO', 'OSNAP', 'POLAR',
  // Impression & export
  'PLOT', 'PRINT', 'PAGESETUP', 'PREVIEW', 'PUBLISH',
  // Fichiers
  'SAVE', 'QSAVE', 'SAVEAS', 'OPEN', 'NEW', 'CLOSE', 'CLOSEALL',
  'EXIT', 'QUIT', 'RECOVER', 'AUDIT',
  // Édition générale
  'UNDO', 'REDO', 'ERASE', 'DELETE', 'OOPS', 'SELECT', 'DESELECT',
  'COPYCLIP', 'PASTECLIP', 'PASTESPEC', 'CUTCLIP',
  // Utilitaires & info
  'PURGE', 'DIST', 'AREA', 'LIST', 'ID', 'TIME', 'STATUS', 'MASSPROP',
  // 3D
  '3DFACE', '3DMESH', 'EXTRUDE', 'REVOLVE', 'SWEEP', 'LOFT',
  'UNION', 'SUBTRACT', 'INTERSECT', 'SLICE', 'SECTION',
  'SHADE', 'RENDER', 'LIGHT',
  // UCS & systèmes de coordonnées
  'UCS', 'UCSMAN', 'PLAN',
  // Divers utiles
  'SPELLING', 'FIND', 'FILTER', 'QSELECT', 'DRAWORDER',
  'SETVAR', 'GETVAR', 'COMMAND', 'AI_MOLC',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Regex des caractères AutoCAD interdits pour les noms de calques (Layer)
// ─────────────────────────────────────────────────────────────────────────────
export const ILLEGAL_LAYER_CHARS = /[<>\/\\?*|=':;",]/;

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 : validateConfig(config) (AC #1, #2, #3, #4, #5)
// Retourne toujours { valid: boolean, errors: string[] } — jamais throw
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valide un objet de configuration Summon Session JSON Schema v1.0.
 * @param {Object} config - L'objet de configuration à valider.
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateConfig(config) {
  const errors = [];

  // ── Subtask 3.1 : Vérification de config.version ───────────────────────
  if (!config || config.version !== SCHEMA_VERSION) {
    errors.push(
      `[Summon] Erreur de validation : champ 'version' manquant ou invalide (attendu "${SCHEMA_VERSION}").`
    );
  }

  // ── Subtask 3.2 : Vérification de config.blocks (Array non-vide) ────────
  if (!config || !Array.isArray(config.blocks) || config.blocks.length === 0) {
    errors.push(
      "[Summon] Erreur de validation : champ 'blocks' manquant ou vide (au moins un bloc requis)."
    );
    // Si blocks est absent/invalide, on ne peut pas itérer — retour anticipé
    return { valid: false, errors };
  }

  // ── Subtask 3.4 : Détection des id dupliqués (insensible à la casse) ────
  const seenIds = new Set();
  for (const block of config.blocks) {
    if (block.id !== undefined && block.id !== null) {
      const uid = String(block.id).toUpperCase();
      if (seenIds.has(uid)) {
        errors.push(
          `[Summon] Erreur de validation : id dupliqué "${String(block.id).toLowerCase()}".`
        );
      }
      seenIds.add(uid);
    }
  }

  // ── Subtasks 3.3, 3.5 : Validation par bloc ──────────────────────────────
  const REQUIRED_FIELDS = ['id', 'name', 'lib_path', 'layer'];

  for (let idx = 0; idx < config.blocks.length; idx++) {
    const block = config.blocks[idx];

    // Subtask 3.3 : Vérification des champs obligatoires
    for (const field of REQUIRED_FIELDS) {
      if (block[field] === undefined || block[field] === null || block[field] === '') {
        errors.push(
          `[Summon] Erreur de validation : bloc ${block.id !== undefined ? `"${block.id}"` : `#${idx}`} — champ '${field}' manquant.`
        );
      }
    }

    // Subtask 3.5 : Conflit avec les commandes AutoCAD réservées et format
    if (block.id !== undefined && block.id !== null) {
      const idStr = String(block.id);
      const upperId = idStr.toUpperCase();
      
      // Sécurité anti-injection LISP (autorise uniquement A-Z, 0-9, -, _)
      if (!/^[A-Z0-9_-]+$/i.test(idStr)) {
        errors.push(
          `[Summon] Erreur de validation : id "${block.id}" contient des caractères non autorisés. Seuls les lettres, chiffres, tirets et underscores sont acceptés.`
        );
      }

      if (RESERVED_AUTOCAD_COMMANDS.has(upperId)) {
        errors.push(
          `[Summon] Erreur de validation : id "${block.id}" est une commande AutoCAD réservée.`
        );
      }
    }

    // Validation du calque (caractères interdits AutoCAD)
    if (block.layer) {
      if (ILLEGAL_LAYER_CHARS.test(block.layer)) {
        errors.push(
          `[Summon] Erreur de validation : calque "${block.layer}" contient des caractères interdits (< > / \\ ? * | = ' : ; " ,).`
        );
      }
    }
    
    // Validation de l'échelle (scale) - doit être un nombre strictement positif
    const scaleToTest = block.scale !== undefined ? block.scale : (block.scale_x !== undefined ? block.scale_x : 1);
    if (typeof scaleToTest !== 'number' || isNaN(scaleToTest) || scaleToTest <= 0) {
      errors.push(`[Summon] Erreur de validation : l'échelle du bloc "${block.id}" doit être un nombre strictement positif.`);
    }

    // Validation de la couleur (color) et de la rotation (rotation_default)
    if (block.color !== undefined && block.color !== null) {
      if (typeof block.color !== 'number' || isNaN(block.color) || block.color < 0 || block.color > 256) {
        errors.push(`[Summon] Erreur de validation : la couleur du bloc "${block.id}" doit être un nombre entre 0 et 256.`);
      }
    }

    if (block.rotation_default !== undefined && block.rotation_default !== null) {
      if (typeof block.rotation_default !== 'number' || isNaN(block.rotation_default)) {
        errors.push(`[Summon] Erreur de validation : la rotation du bloc "${block.id}" doit être un nombre.`);
      }
    }
  }

  // Subtasks 3.6 + 3.7 : accumulation complète, retour { valid, errors }
  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 4 : suggestShortcut(blockName) (AC #6)
// Retourne jusqu'à 3 suggestions uniques, 1-3 chars, non-réservées, en minuscules
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère des suggestions de raccourcis mnémoniques pour un nom de bloc.
 * @param {string} blockName - Le nom du bloc (ex: "CHAISE_BUREAU_STD").
 * @param {Set<string>} takenShortcuts - Ensemble de raccourcis déjà utilisés (optionnel).
 * @returns {string[]} Tableau de suggestions (1-3 chars, non-réservées, en minuscules)
 */
export function suggestShortcut(blockName, takenShortcuts = new Set()) {
  if (!blockName || typeof blockName !== 'string') return [];

  // Normalisation : segmenter sur séparateurs courants (_, -, espace)
  const words = blockName
    .toUpperCase()
    .split(/[_\-\s]+/)
    .filter(w => w.length > 0);

  const candidates = [];

  // Stratégie 1 : Initiales de chaque mot (ex: "CHAISE_BUREAU" → "CB")
  if (words.length >= 2) {
    const initials = words.map(w => w[0]).join('');
    candidates.push(initials.slice(0, 3));   // max 3 chars
    candidates.push(initials.slice(0, 2));   // version courte 2 chars
  }

  // Stratégie 2 : Première + dernière lettre du premier mot (ex: "CHAISE" → "CE")
  if (words[0] && words[0].length >= 2) {
    const firstWord = words[0];
    candidates.push(firstWord[0] + firstWord[firstWord.length - 1]);
  }

  // Stratégie 3 : 2-3 premiers caractères du premier mot (ex: "CHAISE" → "CH", "CHA")
  if (words[0] && words[0].length >= 2) {
    candidates.push(words[0].slice(0, 2));
  }
  if (words[0] && words[0].length >= 3) {
    candidates.push(words[0].slice(0, 3));
  }

  // Stratégie 4 : Initiale seule (ex: "CHAISE" → "C")
  if (words[0]) {
    candidates.push(words[0][0]);
  }

  // Filtrage : unicité + longueur (1-3) + non-réservé AutoCAD
  const seen = new Set();
  const suggestions = [];

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const upper = candidate.toUpperCase();

    if (
      lower.length >= 1 &&
      lower.length <= 3 &&
      !seen.has(lower) &&
      !RESERVED_AUTOCAD_COMMANDS.has(upper) &&
      !takenShortcuts.has(upper)
    ) {
      seen.add(lower);
      suggestions.push(lower);
    }

    if (suggestions.length === 3) break;
  }

  return suggestions;
}

/**
 * Génère un raccourci unique de dernier recours.
 * @param {Set<string>} takenShortcuts - Ensemble de raccourcis déjà utilisés.
 * @returns {string} Raccourci unique garatnti
 */
export function generateUniqueFallbackShortcut(takenShortcuts) {
  let shortcut;
  let limit = 0;
  do {
    shortcut = `B${Math.floor(Math.random()*1000)}`;
    limit++;
  } while ((takenShortcuts.has(shortcut) || RESERVED_AUTOCAD_COMMANDS.has(shortcut)) && limit < 100);
  return shortcut;
}
