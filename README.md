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
| Le lore | `contenu/lore.md` |
| Le règlement | `contenu/reglement.md` |
| Le guide du RP passif | `contenu/rp-passif.md` (même mise en forme que le règlement) |
| Les noms français de la carte | `donnees/monde/traductions.csv` (prioritaire) |
| Les repères du staff sur la carte | `donnees/monde/reperes.csv` |
| Le lien Discord, le nom, le menu | `config.js` |
| Les effectifs des armées | `donnees/armees.csv` |
| Les totaux de levée par région | `donnees/regions.csv` |
| Les noms et prénoms | **Directement dans le Google Sheet** (voir plus bas) |
| Les cartes d'origine (images) | `images/` (remplacer le fichier en gardant le même nom) |
| Le logo | `images/logo.png` (512x512) et `images/favicon.png` (64x64) |
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

### Carte du monde (Westeros et Essos)

La carte reprend la carte et les données du mod **A Game of Thrones** pour Crusader Kings III :
régions, territoires, duchés, comtés, châteaux et cités, seigneurs en 183 AC, routes.
Les fichiers `donnees/monde/*.json` et `monde/tuiles/` sont générés : pas besoin d'y toucher.

**Noms français** : trois fichiers `Original,Français`, du plus prioritaire au moins prioritaire :

1. `donnees/monde/traductions.csv` : vos corrections (régions, cultures, religions, noms officiels). C'est ici qu'il faut corriger.
2. `donnees/monde/traductions-mod.csv` : noms propres au mod, traduits à la main.
3. `donnees/monde/traductions-auto.csv` : châteaux et cités traduits automatiquement (à corriger au besoin dans le fichier 1).

Les noms officiels de la VF (Port-Réal, Vivesaigues, Corneilla...) viennent d'A Wiki of Ice and Fire / La Garde de Nuit.
Les noms exotiques d'Essos restent tels quels, comme dans les livres.

**Ajouter un repère** (`donnees/monde/reperes.csv`) :
1. Sur la page Carte, cliquez **Placer un repère**, puis cliquez à l'endroit voulu.
2. Une ligne est copiée, par exemple `Nom du repère,Description,1353,1448`.
3. Collez-la à la fin du fichier et remplacez le nom et la description.

Si un texte contient une virgule, mettez-le entre guillemets.

**Forces des maisons** : la fiche d'un fief affiche les levées de la maison du seigneur si elle figure dans `donnees/armees.csv`.

**Crédits** : le crédit affiché en bas de la carte (mod AGOT, A Wiki of Ice and Fire, La Garde de Nuit) doit rester visible.

### Noms (Google Sheet en direct)

La page **Noms** lit en direct l'onglet « Noms et prénoms de Westeros » du Google Sheet
`[SOW] Des Chiffres et des Lettres de Westeros`. Ajoutez ou corrigez un nom dans le Sheet : le site suit automatiquement.
Conditions : le Sheet doit rester partagé « Tous les utilisateurs disposant du lien » et garder les colonnes
`Prénom`, `Nom`, `Genre`, `Rang`, `Région`.
Si le Sheet est inaccessible, le site affiche la copie de secours `donnees/noms.csv`.

## Ajouter une page

Copiez `rp-passif.html` (page de texte) ou `lore.html`, renommez-la, changez le titre et le contenu, puis ajoutez-la au `menu` dans `config.js`.

## Structure

```
index.html, lore.html, reglement.html, rp-passif.html,
armees.html, noms.html, cartes.html                pages
config.js            réglages (Discord, menu, Google Sheet)
contenu/             textes (règlement)
donnees/             tableaux CSV
images/              cartes
assets/style.css     apparence
assets/app.js        fonctionnement (pas besoin d'y toucher)
```

Note : les pages chargent leurs données via le réseau. Ouvrir les fichiers en double-cliquant dessus ne fonctionne pas pour le
règlement et les tableaux ; consultez le site en ligne.
