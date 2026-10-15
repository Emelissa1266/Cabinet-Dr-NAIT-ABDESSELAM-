# Photothèque clinique — résultat

## Fonctionnalités

Galerie paginée (20 éléments), miniatures privées, grille responsive, recherche serveur, filtres patient/série/date/catégorie/zone anatomique et tri. Mode albums avec couvertures protégées, compte des photos actives, séries vides et fil d’Ariane. Création et édition des séries en modal ; import multiple séquentiel, glisser-déposer, aperçus temporaires, validation JPEG/PNG et taille configurée, progression par fichier et reprise des seuls échecs. Édition des métadonnées, visionneuse au clic avec navigation clavier et téléchargement authentifié. Comparaisons avant/après conservées.

La suppression d’une photo archive avec motif et conserve le fichier et l’historique. Seules les séries sans aucune photo, même archivée, peuvent être supprimées. Les comparaisons existantes sont revalidées lors des modifications. Les accès médecin/infirmier et le périmètre patient restent contrôlés par Django.

## API

Endpoints existants réutilisés : clinical-photo-sets (liste, création, modification, suppression vide), clinical-photos (liste, création, modification, view, download, archive), photo-comparisons. Nouveaux GET : `/api/v1/clinical-photos/{id}/thumbnail/` et `/api/v1/clinical-photos/upload-rules/`. Séries enrichies avec patient_name, patient_reference, photo_count et cover_photo ; photos avec patient_name et photo_set_title. Aucun changement de modèle ni migration.

Images et miniatures sont servies avec contrôle d’accès, sans URL publique permanente, avec Cache-Control no-store/private, Pragma no-cache, Referrer-Policy no-referrer et nosniff. EXIF/GPS retirés des nouveaux imports et des rendus ; les fichiers historiques ne sont pas réécrits. Orientation EXIF appliquée avant retrait. Les URL Blob sont libérées.

## Validation

- Suite backend complète sur une base PostgreSQL de test distincte : 176 réussis, 1 ignoré (garde spécifique SQLite), dont 22 tests documents.
- Suite frontend : 60 tests réussis, dont 18 tests de workflow photo.
- Compilation Next.js de production réussie ; TypeScript et ESLint ciblé réussis, y compris après la protection de fermeture des formulaires pendant les imports.
- Navigateur sur base SQLite et stockage isolés avec images synthétiques : connexion, galerie, création série, import de deux images avec aperçus/progression, formulaire prérempli et modification, archivage avec motif, compteur albums et affichage de miniature archivée, flèches et Échap. Vérification des tailles ordinateur et mobile.
- Aucun import ni archivage de données du cabinet pendant ces vérifications ; backend utilisateur non redémarré.

## Limites explicites

Les séries utilisent les champs réels : titre, zone, date et notes. La catégorie appartient aux photos. Les imports multiples utilisent plusieurs requêtes unitaires existantes et indiquent une progression par fichier. La navigation de visionneuse porte sur les photos de la page chargée ; les autres pages restent accessibles par la pagination de galerie. Les miniatures sont générées à la demande sans cache persistant pour préserver la confidentialité. La suppression physique de photos reste interdite par la politique existante.

## Fichiers de cette refonte

- `client/features/documents/api-types.ts`
- `client/features/documents/components/private-clinical-image.tsx`
- `client/features/documents/services/document-api-service.ts`
- `client/features/documents/services/photo-workflow.test.mjs`
- `client/features/phototheque/components/photo-library.tsx`
- `client/features/phototheque/components/clinical-gallery.tsx`
- `client/features/phototheque/components/gallery-editors.tsx`
- `client/features/phototheque/components/gallery-pickers.tsx`
- `client/features/phototheque/components/photo-comparisons.tsx`
- `client/features/phototheque/components/photo-gallery.module.css`
- `client/features/phototheque/components/photo-viewer.tsx`
- `client/features/phototheque/services/gallery-workflow.ts`
- `server/apps/documents/serializers.py`
- `server/apps/documents/services.py`
- `server/apps/documents/validators.py`
- `server/apps/documents/views.py`
- `server/apps/documents/tests/test_photo_gallery.py`
