import { USE_MOCK } from './config.js';
import { $, toast } from './utils.js';
import { openDb, all } from './db.js';
import { state } from './state.js';
import './nav.js';
import './actions.js';
import './views/files.js';
import './views/report.js';
import { plan } from './views/upload.js';

/* ---------- Démarrage ---------- */
(async()=>{try{await openDb();state.files=await all('files')}catch(e){toast('IndexedDB indisponible dans ce navigateur.',1)}
  $('#demo').hidden=!USE_MOCK;plan();
  if(state.files.length){state.files.forEach(r=>r.checked=false)}})();
