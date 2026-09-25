export const MAX_PHOTOS=4;
export function validatePhotos(files) {
  if(files.length>MAX_PHOTOS) throw new Error('Up to 4 photos per request. / Maximum 4 photos par demande.');
  for(const file of files) {
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use JPG, PNG or WebP photos. / Utilisez JPG, PNG ou WebP.');
    if(file.size>8*1024*1024) throw new Error('Each photo must be under 8 MB. / Chaque photo doit faire moins de 8 Mo.');
  }
}
export async function readPhotos(files) {
  validatePhotos(files); const result=[];
  for(const file of files) {
    const bitmap=await createImageBitmap(file);
    try {
      const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
      const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const ctx=canvas.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      result.push({name:file.name,data:canvas.toDataURL('image/jpeg',0.78)});
    } finally { bitmap.close(); }
  }
  return result;
}
