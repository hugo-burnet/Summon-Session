// Summon Session — Orchestrateur principal (Story 1.1 + Story 1.5)
// Responsabilité : gestion du DOM, des événements, et orchestration des modules

import { state } from './state.js';
import { parseLsp } from './parser.js';
import { generateLsp, downloadLsp } from './generator.js';
import { suggestShortcut, RESERVED_AUTOCAD_COMMANDS, ILLEGAL_LAYER_CHARS, generateUniqueFallbackShortcut, validateConfig } from './validator.js';

console.log('[Summon] App chargée. Modules ES importés avec succès.');
console.log('[Summon] État initial :', state);

// ── [Story 1.5] Drag-and-Drop & FileReader ──────────────────────────────────

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const dropFeedback = document.getElementById('drop-feedback');
const omniInput = document.getElementById('omni-input');

// [Story 1.5] Gestionnaire de timeout pour éviter les chevauchements de feedback
let feedbackTimeout = null;

// Mapping simplifié des couleurs ACI (AutoCAD Color Index) vers CSS
const ACI_TO_CSS = {
  0: '#FFFFFF', // ByLayer (Défaut Blanc)
  1: '#FF0000', // Red
  2: '#FFFF00', // Yellow
  3: '#00FF00', // Green
  4: '#00FFFF', // Cyan
  5: '#0000FF', // Blue
  6: '#FF00FF', // Magenta
  7: '#FFFFFF', // White
  8: '#808080', // Dark Gray
  9: '#C0C0C0', // Light Gray
  256: '#FFFFFF' // ByLayer
};

/**
 * Retourne une couleur CSS pour un index ACI
 * @param {number} aci 
 * @returns {string}
 */
function getACIColor(aci) {
  if (ACI_TO_CSS[aci]) return ACI_TO_CSS[aci];
  // Pour les autres couleurs, on peut soit utiliser une palette complète soit une couleur neutre
  return '#9BA3B5'; 
}

if (dropZone && fileInput) {
  _initDragAndDrop();
} else {
  console.error('[Summon] Éléments DOM drop-zone ou file-input introuvables.');
}

if (omniInput) {
  _initOmniSearch();
}

_initEditView();
_initExport();
_initWelcomePopup();

/**
 * Initialise tous les événements drag-and-drop et file input.
 */
function _initDragAndDrop() {

  // ── Prévenir le comportement par défaut du navigateur (AC4) ───────────────
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    window.addEventListener(eventName, e => e.preventDefault());
  });

  // ── dragover : activer l'état visuel is-drag-over (AC4) ───────────────────
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    if (!dropZone.classList.contains('is-drag-over')) {
      dropZone.classList.add('is-drag-over');
      dropZone.classList.remove('is-error', 'is-success');
      _setFeedback('');
    }
  });

  // ── dragleave : désactiver l'état is-drag-over (AC4) ─────────────────────
  dropZone.addEventListener('dragleave', e => {
    // Ignore les dragleave vers des enfants (relatedTarget à l'intérieur de la zone)
    if (dropZone.contains(e.relatedTarget)) return;
    dropZone.classList.remove('is-drag-over');
  });

  // ── drop : lecture du fichier déposé (AC4) ────────────────────────────────
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('is-drag-over');

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) {
      _handleError(['[Summon] Aucun fichier détecté dans le dépôt.']);
      return;
    }

    _processFile(files[0]);
  });

  // ── Clic sur la zone → ouvre le sélecteur de fichier ─────────────────────
  dropZone.addEventListener('click', e => {
    // Éviter double-déclenchement si clic sur le label/button
    if (e.target !== fileInput) {
      fileInput.click();
    }
  });

  // ── Sélection via input file ──────────────────────────────────────────────
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files.length > 0) {
      _processFile(fileInput.files[0]);
      // Réinitialiser l'input pour permettre re-sélection du même fichier
      fileInput.value = '';
    }
  });

  console.log('[Summon] Drag-and-drop initialisé.');
}

