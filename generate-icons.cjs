const fs = require('node:fs');
const zlib = require('node:zlib');
function chunk(type,data){
 const t=Buffer.from(type), b=Buffer.concat([t,data]); let crc=0xffffffff;
 for(const v of b){crc^=v;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 const len=Buffer.alloc(4), tail=Buffer.alloc(4);len.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);
 return Buffer.concat([len,b,tail]);
}
fs.mkdirSync('public',{recursive:true});
for(const n of [192,512]){
 const raw=Buffer.alloc(n*(1+n*3));
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
 const X=(x+.5)*128/n,Y=(y+.5)*128/n;
 let c=[16,43,67];
 const d=Math.hypot(X-64,Y-64), ang=Math.atan2(Y-64,X-64);
 if(Math.abs(d-30)<3.5 && Math.abs(Math.sin(ang))>.40)c=[67,217,232];
 for(const [cx,h] of [[52,24],[64,48],[76,24]])if(Math.hypot(X-cx,Math.max(0,Math.abs(Y-64)-h/2))<3.5)c=[243,247,251];
 const i=y*(1+n*3)+1+x*3;raw.set(c,i);
 }
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(n,0);hdr.writeUInt32BE(n,4);hdr[8]=8;hdr[9]=2;
 fs.writeFileSync('public/icon-'+n+'.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
