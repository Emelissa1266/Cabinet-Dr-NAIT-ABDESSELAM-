# Jeu de demonstration

Depuis `server`, avec l'environnement Python du projet :

```powershell
python manage.py seed_demo --dry-run --scale medium --seed 42
python manage.py seed_demo --scale medium --seed 42
```

La commande exige `config.settings.development`, `DEBUG=True`, PostgreSQL et une
connexion effective a `clinic_db`. Elle refuse les migrations en attente,
les contraintes non validees et les incoherences financieres preexistantes.
Configurer la connexion dans `.env`, jamais dans un fichier versionne.

Definir `CLINIC_DEMO_PASSWORD` dans `.env` (12 caracteres minimum, validateurs
Django appliques). En terminal interactif, une saisie masquee est aussi possible.
Le mot de passe n'est jamais affiche. Les comptes existants ne sont ni modifies
ni reinitialises ; une collision de role ou d'adresse reservee est refusee.

Comptes : `seed.demo.admin1`, `seed.demo.doctor1`, `seed.demo.doctor2`,
`seed.demo.nurse1` a `seed.demo.nurse3`, `seed.demo.secretary1` et
`seed.demo.secretary2`. Emails reserves sous `example.test`.

| Objets | small | medium | large |
| --- | ---: | ---: | ---: |
| Patients | 30 | 150 | 450 |
| Consultations | 50 | 250 | 750 |
| Interventions | 12 | 60 | 180 |
| Seances de soins | 36 | 180 | 540 |
| Rendez-vous | 60 | 300 | 900 |
| Factures | 40 | 200 | 600 |
| Paiements | 30 | 150 | 450 |
| Recus | 24 | 120 | 360 |
| PDF prives | 3 | 15 | 45 |

Repartition sur huit mois et quatre semaines a venir. Les dates dependent du
jour d'execution ; la graine reproduit les tirages pour une meme date et un meme
catalogue. La numerotation depend des sequences existantes et reste reservee aux
services metier. Les paiements en attente reservent leur allocation : un seul
paiement par facture dans ce jeu, avec verification du cumul non annule.

Les soins et certaines factures sont crees par les infirmiers sans validation
medicale. Terminer un soin ne cree aucune facture automatiquement. Les
interventions terminees suivent les transitions existantes et comportent bilan
preoperatoire, checklist obligatoire, consentement fictif, compte rendu et suivi.
Les types d'intervention actifs sont reutilises ; sans catalogue, des types
reserves DEMO sont crees. Le statut d'intervention reportee n'existe pas : aucun
nouveau statut n'est ajoute. Aucune photographie clinique n'est generee.

Les fichiers sont generes via le moteur PDF existant et le service d'upload vers
le stockage prive. Aucun lien vers un fichier absent n'est cree. Les PDF et
observations sont explicitement fictifs, sans valeur medicale. Les numeros de
telephone `TEST-*` ne sont pas des numeros composables.

Un manifeste `AuditLog` suit exactement les objets crees dans le processus,
sans inclure les insertions concurrentes d'autres utilisateurs. Une transaction
globale garantit le rollback SQL ; les nouveaux fichiers sont nettoyes en cas
d'erreur. Un verrou transactionnel PostgreSQL serialise les executions de cette
commande. Une seconde execution, meme avec une autre graine ou une autre taille,
conserve le jeu existant et ne cree rien. Aucun modele ni migration ajoute.

## Reinitialisation explicite

```powershell
python manage.py seed_demo --reset-demo --dry-run
python manage.py seed_demo --reset-demo --confirm-reset "DELETE DEMO clinic_db"
```

Cette option n'est jamais executee automatiquement. Elle ne supprime que les
identifiants du manifeste. Une reference depuis un objet exterieur au jeu,
y compris une relation SET_NULL, bloque toute suppression. Les comptes reserves
preexistants et les sequences financieres partagees restent intacts. Les fichiers
suivis sont supprimes apres le commit. Ne pas modifier le manifeste manuellement.

## Tests sans connexion a la base de developpement

```powershell
$env:DATABASE_URL='sqlite:///:memory:'
python -m pytest -q --tb=short
```

SQLite permet de verifier la generation, les volumes, les API et les montants
sur une base de test isolee. Cela ne remplace pas la verification PostgreSQL
du verrou, des contraintes, des migrations et des API apres l'insertion reelle.
La commande publique refuse toujours SQLite. L'interface web doit etre controlee
separement avec frontend et backend lances sur la base cible.