/**
 * Lit et traite un fichier .lsp via FileReader API (AC4).
 *
 * @param {File} file
 */
function _processFile(file) {
  if (!file) return;

  // Vérification de l'extension
  if (!file.name.toLowerCase().endsWith('.lsp')) {
    _handleError([`[Summon] Type de fichier invalide : "${file.name}". Seuls les fichiers .lsp sont acceptés.`]);
    return;
  }

  // État de chargement
  dropZone.classList.add('is-loading');
  dropZone.classList.remove('is-error', 'is-success');
  _setFeedback(`Lecture de "${file.name}"…`);

  const reader = new FileReader();

  reader.onload = e => {
    dropZone.classList.remove('is-loading');
    const fileContent = e.target?.result;

    if (typeof fileContent !== 'string') {
      _handleError(['[Summon] Impossible de lire le contenu du fichier.']);
      return;
    }

    // ── Parsing & validation (AC2, AC3, AC7) ─────────────────────────────
    const result = parseLsp(fileContent);

    if (!result.valid || !result.config) {
      _handleError(result.errors);
      return;
    }

    // ── Mise à jour de l'état global (AC5) ───────────────────────────────
    state.loadFromConfig(result.config);

    // ── Feedback de succès (AC6) ──────────────────────────────────────────
    _handleSuccess(result.config.blocks.length, file.name);
  };

  reader.onerror = () => {
    dropZone.classList.remove('is-loading');
    _handleError(['[Summon] Erreur de lecture FileReader — le fichier est peut-être inaccessible.']);
  };

  // Lecture du fichier (AC4)
  reader.readAsText(file, 'utf-8');
}

/**
 * Affiche un état d'erreur sur la drop zone (AC7, Task 5).
 *
 * @param {string[]} errors
 */
function _handleError(errors) {
  if (feedbackTimeout) clearTimeout(feedbackTimeout);

  dropZone.classList.add('is-error');
  dropZone.classList.remove('is-success', 'is-loading');

  const firstError = errors[0] || '[Summon] Erreur inconnue.';
  _setFeedback(`❌ ${firstError}`);

  // Log console de toutes les erreurs
  errors.forEach(err => console.error(err));

  // Réinitialiser l'état d'erreur après 5 secondes
  feedbackTimeout = setTimeout(() => {
    dropZone.classList.remove('is-error');
    if (dropFeedback && dropFeedback.textContent.includes('❌')) {
      _setFeedback('');
    }
    feedbackTimeout = null;
  }, 5000);
}

/**
 * Affiche un état de succès sur la drop zone (AC6).
 *
 * @param {number} blockCount
 * @param {string} fileName
 */
function _handleSuccess(blockCount, fileName) {
  if (feedbackTimeout) clearTimeout(feedbackTimeout);
  
  dropZone.classList.add('is-success');
  dropZone.classList.remove('is-error', 'is-loading');

  const msg = `✅ Import réussi — ${blockCount} bloc(s) chargé(s) depuis "${fileName}"`;
  _setFeedback(msg);
  console.log(`[Summon] ${msg}`);
  
  feedbackTimeout = null;
}

/**
 * Met à jour le texte de la zone de feedback.
 *
 * @param {string} text
 */
function _setFeedback(text) {
  if (dropFeedback) {
    dropFeedback.textContent = text;
  }
}


/**
 * Génère le SVG réutilisable pour les icônes (pattern Symbol/Use)
 */
