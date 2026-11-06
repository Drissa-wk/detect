import base64
import zlib

import pytest

from app import app

b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
TEXT = ("Bonjour Intact. " * 40).encode()


@pytest.fixture
def post():
    c = app.test_client()
    return lambda path, **body: c.post("/api/" + path, json=body)


def roundtrip(post, n, k, intensity, mode="spread"):
    e = post("encode", data=b64(TEXT), n=n, k=k).get_json()
    assert e["crc"] == zlib.crc32(TEXT) and e["length"] == len(TEXT)
    p = dict(n=n, k=k, t=(n - k) // 2, crc=e["crc"], length=e["length"])
    assert post("check", blocks=e["blocks"], **p).get_json()["ok"]
    nz = post("noise", blocks=e["blocks"], intensity=intensity, mode=mode).get_json()
    chk = post("check", blocks=nz["blocks"], **p).get_json()
    return nz, chk, post("decode", blocks=nz["blocks"], **p).get_json()


def test_page_accueil():
    assert app.test_client().get("/").status_code == 200


def test_restauration_reussie(post):
    nz, chk, dec = roundtrip(post, 32, 16, 3)
    assert not chk["ok"] and chk["bad"] and dec["ok"] and dec["crc_ok"]
    assert dec["corrected"] == sum(nz["per_block"])
    assert base64.b64decode(dec["data"]) == TEXT


def test_trop_de_bruit(post):
    _, _, dec = roundtrip(post, 32, 16, 30)
    assert not dec["ok"] and any(x["status"] == "lost" for x in dec["info"])


def test_rafale_et_rs255(post):
    assert roundtrip(post, 255, 223, 2, "burst")[2]["ok"]


def test_parametres_invalides(post):
    assert post("encode", data="", n=300, k=10).status_code == 400
