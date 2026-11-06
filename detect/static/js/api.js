import { USE_MOCK, API_URL } from './config.js';
import { sleep } from './utils.js';
import { MOCK } from './mock.js';

/* ---------- API (réelle ou simulée) ---------- */
/**
 * Appelle une route de l'API, ou sa version simulée selon la configuration.
 * @param {string} path Suffixe de route, par exemple "encode" ou "decode".
 * @param {object} body Données à envoyer dans le corps JSON de la requête.
 * @returns {Promise<object>} Résultat de la route sous forme d'objet JavaScript.
 */
export async function api(path, body) {
  if (USE_MOCK) {
    // Simule un temps de réponse réseau, puis appelle le traitement fictif correspondant.
    await sleep(350 + Math.random() * 350);
    return MOCK[path](body);
  }

  // Envoie les données au serveur Flask sous forme de JSON.
  const r = await fetch(API_URL + '/api/' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  // Transforme une réponse HTTP en erreur JavaScript si son statut signale un échec.
  if (!r.ok) {
    throw new Error('Le serveur a répondu ' + r.status + '. Vérifiez que Flask est lancé.');
  }

  return r.json();
}

/**
 * Construit l'objet des champs d'un fichier nécessaires aux appels API.
 * @param {object} r Objet représentant un fichier dans l'application.
 * @returns {object} Sous-ensemble de ses données utiles aux routes API.
 */
export const payload = r => ({
  blocks: r.blocks,
  crc: r.crc,
  length: r.length,
  n: r.n,
  k: r.k,
  t: r.t,
  _orig: r._orig
});