function _initIcons() {
  if (document.getElementById('summon-svg-sprite')) return;
  const svgNS = "http://www.w3.org/2000/svg";
  const sprite = document.createElementNS(svgNS, "svg");
  sprite.id = 'summon-svg-sprite';
  sprite.setAttribute("style", "display: none;");
  sprite.innerHTML = `
    <symbol id="icon-doc" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
    </symbol>
    <symbol id="icon-scale" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
    </symbol>
    <symbol id="icon-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </symbol>
    <symbol id="icon-palette" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.607-.482 1.926-1.074.319-.592.544-1.361.544-2.104 0-1.5 1-2.5 2.5-2.5H20c1.1 0 2-.9 2-2 0-5.5-4.5-10-10-10z"/>
    </symbol>
  `;
  document.body.appendChild(sprite);
}
_initIcons();

/**
 * Initialise la barre de recherche Omni-Summon (Story 3.3).
 */
function _initOmniSearch() {
  let omniTimeout;
  omniInput.addEventListener('input', e => {
    clearTimeout(omniTimeout);
    omniTimeout = setTimeout(() => {
      // Small reflow helper
      requestAnimationFrame(() => {
        state.setFilter(e.target.value);
      });
    }, 150); // Debounce court pour conserver le temps réel sans saturer le main thread
  });

  // Focus automatique au démarrage (AC5)
  // On attend une frame pour s'assurer que le DOM est stable
  requestAnimationFrame(() => {
    omniInput.focus();
  });

  const btnAddBlock = document.getElementById('btn-add-block');
  if (btnAddBlock) {
    btnAddBlock.addEventListener('click', () => {
      _openEditView({ id: '', name: '', scale: 1.0, layer: '0', lib_path: '', uid: null });
    });
  }

  console.log('[Summon] Omni-Summon initialisé.');
}

/**
 * Crée un élément card pour un bloc donné.
 * 
 * @param {Object} block
 * @returns {HTMLElement}
 */
