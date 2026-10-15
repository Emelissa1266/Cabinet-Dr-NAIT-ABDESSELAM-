# Resultat du remplissage - 11 octobre 2026

Insertion effectuee dans **clinic_db, PostgreSQL 16.8**, conteneur
`clinic-postgres`, environnement `config.settings.development`, DEBUG actif.
La base du conteneur ne comportait aucune table applicative : les migrations
existantes ont ete appliquees avant l'insertion. Aucun modele ni champ ajoute.
Les donnees SQLite preexistantes n'ont pas ete supprimees ou transferees.

## Commandes executees

```powershell
python manage.py migrate --noinput
python manage.py seed_demo --dry-run --scale medium --seed 42
python manage.py seed_demo --scale medium --seed 42
```

La derniere commande a ete executee une seconde fois : aucune creation
supplementaire. `--reset-demo` n'a pas ete execute sur clinic_db.

## Volumes enregistres

| Entite | Nombre |
| --- | ---: |
| Comptes de demonstration | 8 |
| Patients fictifs | 150 |
| Consultations | 250 |
| Interventions | 60 |
| Plans de soins | 180 |
| Seances de soins | 180 |
| Rendez-vous | 300 |
| Factures / lignes de facturation | 200 / 200 |
| Paiements / allocations | 150 / 150 |
| Recus | 120 |
| Documents PDF prives | 15 |
| Prescriptions / lignes | 84 / 84 |
| Notifications | 60 |
| Alertes medicales / allergies | 22 / 22 |
| Observations / mesures infirmieres | 150 / 150 |
| Parametres de seances / consommations | 150 / 150 |
| Bilans preoperatoires / comptes rendus operatoires | 36 / 36 |
| Bilans postoperatoires / suivis | 36 / 36 |

Le manifeste contient aussi les catalogues DEMO, les horaires des praticiens,
les equipes operatoires et 2769 evenements d'audit generes par les services.
Les nouveaux patients couvrent **8 mois** et les paiements termines **7 mois**.
Le fichier `DEMO_REPORT.json` contient les nombres detailles par modele,
les statistiques mensuelles et les reponses des tableaux de bord par role.

## Etats et finances

- Interventions : 36 terminees, 12 programmees, 12 annulees.
- Seances : 150 terminees, 30 planifiees.
- Rendez-vous : 171 termines, 34 annules, 35 absences, 30 confirmes, 30 programmes.
- Factures : 12 brouillons, 56 emises, 90 partiellement payees, 30 payees, 12 annulees.
- Paiements : 120 termines, 15 en attente, 15 annules.
- Encaissements termines : **285 500,00 DZD**.
- Solde des factures non annulees : **3 579 500,00 DZD**, selon le service dashboard.

Numerotation : `INV-2026-000001` a `INV-2026-000188` (les 12 brouillons
n'ont pas encore de numero), `PAY-2026-000001` a `PAY-2026-000150`,
`REC-2026-000001` a `REC-2026-000120`. Les recus sont reserves aux paiements
termines et uniques par paiement. Les allocations non annulees ne depassent
jamais le total d'une facture ; les allocations ne depassent pas les paiements.
Tous les montants sont des Decimal, en DZD, calcules par les services existants.

## Connexion aux comptes

- Administrateur : `seed.demo.admin1`.
- Medecins : `seed.demo.doctor1`, `seed.demo.doctor2`.
- Infirmiers : `seed.demo.nurse1`, `seed.demo.nurse2`, `seed.demo.nurse3`.
- Secretaires : `seed.demo.secretary1`, `seed.demo.secretary2`.

Le mot de passe aleatoire commun a ces nouveaux comptes est conserve uniquement
dans `CLINIC_DEMO_PASSWORD` du fichier local `server/.env`. Il n'est ni code en
dur, ni affiche dans les journaux, ni reproduit dans ce rapport. Aucun compte
preexistant ni mot de passe preexistant n'a ete modifie par le seeding.

## Validation

- Suite backend sur SQLite de test isolee : **156 reussis**.
- Tests du seeding apres les derniers ajouts : **4 reussis**.
- Suite backend sur PostgreSQL de test isolee : **155 reussis, 1 ignore**.
  Le test ignore verifie specifiquement le refus de SQLite. Aucun echec final.
  Un hasher rapide a ete utilise uniquement dans le processus des tests
  PostgreSQL ; les mots de passe de clinic_db utilisent le hasher normal.
- Integrite financiere avant/apres insertion, contraintes PostgreSQL,
  cles et coherence des patients lies : controles reussis.
- Idempotence reelle sur clinic_db : seconde execution sans doublon.
- 18 controles API directement sur clinic_db : reponses HTTP 200 attendues,
  dont patients et dashboard pour chacun des quatre roles.
- Acces anonyme a la liste des documents : HTTP 401 attendu.
- Les 15 PDF existent dans le stockage prive ; rendu d'un exemplaire verifie.
- Les tests couvrent le rollback SQL, le nettoyage des fichiers, les collisions
  de comptes, la confirmation du reset et le refus de supprimer une donnee
  de demonstration referencee par un enregistrement exterieur.
- `manage.py check` et `git diff --check` : aucune erreur.

**Controle visuel effectue apres redemarrage du backend par l'utilisateur** :
connexion administrateur et medecin reussies, tableaux de bord charges,
150 patients, 60 interventions, facturation et 180 plans de soins affiches.
L'agenda affiche 16 rendez-vous pour la semaine du 12 au 18 octobre 2026.
Ce controle en lecture ne valide pas tous les formulaires ni toutes les transitions.

Anomalie frontend observee : la liste des soins affiche parfois « Patient inconnu »
malgre des cles etrangeres patient valides. La cause UI reste a investiguer ;
aucune correction frontend n'a ete appliquee dans cette tache de seeding.

## Anomalies et limites

La configuration initiale pointait vers SQLite. Le service PostgreSQL 17
Windows occupait le port 5432 a la place du conteneur PostgreSQL 16. Le service
17 a ete arrete avec autorisation explicite et elevation Windows ; il reste
arrete. Le conteneur utilise maintenant 5432. Le redemarrer sur ce meme port
reintroduirait le conflit.

Le catalogue d'interventions etait vide : trois types reserves DEMO ont ete
crees. Le modele ne propose pas de statut d'intervention reportee : ce statut
n'a pas ete invente. Aucune photographie medicale n'a ete generee. Les champs
non representes par les modeles existants n'ont pas ete ajoutes.

## Fichiers crees ou modifies

- `server/apps/accounts/management/commands/seed_demo.py` : commande reutilisable.
- `server/apps/accounts/tests/test_seed_demo.py` : tests.
- `server/DEMO_DATA.md` : utilisation, securite et reset.
- `server/DEMO_REPORT.json` : rapport technique issu de clinic_db.
- `server/DEMO_RESULTATS.md` : ce rapport.
- `server/.env` : connexion au conteneur et mot de passe DEMO local, non versionne.
- `server/.env.example` : variable vide documentee.
- `.gitignore`, `server/.gitignore` : exclusion des temporaires, des fichiers
  prives et d'une copie locale de configuration.
- 15 fichiers PDF sous `server/private_media/secure/documents/`, suivis par
  le manifeste d'audit et exclus du versionnement.
