# Facturation médecin — résultat

## Fonctionnalités

- Bouton « + Ajouter une facture » ; panneau latéral identique au composant existant.
- Patient existant, plusieurs prestations libres ou issues du catalogue, description, quantité, tarif, remises, échéance et notes.
- Total DZD calculé en arithmétique décimale, avec le même arrondi que Django.
- Enregistrement atomique du brouillon et de ses lignes ; option « Enregistrer et émettre » dans la même transaction.
- Formulaire de modification prérempli ; conservation des liens cliniques des lignes existantes et validation du patient.
- Boutons Modifier (crayon) et Supprimer (corbeille) dans le détail. Confirmation de suppression avec le texte demandé.
- Suppression physique uniquement des brouillons sans allocation, y compris les allocations de paiements en attente ou annulés. Aucun paiement ni reçu supprimé.
- Factures émises immuables ; annulation via le service existant pour les cas permis, avec motif et historique.
- Permissions DOCTOR côté Django ; autonomie NURSE sur ses propres factures conservée.
- Verrouillage des factures, transactions atomiques, audit des enregistrements, remises et suppressions ; numéros INV exclusivement produits par le service backend d'émission.
- JWT HttpOnly et protection CSRF existants réutilisés ; erreurs et notifications accessibles, chargement et rafraîchissement.
- Statistiques agrégées par Django sur toutes les pages correspondant aux filtres ; tableau, cartes, couleurs et typographie conservés.
- Aucun changement de modèle, aucune migration nécessaire.

## Fichiers de cette demande

- [server/apps/billing/permissions.py](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/billing/permissions.py>)
- [server/apps/billing/serializers.py](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/billing/serializers.py>)
- [server/apps/billing/services.py](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/billing/services.py>)
- [server/apps/billing/views.py](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/billing/views.py>)
- [server/apps/billing/tests/test_billing_phase6.py](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/billing/tests/test_billing_phase6.py>)
- [server/apps/billing/tests/test_invoice_management.py](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/server/apps/billing/tests/test_invoice_management.py>)
- [client/features/billing/api-types.ts](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/billing/api-types.ts>)
- [client/features/billing/components/real-billing-workspace.tsx](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/billing/components/real-billing-workspace.tsx>)
- [client/features/billing/components/real-billing-workspace.module.css](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/billing/components/real-billing-workspace.module.css>)
- [client/features/billing/components/invoice-editor.tsx](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/billing/components/invoice-editor.tsx>)
- [client/features/billing/services/billing-api-service.ts](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/billing/services/billing-api-service.ts>)
- [client/features/billing/services/invoice-form.ts](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/billing/services/invoice-form.ts>)
- [client/features/billing/services/billing-display.test.mjs](<C:/Users/ABC/Desktop/gestion-cabinet/Cabinet-Dr-NAIT-ABDESSELAM-/client/features/billing/services/billing-display.test.mjs>)

Ce document récapitulatif est ajouté à la racine. Les fichiers de données de démonstration et de configuration déjà modifiés lors de la demande précédente sont conservés.

## Validation

- Suite backend complète SQLite : 167 tests réussis (version finale).
- Suite backend complète PostgreSQL : 162 réussis, 1 ignoré (contrôle spécifique SQLite), avant l'ajout des derniers tests de statistiques/CSRF.
- Suite ciblée finale PostgreSQL : 27 réussis (facturation et PDF).
- Frontend : les 56 tests du projet réussissent ; les 4 tests ciblés de facturation ont été rejoués après ajustement du calcul décimal et réussissent.
- TypeScript : aucune erreur. ESLint des fichiers de facturation : aucune erreur ni avertissement après nettoyage.
- Compilation de production Next.js : réussie. Vérification Django : aucune erreur.
- Vérification du formulaire dans le navigateur : sélection de patients, ajout de deux prestations et calcul 2 × 1 500,25 + 500 = 3 500,50 DZD. Contrôle visuel en largeur réduite et large ; aucune facture de test créée dans la base de développement par le navigateur.
- Les tests de création, émission, modification, suppression et paiements utilisent exclusivement des bases de test isolées.

## Serveur local

Le backend de développement ne répondait plus sur 127.0.0.1:8000 en fin de vérification. Le redémarrage manuel reste à effectuer, conformément au choix précédent de l'utilisateur :

```powershell
cd server
..\.venv\Scripts\python.exe manage.py runserver
```

Puis actualiser la page Facturation. La vérification des derniers enregistrements de bout en bout s'appuie sur les tests API PostgreSQL avec cookies et CSRF ; les clics d'enregistrement dans le navigateur n'ont pas été effectués sur les données du cabinet.