function _createCard(block, sharedTakenIds) {
  const card = document.createElement('article');
  card.className = 'summon-list-item';
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Visualiser le bloc ${block.name || 'inconnu'}`);
  card.tabIndex = 0;

  // ID unique pour FLIP (base64 ou simple hash du chemin pour éviter les collisions)
  const blockUniqueId = block.uid || `${block.name}::${block.lib_path}`;
  card.dataset.blockId = blockUniqueId;

  card.addEventListener('click', () => {
    const currentBlock = state.blocks.find(b => b.uid === card.dataset.blockId) || block;
    _openEditView(currentBlock, card);
  });

  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      card.click();
    }
  });
  
  _updateCardContent(card, block, sharedTakenIds);

  return card;
}

/**
 * Met à jour le HTML d'une carte existante.
 * 
 * @param {HTMLElement} card
 * @param {Object} block
 */
function _updateCardContent(card, block, sharedTakenIds) {
  const blockName = block.name || 'Bloc Inconnu';
  let filePath = 'Inconnu';
  if (block.lib_path) {
    filePath = block.lib_path.split('\\').pop().split('/').pop();
  } else if (block.source_file) {
    filePath = block.source_file.split('\\').pop().split('/').pop();
  }
  
  const scale = block.scale ? `${block.scale}x` : '1x';
  
  let shortcut = block.id;
  if (!shortcut) {
    let taken = sharedTakenIds || new Set(state.blocks.map(b => (b.id || '').toUpperCase()));
    const suggestions = suggestShortcut(blockName, taken);
    shortcut = suggestions.length > 0 ? suggestions[0].toUpperCase() : '';
    
    // Fallback de sécurité garantissant l'unicité
    if (!shortcut) {
      shortcut = generateUniqueFallbackShortcut(taken);
    }
    taken.add(shortcut.toUpperCase());
  }

  const dotColor = getACIColor(block.color !== undefined ? block.color : 7);

  card.innerHTML = `
    <div class="col-cmd">
      <span class="cmd-pill" aria-label="Raccourci: ${escapeHTML(shortcut)}">${escapeHTML(shortcut)}</span>
    </div>
    <div class="col-name" title="${escapeHTML(blockName)}">${escapeHTML(blockName)}</div>
    <div class="col-source" title="${escapeHTML(filePath)}">${escapeHTML(filePath)}</div>
    <div class="col-layer" title="Calque: ${escapeHTML(block.layer || '0')} (Coul: ${block.color || 7})">
      <span class="layer-color-dot" style="background-color: ${dotColor}"></span>
      ${escapeHTML(block.layer || '0')}
    </div>
    <div class="col-scale" title="Échelle: ${escapeHTML(scale)}">${escapeHTML(scale)}</div>
  `;
}

/**
 * Rendu dynamique de la grille de bibliothèque avec support FLIP optimisé (Story 3.3)
 */
function renderLibrary() {
  const libraryContainer = document.getElementById('library-container');
  if (!libraryContainer) return;

  const sharedTakenIds = new Set(state.blocks.map(b => (b.id || '').toUpperCase()));

  const style = getComputedStyle(document.documentElement);
  const durationNormal = parseInt(style.getPropertyValue('--transition-normal')) || 250;
  const durationFast = parseInt(style.getPropertyValue('--transition-fast')) || 150;

  // 1. FIRST (Positions des cartes actuellement dans le DOM)
  const firstPositions = new Map();
  libraryContainer.querySelectorAll('.summon-list-item').forEach(card => {
    firstPositions.set(card.dataset.blockId, card.getBoundingClientRect());
  });

  // 2. Filtrage
  const blocks = state.blocks || [];
  const filterText = state.filterText.toLowerCase();

  const filteredBlocks = blocks.filter(block => {
    if (!filterText) return true;
    return (block.name || '').toLowerCase().includes(filterText) || 
           (block.id || '').toLowerCase().includes(filterText);
  });

  // 3. Reconciliation
  const currentCards = Array.from(libraryContainer.querySelectorAll('.summon-list-item'));
  const currentCardsMap = new Map(currentCards.map(c => [c.dataset.blockId, c]));
  
  const listHeader = document.getElementById('library-header');
  if (filteredBlocks.length > 0) {
    if (listHeader) listHeader.style.display = 'grid';
  } else {
    if (listHeader) listHeader.style.display = 'none';
  }

  // Vider le conteneur proprement (sans toucher au header qui est un sibling)
  libraryContainer.innerHTML = '';

  if (filteredBlocks.length === 0) {
    if (state.blocks.length > 0 && filterText !== '') {
      const placeholder = document.createElement('article');
      placeholder.id = 'placeholder-card';
      placeholder.className = 'surface-glass';
      placeholder.style.gridColumn = '1 / -1';
      placeholder.innerHTML = `<p class="placeholder-text" style="text-align: center; padding: 2rem;">Aucun résultat pour "${escapeHTML(filterText)}"</p>`;
      libraryContainer.appendChild(placeholder);
    }
  } else {
    filteredBlocks.forEach(block => {
      const blockId = block.uid || `${block.name}::${block.lib_path}`;
      let card = currentCardsMap.get(blockId);
      if (!card) {
        card = _createCard(block, sharedTakenIds);
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
      } else {
        _updateCardContent(card, block, sharedTakenIds);
      }
      libraryContainer.appendChild(card);
    });
  }

  // 4. INVERT & PLAY (FLIP)
  requestAnimationFrame(() => {
    libraryContainer.querySelectorAll('.summon-list-item').forEach(card => {
      const firstPos = firstPositions.get(card.dataset.blockId);
      const lastPos = card.getBoundingClientRect();

      // Nouveau entrant
      if (!firstPos) {
        card.animate([
          { opacity: 0, transform: 'scale(0.9)' },
          { opacity: 1, transform: 'scale(1)' }
        ], { duration: durationNormal, easing: 'ease-out', fill: 'forwards' });
        return;
      }

      // Transition de position
      const invertX = firstPos.left - lastPos.left;
      const invertY = firstPos.top - lastPos.top;

      if (invertX !== 0 || invertY !== 0) {
        card.animate([
          { transform: `translate(${invertX}px, ${invertY}px)`, opacity: 1 },
          { transform: 'translate(0, 0)', opacity: 1 }
        ], {
          duration: durationNormal,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
          fill: 'forwards'
        });
      } else {
        card.style.opacity = '1';
        card.style.transform = 'none';
      }
    });
  });
}

/**
 * Échappe les caractères HTML spéciaux.
 * 
 * @param {string} str 
 * @returns {string}
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '`': '&#x60;'
  };
  return str.replace(/[&<>"'`]/g, m => map[m]);
}

/**
 * Initialise la vue d'édition (Story 3.4).
 */
function _initEditView() {
  const viewEdit = document.getElementById('view-edit');
  const editForm = document.getElementById('block-edit-form');
  const btnClose = document.getElementById('btn-close-edit');
  const editName = document.getElementById('edit-name');
  const editId = document.getElementById('edit-id');
  const editLayer = document.getElementById('edit-layer');
  const editColor = document.getElementById('edit-color');
  const editScale = document.getElementById('edit-scale');
  
  _initACIPicker();

  if (!viewEdit || !editForm) return;

  // Fermer la modal
  btnClose.addEventListener('click', _closeEditView);
  viewEdit.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) _closeEditView();
  });

  // Validation en temps réel du Nom -> Suggestions
  editName.addEventListener('input', () => {
    _updateSuggestions(editName.value);
  });

  // Validation en temps réel du Raccourci -> Conflits et Format
  editId.addEventListener('input', () => {
    const value = editId.value.trim().toUpperCase();
    const currentShortcut = editForm.dataset.editingShortcut;
    
    // Vérifier les conflits et le format
    const isConflicted = _isShortcutConflicted(value, currentShortcut);
    const isInvalidFormat = !/^[A-Z0-9_-]*$/i.test(value);
    
    if (isConflicted || isInvalidFormat) {
      editId.classList.add('is-invalid');
    } else {
      editId.classList.remove('is-invalid');
    }
  });

  // Validation du Calque
  editLayer.addEventListener('input', () => {
    if (ILLEGAL_LAYER_CHARS.test(editLayer.value)) {
      editLayer.classList.add('is-invalid');
    } else {
      editLayer.classList.remove('is-invalid');
    }
  });
  
  // Validation de l'Échelle
  editScale.addEventListener('input', () => {
    const val = parseFloat(editScale.value);
    if (!isNaN(val) && val > 0) {
      editScale.classList.remove('is-invalid');
    } else {
      editScale.classList.add('is-invalid');
    }
  });

  // Validation de la couleur
  editColor.addEventListener('input', () => {
    const val = parseInt(editColor.value);
    if (!isNaN(val) && val >= 0 && val <= 256) {
      editColor.classList.remove('is-invalid');
    } else {
      editColor.classList.add('is-invalid');
    }
  });

  // Soumission du formulaire
  editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const editingUid = editForm.dataset.editingUid; // Vide si création
    const isNew = !editingUid;
    const formData = new FormData(editForm);
    
    // Check validation states before applying
    if (editLayer.classList.contains('is-invalid')) return;
    if (editColor.classList.contains('is-invalid')) return;
    if (editScale.classList.contains('is-invalid') || parseFloat(editScale.value) <= 0) {
      editScale.classList.add('is-invalid');
      return;
    }
    
    // Shortcut ID validation (Case insensitive duplicate check)
    const newId = formData.get('id').toUpperCase();
    const currentShortcut = editForm.dataset.editingShortcut;

    // Réinitialisation de l'animation en cas d'erreur répétée
    editId.classList.remove('is-invalid');
    void editId.offsetWidth; // Force reflow pour relancer l'animation "Apple Shake"

    // Vérification de sécurité (Regex stricte identique au validator.js)
    if (!/^[A-Z0-9_-]*$/i.test(newId)) {
      editId.classList.add('is-invalid');
      return;
    }

    // Vérification finale des conflits avant sauvegarde
    if (_isShortcutConflicted(newId, currentShortcut)) {
      editId.classList.add('is-invalid');
      return;
    }

    const updatedData = {
      id: newId,
      name: formData.get('name'),
      scale: parseFloat(formData.get('scale')) || 1.0,
      layer: formData.get('layer') || '0',
      color: parseInt(formData.get('color')) || 7,
      lib_path: formData.get('lib_path') || '',
      block_name: formData.get('block_name') || '',
      command: newId // La commande AutoCAD est liée au raccourci
    };

    // Validation stricte du schéma de bloc avant sauvegarde
    const tempConfig = { version: "1.0", blocks: [updatedData] };
    const validation = validateConfig(tempConfig);
    
    if (!validation.valid) {
      console.error("[Summon] Validation du formulaire échouée :", validation.errors);
      alert("❌ " + validation.errors[0]);
      return;
    }

    if (isNew) {
      state.addBlock(updatedData);
    } else {
      state.updateBlock(editingUid, updatedData);
    }
    _closeEditView();
  });

  // Suppression
  const btnDelete = document.getElementById('btn-delete-block');
  if (btnDelete) {
    btnDelete.addEventListener('click', (e) => {
      e.preventDefault();
      const uid = editForm.dataset.editingUid;
      
      if (!uid) return;
      
      if (confirm(`Confirmer la suppression irréversible de ce bloc (et de sa commande AutoCAD) ?`)) {
        state.deleteBlock(uid);
        _closeEditView();
      }
    });
  }

  console.log('[Summon] Vue édition initialisée.');
}

