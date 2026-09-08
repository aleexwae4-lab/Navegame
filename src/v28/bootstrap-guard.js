const BOOT_EVENT='wae:boot-ready';
const SAFE_PARAM='wae_safe';
const RETRY_PARAM='wae_retry';

function hasGame(){
  const game=window.__waeNeonRiderGame;
  return Boolean(game&&typeof game.start==='function'&&typeof game.init==='function');
}

function markReady(mode='v28'){
  window.__waeBootReady=true;
  window.__waeBootMode=mode;
  window.dispatchEvent(new CustomEvent(BOOT_EVENT,{detail:{mode,version:'28.0.1'}}));
}

function setRetryUi(reason='BOOT STALLED'){
  const button=document.querySelector('#start-btn');
  if(!button||button.dataset.waeRetryInstalled==='true')return;
  button.dataset.waeRetryInstalled='true';
  button.textContent='REINTENTAR ARRANQUE';
  button.title=reason;
  button.addEventListener('click',()=>{
    const url=new URL(location.href);
    url.searchParams.set(RETRY_PARAM,String(Date.now()));
    url.searchParams.delete(SAFE_PARAM);
    location.replace(url.toString());
  },{capture:true,once:true});
}

export function installBootWatchdog(){
  window.setTimeout(()=>{
    if(hasGame()){
      markReady(window.__waeBootMode||'v28');
      return;
    }
    setRetryUi('WAE BOOT WATCHDOG: runtime not ready');
  },3600);

  window.addEventListener('vite:preloadError',()=>setRetryUi('WAE PRELOAD ERROR'));
  window.addEventListener('error',(event)=>{
    const message=String(event?.message||'');
    if(/module|import|chunk|script/i.test(message))setRetryUi(message);
  });
}

export async function bootWithFallback(){
  const params=new URLSearchParams(location.search);
  const safe=params.get(SAFE_PARAM)==='1';

  if(safe){
    try{
      await import('../v15/boot.js');
      window.__waeBootMode='safe-v15';
      if(hasGame())markReady('safe-v15');
      return true;
    }catch(error){
      console.error('[WAE BOOT] Safe fallback failed',error);
      setRetryUi('SAFE BOOT FAILED');
      return false;
    }
  }

  try{
    await import('./boot.js');
    window.__waeBootMode='v28';
    if(hasGame())markReady('v28');
    return true;
  }catch(error){
    console.error('[WAE BOOT] V28 failed, switching to safe core',error);
    try{
      await import('../v15/boot.js');
      window.__waeBootMode='safe-v15';
      document.body.classList.add('wae-safe-boot');
      if(hasGame())markReady('safe-v15');
      return true;
    }catch(fallbackError){
      console.error('[WAE BOOT] Safe fallback failed',fallbackError);
      setRetryUi('BOOT FAILED');
      return false;
    }
  }
}
