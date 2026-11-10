# Multipify Photo 1.0

**Première version commerciale.** Les sections « version 2.0 à 13.0 » ci-dessous décrivent les étapes de développement, toutes incluses dans la 1.0.

## Licence, abonnement et crédits IA (version 1.0)
- **Essai gratuit** au premier lancement (3 jours par défaut, réglable dans l'administration), puis **abonnement 4,99 €/mois** payé par Viva Wallet sur https://multipify.eu/multipify-photo.html, prélevé automatiquement chaque mois. L'abonnement **ne comprend pas de crédit IA**.
- **Crédits IA** : une retouche IA OpenAI = **2 crédits** ; packs **100 crédits = 10 €** et **550 crédits = 50 €**, achetés dans le logiciel (IA › Crédits IA et licence…) ou sur la page de vente avec la clé. Les crédits s'ajoutent automatiquement à la clé, donc au PC où elle est active (badge ✨ dans la barre de menus, mis à jour en quelques secondes après le paiement). En cas d'échec du service IA, les crédits sont rendus.
- **1 clé = 1 ordinateur** : activer la clé sur un autre PC désactive l'ancien (il affiche « Cette clé a été activée sur un autre ordinateur »). L'identifiant du PC est calculé à partir de l'identifiant matériel de Windows / macOS ; la licence est chiffrée sur le disque.
- L'IA passe par le serveur Multipify (clé OpenAI du serveur) : le client n'a besoin d'aucune clé. Option avancée : IA › Utiliser ma propre clé OpenAI.
- Hors connexion : le logiciel reste utilisable 7 jours sans vérification (réglable).
- Aide › Rechercher des mises à jour : télécharge la dernière version publiée dans l'administration.
- Côté serveur : voir `INSTALLATION-SERVEUR.md` dans le paquet serveur.

Éditeur d'images professionnel pour Windows (Electron), inspiré de Photoshop 2026 : calques et groupes, calques de réglage non destructifs, styles de calque modifiables, masques, fichiers PSD, fonctions IA génératives, Fluidité, perspective, plume, règles et repères.

## Obtenir les .exe sans rien installer
Voir **OBTENIR-LE-EXE.md** : envoyez le dossier sur GitHub (gratuit) et les serveurs de GitHub construisent l'installateur et la version portable (.exe) automatiquement, en 8 à 12 minutes (fichier `.github/workflows/construire-exe.yml`).

## Nouveautés de la version 13.0 — Retouche IA
- **Retouche IA** (IA › Retouche IA, Ctrl+Alt+R, ou bouton ✨ Retouche de la barre contextuelle) : **111 retouches prêtes à l'emploi**, classées en 11 catégories et cherchables :
  - **Peau** : rides, rides du front, pattes d'oie, rides du lion, sillons nasogéniens, rides du cou, boutons et acné, cicatrices d'acné, taches pigmentaires, rougeurs, lissage avec texture conservée, pores, brillance, cernes, poches, grains de beauté, cicatrices, tatouages, vergetures, teint unifié, peau éclatante, bronzage, duvet, coups de soleil, veines, cellulite.
  - **Yeux** : blanc des yeux, yeux rouges, éclat du regard, netteté, ouverture des yeux fermés, couleur des yeux, sourcils, cils, reflets sur les lunettes, retrait des lunettes.
  - **Bouche** : blanchiment et alignement des dents, espace entre les dents, sourire naturel, lèvres, rouges à lèvres.
  - **Visage** : affinement, double menton, mâchoire, symétrie, nez, rajeunir ou vieillir, expression détendue, fatigue.
  - **Cheveux et barbe** : cheveux rebelles, zones dégarnies, brillance, cheveux blancs, volume, 5 couleurs, barbe, rasage.
  - **Maquillage**, **corps et vêtements** (silhouette, posture, vêtements repassés, peluches, taches, auréoles, bijoux, tenue professionnelle), **lumière** (studio, contre-jour, flash, flou, bruit), **arrière-plan** (bokeh, fonds studio et bureau, personnes et objets gênants), **restauration**.
  - **Retouches complètes** : portrait magazine, LinkedIn/CV, mariage, selfie, retouche très naturelle.
- **Plusieurs retouches combinées** en un seul passage IA (une seule facturation), intensité **subtile / moyenne / forte**.
- **Détection automatique des visages et des personnes** : seule la zone utile est envoyée à l'IA, en meilleure définition, et seule cette zone est modifiée. Zone au choix : visage, personne, sélection ou image entière.
- **Favoris ★**, **Mes prompts** (vos propres consignes enregistrées) et **Retouches en un clic** dans le menu IA.
- Résultat toujours **non destructif** : nouveau calque avec masque adouci. Opacité pour doser, pinceau sur le masque pour affiner, Ctrl+Alt+B pour comparer avant/après.
- Tout est traduit dans les 11 langues.

## Nouveautés de la version 12.0
- **Studio photo produit (e-commerce)** (Image) : détourage, centrage et taille conformes à Amazon, Cdiscount, Fnac/Darty, Shopify, WooCommerce/PrestaShop, Etsy, eBay et Instagram Shopping. Fond blanc pur, gris, dégradé studio, couleur ou transparent. Ombre de contact, ombre portée ou reflet. Le résultat est un document à calques modifiable.
- **Détourage hors ligne et gratuit** (Sélection › Sujet — hors ligne) : pour les photos sur fond uni, sans clé IA.
- **Traitement par lots avancé** (Fichier › Automatisation) : consigne libre pour l'assistant IA, retouche automatique, suppression d'arrière-plan, studio produit, filigrane, redimensionnement et format, pour tout un catalogue en une fois.
- **Filigrane** (Image) : texte ou logo, 6 positions ou mosaïque anti-copie en diagonale, opacité, ombre de lisibilité.
- **Collage / grille de photos** (Fichier › Automatisation) : grille automatique, « une grande + petites » ou bandes. Formats réseaux sociaux et A4, espacement, coins arrondis, recadrage intelligent de chaque photo.
- **Icônes d'application et favicon** (Fichier › Exporter) : favicon.ico, app.ico Windows, PNG du site et manifeste PWA, icônes iOS et Android, code HTML à coller.
- **Texte circulaire** (Texte) : arc en haut, arc en bas ou cercle complet, centré automatiquement et toujours modifiable.
- **Nommer les calques automatiquement (IA)** : chaque calque reçoit un nom descriptif (comme « Layer Cleanup » de Photoshop 2026).
- **Avant / après** (Affichage, Ctrl+Alt+B) : comparaison avec curseur de séparation par rapport à l'état d'origine.
- **Épreuve daltonisme** (Affichage) : protanopie, deutéranopie, tritanopie, achromatopsie.
- **Accessibilité des textes** (Texte) : contraste WCAG 2.2 de chaque texte, AA/AAA mesuré sur le fond réel.
- **Inverser les teintes** (Image › Réglages) : calque Teinte/Saturation à 180°.
- Toutes les nouvelles fonctions sont traduites dans les 11 langues.

### Limites restantes
- **CR3 / RAF compressé** : données du capteur via Adobe DNG Converter. Sinon, l'image intégrée pleine résolution (8 bits) s'ouvre.
- **Fonctions IA** : clé OpenAI et Internet nécessaires.
- **Détourage hors ligne** : prévu pour les fonds unis (photos produit). Pour les fonds chargés, utilisez le détourage IA.
- **Sessions par Internet** : relais à installer (RELAIS.md).

## Nouveautés de la version 11.0
- **Assistant IA** (IA › Assistant IA, Ctrl+Alt+A, ou bouton ✨ Assistant de la barre contextuelle) : décrivez la retouche en langage naturel, dans votre langue (« plus chaud, léger vignettage, titre ÉTÉ 2027 en haut, format 4:5 »). L'assistant regarde l'image et crée des **calques de réglage non destructifs**, du texte, un recadrage intelligent, des filtres ou lance les fonctions génératives. Le bouton **Tout annuler** revient en arrière d'un clic, et l'on peut enchaîner les demandes (« encore un peu plus chaud »).
- **Retouche automatique (IA)** : correction naturelle de l'exposition, du contraste, de la balance des blancs et des couleurs en un clic, sur un calque Camera Raw modifiable.
- **Filtres neuronaux IA** : 14 effets (aquarelle, peinture à l'huile, croquis, BD, pop art, rendu 3D, jour → nuit, été → hiver, automne, coucher de soleil, éclairage studio, restauration de photo ancienne, amélioration des détails, désencombrement), plus une description libre. Le résultat est placé sur un nouveau calque, limitable à la sélection.
- **Décrire l'image (IA)** : titre, description, texte alternatif (accessibilité, SEO) et mots-clés, enregistrés dans les informations du fichier et exportés dans les métadonnées.
- **Rédiger un texte (IA)** : slogans, titres, légendes avec hashtags, descriptions de produit, boutons d'appel à l'action, citations, en 11 langues et 5 tons. Un clic sur une proposition l'insère.
- **Traduire les textes du document (IA)** : toute l'affiche est déclinée dans une autre langue (copie du document, mises en forme conservées).
- **Modèles IA réglables** (IA › Modèles IA) : modèle d'image (gpt-image-2, gpt-image-1.5…) et modèle de texte/vision (par défaut gpt-5.4-mini).
- **Flou d'objectif (bokeh)** (Filtre › Flou) : flou de profondeur en lumière linéaire. La zone nette est la sélection (sujet), un point, le premier plan ou une bande. Diaphragme rond, hexagonal ou octogonal, reflets réglables.
- **Recadrage intelligent** (Image) : la zone importante (sujet, visages, détails, sélection) est conservée automatiquement.
- **Export pour les réseaux sociaux** (Fichier › Exporter) : Instagram (carré, portrait), Story/Reels/TikTok, miniature YouTube, Facebook, LinkedIn, X, Pinterest et fiche produit, chacun recadré intelligemment, en un seul export.
- **Palette de couleurs de l'image** (Image) : les couleurs dominantes sont envoyées au nuancier, copiées ou ajoutées en calque palette.
- **Générateur de QR code** (Calque › Nouveau QR code) : versions 1 à 40, correction L/M/Q/H, couleurs et fond transparent.
- **Langues** : noms de calques par défaut traduits (Background, Ebene 1, Capa 1…), nouvelles fonctions et aides des outils traduites dans les 11 langues.

## Nouveautés de la version 10.0
- **Interface en 11 langues** : français, English, Español, Deutsch, Italiano, Português, Nederlands, Polski, Русский, 中文, 日本語. Bouton 🌐 en haut à droite (ou Édition › Langue / Language). La langue du système est détectée au premier lancement. Menus, outils, panneaux, filtres, réglages, modes de fusion, infobulles et messages principaux sont traduits ; les textes d'aide longs des boîtes de dialogue sont en anglais dans les langues autres que le français.
- **Peinture en 32 bits** : Image › Mode › 32 bits rend tous les calques de pixels éditables en virgule flottante (valeurs > 1 conservées). Pinceaux, gommes, filtres et transformations écrivent la différence en 32 bits ; Affichage › Exposition d'affichage 32 bits règle l'aperçu (en IL) sans toucher aux données. Historique, recadrage, zone de travail, symétries, .mpp et export TIFF 32 bits / HDR gèrent ces données.
- **Sessions en direct par Internet** : Fichier › Partager › Démarrer une session par Internet. L'application crée une salle privée sur votre serveur relais et affiche une invitation (`wss://…/r/salle#code`) à envoyer ; les participants la collent dans « Rejoindre une session ». Plusieurs salles indépendantes peuvent tourner sur le même relais. Voir **RELAIS.md** pour installer le relais (Node.js, sans dépendance) sur votre serveur, par exemple multipify.eu.
- **Modifications simultanées du même calque** : chaque envoi contient le masque exact des pixels modifiés ; deux personnes qui peignent en même temps sur le même calque à des endroits différents voient les deux modifications (seuls les pixels touchés par les deux en même temps se résolvent au dernier arrivé).

## Nouveautés de la version 9.0
- **Sessions en direct (réseau local)** : Fichier › Partager › Démarrer une session en direct. Vos collègues rejoignent avec l'adresse et le code affichés ; chaque coup de pinceau, masque, texte, calque ajouté/supprimé/déplacé et commentaire est transmis en quelques dizaines de millisecondes, avec les **curseurs** et le calque de chaque participant affichés en direct. (Serveur intégré, port 41700, code à 4 chiffres ; autorisez l'application dans le pare-feu.)
- **16 bits éditable** : Image › Mode › 16 bits convertit tous les calques de pixels en calques 16 bits par couche. Pinceaux, gommes, tampons, filtres et transformations travaillent sur l'aperçu et la différence exacte est reportée en 16 bits ; les réglages (niveaux, courbes, teinte/saturation…) sont calculés directement en 16 bits ; historique, recadrage, zone de travail, symétries, .mpp et exports gèrent les données 16 bits. Objets dynamiques RAW/HDR : « Pixelliser en calque 16 bits éditable ».
- **RAW** : capteurs **Fujifilm X-Trans** (dématriçage 6×6) en DNG et en RAF non compressé ; **conversion automatique** des formats fermés (Canon CR3, RAF compressé, NEF haute efficacité…) via **Adobe DNG Converter** (gratuit) si installé, puis développement des données du capteur.

## Nouveautés de la version 8.0
- **Coédition** d'un même fichier par plusieurs personnes (dossier OneDrive / Dropbox / Google Drive / réseau) : identifiants de calques stables, **fusion automatique à trois voies** calque par calque (vos calques, les leurs, les ajouts et suppressions de chacun), conflits conservés en calque masqué rouge, annulable (Ctrl+Z) ; **synchronisation automatique** (délai réglable) ; **présence** en direct (qui a le fichier ouvert, quel calque chacun modifie, badge sur les calques) ; un enregistrement ne peut plus écraser le travail d'un collègue.
- **Composition haute précision du document entier** : tous les calques (8 bits et 16/32 bits), masques, opacité, fond, 27 modes de fusion, groupes, écrêtages, calques de réglage (table 3D interpolée en flottant) calculés sans arrondi à 8 bits → TIFF 16 bits, PNG 16 bits, TIFF 32 bits et HDR du document complet.
- **RAW** : NEF compressé Nikon (sans perte et avec perte, 12/14 bits) ; **profils d'appareil Adobe .dcp** (recherche automatique dans les dossiers Adobe Camera Raw / DNG Converter, ou import manuel) ; **calibration de l'appareil avec une charte ColorChecker** (profil exact par boîtier, réutilisé pour tous ses RAW).
- Panorama : coutures corrigées (plus aucune bande semi-transparente), recadrage automatique sur le plus grand rectangle plein.

## Nouveautés de la version 7.0 — les limites de la 6.0 sont levées
- **Gestion des couleurs ICC complète** : moteur de conversion (profils matrice/TRC et LUT v2/v4 « mft1/mft2/mAB/mBA »), modes de rendu perceptif / colorimétrie relative / saturation, compensation du point noir ; profils de travail sRGB, Adobe RGB (1998), Display P3, ProPhoto RGB ; **Attribuer / Convertir en profil** ; chargement du **profil CMJN de votre imprimeur** (.icc/.icm, ex. FOGRA39) utilisé pour l'épreuve écran, l'alerte de gamut, le TIFF CMJN et le PDF CMJN (avec OutputIntent) ; affichage géré des documents non sRGB ; profils incorporés lus à l'ouverture (JPEG, PNG, TIFF) et écrits à l'export (PNG, JPEG, TIFF, PDF).
- **16 et 32 bits par couche** : calques haute précision en virgule flottante (objets dynamiques), **développement Camera Raw 16/32 bits** sans perte (exposition, tons, blancs/noirs, température, vibrance, virage HDR filmique/Reinhard), ouverture TIFF/PNG 16 bits, TIFF 32 bits flottant et **Radiance HDR**, **Fusion HDR Pro**, export TIFF 16/32 bits, PNG 16 bits et HDR ; données haute précision conservées dans les .mpp.
- **Vrai développement RAW** depuis les données du capteur : DNG (non compressé et JPEG sans perte, tuiles, linéarisation, niveaux, matrices couleur, balance des blancs de l'appareil), Canon CR2, Sony ARW, RAW TIFF non compressés ; dématriçage Malvar-He-Cutler ; image 16 bits linéaire. (CR3, NEF compressé, RAF X-Trans : aperçu intégré + conseil d'Adobe DNG Converter.)
- **Panorama et alignement en perspective** : points caractéristiques (Harris), appariement, RANSAC, homographie ; dispositions Auto / Perspective / Cylindrique / Repositionnement, compensation d'exposition, coutures optimales fondues, remplissage des bords d'après le contenu ou recadrage automatique ; alignement automatique des calques en perspective, similitude ou translation.
- **Collaboration** : commentaires épinglés sur l'image (réponses, résolution, auteur), **enregistrement dans le cloud** (OneDrive, Dropbox, Google Drive, iCloud détectés), **synchronisation en direct** des commentaires entre ordinateurs, **verrou d'édition** (« ouvert aussi par… »), alerte quand une nouvelle version est enregistrée par un collègue, invitation par e-mail.
- **Fenêtres flottantes** : panneaux détachables (clic droit sur un onglet ou glisser hors du dock), documents en fenêtres flottantes, « Nouvelle fenêtre pour… », mosaïque.
- **Repères commentés** : repères intelligents magenta pendant le déplacement (bords, centres, autres calques, repères), magnétisme, distances entre objets en pixels.

## Nouveautés de la version 6.0 — vérification complète du guide « Photoshop 2026 » (21 catégories)
- **Formats** : ouverture TIFF (non compressé, LZW, ZIP, PackBits, CMJN) et RAW (DNG, CR2, CR3, NEF, ARW, ORF, RW2, RAF… via l'aperçu développé par l'appareil, ouvert en objet dynamique), lecture EXIF ; export PNG/JPEG (avec ppp et métadonnées), WebP, GIF, BMP, TIFF RVB et **TIFF CMJN**, **PDF** et **PDF CMJN d'impression** (fond perdu, traits de coupe).
- **Couleur** : modes Bitmap (diffusion, seuil, trame, demi-teintes), Niveaux de gris, Bichromie/Trichromie, Couleurs indexées ; **épreuve écran CMJN** (Ctrl+Y) et **alerte de gamut** ; résolution en ppp ; informations sur le fichier (titre, auteur, copyright, mots-clés).
- **Calques** : 27 modes de fusion (Fondu, Lumière linéaire/vive/ponctuelle, Mélange maximal, Soustraction, Division…), **options de fusion conditionnelle** (« Fusion si »), effet **Satin**, **masques vectoriels**, **compositions de calques**, **plans de travail** (formats pub/réseaux, export groupé), alignement et **répartition** des calques, objets dynamiques **liés** (mise à jour depuis le fichier).
- **Géométrie** : **déformation de la marionnette**, **alignement automatique des calques**, **Photomerge (panorama)**, **rotation de l'affichage**, super résolution ×2/×4.
- **Filtres** : Correction de l'objectif (distorsion, aberration chromatique, vignetage), Netteté optimisée, Réduction du tremblement, Fibres, Flou de rotation, Flou de champ, Camera Raw « Détail / Mélangeur TSL / Optique ».
- **Retouche** : séparation de fréquences, calque Dodge & Burn, restauration de photo ancienne.
- **Texte** : texte de paragraphe (bloc), **texte sur tracé**, **déformation du texte** (arc, arche, drapeau, vague…), crénage, petites capitales, styles de caractère.
- **IA** : **variations génératives** (choix parmi 1 à 4 résultats dans Propriétés).
- **Animation** : panneau **Montage** image par image, interpolation, **GIF animé**, **export vidéo** (MP4 ou WebM), import d'images vidéo en calques.
- **Automatisation** : **traitement par lots / processeur d'images**, **jeux de données (variables)** depuis un tableau CSV/Excel, **scripts** (console et fichiers .js).
- **Sécurité des données** : **sauvegarde automatique** + récupération après plantage, **historique des versions**, vérification des **polices manquantes**.
- **Personnalisation** : **raccourcis clavier** et **barre d'outils** modifiables, **espaces de travail** (Essentiel, Photographie, Peinture, Typographie, Graphisme et web, Animation + les vôtres), panneau **Bibliothèques** (graphiques, couleurs, styles).

## Nouveautés de la version 5.0 — l'interface et le flux de travail de Photoshop
- **Panneaux à onglets ancrés** (4 groupes, comme Photoshop) : Propriétés · Réglages · Navigation · Info · Histogramme / Couleur · Nuancier · Dégradés · Motifs · Styles / Pinceaux · Caractère · Historique · Actions / Calques · Couches · Tracés. Clic sur l'onglet actif = réduire ; disposition mémorisée.
- **Panneau Propriétés contextuel** : taille/position/angle numériques, alignement, texte, réglage modifiable en direct, densité et contour progressif du masque, sélection, document.
- **Objets dynamiques** : redimensionnement et rotation sans perte, **filtres dynamiques** (modifier, masquer, supprimer à tout moment), remplacer le contenu, pixelliser. Enregistrés dans le .mpp.
- **Moteur de pinceau complet** : espacement, angle, arrondi, variation de taille/opacité/angle, dispersion, aérographe, **lissage**, **symétrie** (verticale, horizontale, quadruple, radiale 6/8, mandala) ; 14 pinceaux prédéfinis avec aperçu de trait.
- **Bibliothèques** : 14 préréglages de réglage (Portrait, Paysage, Cinéma, N&B, Vintage…), 14 styles de calque, 14 dégradés, 10 motifs.
- **Calques avancés** : recherche et filtre par type, verrous (transparence, pixels, position, tout), **opacité du fond** distincte de l'opacité, effets et filtres dynamiques affichés sous le calque avec œil.
- **Couches** : affichage RVB/R/V/B (Ctrl+2…5), couches alpha (enregistrer/récupérer la sélection). **Tracés** enregistrés. **Instantanés** dans l'historique.
- **Barre de tâches contextuelle** sous l'image (remplissage génératif depuis la sélection, sujet, arrière-plan, texte…).
- **Écran d'accueil** : formats rapides, **6 modèles** modifiables (affiche, post Instagram, miniature YouTube, fiche produit, carte de visite, bannière), récents avec vignettes.

## Nouveautés de la version 4.0

- **Clic droit partout**, comme Photoshop :
  - sur l'image : annuler/rétablir, coller, sélections (sujet, ciel, pixels), et avec une sélection active : calque par copier/couper, remplir, contour, remplissage génératif, masque, transformation ;
  - avec un pinceau : réglage rapide de la taille, de la dureté et de la forme ;
  - sur un calque : renommer, style, dupliquer, grouper, masque d'écrêtage, masques, copier/coller le style, verrous, couleur d'étiquette, fusion, export PNG ;
  - sur un onglet : enregistrer, exporter, dupliquer, fermer les autres.
- **Glisser-déposer complet** : images déposées sur la zone de travail = placées comme calques à l'endroit du dépôt ; sur le panneau Calques = insérées à cette position ; ailleurs = ouvertes dans de nouveaux onglets ; calque glissé sur l'onglet d'un autre document = copié ; onglets réordonnables ; couleur du nuancier glissée sur l'image = remplissage, sur le panneau Calques = calque de couleur unie ; texte glissé = calque de texte.
- **Masques d'écrêtage** (Ctrl+Alt+G), **verrou des pixels transparents** (/), **couleurs d'étiquette**, **copier/coller le style**, **calque par couper** (Ctrl+Maj+J), **export d'un calque en PNG**, mode de fusion du pinceau.
- **Nouveaux outils** : Pinceau mélangeur, Plume libre, Plume de courbure, Masque de texte, Comptage, Notes.
- **Recherche de commandes** (Ctrl+F) sur tous les menus et outils.
- **Panneau Actions** : enregistrement et lecture de suites de commandes, 4 actions prêtes à l'emploi.
- **Menu Fenêtre** (affichage des panneaux, réinitialisation) et **thème clair**.
- Filtres neuronaux locaux : **Peau lisse**, **Suppression des artefacts JPEG** ; réglage **Remplacement de couleur** ; **Image > Mode > Niveaux de gris** ; ✨ **Générer un arrière-plan** (IA).

## Nouveautés de la version 3.0 (d'après la liste des outils et les nouveautés de Photoshop 2026)

- **Barre d'outils à groupes** comme Photoshop (clic droit ou appui long sur un outil, Maj + lettre pour alterner).
- **Nouveaux outils** : Correcteur (Alt + clic source, fusion sans raccord), Pièce, Déplacement basé sur le contenu, outil **Suppression** (local ou ✨ IA), Tampon de motif, Forme d'historique, Gomme d'arrière-plan, Gomme magique, Sélection ligne/colonne unique, **Lasso magnétique**, **Sélection d'objet**, **Recadrage perspective**, **Règle** (mesure + redresser l'image), **Échantillonnage de couleur** (4 points).
- **Réglages 2026** (aussi en calques de réglage) : Lumière, Couleur et vibrance, Clarté et suppression de brume, Grain, Mélangeur de couches, Correction sélective, Correspondance de couleurs (10 LUT), calques de remplissage Couleur unie et Dégradé.
- **Filtre Camera Raw** (Ctrl+Maj+A) : balance des blancs, exposition, ombres/hautes lumières, clarté, brume, vibrance, vignettage, grain.
- **Galerie de filtres** : croquis, aquarelle, découpage, contours lumineux, BD, fusain, grain photo, pointillisme, néon ; plus flou de diaphragme, flou de surface, antipoussière, passe-haut, minimum/maximum, décalage, coordonnées polaires, cristallisation, halo.
- **Commandes** : Échelle basée sur le contenu, Déformation (grille), **Remplacement du ciel**, Sélection > Ciel, Zone de mise au point, **Sélectionner et masquer**, Définir un motif / une forme de pinceau, **Harmoniser** (correspondance des couleurs), ✨ Coloriser une photo N&B, Nettoyer les calques, Dupliquer l'image, Nouveau d'après le presse-papiers, Exporter les calques en PNG (ZIP), Imprimer, agrandissement « Conserver les détails » (Lanczos).
- **Texte dynamique** : texte en arc ou en cercle, texte vertical, polices installées sur l'ordinateur.
- **Formes personnalisées** : bulle, coche, croix, éclair, nuage, losange, flèche pleine, lune, badge.
- **Panneaux Info et Histogramme**.