/**
 * Initialise le popover de sélection de couleur ACI.
 */
function _initACIPicker() {
  const btnPicker = document.getElementById('btn-color-picker');
  const popover = document.getElementById('aci-picker-popover');
  const editColor = document.getElementById('edit-color');
  if (!btnPicker || !popover || !editColor) return;

  // Générer les swatches pour les couleurs standard 1-9 + 256
  const colorsToShow = [1, 2, 3, 4, 5, 6, 7, 8, 9, 256];
  const colorNames = {
    1: 'Rouge', 2: 'Jaune', 3: 'Vert', 4: 'Cyan', 5: 'Bleu',
    6: 'Magenta', 7: 'Blanc/Noir', 8: 'Gris Foncé', 9: 'Gris Clair', 256: 'ByLayer'
  };

  popover.innerHTML = '';
  colorsToShow.forEach(aci => {
    const swatch = document.createElement('div');
    swatch.className = 'aci-swatch';
    swatch.style.backgroundColor = getACIColor(aci);
    swatch.dataset.tooltip = `${colorNames[aci] || aci} (ACI ${aci})`;
    swatch.dataset.aci = aci;
    
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      editColor.value = aci;
      editColor.dispatchEvent(new Event('input')); // Déclencher validation
      popover.hidden = true;
    });
    popover.appendChild(swatch);
  });

  btnPicker.addEventListener('click', (e) => {
    e.stopPropagation();
    popover.hidden = !popover.hidden;
  });

  // Fermer le popover si on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!popover.contains(e.target) && e.target !== btnPicker) {
      popover.hidden = true;
    }
  });
}

