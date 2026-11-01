# Song of Westeros - site communautaire

Site du serveur Garry's Mod RP **Song of Westeros** (univers Game of Thrones), publié avec GitHub Pages :
https://3kera3.github.io/song-of-westeros/

## Modifier le site (sans rien installer)

1. Ouvrez le dépôt sur github.com et cliquez sur le fichier à modifier.
2. Cliquez sur l'icône **crayon** (Edit this file) en haut à droite du fichier.
3. Faites vos modifications.
4. Cliquez sur **Commit changes...** puis encore **Commit changes**.
5. Le site se met à jour tout seul en 1 à 2 minutes (rechargez la page avec Ctrl+F5).

Astuce : appuyez sur la touche `.` sur la page du dépôt pour ouvrir un éditeur complet dans le navigateur.
Pour annuler une erreur : onglet **Commits**, ouvrez le commit fautif, puis revenez à l'ancienne version du fichier.

## Quel fichier modifier ?

| Je veux changer... | Fichier |
|---|---|
| Le règlement | `contenu/reglement.md` |
| Le lien Discord, le nom, le menu | `config.js` |
| Les effectifs des armées | `donnees/armees.csv` |
| Les totaux de levée par région | `donnees/regions.csv` |
| Les noms et prénoms | **Directement dans le Google Sheet** (voir plus bas) |
| Les cartes | `images/` (remplacer le fichier en gardant le même nom) |
| Les couleurs | `assets/style.css` (variables en haut du fichier) |
| Les textes de l'accueil | `index.html` |

### Règlement (`contenu/reglement.md`)

Mise en forme simple :

```
# VIII. Nouvelle section          -> nouvelle section (ajoutée au sommaire)

## Nom de la règle                -> nouvelle carte de règle

Un paragraphe de texte. **En gras** avec deux étoiles.

- ✕ chose interdite               -> puce rouge
- ✔ chose autorisée               -> puce verte
- élément normal

> ✔ **Exemple autorisé** : ...    -> encadré vert
> ✕ **Exemple interdit** : ...    -> encadré rouge
> ⚠ **Sanction** : ...            -> encadré orange
```

Laissez une ligne vide entre deux paragraphes ou deux encadrés.

### Armées (`donnees/armees.csv`)

Une ligne par maison, valeurs séparées par des virgules, chiffres sans espace :

```
Région,Maison,Levées,Infanterie,Cavalerie,Chevaliers,Vassaux,Flotte
Le Nord,Maison Stark,6400,5400,1000,,,
```

Une case vide s'affiche « - ». Le nom de région doit être écrit exactement comme dans `donnees/regions.csv`.
GitHub affiche les CSV sous forme de tableau, ce qui aide à vérifier.

### Noms (Google Sheet en direct)

La page **Noms** lit en direct l'onglet « Noms et prénoms de Westeros » du Google Sheet
`[SOW] Des Chiffres et des Lettres de Westeros`. Ajoutez ou corrigez un nom dans le Sheet : le site suit automatiquement.
Conditions : le Sheet doit rester partagé « Tous les utilisateurs disposant du lien » et garder les colonnes
`Prénom`, `Nom`, `Genre`, `Rang`, `Région`.
Si le Sheet est inaccessible, le site affiche la copie de secours `donnees/noms.csv`.

## Ajouter une page

Copiez `cartes.html`, renommez-la, changez le titre et le contenu, puis ajoutez-la au `menu` dans `config.js`.

## Structure

```
index.html, reglement.html, armees.html, noms.html, cartes.html   pages
config.js            réglages (Discord, menu, Google Sheet)
contenu/             textes (règlement)
donnees/             tableaux CSV
images/              cartes
assets/style.css     apparence
assets/app.js        fonctionnement (pas besoin d'y toucher)
```

Note : les pages chargent leurs données via le réseau. Ouvrir les fichiers en double-cliquant dessus ne fonctionne pas pour le
règlement et les tableaux ; consultez le site en ligne.
