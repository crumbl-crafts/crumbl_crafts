(function(){
  // Shared WebAudio UI sounds manager — small, lazy-init, persisted toggle
  if(window.__cc_ui_sounds_shared) return; // guard
  window.__cc_ui_sounds_shared = true;

  let audioCtx = null;
  // UI sounds enabled by default (not tweakable for now)
  let enabled = true;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function initAudio(){
    if(audioCtx) return;
    try{ audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ audioCtx = null; }
  }

  function playTone(freq, type='sine', duration=0.08, vol=0.08){
    if(!audioCtx || !enabled) return;
    try{
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.value = 0.0001;
      o.connect(g); g.connect(audioCtx.destination);
      const now = audioCtx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
      o.start(now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      o.stop(now + duration + 0.02);
    }catch(e){ /* silent */ }
  }

  function playHover(){ if(reduceMotion) return; playTone(920,'triangle',0.06,0.03); }
  function playClick(){ playTone(660,'sine',0.09,0.08); }

  // attach behaviors to interactive elements
  function attach(){
    document.querySelectorAll('.dept, .cta, a, button').forEach(el=>{
      el.addEventListener('click', ()=>{ initAudio(); if(audioCtx && audioCtx.state==='suspended') audioCtx.resume().catch(()=>{}); playClick(); }, {passive:true});
      if(!reduceMotion) el.addEventListener('pointerenter', ()=>{ initAudio(); if(audioCtx && audioCtx.state==='suspended') audioCtx.resume().catch(()=>{}); playHover(); });
    });
  }

  // Not exposing a toggle UI currently — keep sounds enabled by default.

  // initialize after DOM ready
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>{ attach(); }); else { attach(); }

  // debug API (no toggle/persistence exposed)
  window.__cc_ui_sounds = { playClick, playHover };
})();
