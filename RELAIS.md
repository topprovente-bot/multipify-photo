# Serveur relais des sessions en direct (Internet)

Le fichier `collab-server.js` (aucune dépendance, Node.js 18+) relaie les sessions en direct de Multipify Photo entre des personnes qui ne sont pas sur le même réseau.

## Installation (ex. sur le serveur de multipify.eu)
```bash
node collab-server.js 41700 --relay        # ou : PORT=41700 node collab-server.js --relay
```
Laissez-le tourner avec pm2 / systemd (`pm2 start collab-server.js -- 41700 --relay`).

## HTTPS / wss (obligatoire sur Internet)
Exemple nginx :
```nginx
location /collab/ {
  proxy_pass http://127.0.0.1:41700/;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_read_timeout 3600s;
}
```
Dans Multipify Photo : Fichier › Partager › Serveur relais… → `wss://multipify.eu/collab`

Chaque session crée un salon privé (identifiant aléatoire + code à 6 chiffres). Le relais ne stocke rien : il transmet seulement les messages entre les participants connectés.
