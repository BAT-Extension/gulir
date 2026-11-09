// Idle deadline: user editing resets it; active save pauses it entirely.
export function createCountdown({onTick,onExpire,seconds=60,now=()=>Date.now(),schedule=fn=>setInterval(fn,250),cancel=id=>clearInterval(id)}) {
  let deadline=now()+seconds*1000,paused=false,stopped=false;
  const tick=()=>{if(stopped)return;if(paused){onTick(null);return;}const left=Math.max(0,Math.ceil((deadline-now())/1000));onTick(left);if(left===0){stopped=true;cancel(timer);onExpire();}};
  const timer=schedule(tick);
  tick();
  return {reset(){if(stopped)return;deadline=now()+seconds*1000;tick();},pause(){paused=true;tick();},resume(){paused=false;deadline=now()+seconds*1000;tick();},stop(){stopped=true;cancel(timer);}};
}
