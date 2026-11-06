import { toB64, fromB64, crc32 } from './utils.js';

/* Simulation locale : reproduit le comportement (correction possible si <= t octets faux par bloc) */
export const MOCK={
  encode({data,n,k}){const d=fromB64(data),bl=[];
    for(let i=0;i<d.length||!bl.length;i+=k){const b=new Uint8Array(n);b.set(d.subarray(i,i+k));let s=0;
      for(let j=0;j<k;j++)s=(s*31+b[j]+j)&255;for(let j=k;j<n;j++)b[j]=(s+j*7)&255;bl.push(toB64(b))}
    return{blocks:bl,crc:crc32(d),length:d.length,_orig:bl}},
  noise({blocks,intensity,mode}){const B=blocks.map(fromB64),n=B[0].length,tot=B.length*n,
    m=Math.min(tot,Math.max(1,Math.round(tot*intensity/100))),st=Math.floor(Math.random()*tot),hit=new Set();
    for(let i=0;i<m;i++)hit.add(mode==='burst'?(st+i)%tot:Math.floor(Math.random()*tot));
    const per=B.map(()=>0);hit.forEach(p=>{B[Math.floor(p/n)][p%n]^=1+Math.floor(Math.random()*255);per[Math.floor(p/n)]++});
    return{blocks:B.map(toB64),per_block:per}},
  check(p){const bad=[];p.blocks.forEach((b,i)=>{if(b!==p._orig[i])bad.push(i)});return{ok:!bad.length,bad}},
  decode(p){const o=p._orig.map(fromB64),B=p.blocks.map(fromB64),info=[];let corr=0;
    B.forEach((b,i)=>{let e=0;b.forEach((v,j)=>{if(v!==o[i][j])e++});
      if(!e)info.push({errors:0,status:'ok'});
      else if(e<=p.t){B[i]=o[i];corr+=e;info.push({errors:e,status:'fixed'})}
      else info.push({errors:e,status:'lost'})});
    const d=new Uint8Array(p.length);B.forEach((b,i)=>d.set(b.subarray(0,Math.min(p.k,p.length-i*p.k)),i*p.k));
    const crc_ok=crc32(d)===p.crc;
    return{ok:crc_ok&&!info.some(x=>x.status==='lost'),blocks:B.map(toB64),info,corrected:corr,crc_ok,data:toB64(d)}}
};
