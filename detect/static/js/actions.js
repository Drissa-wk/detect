import { $, toast, busy } from './utils.js';
import { api, payload } from './api.js';
import { put } from './db.js';
import { state, save, log } from './state.js';
import { renderFiles } from './views/files.js';
import { renderReport } from './views/report.js';

/* ---------- Vérification, bruit, correction ---------- */
/**
 * Vérifie les blocs d'un fichier auprès de l'API et actualise son état.
 * @param {object} r Fichier à vérifier, avec ses paramètres et ses blocs encodés.
 */
export async function verify(r) {
  try {
    const res = await api('check', payload(r));
    r.checked = true;
    r._v = 0;
    r.bad = res.bad;

    // Signale dans le journal les blocs qui n'ont pas passé le contrôle.
    if (!res.ok) {
      log(r, 'Contrôle à l’ouverture : ' + res.bad.length + ' bloc(s) invalide(s) détecté(s).');
    }

    await save(r);
  } catch (err) {
    r._v = 0;
    toast(err.message, 1);
  }

  // Ne rafraîchit que les vues actuellement affichées.
  if (!$('#v-files').hidden) renderFiles();
  if (!$('#v-report').hidden) renderReport();
}

// Affiche immédiatement la valeur choisie pour l'intensité du bruit.
$('#inten').oninput = e => {
  $('#intenO').textContent = e.target.value;
};

// Le formulaire injecte du bruit uniquement lors d'une validation confirmée.
$('#dlgF').onsubmit = async e => {
  if (e.submitter.value !== 'ok') return;

  const r = state.files.find(f => f.id === state.noiseId);
  const intensity = +$('#inten').value;
  const mode = new FormData(e.target).get('mode');

  try {
    const res = await api('noise', { blocks: r.blocks, intensity, mode });
    r.blocks = res.blocks;
    r.noise = { intensity, mode, per: res.per_block };
    r.correction = null;
    r.restored = false;
    r.checked = false;

    // Conserve une trace de l'altération et sauvegarde le nouvel état du fichier.
    log(r, `Corruption simulée : ${intensity} % des octets, ${mode === 'burst' ? 'en rafale' : 'isolés'} (${res.per_block.reduce((a, b) => a + b, 0)} octets modifiés).`);
    await save(r);
    toast('Le fichier a été abîmé.');

    if (!$('#v-files').hidden) renderFiles();
    else renderReport();

    r._v = 1;
    verify(r);
  } catch (err) {
    toast(err.message, 1);
  }
};

/**
 * Demande la correction des blocs et enregistre le résultat de la tentative.
 * @param {object} r Fichier à corriger.
 * @param {HTMLElement} btn Bouton déclencheur, utilisé pour afficher l'état occupé.
 */
export async function correct(r, btn) {
  if (btn) busy(btn, 'Correction…');

  try {
    const res = await api('decode', payload(r));
    r.correction = {
      ok: res.ok,
      info: res.info,
      corrected: res.corrected,
      crc_ok: res.crc_ok,
      at: Date.now()
    };
    r.blocks = res.blocks;
    r.bad = res.info
      .map((x, i) => x.status === 'lost' || (!res.ok && x.status !== 'ok') ? i : -1)
      .filter(i => i >= 0);
    r.restored = res.ok;

    const lost = r.bad.length;
    log(
      r,
      res.ok
        ? `Correction réussie : ${res.corrected} octet(s) corrigé(s), CRC-32 conforme.`
        : `Correction partielle : ${lost} bloc(s) perdu(s), CRC-32 non conforme.`
    );

    // Enregistre les statistiques de cette tentative, puis sauvegarde le fichier corrigé.
    await put('runs', {
      intensity: r.noise ? r.noise.intensity : 0,
      ok: res.ok,
      mode: r.noise ? r.noise.mode : '-',
      at: Date.now()
    });
    await save(r);
    toast(
      res.ok
        ? 'Fichier restauré.'
        : 'Restauration impossible : trop d’erreurs dans un bloc.',
      !res.ok
    );
  } catch (err) {
    toast(err.message, 1);
  } finally {
    if (btn) busy(btn);
  }

  if (!$('#v-files').hidden) renderFiles();
  else renderReport();
}
