# STASE

**Version 2.1**

Web app perso pour iPhone : suivre sa consommation de nicotine (snus et vape), d'abord pour **observer**, puis pour **arrêter**. Sobre, sans culpabilisation, tout reste sur le téléphone.

**En ligne :** https://h9r9zwh7ym-arch.github.io/STASE/ (GitHub Pages, branche `main`, dossier racine)

## Installer sur iPhone

1. Ouvrir l'adresse ci-dessus dans **Safari**.
2. Bouton Partager → **Sur l'écran d'accueil**.
3. Lancer STASE depuis l'icône : l'app s'ouvre en plein écran.

## Ce que fait l'app

- **Questionnaire de départ** (facultatif) : usage, motivations, points de santé → bénéfices adaptés.
- **Observation** : « + Snus » / « + Vape » en un tap, contexte facultatif (déclencheur, intensité), millilitres de vape du jour, correction après coup (Historique), réduction progressive optionnelle.
- **Stats** : constats automatiques (heures, déclencheur, jour chargé, tendance), calendrier du mois, prises par jour, moyenne 7 j, heures, déclencheurs, dépenses en CHF, nicotine estimée (snus : portions × mg ; vape : ml × mg/ml), corrélation avec le check-in.
- **Check-in du soir** : sommeil, énergie, humeur, anxiété, fréquence cardiaque au repos.
- **Arrêt** : temps sans nicotine en direct, économies (CHF), doses et ml évités, nicotine évitée, par rapport à la moyenne réelle d'observation ; meilleur enchaînement, message du jour.
- **J'ai une envie** : minuteur de 10 minutes, respiration guidée, rappel de tes raisons d'arrêter (ta phrase, tes progrès, tes bénéfices), mini-relevé.
- **Après une prise** : rien n'est remis à zéro, on note et on reprend.
- **Corps** : frise de repères prudents (tendances générales, pas un avis médical) et bénéfices personnalisés.
- **Rappels** : carte « Check-in du soir » dans l'app après l'heure choisie, et alerte quotidienne via le calendrier de l'iPhone (fichier .ics), iOS ne permettant pas les notifications programmées sans serveur.
- **Aide** intégrée (Réglages → Aide) : fonctionnement, calculs, sauvegarde, ressources (Ligne stop-tabac 0848 000 181).
- **Mises à jour** : recherchées à l'ouverture, « Recharger » quand une nouvelle version est prête.

## Données et sauvegarde

- Tout est stocké dans le `localStorage` de Safari, sur l'appareil. Rien n'est envoyé nulle part.
- **iOS peut effacer les données** d'une web app peu utilisée : faire un **export** régulier (Réglages → Données → Exporter, puis « Enregistrer dans Fichiers »). L'app le rappelle après 14 jours sans export.
- Import : Réglages → Données → Importer (le fichier remplace les données, avec « Annuler » juste après).
- Données de démo : Réglages → Données → Charger des données de démo (observation ou arrêt en cours).

## Calcul des coûts

- Snus : prix de la boîte ÷ portions par boîte = coût d'une prise.
- Vape : si les ml du jour sont notés, ml × (prix ÷ contenance) ; sinon sessions × (prix ÷ sessions par capsule ou flacon).
- Un prix à zéro n'est jamais affiché comme « 0 CHF » : l'app indique qu'il manque.

## Développement

`index.html` contient toute l'app (HTML, CSS et JavaScript sans framework, sans build, polices intégrées). `sw.js`, à côté, est le service worker repris de ZESTE et ASCEN : l'app s'ouvre depuis une copie locale (même hors réseau), télécharge la nouvelle version en arrière-plan et propose « Recharger » quand elle a changé. Il ne s'active qu'en HTTPS (GitHub Pages) ou sur `localhost`.

- **Lancer sur Mac** : ouvrir `index.html` dans Safari ou Chrome (vue mobile des outils développeur), ou `python3 -m http.server` puis http://localhost:8000.
- **Tester sur iPhone sans publier** : `python3 -m http.server` sur le Mac, puis `http://<IP-du-Mac>:8000` sur l'iPhone (même Wi-Fi).
- **Tests** : ouvrir `index.html?test`. Les tests tournent dans la page, sans toucher aux vraies données (calculs d'économies, dates et fuseaux, minuit, prix à zéro, corrélation, rendu de chaque écran…).

Organisation du script, dans l'ordre : `Util`, `Dates`, `Store` (stockage, migration, import/export), `Calc` (fonctions pures), `Charts` (SVG), `Craving`, `Demo`, `Messages`, `MILESTONES`, `CONCERNS`, `Intakes`, `UI`, `Screens`, feuilles, `Actions`, `Backup`, `App` (routage par `#/écran`), `Tests`.

## Limites connues

- Le **tout premier chargement** demande du réseau ; ensuite l'app s'ouvre depuis sa copie locale.
- Les repères santé et les bénéfices sont des **tendances générales**, pas un avis médical.
