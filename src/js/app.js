'use strict';
/* Démarrage de Multipify Photo */
MP.version = '1.0.0';
window.addEventListener('DOMContentLoaded', () => {
  MP.view.init(document.getElementById('view'));
  MP.guides.init();
  MP.ui.init();
  MP.v4init(); MP.v5init(); MP.v6init(); MP.v7init(); MP.v8init(); MP.v10init(); MP.license && MP.license.init();
  // fichiers passés au lancement (double-clic sur un fichier, « Ouvrir avec… »)
  MP.native.onOpenPaths && MP.native.onOpenPaths(async (files) => { for (const f of files) await MP.io.openFile(f); });
  MP.native.ready && MP.native.ready();
  window.addEventListener('resize', () => MP.ui.navigatorDirty());
});
