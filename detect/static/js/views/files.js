import { $, esc, fmt, when, toast } from '../utils.js';
import { del } from '../db.js';
import { state, status, LABEL, cells } from '../state.js';
import { show } from '../nav.js';
import { verify, correct } from '../actions.js';

/* ---------- Liste des fichiers ---------- */
export function renderFiles(){const L=$('#list');
  if(!state.files.length){L.innerHTML=`<div class="empty"><h2>Aucun fichier</h2><p>Déposez un fichier texte pour commencer.</p><button class="btn" data-a="new">Déposer un fichier</button></div>`;return}
  L.innerHTML=state.files.slice().reverse().map(r=>{const s=status(r);
    return `<article class="row" data-id="${r.id}">
      <div><h3>${esc(r.name)}</h3><p class="mute">Déposé par ${esc(r.owner)} le ${when(r.at)}, ${fmt(r.length)}</p></div>
      <div><span class="badge b-${s==='restauré'?'restauré':s}">${LABEL[s]}</span></div>
      <div class="strip">${cells(r,80)}</div>
      <div class="acts">
        <button class="btn sec" data-a="rep">Voir le rapport</button>
        <button class="btn sec" data-a="noise">Abîmer</button>
        ${s==='corrompu'?'<button class="btn fixit" data-a="fix">Corriger</button>':''}
        ${s==='perdu'?'<button class="btn" disabled title="Trop d’octets erronés dans un bloc">Corriger</button>':''}
        <button class="btn ghost" data-a="del">Supprimer</button></div></article>`}).join('');
  state.files.filter(r=>!r.checked&&!r._v).forEach(r=>{r._v=1;verify(r)})}
$('#list').onclick=async e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.a==='new')return show('upload');
  const r=state.files.find(f=>f.id===b.closest('.row').dataset.id);
  if(b.dataset.a==='rep'){state.sel=r.id;show('report')}
  if(b.dataset.a==='noise'){state.noiseId=r.id;$('#dlg').showModal()}
  if(b.dataset.a==='fix')correct(r,b);
  if(b.dataset.a==='del'&&confirm('Supprimer « '+r.name+' » ?')){await del('files',r.id);state.files=state.files.filter(f=>f!==r);renderFiles();toast('Fichier supprimé.')}};
