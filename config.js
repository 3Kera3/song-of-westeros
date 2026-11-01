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
    { titre: "Carte", lien: "cartes.html" },
  ],
};
