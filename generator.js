/**
 * Summon Session — Module de Génération (generator.js)
 * Responsabilité : Transformer le state web en script AutoLISP autonome.
 */

/**
 * Génère le contenu complet du fichier .lsp en respectant l'ordre des sections de l'architecture.
 * 
 * @param {Object} state - L'état global { blocks, settings, ... }
 * @returns {string} Le contenu du fichier LISP
 */
export function generateLsp(state) {
  // Préparer les données JSON pour la section 1
  const config = {
    version: "1.0",
    project: "Summon Session",
    generated: new Date().toISOString().split('T')[0],
    settings: state.settings,
    blocks: state.blocks.map(b => b)
  };

  const jsonString = JSON.stringify(config);

  // Découpage du JSON en lignes de 120 caractères (Unicode-safe via le flag 'u')
  const jsonChunks = jsonString.match(/[\s\S]{1,120}/gu) || [];
  const chunkedJson = jsonChunks.map(chunk => `;;SUMMON-CHUNK:${chunk}`).join('\n');

  // Extraction des settings
  const settings = state.settings || { default_scale: 1, insunits: 4, restore_layer: true };
  const d_scale = settings.default_scale || 1.0;
  const insunits = settings.insunits || 4;
  const restore_layer = settings.restore_layer !== false ? 'T' : 'nil';

  // Générer la section 6 (Commandes c:XX)
  const definedCommands = state.blocks.map(b => {
    if (!b || typeof b.id !== 'string') return '';
    const cmdId = b.id.toUpperCase();
    const layer = (b.layer || "").replace(/"/g, ''); // Fix injection fail
    const color = (typeof b.color === 'number' && !isNaN(b.color)) ? b.color : 7;
    // Conserver les antislashs pour ObjectDBX tout en les échappant pour le LISP
    const lib_path = (b.lib_path || "").replace(/\\/g, "\\\\").replace(/"/g, '');
    const block_name = (b.block_name || "").replace(/"/g, '');
    const finalLibPath = block_name ? `${lib_path}|${block_name}` : lib_path;
    const sx = (b.scale !== undefined) ? b.scale : ((b.scale_x !== undefined) ? b.scale_x : 1.0);
    const sy = (b.scale !== undefined) ? b.scale : ((b.scale_y !== undefined) ? b.scale_y : 1.0);
    const rot = (typeof b.rotation_default === 'number' && !isNaN(b.rotation_default)) ? b.rotation_default : 0.0;

    return `(defun c:${cmdId} () (summon-save-env) (summon-invoke "${cmdId}" "${layer}" ${color} "${finalLibPath}" ${sx} ${sy} ${rot}) (summon-restore-env) (princ))`;
  });

  // Purger les raccourcis supprimés de la mémoire AutoCAD explicitement
  if (state.deletedBlocks && state.deletedBlocks.length > 0) {
    const deletedCmds = state.deletedBlocks.map(id => `(setq c:${id} nil)`);
    definedCommands.push(...deletedCmds);
  }

  const commands = definedCommands.join('\n');

  // Assemblage du Template Final
  return `;; ============================================================
;; SUMMON SESSION — AutoLISP Engine
;; ============================================================

;; SECTION 1 : CONFIG EMBARQUÉE
;;SUMMON-CONFIG-BEGIN
${chunkedJson}
;;SUMMON-CONFIG-END

;; SECTION 2 : DÉPENDANCES
;; (Aucune. Zéro DLL, Zéro parseur JSON. 100% LISP Autonome)

;; SECTION 3 : VARIABLES GLOBALES
(setq *SUMMON-SETTINGS-RESTORE-LAYER* ${restore_layer})
(setq *SUMMON-SETTINGS-DEFAULT-SCALE* ${d_scale})
(setq *SUMMON-SETTINGS-INSUNITS* ${insunits})
(setq *old-filedia* nil *old-cmdecho* nil *old-clayer* nil *old-attdia* nil *old-attreq* nil *old-osmode* nil *old-insunits* nil)

;; SECTION 4 : FONCTIONS UTILITAIRES (summon-*)
(defun summon-safe-getvar (vname / val)
  (setq val (vl-catch-all-apply 'getvar (list vname)))
  (if (vl-catch-all-error-p val) nil val))

(defun summon-save-env ()
  (setq *old-filedia* (summon-safe-getvar "FILEDIA") *old-cmdecho* (summon-safe-getvar "CMDECHO")
        *old-clayer* (if *SUMMON-SETTINGS-RESTORE-LAYER* (summon-safe-getvar "CLAYER") nil)
        *old-insunits* (summon-safe-getvar "INSUNITS") *old-attdia* (summon-safe-getvar "ATTDIA") *old-attreq* (summon-safe-getvar "ATTREQ"))
  (setvar "FILEDIA" 0) (setvar "CMDECHO" 0) (setvar "ATTDIA" 0) (setvar "ATTREQ" 0) (princ))

(defun summon-restore-env ()
  (if *old-filedia* (setvar "FILEDIA" *old-filedia*))
  (if *old-cmdecho* (setvar "CMDECHO" *old-cmdecho*))
  (if *old-clayer* (setvar "CLAYER" *old-clayer*))
  (if *old-insunits* (setvar "INSUNITS" *old-insunits*))
  (if *old-attdia* (setvar "ATTDIA" *old-attdia*))
  (if *old-attreq* (setvar "ATTREQ" *old-attreq*))
  (setq *old-filedia* nil *old-cmdecho* nil *old-clayer* nil *old-attdia* nil *old-attreq* nil *old-insunits* nil) (princ))

(defun summon-ensure-layer (name color / c_val)
  (if (and name (/= name ""))
    (progn
      (setq c_val (if (= (type color) 'STR) (atoi color) color))
      (if (not (tblsearch "LAYER" name)) (vl-cmdf "_.-LAYER" "_M" name "_C" (itoa c_val) name "") (setvar "CLAYER" name)))) (princ))

(defun summon-insert-native (id lib_path sx sy rot / v acad-ver is-zw)
  (setq v (getvar "ACADVER") is-zw (getvar "ZWCADVER"))
  (setq acad-ver (if v (atof v) 0.0))
  (terpri) (princ (strcat "\\n[Summon] Invocation [" id "] : Spécifiez le point d'insertion | [ESC] Annuler"))
  (if (equal sx sy 0.00001)
      (vl-cmdf "_.-INSERT" lib_path "_S" sx "_R" rot pause)
      (vl-cmdf "_.-INSERT" lib_path "_X" sx "_Y" sy "_R" rot pause)))

(defun summon-invoke-parse-path (path / pos)
  (setq pos (vl-string-search "|" path))
  (if pos
      (list (substr path 1 pos) (substr path (+ pos 2)))
      (list path nil)))

(defun summon-import-dbx (dwgPath blkName / acadObj acVer dbxDoc dbxBlocks blkObj objArray progIDs id val ret docBlocks)
  (setq acadObj (vlax-get-acad-object))
  ;; ObjectDBX ProgIDs selon la plateforme (ZWCAD vs AutoCAD)
  (if (getvar "ZWCADVER")
      (setq progIDs (list "ZWCAD.OpenSave" "Zcad.ZcDbDocument" "ZWCAD.ZcDbDocument"))
      (progn
        (setq acVer (substr (vla-get-version acadObj) 1 2))
        (setq progIDs (list (strcat "ObjectDBX.AxDbDocument." acVer) "ObjectDBX.AxDbDocument"))))
  
  (setq dbxDoc nil)
  (foreach id progIDs
    (if (not dbxDoc)
      (progn
        (setq val (vl-catch-all-apply 'vla-GetInterfaceObject (list acadObj id)))
        (if (not (vl-catch-all-error-p val)) (setq dbxDoc val)))))
        
  (setq ret nil)
  (if dbxDoc
      (progn
        (if (not (vl-catch-all-error-p (vl-catch-all-apply 'vla-Open (list dbxDoc dwgPath))))
            (progn
              (setq dbxBlocks (vla-get-Blocks dbxDoc))
              (setq blkObj (vl-catch-all-apply 'vla-Item (list dbxBlocks blkName)))
              (if (not (vl-catch-all-error-p blkObj))
                  (progn
                    (setq objArray (vlax-make-safearray vlax-vbObject '(0 . 0)))
                    (vlax-safearray-put-element objArray 0 blkObj)
                    (setq docBlocks (vla-get-Blocks (vla-get-ActiveDocument acadObj)))
                    (setq val (vl-catch-all-apply 'vla-CopyObjects (list dbxDoc objArray docBlocks)))
                    (if (not (vl-catch-all-error-p val)) (setq ret t))))))
        (vlax-release-object dbxDoc)))
  ret)

(defun summon-invoke (id layer color lib_path sx sy rot / *error* final_sx final_sy d_scale units parsed file_part blk_part block_exists success)
  (defun *error* (msg) (summon-restore-env) (princ (strcat "\\n[Summon] Erreur : " msg)) (princ))
  (setq d_scale *SUMMON-SETTINGS-DEFAULT-SCALE* units *SUMMON-SETTINGS-INSUNITS*)
  (if (not layer) (setq layer ""))
  (if (not color) (setq color 7))
  (if (not lib_path) (setq lib_path ""))
  (if (not sx) (setq sx 1.0))
  (if (not sy) (setq sy 1.0))
  (if (not rot) (setq rot 0.0))
  (setq sx (float sx) sy (float sy) rot (float rot) d_scale (float d_scale))
  (setvar "INSUNITS" units)
  (setq final_sx (* d_scale sx) final_sy (* d_scale sy))
  
  (setq parsed (summon-invoke-parse-path lib_path))
  (setq file_part (car parsed) blk_part (cadr parsed))
  
  (if blk_part
      ;; Mode Extraction DBX : on veut extraire seulement "blk_part" du DWG "file_part"
      (progn
        (setq block_exists (tblsearch "BLOCK" blk_part))
        (if (not block_exists)
            (progn
              (setq success (summon-import-dbx file_part blk_part))
              (if success (setq block_exists t))))
        (if block_exists
            (progn
              (if (and layer (/= layer "")) (summon-ensure-layer layer color))
              (summon-insert-native id blk_part final_sx final_sy rot))
            (princ (strcat "\\n[Summon] ERREUR : Impossible d'extraire le bloc '" blk_part "' depuis '" file_part "'. Vérifiez les noms et le format de fichier."))))
      
      ;; Mode Actuel / Fichier Direct : Le DWG EST le bloc (ou est dans le path)
      (progn
        (setq block_exists (or (findfile lib_path) (tblsearch "BLOCK" lib_path) (findfile (strcat lib_path ".dwg"))))
        (if (and lib_path (/= lib_path "") block_exists)
          (progn
            (if (and layer (/= layer "")) (summon-ensure-layer layer color))
            (summon-insert-native id lib_path final_sx final_sy rot))
          (princ (strcat "\\n[Summon] ERREUR : Bloc '" lib_path "' introuvable ou chemin invalide."))))))

;; SECTION 5 : ALIAS & COMMANDES DE SOUTIEN
;; (Non requis pour cette version — réservé pour extensions futures)

;; SECTION 6 : COMMANDES GÉNÉRÉES
${commands}

;; SECTION 7 : INITIALISATION
(progn
  (vl-load-com)
  (princ "\\n[Summon] Session chargée avec succès. (100% Natif)\\n")
)
(princ)
`;
}

/**
 * Déclenche le téléchargement du fichier .lsp généré vers le client.
 * 
 * @param {string} content - Le contenu textuel du fichier
 * @param {string} [filename='summon-session.lsp'] - Le nom du fichier à enregistrer
 */
export function downloadLsp(content, filename = 'summon-session.lsp') {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log(`[Summon] Téléchargement déclenché : ${filename}`);
}
