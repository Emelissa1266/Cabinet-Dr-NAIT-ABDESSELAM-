# Module Arrêts de travail

## Fonctionnalités livrées

Le médecin dispose du module `/work-leaves`, d’une entrée de navigation et d’une section Arrêts de travail dans le dossier patient. La création depuis une consultation présélectionne le patient et la consultation. Un lien permet de retrouver les arrêts de cette consultation, sans duplication des données.

La liste propose recherche, filtre patient/statut et pagination. Les détails présentent identité, dates, durée, médecin, consultation, prolongation, données confidentielles réservées à l’auteur et historique. Le formulaire large conserve les composants, couleurs et styles existants. L’option de largeur ajoutée au composant partagé de dialogue est facultative : les autres dialogues gardent leurs dimensions précédentes.

Le formulaire permet un arrêt initial ou une prolongation, prescription, dates, consultation facultative, motif médical, notes internes et instructions au patient. La durée calendaire inclut les deux dates ; elle est calculée dans le navigateur et recalculée indépendamment par Django. Aucune durée maximale arbitraire n’est imposée.

Le workflow est `DRAFT` → `ISSUED` → `CANCELLED`. Seuls les brouillons peuvent être modifiés ou supprimés. L’émission nécessite une confirmation explicite du médecin et fige l’identité du patient, du prescripteur et le texte émis. Les modifications ultérieures du profil patient ou du modèle de texte ne réécrivent pas le certificat historique. Une correction d’un certificat émis passe par son annulation motivée puis la création d’un nouveau document. Les annulations conservent les dates, le contenu, les liens et l’historique.

Une prolongation référence un arrêt émis du même patient et du même médecin ; son début doit être postérieur à la fin précédente. Aucune règle réglementaire de durée maximale ou de continuité obligatoire n’est inventée. Les relations protégées empêchent la suppression de l’historique via le patient ou la consultation. L’API explique ce refus au lieu de provoquer une erreur serveur ou une suppression en cascade.

## Backend, migration et numérotation

Le modèle `WorkLeave` est ajouté dans l’application médicale existante. La migration **medical.0003_work_leave** crée la table, les relations, l’index et les contraintes de dates/durée ; elle a été **appliquée à la base PostgreSQL locale clinic_db**. `makemigrations --check --dry-run` confirme l’absence de migration manquante.

Les références `AT-AAAA-000001` sont générées uniquement côté backend à la création du brouillon. Le service réutilise `FinancialSequence` et son verrou transactionnel, avec une clé indépendante `work_leave`. Les numéros INV-* et les séquences financières existantes ne changent pas. Les opérations métier et leur audit sont atomiques ; les changements de statut sont protégés par verrou de ligne. L’audit conserve l’action, la référence, le statut et les noms des champs modifiés, sans recopier les motifs médicaux, notes ou instructions.

## Endpoints

Préfixe : `/api/v1/work-leaves/`.

- `GET /` : liste paginée, filtres patient, consultation, statut, type, recherche par référence/patient et tri chronologique.
- `POST /` : création d’un brouillon.
- `GET /{id}/` : détail et historique.
- `PATCH /{id}/` : modification d’un brouillon.
- `DELETE /{id}/` : suppression d’un brouillon autorisé, audit conservé.
- `POST /{id}/issue/` : émission, sans changement du contenu transmis avec cette action.
- `POST /{id}/cancel/` : annulation motivée via `cancellation_reason`.
- `GET /{id}/pdf/` : PDF en pièce jointe, `Arret_Travail_AT-AAAA-000001.pdf`.
- `GET /{id}/print/` : PDF inline pour aperçu sécurisé et impression.

## Permissions et confidentialité

- **DOCTOR** : création et accès à ses propres arrêts uniquement ; modification/suppression de ses brouillons ; émission, annulation, prolongation, PDF et impression.
- **Autre médecin** : certificats masqués de la liste et réponse 404 sur accès direct.
- **ADMIN, NURSE, SECRETARY** : aucun accès à ce nouveau module (403). Aucune permission explicite supplémentaire n’ayant été définie pour ces rôles, aucun accès médical ne leur a été attribué automatiquement. Leurs droits sur les modules existants restent inchangés.
- **Anonyme** : 401.
- JWT HttpOnly et CSRF existants conservés ; tests de création/émission par cookies avec refus sans CSRF.
- Champs techniques et statuts non modifiables par injection dans le formulaire/API.
- PDF générés en mémoire, réponses privées `no-store`, accès API autorisé uniquement et aperçu via URL Blob temporaire.

## Certificat PDF

A4, logo officiel, coordonnées, marges, polices, teal, séparateurs et pied de page issus du générateur partagé avec ordonnances/factures. Le certificat comporte identité, naissance si disponible, période inclusive, durée, date, référence, lien de prolongation et espace vierge pour signature/cachet.

Le texte émis exprime la prescription d’un arrêt par le médecin ; il n’invente pas un examen réalisé « ce jour ». Le PDF destiné à l’employeur exclut motif médical, notes internes, instructions libres et motif détaillé d’annulation. Un brouillon affiche **BROUILLON - NON VALIDE** et ne produit pas le texte attestant l’émission ; un annulé affiche **ANNULÉ - DOCUMENT NON VALIDE**. Le bouton d’impression automatique est réservé aux documents émis ; les aperçus/téléchargements des autres statuts gardent leur mention de non-validité.

