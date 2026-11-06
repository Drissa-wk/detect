/* ============================================================
   CONTRAT D'API FLASK (POST JSON, octets encodés en base64)
   /api/encode {data,n,k}            -> {blocks[],crc,length}
   /api/noise  {blocks[],intensity,mode:'spread'|'burst'} -> {blocks[],per_block[]}
   /api/check  {blocks[],crc,length,n,k}  -> {ok,bad[]}   (blocs dont le syndrome != 0)
   /api/decode {blocks[],crc,length,n,k,t} -> {ok,blocks[],info[{errors,status:'ok'|'fixed'|'lost'}],corrected,crc_ok,data}
   Pour utiliser le vrai serveur : USE_MOCK=false (et servir cette page depuis Flask).
   ============================================================ */
export const USE_MOCK = false;
export const API_URL = '';
