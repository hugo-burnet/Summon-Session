// Summon Session — Source de vérité unique (Story 1.1, 1.5, 3.2)
// Responsabilité unique : détenir l'état applicatif global en mémoire (Zero-DB)

export const state = {
  blocks: [],
  deletedBlocks: [], // Stocke les identifiants supprimés pour nettoyage LISP
  filterText: '',
  settings: { default_scale: 1, insunits: 4, restore_layer: true },
  isDirty: false,

  /**
   * Distribue l'événement global 'summon:state-changed'.
   *
   * @param {string} source - L'origine du changement d'état
   */
  dispatchStateChanged(source = 'unknown') {
    document.dispatchEvent(new CustomEvent('summon:state-changed', {
      detail: { source, blockCount: this.blocks.length }
    }));
  },

  /**
   * Charge la configuration parsée dans l'état global.
   * Dispatch l'événement 'summon:state-changed' pour déclencher un re-render.
   *
   * @param {Object} config - Objet de configuration validé (JSON Schema v1.0)
   */
  loadFromConfig(config) {
    if (!config || !Array.isArray(config.blocks)) {
      console.error('[Summon] state.loadFromConfig : config invalide.');
      return;
    }

    if (config.settings && typeof config.settings === 'object') {
      // Nettoyage et sécurisation des types pour settings
      this.settings = { 
        default_scale: typeof config.settings.default_scale === 'number' ? config.settings.default_scale : 1,
        insunits: typeof config.settings.insunits === 'number' ? config.settings.insunits : 4,
        restore_layer: typeof config.settings.restore_layer === 'boolean' ? config.settings.restore_layer : true
      };
    }

    this.blocks = config.blocks.map((b, index) => ({
      ...b,
      uid: b.uid || `block-${Date.now()}-${index}`
    }));
    this.isDirty = false;

    // Propagation de l'événement global pour déclencher un re-render
    this.dispatchStateChanged('import');

    console.log(`[Summon] État mis à jour — ${this.blocks.length} bloc(s) en mémoire.`);
  },

  /**
   * Met à jour un bloc spécifique par son UID (approche immuable).
   * Active l'état isDirty global.
   *
   * @param {string} uid - L'identifiant unique stable du bloc
   * @param {Object} data - Les nouvelles données à fusionner
   */
  updateBlock(uid, data) {
    if (!uid) return;

    const index = this.blocks.findIndex(b => b.uid === uid);
    if (index === -1) {
      console.warn(`[Summon] state.updateBlock : bloc "${uid}" introuvable.`);
      return;
    }

    // Mise à jour immuable du tableau
    this.blocks = [
      ...this.blocks.slice(0, index),
      { ...this.blocks[index], ...data },
      ...this.blocks.slice(index + 1)
    ];

    this.isDirty = true;
    this.dispatchStateChanged('edit');
    console.log(`[Summon] Bloc UID "${uid}" mis à jour (${this.isDirty ? 'Dirty' : 'Clean'}).`);
  },

  /**
   * Ajoute un nouveau bloc de zéro.
   * @param {Object} data - Les données du bloc à créer
   */
  addBlock(data) {
    if (!data.uid) data.uid = `block-${Date.now()}-${Math.floor(Math.random()*1000)}`;
    this.blocks = [...this.blocks, data];
    this.isDirty = true;
    this.dispatchStateChanged('add');
    console.log(`[Summon] Bloc ajouté (${data.id}).`);
  },

  /**
   * Supprime un bloc par son UID.
   * @param {string} uid - L'identifiant unique stable
   */
  deleteBlock(uid) {
    const blockToDelete = this.blocks.find(b => b.uid === uid);
    if (blockToDelete && blockToDelete.id) {
       this.deletedBlocks.push(blockToDelete.id.toUpperCase());
    }
    this.blocks = this.blocks.filter(b => b.uid !== uid);
    this.isDirty = true;
    this.dispatchStateChanged('delete');
    console.log(`[Summon] Bloc supprimé (UID: ${uid}).`);
  },

  /**
   * Met à jour le filtre de recherche global.
   *
   * @param {string} text - Le texte de recherche
   */
  setFilter(text) {
    this.filterText = text.toLowerCase().trim();
    this.dispatchStateChanged('filter');
  },

  /**
   * Réinitialise l'état de modification (dirty state).
   * Utilisé après un export réussi.
   */
  clearDirty() {
    this.isDirty = false;
    this.deletedBlocks = [];
    this.dispatchStateChanged('sync');
    console.log('[Summon] État de modification réinitialisé.');
  }
};
