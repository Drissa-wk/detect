"""Intact : serveur Flask. CRC-32 via zlib, Reed-Solomon via reedsolo. Sans état : tout est stocké côté navigateur."""
import base64
import random
import zlib
import os

from flask import Flask, jsonify, request
from reedsolo import ReedSolomonError, RSCodec

app = Flask(__name__, static_folder="static", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024 * 1024
# Les donnees binaires transitent dans le JSON sous forme de texte Base64.
# b : donnees binaires a encoder en Base64.
b64e = lambda b: base64.b64encode(bytes(b)).decode()  # noqa: E731
# Alias de decodage Base64, utilise pour convertir les champs JSON en octets.
b64d = base64.b64decode


def codec(n, k):
    """Construit un codec Reed-Solomon apres validation des tailles.

    Args:
        n: taille totale d'un bloc encode, en octets.
        k: nombre d'octets de donnees utiles dans chaque bloc.

    Returns:
        Le codec configure avec n-k octets de controle.

    Raises:
        ValueError: si les tailles ne respectent pas 0 < k < n <= 255.
    """
    # n est la taille du bloc code; k est sa partie utile, le reste sert a la correction.
    if not (isinstance(n, int) and isinstance(k, int) and 0 < k < n <= 255):
        raise ValueError("paramètres RS invalides : il faut 0 < k < n <= 255")
    return RSCodec(n - k, nsize=n)


@app.errorhandler(Exception)
def fail(e):
    """Convertit une exception en reponse JSON avec un code HTTP adapte.

    Args:
        e: exception levee pendant le traitement d'une requete.

    Returns:
        Une reponse JSON contenant le message d'erreur et son code HTTP.
    """
    # Les erreurs de requete usuelles deviennent des 400; les autres restent des erreurs serveur.
    code = e.code if hasattr(e, "code") and isinstance(e.code, int) else 400 if isinstance(e, (ValueError, KeyError, TypeError)) else 500
    return jsonify(error=str(e)), code


@app.get("/")
def index():
    """Sert la page HTML principale de l'application."""
    return app.send_static_file("index.html")


@app.post("/api/encode")
def encode():
    """Encode les donnees recues en blocs Reed-Solomon.

    Corps JSON attendu:
        n: taille totale de chaque bloc encode.
        k: nombre d'octets de donnees par bloc.
        data: donnees originales encodees en Base64.

    Returns:
        JSON avec les blocs Base64, le CRC-32 et la longueur originale.
    """
    d = request.get_json()
    n, k, data = d["n"], d["k"], b64d(d["data"])
    rs = codec(n, k)
    # Chaque fragment contient au plus k octets; meme une entree vide produit un bloc.
    chunks = [data[i:i + k] for i in range(0, len(data), k)] or [b""]
    # Le dernier fragment est complete a k octets avant le codage; length permettra de retirer ces zeros.
    blocks = [b64e(rs.encode(c.ljust(k, b"\0"))) for c in chunks]
    return jsonify(blocks=blocks, crc=zlib.crc32(data), length=len(data))


@app.post("/api/noise")
def noise():
    """Injecte des erreurs aleatoires dans les blocs encodes.

    Corps JSON attendu:
        blocks: liste des blocs encodes en Base64.
        intensity: pourcentage d'octets a modifier.
        mode: optionnel; ``burst`` choisit des positions consecutives, sinon elles sont dispersees.

    Returns:
        JSON avec les blocs alteres en Base64 et le nombre d'octets modifies par bloc.
    """
    d = request.get_json()
    # bytearray rend les blocs decodes modifiables en place.
    blocks = [bytearray(b64d(b)) for b in d["blocks"]]
    # On traite tous les octets comme une seule suite, meme si elle est repartie en blocs.
    n, total = len(blocks[0]), len(blocks) * len(blocks[0])
    # L'intensite est un pourcentage; le code impose au moins une alteration et plafonne au total.
    m = min(total, max(1, round(total * float(d["intensity"]) / 100)))
    if d.get("mode") == "burst":
        # Une rafale correspond a m positions consecutives dans la suite concatenee.
        start = random.randrange(total - m + 1)
        pos = range(start, start + m)
    else:
        # Sinon, on choisit m positions distinctes reparties aleatoirement.
        pos = random.sample(range(total), m)
    per = [0] * len(blocks)
    for p in pos:
        # p // n retrouve le bloc, p % n l'octet dans ce bloc; un XOR non nul change toujours l'octet.
        blocks[p // n][p % n] ^= random.randint(1, 255)             # l'octet change toujours
        per[p // n] += 1
    return jsonify(blocks=[b64e(b) for b in blocks], per_block=per)


@app.post("/api/check")
def check():
    """Verifie quels blocs passent le controle Reed-Solomon.

    Corps JSON attendu:
        n: taille totale d'un bloc.
        k: nombre d'octets de donnees par bloc.
        blocks: liste des blocs a verifier en Base64.

    Returns:
        JSON avec le resultat global ``ok`` et les indices des blocs invalides.
    """
    d = request.get_json()
    rs = codec(d["n"], d["k"])
    # rs.check renvoie un resultat par bloc; bad contient les indices qui echouent.
    bad = [i for i, b in enumerate(d["blocks"]) if not all(rs.check(bytearray(b64d(b))))]
    return jsonify(ok=not bad, bad=bad)


@app.post("/api/decode")
def decode():
    """Decode et tente de corriger les blocs, puis verifie les donnees reconstituees.

    Corps JSON attendu:
        n: taille totale d'un bloc encode.
        k: nombre d'octets de donnees par bloc.
        blocks: liste des blocs recus en Base64.
        length: longueur des donnees originales, pour retirer le remplissage.
        crc: CRC-32 attendu des donnees originales.

    Returns:
        JSON avec les blocs corriges, le statut de chaque bloc, les donnees recuperees,
        le nombre d'erreurs corrigees et les resultats global et CRC.
    """
    d = request.get_json()
    n, k = d["n"], d["k"]
    # Un code avec n-k octets de controle peut corriger jusqu'a floor((n-k)/2) erreurs par bloc.
    rs, t = codec(n, k), (n - k) // 2
    blocks, info, data, corrected = [], [], bytearray(), 0
    for raw in d["blocks"]:
        block = bytearray(b64d(raw))
        try:
            # msg contient les donnees utiles; full est le bloc entier corrige; errata indique les erreurs trouvees.
            msg, full, errata = rs.decode(block)
            e = len(errata)
            blocks.append(b64e(full))
            info.append({"errors": e, "status": "fixed" if e else "ok"})
            corrected += e
            data += msg
        except ReedSolomonError:                                      # Le bloc depasse la capacite de correction.
            blocks.append(b64e(block))
            # On conserve le bloc recu et ses k premiers octets comme tentative, mais le statut signale la perte.
            # t + 1 indique que la limite est depassee; ce n'est pas le nombre exact d'erreurs.
            info.append({"errors": t + 1, "status": "lost"})
            data += block[:k]
    # Supprime le remplissage du dernier bloc, puis controle les donnees reconstituees avec leur CRC d'origine.
    data = bytes(data[:d["length"]])
    crc_ok = zlib.crc32(data) == d["crc"]
    ok = crc_ok and all(x["status"] != "lost" for x in info)
    return jsonify(ok=ok, blocks=blocks, info=info, corrected=corrected, crc_ok=crc_ok, data=b64e(data))


if __name__ == '__main__':
    # 1. Regarde si l'hébergeur a fourni un port dans l'environnement système
    # 2. Si on est sur notre PC (pas de port fourni), on utilise le port 5000 par défaut
    port = int(os.environ.get('PORT', 5000))
    
    # On lance l'application en lui disant d'écouter sur n'importe quelle IP ('0.0.0.0') 
    # et sur le port qu'on vient de trouver
    app.run(host='0.0.0.0', port=port)