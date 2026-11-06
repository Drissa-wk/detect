import { $, $$, toast } from './utils.js';
import { state } from './state.js';
import { renderFiles } from './views/files.js';
import { renderReport } from './views/report.js';

/* ---------- Navigation ---------- */
export function show(v){$$('.view').forEach(s=>s.hidden=s.id!=='v-'+v);
  $$('nav button').forEach(b=>b.setAttribute('aria-current',b.dataset.v===v?'page':'false'));
  if(v==='files')renderFiles();if(v==='report')renderReport();scrollTo(0,0)}
$$('nav button').forEach(b=>b.onclick=()=>show(b.dataset.v));
$('#user').onchange=e=>{state.user=e.target.value;toast('Connecté en tant que '+state.user+'.')};
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g)show(g.dataset.go)});