let lastFocusedElement = null;

/**
 * Ouvre la vue d'édition avec les données d'un bloc.
 * @param {Object} block 
 * @param {HTMLElement} triggerElement
 */
function _openEditView(block, triggerElement = null) {
  lastFocusedElement = triggerElement;
  const viewEdit = document.getElementById('view-edit');
  const editForm = document.getElementById('block-edit-form');
  if (!viewEdit || !editForm) return;

  // Remplir le formulaire
  editForm.dataset.editingUid = block.uid || ''; // Stocker l'UID stable pour l'édition
  
  const blockName = block.name || '';
  let blockId = block.id || '';
  
  // Si le bloc n'a pas encore de raccourci (nouveau ou import incomplet), suggérer le meilleur
  if (!blockId && blockName) {
    const taken = new Set(state.blocks
      .filter(b => b.uid !== (block.uid || ''))
      .map(b => (b.id || '').toUpperCase())
    );
    const suggestions = suggestShortcut(blockName, taken);
    if (suggestions.length > 0) {
      blockId = suggestions[0].toUpperCase();
    } else {
      blockId = generateUniqueFallbackShortcut(taken);
    }
  }

  editForm.dataset.editingShortcut = block.id || ''; // Raccourci original (tel quel dans le state)
  
  document.getElementById('edit-name').value = blockName;
  document.getElementById('edit-id').value = blockId;
  document.getElementById('edit-scale').value = block.scale || 1.0;
  document.getElementById('edit-layer').value = block.layer || '0';
  document.getElementById('edit-color').value = (block.color !== undefined) ? block.color : 7;
  document.getElementById('edit-lib-path').value = block.lib_path || '';
  document.getElementById('edit-block-name').value = block.block_name || '';

  // Affichage du bouton de suppression seulement si ce n'est pas un nouveau bloc
  const btnDelete = document.getElementById('btn-delete-block');
  if (btnDelete) btnDelete.hidden = !block.uid;

  // Réinitialiser les validations
  const editIdInput = document.getElementById('edit-id');
  editIdInput.classList.remove('is-invalid');
  document.getElementById('edit-scale').classList.remove('is-invalid');
  document.getElementById('edit-layer').classList.remove('is-invalid');
  
  _updateSuggestions(blockName);

  // Afficher la vue
  viewEdit.hidden = false;
  document.getElementById('edit-name').focus();
}

