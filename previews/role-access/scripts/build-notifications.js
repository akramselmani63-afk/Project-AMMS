import { build } from 'esbuild';

await build({
  entryPoints:['./src/notifications.js'],bundle:true,minify:true,format:'iife',tsconfigRaw:{},
  globalName:'AMMSNotifications',outfile:'assets/notifications.js',target:'es2020',
  define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'
});
