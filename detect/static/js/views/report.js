import { $, esc, fmt, when } from '../utils.js';
import { all } from '../db.js';
import { state, status, cells, textOf } from '../state.js';
import { correct } from '../actions.js';

/* ---------- Rapport ---------- */
function verdict(r){const s=status(r),N=r.blocks.length,c=r.correction;
  if(s==='sain')return['ok','Fichier intact',`Aucune altération détectée dans les ${N} bloc${N>1?'s':''}.`];
  if(s==='corrompu')return['hit','Fichier corrompu',`${r.bad.length} bloc${r.bad.length>1?'s':''} sur ${N} échouent au contrôle. Le décodage Reed-Solomon peut les réparer.`];
  if(s==='restauré')return['fix','Fichier restauré',`${c.corrected} octet${c.corrected>1?'s':''} corrigé${c.corrected>1?'s':''}. Le CRC-32 du résultat correspond à celui du dépôt.`];
  if(s==='perdu')return['lost','Restauration impossible',`Au moins un bloc contient plus de ${r.t} octets erronés, au-delà de la capacité du code. Le CRC-32 final signale l’échec.`];
  return['verif','Vérification en cours…','Calcul des syndromes de chaque bloc.']}
export function renderReport(){
  const box=$('#rep'),S=$('#repSel');
  if(!state.files.length){$('#selW').hidden=true;box.innerHTML=`<div class="empty" style="margin-top:20px"><h2>Pas encore de rapport</h2><p>Déposez un fichier pour voir ses statistiques de protection.</p><button class="btn" data-go="upload">Déposer un fichier</button></div>`;return}
  $('#selW').hidden=false;
  const r=state.files.find(f=>f.id===state.sel)||state.files[state.files.length-1];state.sel=r.id;
  S.innerHTML=state.files.map(f=>`<option value="${f.id}" ${f.id===state.sel?'selected':''}>${esc(f.name)} (${esc(f.owner)})</option>`).join('');
  const [vc,vt,vx]=verdict(r),N=r.blocks.length,per=r.noise?r.noise.per:null,altered=per?per.reduce((a,b)=>a+b,0):0,hitB=per?per.filter(x=>x>0).length:0,c=r.correction;
  const scale=per?Math.max(r.t+2,...per):1;
  const bars=per?`<div class="bars" role="img" aria-label="Octets altérés par bloc">${per.map((v,i)=>`<b class="${c?({ok:'',fixed:'fixed',lost:'lost'}[c.info[i].status]):''}" style="height:${v/scale*100}%" title="Bloc ${i+1} : ${v} octet(s) altéré(s)"></b>`).join('')}<div class="thr" style="bottom:${r.t/scale*100}%"><span>Capacité : ${r.t}</span></div></div>
    <p class="mute" style="margin-top:8px">Au-dessus du pointillé, un bloc dépasse ce que le code sait corriger.</p>`:'<p class="mute">Aucune corruption simulée sur ce fichier.</p>';
  const text=new TextDecoder().decode(textOf(r));
  box.innerHTML=`<div class="verdict v-${vc}"><h2>${vt}</h2><p>${vx}</p>
    <div class="acts" style="margin-top:12px">
      ${status(r)==='corrompu'?'<button class="btn fixit" id="rFix">Corriger le fichier</button>':''}
      <button class="btn sec" id="rNoise">Abîmer</button>
      ${status(r)==='sain'||status(r)==='restauré'?'<button class="btn sec" id="rDl">Télécharger</button>':''}</div></div>
    <div class="grid">
      <section class="blk"><h2>Fiche technique</h2><dl>
        <div><dt>Taille d’origine</dt><dd>${fmt(r.length)}</dd></div>
        <div><dt>Taille stockée</dt><dd>${fmt(N*r.n)} (+${Math.round((r.n/r.k-1)*100)} %)</dd></div>
        <div><dt>Code</dt><dd>RS(${r.n},${r.k}), distance ${r.n-r.k+1}</dd></div>
        <div><dt>Octets corrigibles par bloc</dt><dd>${r.t}</dd></div>
        <div><dt>Blocs</dt><dd>${N}</dd></div>
        <div><dt>CRC-32 au dépôt</dt><dd>${r.crc.toString(16).padStart(8,'0')}</dd></div></dl></section>
      <section class="blk"><h2>Altération et correction</h2><dl>
        <div><dt>Octets altérés</dt><dd>${altered}</dd></div>
        <div><dt>Blocs touchés</dt><dd>${hitB} sur ${N}</dd></div>
        <div><dt>Octets corrigés</dt><dd>${c?c.corrected:'-'}</dd></div>
        <div><dt>Blocs perdus</dt><dd>${c?c.info.filter(x=>x.status==='lost').length:'-'}</dd></div>
        <div><dt>CRC-32 après correction</dt><dd>${c?(c.crc_ok?'conforme':'différent'):'-'}</dd></div>
        <div><dt>Intensité du bruit</dt><dd>${r.noise?r.noise.intensity+' %, '+(r.noise.mode==='burst'?'rafale':'isolés'):'-'}</dd></div></dl></section></div>
    <section class="blk"><h2>Carte des blocs</h2><div class="map">${cells(r,400)}</div>
      <div class="legend"><span><i style="background:var(--okt)"></i>Intact</span><span><i style="background:var(--hit)"></i>Altéré</span><span><i style="background:var(--fix)"></i>Corrigé</span><span><i style="background:var(--lost)"></i>Perdu</span></div></section>
    <section class="blk"><h2>Octets altérés par bloc</h2>${bars}</section>
    <section class="blk"><h2>Contenu lu</h2><pre id="txt"></pre></section>
    <section class="blk"><h2>Historique du fichier</h2><ol class="log">${r.events.slice().reverse().map(e=>`<li><span class="mute">${when(e.t)}</span><span>${esc(e.text)}</span></li>`).join('')}</ol></section>
    <section class="blk"><h2>Taux de réussite selon le bruit</h2><div id="runs"></div></section>`;
  $('#txt').textContent=text||'(fichier vide)';
  $('#rFix')&&($('#rFix').onclick=e=>correct(r,e.currentTarget));
  $('#rNoise').onclick=()=>{state.noiseId=r.id;$('#dlg').showModal()};
  $('#rDl')&&($('#rDl').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([textOf(r)],{type:'text/plain'}));a.download=r.name;a.click()});
  runsChart()}
$('#repSel').onchange=e=>{state.sel=e.target.value;renderReport()};
async function runsChart(){const runs=await all('runs'),el=$('#runs');
  if(!runs.length){el.innerHTML='<p class="mute">Aucune correction effectuée pour l’instant. Abîmez un fichier à différentes intensités, puis corrigez-le : le graphique se remplit.</p>';return}
  const bins=[['1 à 3 %',0,3],['4 à 8 %',3,8],['9 à 15 %',8,15],['16 à 30 %',15,30]];
  el.innerHTML='<div class="rates">'+bins.map(([l,a,b])=>{const g=runs.filter(x=>x.intensity>a&&x.intensity<=b),ok=g.filter(x=>x.ok).length;
    return `<div class="rate"><span>${l}</span><div class="t"><i style="width:${g.length?ok/g.length*100:0}%"></i></div><span class="mute">${g.length?ok+' sur '+g.length+' réussies':'aucun essai'}</span></div>`}).join('')+'</div><p class="mute" style="margin-top:10px">Tant que chaque bloc reste sous sa capacité de correction, la restauration réussit. Au-delà, elle échoue brutalement. Les rafales échouent plus tôt car elles concentrent les erreurs dans peu de blocs.</p>';}
