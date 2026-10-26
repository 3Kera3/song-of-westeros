# Les Chroniques de Westeros — Wiki RP

Prototype de wiki statique pour un serveur Garry's Mod RP Game of Thrones, prévu pour GitHub Pages.

## Publier avec GitHub Pages
1. Créez un dépôt GitHub public nommé `got-rp-wiki` (ou utilisez votre dépôt existant).
2. Ajoutez tous les fichiers et dossiers de ce projet à la racine du dépôt.
3. Dans le dépôt, ouvrez **Settings → Pages**.
4. Dans **Build and deployment**, choisissez **Deploy from a branch**.
5. Sélectionnez la branche `main` et le dossier `/(root)`, puis cliquez **Save**.
6. Attendez la fin du déploiement et ouvrez l'URL affichée dans la section Pages.

## Modifier les contenus
- `reglements/` : pages de règlements.
- `maisons/` : index et fiches des maisons.
- `historique.html` : journal des mises à jour.
- `assets/style.css` : couleurs, mise en page et adaptation mobile.
- `assets/search-index.js` : liste des pages visibles dans la recherche.

Les textes entre crochets sont des emplacements à remplacer par les règles officielles du serveur. Vérifiez les informations de lore pour la chronologie exacte de votre campagne.

## Notes
- Le site est statique : il n'y a pas de compte joueur, de panneau d'administration ni de base de données.
- La recherche porte sur les titres, catégories et descriptions ajoutés à `assets/search-index.js`, pas sur le texte intégral de chaque page.
- GitHub conserve l'historique des modifications via les commits.
