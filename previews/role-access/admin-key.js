import {createHmac} from 'node:crypto';
export function administratorKey(secret,now=Date.now()) {
  return createHmac('sha256',secret).update(String(Math.floor(now/300000))).digest('hex');
}
