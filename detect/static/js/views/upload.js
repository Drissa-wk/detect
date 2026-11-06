import { $, fmt, toast, busy, toB64 } from '../utils.js';
import { api } from '../api.js';
import { state, log, save } from '../state.js';
import { show } from '../nav.js';

/* ---------- Dépôt ---------- */
const preset=()=>$('#preset').value.split(',').map(Number);
export function plan(){const [n,k]=preset(),s=$('#sum');$('#go').disabled=!state.picked;
  if(!state.picked){s.textContent='';return}
  const nb=Math.max(1,Math.ceil(state.picked.size/k));
  s.textContent=`${state.picked.name} : ${fmt(state.picked.size)}, soit ${nb} bloc${nb>1?'s':''} de ${k} octets. Stockage prévu : ${fmt(nb*n)}.`}
function pick(f){if(!f)return;
  if(f.size>200*1024){toast('Fichier trop volumineux : 200 Ko maximum pour cette démonstration.',1);return}
  state.picked=f;$('#dropT').textContent=f.name;$('#dropS').textContent='Cliquez pour choisir un autre fichier';plan()}
$('#file').onchange=e=>pick(e.target.files[0]);
$('#preset').onchange=plan;
const drop=$('#drop');
['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>pick(e.dataTransfer.files[0]));
$('#go').onclick=async e=>{const btn=e.currentTarget;busy(btn,'Encodage…');
  try{const [n,k]=preset(),data=new Uint8Array(await state.picked.arrayBuffer()),res=await api('encode',{data:toB64(data),n,k});
    const r={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:state.picked.name,owner:state.user,at:Date.now(),
      length:res.length,n,k,t:Math.floor((n-k)/2),crc:res.crc,blocks:res.blocks,_orig:res._orig,
      checked:true,bad:[],noise:null,correction:null,restored:false,events:[]};
    log(r,`Déposé par ${state.user}, encodé en RS(${n},${k}).`);
    await save(r);state.files.push(r);state.sel=r.id;state.picked=null;$('#file').value='';
    $('#dropT').textContent='Glissez un fichier .txt ici';$('#dropS').textContent='ou cliquez pour le choisir (200 Ko maximum)';
    toast('Fichier déposé et protégé.');plan();show('report')}
  catch(err){toast(err.message,1)}finally{busy(btn)}};
