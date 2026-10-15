# Terminologie du cabinet médical

Les libellés désignant l’établissement sont harmonisés : Photothèque médicale, Imagerie médicale privée, Navigation du cabinet, Finances du cabinet, Agenda du cabinet et vue d’ensemble du cabinet médical. Le titre des onglets et la description de l’application présentent le cabinet médical spécialisé en chirurgie plastique et esthétique.

Les composants communs couvrent ADMIN, DOCTOR, NURSE et SECRETARY. Les libellés d’administration Django et les messages de fermeture du cabinet sont également corrigés. Les expressions « Gestion de clinique » et « Personnel de la clinique » n’ont pas été trouvées dans les sources applicatives inspectées.

Les termes médicaux légitimes (notes cliniques, examen clinique, suivi clinique, mesures cliniques, catégorie de documents cliniques) restent inchangés. Les identifiants techniques, routes, modèles, noms de tables, chemins, logo et nom officiel du cabinet sont conservés. Aucun changement de design ni de fonctionnalité.

Les factures PDF utilisent déjà le nom du cabinet : aucun changement nécessaire dans leur génération.

## Fichiers modifiés pour cette demande

- [client/app/layout.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/app/layout.tsx)
- [client/components/layout/application-shell.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/components/layout/application-shell.tsx)
- [client/components/layout/sidebar.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/components/layout/sidebar.tsx)
- [client/features/secretary/components/secretary-agenda.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/secretary/components/secretary-agenda.tsx)
- [client/features/secretary/components/secretary-calendar.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/secretary/components/secretary-calendar.tsx)
- [client/features/phototheque/components/clinical-gallery.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/phototheque/components/clinical-gallery.tsx)
- [client/features/phototheque/components/photo-viewer.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/phototheque/components/photo-viewer.tsx)
- [client/features/patients/components/patient-detail.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/patients/components/patient-detail.tsx)
- [client/features/nurse/components/nurse-patients.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/nurse/components/nurse-patients.tsx)
- [client/features/documents/components/patient-photos-section.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/documents/components/patient-photos-section.tsx)
- [client/features/documents/services/photo-workflow.ts](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/documents/services/photo-workflow.ts)
- [client/features/dashboard/services/dashboard-view.ts](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/dashboard/services/dashboard-view.ts)
- [client/features/billing/components/real-billing-workspace.tsx](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/billing/components/real-billing-workspace.tsx)
- [server/config/settings/base.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/config/settings/base.py)
- [server/apps/accounts/admin.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/accounts/admin.py)
- [server/apps/accounts/views.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/accounts/views.py)
- [server/apps/agenda/models.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/agenda/models.py)
- [server/apps/agenda/services.py](C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/agenda/services.py)

## Vérifications exécutées

- Suite frontend Node : 63 tests réussis.
- TypeScript : `tsc --noEmit`, réussi.
- Backend Django : 44 tests réussis (agenda, authentification, administration des utilisateurs et factures PDF), sur base SQLite en mémoire isolée.
- `git diff --check` : réussi.
- Recherche globale des occurrences dans les sources frontend/backend et contrôle des libellés des documents générés.

Pas de vérification visuelle interactive des quatre interfaces pendant cette modification de textes.
