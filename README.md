# 🔮 Summon Session

**Une application web "Zero-Build" pour générer, éditer et gérer des bibliothèques de blocs AutoCAD par invocation mnémonique.**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)]()
[![Zero-Build](https://img.shields.io/badge/architecture-Zero--Build-success.svg)]()
[![AutoCAD](https://img.shields.io/badge/support-AutoCAD%20%7C%20ZWCAD-red.svg)]()

Summon Session est un outil de productivité ultime pour les dessinateurs. Il remplace les palettes d'outils lourdes et lentes par un système d'alias dynamique et ultra-léger. L'application web agit comme une "forge" pour générer un fichier `.lsp` autonome, que vous chargez directement dans votre logiciel de CAO préféré.

---

## ✨ Fonctionnalités Clés

- 🎯 **Drag & Drop Instantané** : Déposez un fichier `.lsp` généré par Summon Session pour recharger instantanément l'état de votre bibliothèque.
- 🔍 **Omni-Summon Spotlight** : Recherchez dynamiquement vos blocs parmi des centaines, avec un filtrage instantané fluide et des transitions animées (FLIP animations).
- ✏️ **Studio d'Édition Intégré** : Modifiez les propriétés de vos blocs (Échelle, Calque, Chemin source) directement depuis l'interface web, avec des validations en direct "Apple-like".
- 🤖 **Suggestions Intelligentes de Raccourcis** : L'outil analyse vos noms de blocs et vous propose les raccourcis les plus évidents (ex: _Chaise Bureau_ -> _CB_), tout en évitant les conflits natifs d'AutoCAD.
- 📦 **Export LISP Autonome** : En un clic, générez un fichier AutoLISP sécurisé, sans aucune dépendance externe DLL, incluant la sauvegarde et la restauration des états LISP en cas de crash (`*error*` handling).

---

## 🏗️ Architecture "Zero-Build"

Cette application suit la philosophie **Zero-Build & Zero-DB** :
- **Pas de Node.js, NPM, ou Webpack.** L'application s'exécute directement dans le navigateur via l'utilisation stricte d'ES Modules natifs (`import / export`).
- **Pas de base de données.** L'entièreté de l'état applicatif est stocké au sein même du fichier AutoLISP final, sous forme de JSON embarqué (`;;SUMMON-CONFIG-BEGIN`). Le code `.lsp` devient donc la seule et unique source de vérité.

```text
summon-session/
├── summon-session.lsp    ← Fichier LISP final avec JSON encodé
├── docs/                 ← Interface Web (GitHub Pages)
│   ├── index.html        ← Interface "Glassmorphism"
│   ├── style.css         ← Design System
│   ├── app.js            ← Orchestrateur DOM
│   ├── state.js          ← Store central (Source de vérité UI)
│   ├── generator.js      ← Générateur de code LISP à grande vitesse
│   ├── parser.js         ← Extracteur JSON natif
│   └── validator.js      ← Sécurité et prévention d'injections LISP
└── README.md
```

---

## 🚀 Utilisation & Intégration

### 1️⃣ Interface Web (Studio)
Accédez au studio pour gérer vos bibliothèques (Hébergé sur GitHub Pages) : \
👉 **[Accéder au Summon Studio](https://hugo-burnet.github.io/Summon-Session/)**

1. Importez votre fichier `.lsp` (ou commencez de zéro).
2. Créez / modifiez vos alias.
3. Cliquez sur **Exporter le LISP**.

### 2️⃣ Déploiement dans AutoCAD / ZWCAD
Pour que l'invocation fonctionne, votre logiciel de CAO doit savoir où trouver vos fichiers DWG sources.

1. Extrayez le fichier généré `summon-session.lsp` dans un dossier permanent.
2. Ouvrez AutoCAD, tapez `OPTIONS`.
3. Allez dans **Fichiers** → **Chemin de recherche des fichiers de support**.
4. Ajoutez le dossier contenant `summon-session.lsp` et vos fichiers source.

**Chargement automatique (Recommandé) :**
Éditez ou créez un fichier `acaddoc.lsp` dans vos dossiers de support, puis ajoutez simplement :
```lisp
(load "summon-session.lsp")
```
_Chaque nouveau dessin ouvert comportera alors par magie tous vos raccourcis._

---

## 🛡️ Sécurité & Résilience AutoLISP

L'export LISP inclut un système défensif complet développé pour les environnements de production :
- **Variables Système Protégées :** Avant de placer un bloc, `FILEDIA`, `OSMODE`, `CMDECHO` et autres sont sauvegardés. Ils sont correctement restaurés à la fin.
- **Handler d'Erreur Global Actif :** Si vous pressez `ECHAP` pendant un placement de bloc, le LISP ne plantera pas vos fenêtres de dialogues AutoCAD. Le système rétablira immédiatement un état sain.
- **Protection contre les injections :** Le Validator web empêche toute création de calque ou raccourci contenant des caractères illégaux LISP.

---
_Généré via Ingénierie Agentique Avancée (Antigravity)._
