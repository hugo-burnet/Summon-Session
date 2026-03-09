// Summon Session — Parser de fichier .lsp (Story 1.5)
// Responsabilité unique : extraction de la config JSON embarquée dans un .lsp
// Aucun effet de bord DOM — module logique pur.

import { validateConfig } from './validator.js';

// Marqueurs exacts définis par l'architecture (doit rester synchronisé avec summon-session.lsp)
const CONFIG_BEGIN_MARKER = ';;SUMMON-CONFIG-BEGIN';
const CONFIG_END_MARKER = ';;SUMMON-CONFIG-END';

/**
 * Extrait le bloc JSON situé entre les marqueurs de config dans le contenu d'un fichier .lsp,
 * valide le schema via validator.js et retourne l'objet JS parsé.
 *
 * @param {string} fileContent - Contenu textuel brut du fichier .lsp
 * @returns {{ config: Object|null, valid: boolean, errors: string[] }}
 */
export function parseLsp(fileContent) {
  if (!fileContent || typeof fileContent !== 'string') {
    console.error('[Summon] parseLsp : contenu de fichier invalide ou vide.');
    return { config: null, valid: false, errors: ['[Summon] Contenu de fichier invalide ou vide.'] };
  }

  // ── Étape 1 : isolation du bloc entre les marqueurs ────────────────────────
  const lines = fileContent.split('\n');
  let capturing = false;
  const jsonLines = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trimEnd();

    if (trimmed.includes(CONFIG_BEGIN_MARKER)) {
      capturing = true;
      continue;
    }

    if (trimmed.includes(CONFIG_END_MARKER)) {
      capturing = false;
      break;
    }

    if (capturing) {
      // Nettoyage des préfixes de commentaire LISP (ex: "; ", ";  ", ";;")
      // Certaines lignes peuvent commencer par un ou plusieurs ";" en style LISP
      const cleaned = _stripLispCommentPrefix(trimmed);
      jsonLines.push(cleaned);
    }
  }

  if (jsonLines.length === 0) {
    const msg = '[Summon] Marqueurs de configuration introuvables dans le fichier .lsp.';
    console.error(msg);
    return { config: null, valid: false, errors: [msg] };
  }

  // ── Étape 2 : assemblage et parsing JSON ───────────────────────────────────
  const jsonString = jsonLines.join('');

  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (parseError) {
    const msg = `[Summon] Erreur de parsing JSON : ${parseError.message}`;
    console.error(msg);
    return { config: null, valid: false, errors: [msg] };
  }

  // ── Étape 3 : validation du schéma via validator.js ───────────────────────
  const validation = validateConfig(parsed);

  if (!validation.valid) {
    console.error('[Summon] Schéma de configuration non conforme :', validation.errors);
    return { config: null, valid: false, errors: validation.errors };
  }

  console.log(`[Summon] Configuration importée avec succès — ${parsed.blocks.length} bloc(s) chargé(s).`);
  return { config: parsed, valid: true, errors: [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitaire interne : nettoyage des préfixes de commentaire LISP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Supprime les préfixes de commentaire LISP (ex: ";  ", ";;") d'une ligne.
 * Si la ligne commence par ;;SUMMON-CHUNK:, on extrait proprement.
 *
 * @param {string} line
 * @returns {string}
 */
function _stripLispCommentPrefix(line) {
  const trimmed = line.replace(/^\s*/, '');
  if (trimmed.startsWith(';;SUMMON-CHUNK:')) {
    return trimmed.substring(15);
  }
  return trimmed.replace(/^;+\s?/, '');
}
