# Obtenir directement les fichiers .exe (sans rien installer)

Le projet contient une construction automatique sur les serveurs de GitHub (gratuit) :

1. Créez un compte gratuit sur https://github.com puis un dépôt privé (bouton « New repository »).
2. Sur la page du dépôt : « Add file » › « Upload files », glissez **tout le contenu** du dossier `multipify-photo`
   (y compris le dossier caché `.github`), puis « Commit changes ».
3. Ouvrez l'onglet **Actions** : la construction « Construire le .exe Windows » démarre seule (8 à 12 minutes).
4. Cliquez sur la construction terminée (coche verte) puis, en bas, sur **Multipify-Photo-Windows** :
   vous téléchargez un .zip qui contient
   - `MultipifyPhoto-Setup-1.0.0.exe` (installateur),
   - `Multipify-Photo-Portable-1.0.0.exe` (version portable, sans installation).

Astuce : si vous reliez votre compte GitHub à Claude (claude.ai › Paramètres › Connecteurs), Claude peut envoyer
le projet et lancer la construction lui-même ; il ne vous reste qu'à télécharger les .exe.

Le fichier `construire-exe.bat` reste disponible pour construire sur votre propre PC (nécessite Node.js).
