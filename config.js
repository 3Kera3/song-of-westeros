// =============================================================
//  CONFIGURATION DU SITE - Song of Westeros
//  Modifiez les valeurs entre guillemets, puis "Commit changes".
// =============================================================
window.SOW = {
  nom: "Song of Westeros",
  sigle: "SOW",
  accroche: "Serveur Garry's Mod roleplay dans l'univers de Game of Thrones.",

  // Lien d'invitation Discord
  discord: "https://discord.gg/kd2c4Fdc3A",

  // Google Sheet "[SOW] Des Chiffres et des Lettres de Westeros"
  // La page Noms lit l'onglet en direct : modifiez le Sheet, le site suit.
  sheet: {
    id: "1SMvh1fFM32yc27zp90cOC9YRACTsFhHYjfWah_sP2zg",
    ongletNoms: "1362083144",
  },

  // Menu du site (ordre d'affichage)
  menu: [
    { titre: "Accueil", lien: "index.html" },
    { titre: "Lore", lien: "lore.html" },
    { titre: "Règlement", lien: "reglement.html" },
    { titre: "RP passif", lien: "rp-passif.html" },
    { titre: "Armées", lien: "armees.html" },
    { titre: "Noms", lien: "noms.html" },
    { titre: "Cartes", lien: "cartes.html" },
  ],

  // Cartes interactives. "id" relie la carte aux repères de donnees/lieux.csv (colonne Carte).
  // Pour ajouter une carte : déposer l'image dans images/ et ajouter une ligne ici.
  cartes: [
    { id: "regions", titre: "Régions et royaumes", image: "images/carte-regions.png", description: "Les neuf régions et leurs places fortes." },
    { id: "economie", titre: "Productions et ressources", image: "images/carte-economie.png", description: "Mines, cultures, élevage et artisanat." },
    { id: "routes", titre: "Routes commerciales", image: "images/carte-routes.png", description: "Routes, voies maritimes, ports et marchés." },
  ],
};