/**
 * Ferme la vue d'édition.
 */
function _closeEditView() {
  const viewEdit = document.getElementById('view-edit');
  if (viewEdit) viewEdit.hidden = true;
  if (lastFocusedElement) {
    lastFocusedElement.focus();
    lastFocusedElement = null;
  }
}

/**
 * Met à jour les suggestions de raccourcis sous le champ ID.
 * @param {string} name 
 */
function _updateSuggestions(name) {
  const suggestionsBox = document.getElementById('shortcut-suggestions');
  const editId = document.getElementById('edit-id');
  const editForm = document.getElementById('block-edit-form');
  if (!suggestionsBox || !editForm) return;

  const taken = new Set(state.blocks
    .filter(b => b.uid !== editForm.dataset.editingUid)
    .map(b => (b.id || '').toUpperCase())
  );
  
  const suggestions = suggestShortcut(name, taken);
  suggestionsBox.innerHTML = '';

  suggestions.forEach(s => {
    const pill = document.createElement('span');
    pill.className = 'pill-suggestion';
    pill.textContent = s.toUpperCase();
    pill.addEventListener('click', () => {
      editId.value = s.toUpperCase();
      editId.dispatchEvent(new Event('input')); // Déclencher la validation de conflit
    });
    suggestionsBox.appendChild(pill);
  });
}

/**
 * Vérifie si un raccourci est utilisé par un autre bloc ou est réservé.
 * @param {string} shortcut 
 * @param {string} originalShortcut 
 * @returns {boolean}
 */
function _isShortcutConflicted(shortcut, originalShortcut) {
  if (!shortcut) return false;
  
  const upper = shortcut.toUpperCase();
  const upperOriginal = (originalShortcut || '').toUpperCase();
  
  // 1. Vérifier les commandes réservées AutoCAD
  if (RESERVED_AUTOCAD_COMMANDS.has(upper)) {
    return true;
  }

  // 2. Vérifier les doublons dans l'état (hors raccourci actuel si inchangé)
  if (upper === upperOriginal) return false;

  return state.blocks.some(b => 
    (b.id || '').toUpperCase() === upper
  );
}