## Nouveautés de la version 2.0

- **Groupes de calques** (Ctrl+G / Ctrl+Maj+G), imbriqués, avec mode « Transfert », opacité, masque, glisser-déposer dans un groupe.
- **Calques de réglage non destructifs** : Luminosité/Contraste, Niveaux, Courbes, Exposition, Vibrance, Teinte/Saturation, Balance des couleurs, Noir et blanc, Filtre photo, Tons foncés/clairs, Courbe de transfert de dégradé, Négatif, Isohélie, Seuil — avec masque, modifiables à tout moment (double-clic).
- **Styles de calque modifiables** (fx) : ombre portée, contour, lueur externe, ombre interne, biseautage/estampage, incrustation couleur et dégradé.
- **Fichiers Photoshop PSD** : ouverture (RVB/niveaux de gris 8 bits, calques, groupes, masques, compressions RLE et ZIP) et enregistrement (Fichier > Enregistrer au format PSD).
- **IA générative** (menu IA, clé OpenAI dans Édition > Préférences) : Remplissage génératif, Extension générative, Générer une image, Supprimer l'arrière-plan, Sélectionner le sujet.
- **Fluidité** (Ctrl+Maj+X) : déformation avant, reconstruction, tourbillons, contraction, dilatation.
- **Perspective / Torsion** dans la transformation manuelle (coins libres).
- Nouveaux outils : **Plume** (P, tracés de Bézier → sélection, remplissage, contour, forme), **Sélection rapide** (A), **Œil rouge**, **Remplacement de couleur**.
- **Masque rapide** (Q), **règles et repères** (Ctrl+R, glisser depuis les règles) avec **magnétisme**.
- Pinceaux : formes carré, calligraphie, craie, aérographe, feuillage + dispersion.
- Rendu plus rapide (cache de composition et des styles).

