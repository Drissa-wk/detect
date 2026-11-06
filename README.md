# Detect

**Detect** est une application web de démonstration consacrée à la détection et à la correction d'altérations dans des fichiers texte. Elle illustre le fonctionnement d'un code correcteur Reed–Solomon, complété par une empreinte CRC-32 pour contrôler l'intégrité des données restaurées.

L'application permet de déposer un fichier `.txt`, de le découper en blocs protégés, de simuler une corruption du stockage, puis de vérifier si les blocs altérés peuvent être corrigés.

> Ce projet est une démonstration pédagogique. Il ne remplace ni une sauvegarde, ni un système de stockage fiable, ni une protection cryptographique.

## Fonctionnalités

- Dépôt de fichiers texte par sélection ou glisser-déposer.
- Choix d'un niveau de protection Reed–Solomon : `RS(32,16)`, `RS(64,48)` ou `RS(255,223)`.
- Simulation d'altérations réparties ou sous forme de rafale.
- Vérification des blocs et tentative de correction.
- Contrôle CRC-32 après décodage pour confirmer que les données reconstituées correspondent aux données originales.
- Rapport visuel avec statut des blocs, octets altérés et corrigés, et historique des opérations.
- Persistance locale des fichiers et des tentatives dans IndexedDB du navigateur.

## Fonctionnement

Le navigateur envoie les données au serveur Flask sous forme de JSON, avec le contenu binaire encodé en Base64. Le serveur découpe les données en fragments de `k` octets, puis utilise la bibliothèque `reedsolo` pour produire des blocs de `n` octets.

Pour un code `RS(n, k)`, les `n - k` octets restants contiennent les symboles de contrôle. La capacité théorique de correction est de `floor((n - k) / 2)` octets erronés par bloc. Le CRC-32 est calculé avec `zlib` et sert à vérifier le résultat final; il ne corrige pas les erreurs.

Les erreurs sont injectées uniquement pour la démonstration. Le mode « isolés » choisit des positions réparties dans les blocs; le mode « rafale » choisit des positions consécutives. La correction est effectuée côté serveur avec Reed–Solomon.

## Architecture

```text
.
└── detect/
    ├── app.py                  # Application Flask et routes API
    ├── requirements.txt        # Dépendances d'exécution
    ├── requirements-dev.txt    # Dépendances de développement et de test
    ├── pytest.ini              # Configuration de pytest
    ├── static/
    │   ├── index.html          # Page principale
    │   ├── css/                # Styles de base, composants et vues
    │   └── js/                 # API, état, IndexedDB et interface
    └── tests/
        └── test_app.py         # Tests des routes Flask
```

Le frontend est du JavaScript natif en modules ES; aucune étape de compilation n'est nécessaire. Flask sert à la fois la page statique et les routes API.

## Prérequis

- Python 3 installé.
- `pip` et `venv` disponibles.
- Un navigateur moderne prenant en charge IndexedDB et les modules JavaScript.

## Installation et lancement local

Depuis la racine du dépôt :

```bash
cd detect
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python app.py
```

Ouvre ensuite [http://127.0.0.1:5000](http://127.0.0.1:5000).

Sous Windows, l'activation de l'environnement virtuel se fait avec :

```powershell
.venv\Scripts\Activate.ps1
```

L'application accepte actuellement les fichiers `.txt` jusqu'à **200 Ko** dans l'interface. Le serveur a également une limite de taille de requête de **4 Mio**; la représentation Base64 augmente la taille des données envoyées.

## Utilisation

1. Dépose un fichier texte depuis l'onglet **Déposer**.
2. Choisis le niveau de protection voulu. Le résumé indique le nombre de blocs et l'espace de stockage estimé.
3. Consulte le statut et les blocs dans **Fichiers** ou les détails dans **Rapport**.
4. Utilise **Abîmer** pour simuler des erreurs, en choisissant leur intensité et leur distribution.
5. Lance la correction et consulte le statut des blocs ainsi que le résultat du contrôle CRC-32.

Le sélecteur d'utilisateur et les fichiers enregistrés sont locaux à l'application de démonstration; il ne s'agit pas d'une authentification ni d'un compte utilisateur serveur.

## API Flask

Toutes les routes API utilisent `POST` et reçoivent un corps JSON. Les octets sont transportés sous forme de chaînes Base64.

| Route | Rôle |
| --- | --- |
| `/api/encode` | Découpe et encode les données; renvoie les blocs, leur CRC-32 et la longueur originale. |
| `/api/noise` | Modifie aléatoirement des octets; renvoie les blocs altérés et le nombre d'altérations par bloc. |
| `/api/check` | Vérifie les blocs; renvoie le résultat et les indices des blocs invalides. |
| `/api/decode` | Tente de corriger les blocs; renvoie les statuts, les données décodées et le résultat CRC-32. |

Les paramètres précis et les formats de réponse sont définis dans `detect/app.py` et dans le contrat documenté en haut de `detect/static/js/config.js`.

## Tests

Les tests backend utilisent `pytest` et le client de test Flask. Ils vérifient notamment l'encodage, la détection de corruption, la correction réussie ou impossible, le mode rafale et le rejet de paramètres invalides.

Installe les dépendances de développement et lance les tests depuis le dossier `detect` :

```bash
python -m pip install -r requirements-dev.txt
python -m pytest
```

Les dépendances de développement incluent aussi Ruff pour l'analyse statique Python.

## Données et confidentialité

Les fichiers et l'historique des tentatives sont conservés dans **IndexedDB du navigateur**, dans les stores `files` et `runs`. Le backend traite les données reçues pendant les requêtes, mais le code actuel ne met pas en place de stockage serveur pour ces fichiers. Les données ne sont donc pas synchronisées entre navigateurs ou appareils; vider les données du site dans le navigateur peut les supprimer.

## Déploiement

En local, `python app.py` lance le serveur de développement Flask avec le mode debug activé. **Ne déploie pas ce serveur de développement ni le mode debug sur Internet.** Pour une mise en production, utilise un serveur WSGI tel que Gunicorn, désactive le debug et configure HTTPS.

Le backend Flask sert déjà les fichiers statiques, ce qui permet de déployer le projet comme une seule application Python. Si le frontend est hébergé séparément, par exemple sur Netlify, il faut aussi configurer l'URL de l'API Flask et le routage ou le proxy entre les deux domaines.

## Limites

- L'interface accepte seulement les fichiers texte `.txt`.
- Le stockage est local au navigateur et n'est pas une sauvegarde durable.
- Les corruptions sont simulées; elles ne correspondent pas à une panne réelle de disque ou de réseau.
- CRC-32 détecte certaines altérations accidentelles, mais n'est pas une signature ni un mécanisme de sécurité.
- Les tests présents couvrent les routes backend; ils ne constituent pas une suite de tests automatisés du navigateur.