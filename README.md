# STASE

Web app perso pour iPhone : suivre sa consommation de nicotine (snus et vape), d'abord pour **observer**, puis pour **arrêter**. Sobre, sans culpabilisation, tout reste sur le téléphone.

**En ligne :** https://h9r9zwh7ym-arch.github.io/STASE/ (GitHub Pages, branche `main`, dossier racine)

## Installer sur iPhone

1. Ouvrir l'adresse ci-dessus dans **Safari**.
2. Bouton Partager → **Sur l'écran d'accueil**.
3. Lancer STASE depuis l'icône : l'app s'ouvre en plein écran.

## Ce que fait l'app

- **Questionnaire de départ** (facultatif) : usage, motivations, points de santé → bénéfices adaptés.
- **Observation** : « + Snus » / « + Vape » en un tap, contexte facultatif (déclencheur, intensité), correction après coup, réduction progressive optionnelle.
- **Stats** : prises par jour, moyenne 7 j, heures, déclencheurs, dépenses, nicotine du snus, corrélation avec le check-in.
- **Check-in du soir** : sommeil, énergie, humeur, anxiété, fréquence cardiaque au repos.
- **Arrêt** : temps sans nicotine en direct, économies et doses évitées par rapport à la moyenne réelle d'observation, meilleur enchaînement, message du jour.
- **J'ai une envie** : minuteur de 10 minutes, respiration guidée, mini-relevé.
- **Après une prise** : rien n'est remis à zéro, on note et on reprend.
- **Corps** : frise de repères prudents (tendances générales, pas un avis médical) et bénéfices personnalisés.

## Données et sauvegarde

- Tout est stocké dans le `localStorage` de Safari, sur l'appareil. Rien n'est envoyé nulle part.
- **iOS peut effacer les données** d'une web app peu utilisée : faire un **export** régulier (Réglages → Données → Exporter, puis « Enregistrer dans Fichiers »). L'app le rappelle après 14 jours sans export.
- Import : Réglages → Données → Importer (le fichier remplace les données, avec « Annuler » juste après).
- Données de démo : Réglages → Données → Charger des données de démo (observation ou arrêt en cours).

## Développement

Un seul fichier, `index.html` : HTML, CSS et JavaScript sans framework, sans build, polices intégrées.

- **Lancer sur Mac** : ouvrir `index.html` dans Safari ou Chrome (vue mobile des outils développeur), ou `python3 -m http.server` puis http://localhost:8000.
- **Tester sur iPhone sans publier** : `python3 -m http.server` sur le Mac, puis `http://<IP-du-Mac>:8000` sur l'iPhone (même Wi-Fi).
- **Tests** : ouvrir `index.html?test`. Les tests tournent dans la page, sans toucher aux vraies données (calculs d'économies, dates et fuseaux, minuit, prix à zéro, corrélation, rendu de chaque écran…).

Organisation du script, dans l'ordre : `Util`, `Dates`, `Store` (stockage, migration, import/export), `Calc` (fonctions pures), `Charts` (SVG), `Craving`, `Demo`, `Messages`, `MILESTONES`, `CONCERNS`, `Intakes`, `UI`, `Screens`, feuilles, `Actions`, `Backup`, `App` (routage par `#/écran`), `Tests`.

## Limites connues

- Sans service worker (contrainte « un seul fichier »), le **premier chargement** de l'app demande du réseau ; ensuite Safari la garde souvent en cache, sans garantie.
- Les repères santé et les bénéfices sont des **tendances générales**, pas un avis médical.
