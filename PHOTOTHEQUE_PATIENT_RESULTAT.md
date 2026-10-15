# Dossier patient — détails photo au clic

## Résultat

La photothèque du dossier patient affiche uniquement une galerie paginée par défaut : miniature privée, badge, zone et date. Aucune première photo n’est sélectionnée automatiquement. Les détails, le téléchargement, la modification et l’archivage sont accessibles dans une lightbox centrée, fermable par X ou Échap. Zoom de 100 à 300 %, image en contain et navigation limitée à la série courante, avec prise en charge des pages suivantes. Les photos sans série restent isolées dans la visionneuse.

Les formulaires de série et d’import réutilisent les modals existantes avec patient verrouillé. La comparaison Avant/Après possède son bouton et sa modal avec sélection, aperçus côte à côte, notes et enregistrement via API existante. Les comparaisons enregistrées restent dans des cartes compactes. La galerie est actualisée après les opérations.

L’onglet Photos occupe la largeur disponible ; les autres onglets et sections conservent leur disposition. Grille adaptative selon la largeur réelle du conteneur : 3/4 colonnes sur ordinateur, 2 sur tablette et 1 sur mobile. Miniatures en cover, images de visionneuse en contain.

## Sécurité

Aucun changement backend, de permissions ou de stockage. Les API JWT HttpOnly/CSRF existantes sont réutilisées, y compris miniatures et téléchargement privés, validation RBAC et journalisation. DOCTOR et NURSE conservent leurs droits existants ; le backend vérifie toujours le périmètre patient. L’archivage demande un motif et conserve le fichier et l’historique.

## Vérifications exécutées

- Suite frontend complète : 63 tests réussis, dont 21 workflows photo. Trois tests ajoutés pour localisation de page dans une série, isolation des photos sans série et arrêt de pagination si photo disparue.
- Suite backend documents/photos sur PostgreSQL de test distinct : 22 tests réussis (droits, périmètre infirmier, images/miniatures privées, CSRF, archivage, conservation des fichiers et comparaisons).
- TypeScript --noEmit, ESLint ciblé, compilation Next.js de production et git diff --check : réussis.
- Navigateur, données synthétiques et stockage SQLite isolés : aucun dialogue ni bouton Télécharger/Archiver au chargement ; ouverture au clic ; navigation de série ; fermeture Échap et X ; zoom 150 % ; création de série ; import de photo ; comparaison avec notes puis fermeture et carte enregistrée. Téléchargement déclenché depuis la visionneuse et réponse API 200 ; le navigateur de contrôle n’a pas confirmé le chemin local du fichier téléchargé.
- DOCTOR : galerie, navigation, création, import et comparaison testés. NURSE assignée : accès à la galerie et aux images, formulaire prérempli, modification des notes et archivage avec motif testés avec succès.
- Responsive à 1440, 768 et 390 px : respectivement 4, 2 et 1 colonnes, sans débordement horizontal ; zoom mobile testé.
- Aucune donnée du cabinet importée/modifiée/archivée pendant ces tests ; aucun redémarrage du backend utilisateur.

## Fichiers modifiés/ajoutés pour cette demande

- `client/features/documents/components/patient-photos-section.tsx`
- `client/features/documents/components/patient-photos-section.module.css`
- `client/features/documents/services/patient-photo-navigation.ts`
- `client/features/documents/services/photo-workflow.test.mjs`
- `client/features/phototheque/components/photo-viewer.tsx`
- `client/features/phototheque/components/photo-comparisons.tsx`
- `client/features/phototheque/components/photo-gallery.module.css`
- `client/features/patients/components/patient-detail.tsx`
- `client/features/patients/components/patient-detail.module.css`
