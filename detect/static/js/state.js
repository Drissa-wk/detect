import { put } from './db.js';
import { fromB64 } from './utils.js';

/* ---------- État et utilitaires ---------- */
/** État partagé par les différentes parties de l'interface. */
export const state = {
  files: [],
  user: 'Alice',
  sel: null,
  picked: null,
  noiseId: null
};

/**
 * Détermine le statut à afficher pour un fichier.
 * @param {object} r Fichier dont on examine l'état de vérification et de correction.
 * @returns {string} Clé de statut parmi verif, perdu, corrompu, restauré ou sain.
 */
export const status = r => !r.checked
  ? 'verif'
  : r.bad.length
    ? (r.correction && !r.correction.ok ? 'perdu' : 'corrompu')
    : (r.restored ? 'restauré' : 'sain');

/** Libellés affichés dans l'interface pour chaque clé de statut. */
export const LABEL = {
  sain: 'Intact',
  corrompu: 'Corrompu',
  restauré: 'Restauré',
  perdu: 'Irrécupérable',
  verif: 'Vérification…'
};

/**
 * Retourne la classe CSS d'une cellule correspondant à un bloc.
 * @param {object} r Fichier qui contient les blocs et leurs résultats de correction.
 * @param {number} i Index du bloc à représenter.
 * @returns {string} Classe CSS indiquant l'état du bloc, ou une chaîne vide.
 */
export const cell = (r, i) => r.correction
  ? ({ ok: '', fixed: 'fixed', lost: 'lost' }[r.correction.info[i].status])
  : (r.bad.includes(i) ? 'hit' : '');

/**
 * Génère le HTML des indicateurs de blocs et, si nécessaire, du compteur restant.
 * @param {object} r Fichier dont les blocs sont représentés.
 * @param {number} max Nombre maximal d'indicateurs de blocs à générer.
 * @returns {string} Fragment HTML à insérer dans la vue.
 */
export const cells = (r, max) => r.blocks
  .slice(0, max)
  .map((_, i) => `<i class="c ${cell(r, i)}" title="Bloc ${i + 1}"></i>`)
  .join('')
  + (r.blocks.length > max
    ? `<span class="mute">+${r.blocks.length - max}</span>`
    : '');

/**
 * Reconstitue les octets du fichier à partir de ses blocs encodés en Base64.
 * @param {object} r Fichier avec les blocs, leur taille utile et la longueur originale.
 * @returns {Uint8Array} Données binaires reconstituées, limitées à la longueur originale.
 */
export function textOf(r) {
  const k = r.k;
  const out = new Uint8Array(r.length);

  // Copie au plus k octets utiles de chaque bloc, sans dépasser la taille originale.
  r.blocks.forEach((b, i) => {
    out.set(
      fromB64(b).subarray(0, Math.min(k, r.length - i * k)),
      i * k
    );
  });

  return out;
}

/** Persiste l'objet fichier dans la collection "files" de la base locale. */
export async function save(r) {
  await put('files', r);
}

/** Ajoute un événement horodaté au journal du fichier. */
export function log(r, text) {
  r.events.push({ t: Date.now(), text });
}