### Activer l'IA
Les fonctions ✨ appellent l'API Images d'OpenAI (modèle `gpt-image-1` par défaut, modifiable). Créez une clé sur platform.openai.com, puis Édition > Préférences > Clé API. Chaque génération est facturée par OpenAI sur votre compte.

## Générer le .exe (Windows)

1. Installez **Node.js 20 ou plus récent** (https://nodejs.org, version LTS).
2. Double-cliquez sur **`construire-exe.bat`** (ou, dans un terminal ouvert dans ce dossier : `npm install` puis `npm run dist`).
3. Les fichiers sont créés dans le dossier **`dist\`** :
   - `MultipifyPhoto-Setup-1.0.0.exe` → installateur (raccourci bureau + menu Démarrer, association des fichiers `.mpp`)
   - `Multipify-Photo-Portable-1.0.0.exe` → version portable sans installation

Pour lancer le logiciel sans le compiler : `npm install` puis `npm start`.
Version Mac : `npm run dist:mac` (à lancer sur un Mac).

## Fonctions de base (déjà présentes en 1.0)

**Outils (raccourci)** : Déplacement (V, alignement, sélection auto du calque), Rectangle/Ellipse de sélection (M), Lasso libre et polygonal (L), Baguette magique (W), Recadrage avec ratios (C), Pipette (I), Correcteur localisé (J), Pinceau (B, dureté, flux, pression du stylet), Crayon (N), Tampon de duplication (S), Gomme (E), Dégradé linéaire/radial/angulaire/réfléchi/losange (G), Pot de peinture (K), Goutte d'eau (R), Netteté (Y), Doigt (F), Densité −/+ (O/P), Éponge (Q), Texte modifiable (T), Formes : rectangle, arrondi, ellipse, triangle, polygone, étoile, cœur, ligne, flèche (U), Main (H), Zoom (Z), Transformation manuelle (Ctrl+T : échelle, rotation, symétries).

**Calques** : 16 modes de fusion, opacité, verrouillage, glisser-déposer pour réordonner, renommer, dupliquer, fusionner, aplatir, masques de fusion (peindre en noir/blanc), styles (ombre portée, contour, lueur externe), calques de texte modifiables.

**Réglages** : Luminosité/Contraste, Niveaux (histogramme), Courbes, Exposition, Vibrance, Teinte/Saturation, Balance des couleurs, Noir et blanc, Filtre photo, Tons foncés/Tons clairs, Courbe de transfert de dégradé, Négatif, Isohélie, Seuil, Sépia, Désaturation, Égaliser, Contraste auto.

**Filtres** : Flou gaussien, de mouvement, radial, Tilt-shift, Accentuation, Plus net, Bruit, Médiane, Tourbillon, Sphérisation, Ondulation, Mosaïque, Demi-teintes, Estampage, Contours, Peinture à l'huile, Lueur douce, Nuages, Vignettage.

**Édition / Image** : Remplir (dont *Remplir d'après le contenu* pour effacer un objet), Contour de sélection, Copier/Coller (presse-papiers Windows), Taille de l'image, Taille de la zone de travail, Rotations, Symétries, Recadrer sur la sélection, Rogner.

**Sélection** : Tout, Désélectionner, Intervertir, Pixels du calque, Plage de couleurs, Contour progressif, Dilater, Contracter, Lisser.

**Fichiers** : ouverture PNG, JPEG, WebP, GIF, BMP, SVG, AVIF, ICO ; projets `.mpp` (tous les calques, masques et textes) ; export PNG/JPEG/WebP avec qualité et échelle ; glisser-déposer (Maj = importer comme calque) ; onglets multi-documents ; historique de 40 étapes (panneau Historique cliquable).

## Structure

```
main.js / preload.js   coque Electron (fenêtres, fichiers, presse-papiers)
src/index.html         interface
src/styles.css         thème sombre
src/js/core.js         documents, calques, historique, rendu
src/js/selection.js    sélections
src/js/tools.js        outils
src/js/ops.js          réglages, filtres, opérations image/calque
src/js/io.js           ouverture, enregistrement, export
src/js/v4.js           menus clic droit, glisser-déposer, outils et panneaux v4
src/js/tools3.js       outils v3 (correcteur, pièce, suppression, lasso magnétique…)
src/js/ops2.js         réglages 2026, Camera Raw, galerie de filtres
src/js/cmds.js         ciel, échelle basée sur le contenu, déformation, harmoniser, export ZIP…
src/js/tools2.js       plume, sélection rapide, œil rouge, remplacement de couleur, masque rapide, perspective
src/js/fx.js           styles de calque et calques de réglage
src/js/psd.js          lecture / écriture PSD
src/js/ai.js           fonctions IA (OpenAI)
src/js/liquify.js      Fluidité
src/js/guides.js       règles, repères, magnétisme
src/js/ui.js           menus, panneaux, boîtes de dialogue, raccourcis
build/icon.ico|png     icônes de l'application
```