// ── Listener global pour les re-renders (summon:state-changed) ────────────
document.addEventListener('summon:state-changed', e => {
  const detail = e.detail || {};
  console.log(`[Summon] État global mis à jour — source: ${detail.source}, blocs: ${detail.blockCount}`);
  
  // Mise à jour de l'indicateur dirty
  const syncIndicator = document.getElementById('sync-indicator');
  if (syncIndicator) {
    if (state.isDirty) {
      syncIndicator.classList.add('is-dirty');
    } else {
      syncIndicator.classList.remove('is-dirty');
    }
  }

  // Rendu de la grille et tableau de bord
  _updateDashboard();
  renderLibrary();
});

/**
 * Met à jour le tableau de bord (Dashboard)
 */
function _updateDashboard() {
  const dashboard = document.getElementById('dashboard');
  if (!dashboard) return;

  if (!state.blocks || state.blocks.length === 0) {
    dashboard.hidden = true;
    return;
  }
  
  dashboard.hidden = false;

  const totalBlocks = state.blocks.length;
  // Décompte brut des fichiers sources distincts
  const sourceFiles = new Set(state.blocks.map(b => b.lib_path || b.source_file || '').filter(Boolean)).size;
  const defaultScale = state.settings?.default_scale || 1.0;

  document.getElementById('dash-total-blocks').textContent = totalBlocks;
  document.getElementById('dash-total-files').textContent = sourceFiles;
}

/**
 * Initialise la logique d'export (Story 3.5).
 */
function _initExport() {
  const exportBtn = document.getElementById('export-lsp-btn');
  if (!exportBtn) return;

  exportBtn.addEventListener('click', () => {
    console.log('[Summon] Déclenchement de la génération .lsp...');
    
    if (!state.blocks || state.blocks.length === 0) {
      console.warn("[Summon] Tentative d'export d'un état vide.");
      alert("⚠️ Aucune configuration à exporter. Importez un fichier LISP d'abord.");
      return;
    }

    try {
      const configToExport = {
        version: "1.0",
        blocks: state.blocks,
        settings: state.settings
      };
      
      const validation = validateConfig(configToExport);
      if (!validation.valid) {
        console.error("[Summon] Validation échouée avant export :", validation.errors);
        alert("❌ Impossible d'exporter : des données sont invalides (regardez la console).");
        return;
      }

      const lspContent = generateLsp(state);
      downloadLsp(lspContent, 'summon-session.lsp');
      state.clearDirty();
      
      console.log('[Summon] Export terminé avec succès.');
    } catch (err) {
      console.error("[Summon] Erreur lors de l'export :", err);
      alert("❌ Une erreur est survenue lors de la génération du fichier.");
    }
  });

  console.log('[Summon] Module d\'export initialisé.');
}

/**
 * Initialise le popup de bienvenue (Story 3.6 - UX refinement).
 */
function _initWelcomePopup() {
  const popup = document.getElementById('welcome-popup');
  const btnClose = document.getElementById('btn-close-welcome');
  const btnOk = document.getElementById('btn-welcome-ok');

  if (!popup) return;

  // On affiche le popup uniquement si aucune donnée n'est chargée au démarrage
  if (state.blocks.length === 0) {
    popup.hidden = false;
  }

  const closePopup = () => {
    popup.hidden = true;
  };

  if (btnClose) btnClose.addEventListener('click', closePopup);
  if (btnOk) btnOk.addEventListener('click', closePopup);

  // Fermer en cliquant sur l'overlay
  popup.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) closePopup();
  });
  
  // Fermer automatiquement le popup dès que des blocs sont ajoutés (ex: via Drag & Drop)
  document.addEventListener('summon:state-changed', () => {
    if (state.blocks.length > 0 && !popup.hidden) {
      closePopup();
    }
  });
}

// ── Initialisation ────────────────────────────────────────────────────────
renderLibrary();