`WORK_LEAVE_CERTIFICATE_TEXT` permet de configurer le texte via l’environnement. Variables disponibles : `{doctor}`, `{patient}`, `{duration}`, `{start}`, `{end}`. La configuration est documentée dans `.env.example`. Le texte est figé lors de l’émission. Aucune signature, cachet, mention CNAS, adresse, numéro d’agrément ou signature électronique qualifiée n’est généré.

## Fichiers créés ou modifiés

- [server/apps/medical/models.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/medical/models.py)
- [server/apps/medical/migrations/0003_work_leave.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/medical/migrations/0003_work_leave.py)
- [server/apps/medical/work_leave_api.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/medical/work_leave_api.py)
- [server/apps/medical/work_leave_services.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/medical/work_leave_services.py)
- [server/apps/medical/work_leave_pdf.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/medical/work_leave_pdf.py)
- [server/apps/medical/urls.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/medical/urls.py)
- [server/apps/medical/views.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/medical/views.py)
- [server/apps/medical/tests/test_work_leaves.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/medical/tests/test_work_leaves.py)
- [server/apps/patients/views.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/patients/views.py)
- [server/config/settings/base.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/config/settings/base.py)
- [server/.env.example](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/.env.example)
- [client/app/(dashboard)/work-leaves/page.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/app/(dashboard)/work-leaves/page.tsx)
- [client/features/work-leaves/types.ts](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/work-leaves/types.ts)
- [client/features/work-leaves/services/work-leave-api.ts](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/work-leaves/services/work-leave-api.ts)
- [client/features/work-leaves/services/work-leave-form.ts](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/work-leaves/services/work-leave-form.ts)
- [client/features/work-leaves/services/work-leave.test.mjs](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/work-leaves/services/work-leave.test.mjs)
- [client/features/work-leaves/components/work-leave-editor.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/work-leaves/components/work-leave-editor.tsx)
- [client/features/work-leaves/components/work-leaves-workspace.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/work-leaves/components/work-leaves-workspace.tsx)
- [client/features/work-leaves/components/create-work-leave-button.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/work-leaves/components/create-work-leave-button.tsx)
- [client/features/work-leaves/components/work-leaves.module.css](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/work-leaves/components/work-leaves.module.css)
- [client/features/patients/components/patient-detail.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/patients/components/patient-detail.tsx)
- [client/features/medical/components/patient-phase-9e-sections.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/medical/components/patient-phase-9e-sections.tsx)
- [client/lib/navigation.ts](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/lib/navigation.ts)
- [client/lib/presentation.ts](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/lib/presentation.ts)
- [client/components/ui/detail-dialog.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/components/ui/detail-dialog.tsx)
- [client/components/ui/detail-dialog.module.css](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/components/ui/detail-dialog.module.css)
- [client/package.json](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/package.json)

## Tests et résultats

- **147 tests backend réussis, 1 ignoré sur SQLite** : suites medical, care, billing, patients et authentification. Le test ignoré nécessite les verrous PostgreSQL.
- **24 tests du module réussis sur une base PostgreSQL de test isolée**, incluant huit créations concurrentes avec références distinctes. Cette exécution couvre la numérotation concurrente ignorée sur SQLite ; la protection supplémentaire de suppression patient/consultation est couverte par la suite SQLite finale.
- **81 tests frontend réussis**, dont 8 nouveaux tests (jours inclusifs, bissextile/DST, dates invalides, prolongation, workflow, appels API, pagination, rôles et présélection patient/consultation). Les tests ciblés ont aussi été relancés après les ajustements du formulaire large.
- Contrôles TypeScript `tsc --noEmit`, ESLint ciblé, Ruff ciblé, `manage.py check`, migration cohérente et `git diff --check` : réussis.
- Trois certificats fictifs rendus avec Poppler et inspectés visuellement : brouillon, émis et annulé, une page A4 chacun. Logo, coordonnées, titre, période, durée, référence, mentions de non-validité, espace de signature et absence de diagnostic vérifiés.
- Données et bases de test uniquement ; aucune donnée médicale réelle n’a été créée ou modifiée pour les tests. L’unique intervention sur la base locale de développement est la migration structurelle du module.

Limites de vérification : les interactions frontend sont contrôlées par tests de logique et rendu React côté serveur, et les aperçus PDF réutilisent le mécanisme déjà testé. Pas de parcours manuel authentifié dans le navigateur ni de test sur une imprimante physique pendant cette intervention. Aucun redémarrage manuel des serveurs.

## Validation avant mise en production

Le modèle n’est pas présenté comme juridiquement validé. Faire valider par le médecin les mentions obligatoires, le texte de délivrance, les règles de prescription/prolongation/annulation, les règles de conservation des brouillons et les éventuelles exigences des organismes concernés en Algérie. L’immutabilité est assurée dans le logiciel et dans les données sources ; aucune inviolabilité cryptographique ou signature qualifiée du fichier exporté n’est revendiquée.
