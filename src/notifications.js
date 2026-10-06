import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { GooeyToaster, gooeyToast } from 'goey-toast';
import 'goey-toast/styles.css';

let root;
export function notify(message,type='success',language='fr') {
  const fr=language==='fr';
  if(!root) {
    const container=document.createElement('div'); container.id='amms-notifications';
    document.body.append(container); root=createRoot(container);
    const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    flushSync(()=>root.render(React.createElement(GooeyToaster,{
      position:'top-right',visibleToasts:3,maxQueue:3,queueOverflow:'drop-oldest',
      preset:'subtle',spring:!reduced,bounce:reduced?0:0.1,closeOnEscape:true,swipeToDismiss:true,
      offset:16
    })));
  }
  const titles=fr?{success:'Enregistré',error:'Action impossible',warning:'À vérifier',info:'Information'}:{success:'Saved',error:'Action failed',warning:'Please check',info:'Information'};
  const id=gooeyToast[type in titles?type:'info'](titles[type] || titles.info,{
    description:message,timing:{displayDuration:type==='error'?10000:6500},
    fillColor:'#ffffff',borderColor:'#b9ccd9',borderWidth:1,preset:'subtle',
    classNames:{title:'amms-toast-title',description:'amms-toast-description',actionButton:'amms-toast-dismiss'},
    action:{label:fr?'Fermer':'Dismiss',onClick:()=>gooeyToast.dismiss(id)},
  });
  return id;
}
