(function(){
  // ui-transitions.js — injects lightweight CSS and exposes premium promo + cookie banner APIs
  if(window.__ui_transitions_loaded) return; window.__ui_transitions_loaded = true;

  const css = `
  /* Premium promo */
  .promo-wrap{position:fixed;top:18px;left:50%;transform:translateX(-50%) translateY(-8px);z-index:99997;pointer-events:none}
  .promo-card{pointer-events:auto;min-width:320px;max-width:760px;padding:14px 18px;border-radius:14px;background:linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));border:1px solid rgba(255,255,255,0.06);box-shadow:0 12px 40px rgba(0,0,0,0.6);backdrop-filter:blur(12px) saturate(1.05);display:flex;align-items:center;gap:12px;transform-origin:top center;}
  .promo-card .media{width:64px;height:64px;border-radius:10px;display:grid;place-items:center;background:linear-gradient(135deg, rgba(255,23,68,0.16), rgba(41,121,255,0.06));font-size:28px}
  .promo-card .media img{width:100%;height:100%;object-fit:cover;border-radius:8px;display:block}
  .promo-card .media .crumb{position:absolute;width:6px;height:6px;border-radius:50%;background:rgba(255,215,140,0.9);box-shadow:0 2px 6px rgba(0,0,0,0.45);opacity:0;transform:translateY(0);animation:crumbPop .9s ease forwards}
  @keyframes crumbPop{0%{opacity:0;transform:translateY(6px) scale(.6)}30%{opacity:1;transform:translateY(-6px) scale(1)}100%{opacity:0;transform:translateY(-18px) scale(.6)}}
  .promo-card .content{flex:1}
  .promo-card .title{font-weight:800;margin:0 0 4px 0}
  .promo-card .body{color:rgba(255,255,255,0.82);font-size:0.95rem;margin:0}
  .promo-card .cta{margin-left:12px;padding:8px 12px;border-radius:10px;border:none;background:linear-gradient(90deg,#ff6b9d,#ff1744);color:#fff;font-weight:800;cursor:pointer}
  @keyframes promoIn{from{opacity:0;transform:translateX(-50%) translateY(-18px) scale(.98)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
  @keyframes promoOut{from{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}to{opacity:0;transform:translateX(-50%) translateY(-12px) scale(.98)}}
  .promo-wrap.show{pointer-events:auto;animation:promoIn .36s cubic-bezier(.2,.9,.2,1) both}
  .promo-wrap.hide{animation:promoOut .28s ease both}

  /* Cookie banner */
  .cookie-banner{position:fixed;left:16px;right:16px;bottom:16px;max-width:1100px;margin:0 auto;z-index:99999;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:linear-gradient(180deg, rgba(20,24,32,0.92), rgba(20,24,32,0.86));border:1px solid rgba(255,255,255,0.04);box-shadow:0 14px 48px rgba(0,0,0,0.6);backdrop-filter:blur(8px);opacity:0;transform:translateY(12px);transition:opacity .28s ease,transform .28s ease}
  .cookie-banner.show{opacity:1;transform:translateY(0)}
  .cookie-banner .cb-text{flex:1;color:var(--muted,#c4cbdc)}
  .cookie-banner .cb-actions{display:flex;gap:8px}
  .cb-btn{padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:var(--muted,#fff);cursor:pointer}
  .cb-btn.primary{background:linear-gradient(90deg,#ffd27a,#ff6b9d);color:#000;border:none}
  /* Fullscreen transition overlay for gif (cookie-eating) */
  .transition-overlay{position:fixed;inset:0;display:grid;place-items:center;background:rgba(0,0,0,0.8);z-index:100000;opacity:0;pointer-events:none;transition:opacity .18s ease}
  .transition-overlay.show{opacity:1;pointer-events:auto}
  .transition-overlay img{max-width:46vw;max-height:60vh;border-radius:14px;box-shadow:0 28px 80px rgba(0,0,0,0.8);border:6px solid rgba(0,0,0,0.6)}
  .transition-overlay .surround{position:absolute;inset:auto;width:260px;height:260px;border-radius:50%;box-shadow:0 0 120px rgba(255,200,120,0.06) inset, 0 0 36px rgba(255,23,68,0.06);mix-blend-mode:screen}
  `;

  const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s);

  // Create containers
  const promoWrap = document.createElement('div'); promoWrap.className = 'promo-wrap'; promoWrap.setAttribute('aria-hidden','true'); document.body.appendChild(promoWrap);
  const cookie = document.createElement('div'); cookie.className = 'cookie-banner'; cookie.setAttribute('role','dialog'); cookie.setAttribute('aria-live','polite'); cookie.innerHTML = `
    <div class="cb-text">We use minimal cookies for essential functionality and analytics. By continuing you accept this usage.</div>
    <div class="cb-actions"><button class="cb-btn" id="cbManage">Manage</button><button class="cb-btn primary" id="cbAccept">Accept</button></div>
  `; document.body.appendChild(cookie);

  // Transition overlay element (for playing transition.gif)
  const transOverlay = document.createElement('div'); transOverlay.className = 'transition-overlay'; transOverlay.setAttribute('aria-hidden','true'); transOverlay.innerHTML = `<div class="surround" aria-hidden></div><img alt="transition">`;
  document.body.appendChild(transOverlay);

  // Promo API
  function showPremiumPromo(opts={title:'Premium',body:'Upgrade for perks',icon:'⭐',cta:'Learn',duration:6000}){
    promoWrap.innerHTML = '';
    const card = document.createElement('div'); card.className='promo-card';
    // detect image-like icon (gif/png/jpg/svg) or explicit transition gif usage
    let mediaHtml = '';
    if(opts.icon && /\.(gif|png|jpg|jpeg|svg)$/i.test(opts.icon)){
      mediaHtml = `<div class="media"><img src="${opts.icon}" alt="promo"></div>`;
    } else if(opts.useTransitionGif || (opts.icon && opts.icon.toLowerCase()==='transition.gif')){
      mediaHtml = `<div class="media" style="position:relative"><img src="transition.gif" alt="promo"/><div class="crumb" style="left:8px;top:8px"></div><div class="crumb" style="left:34px;top:22px"></div></div>`;
    } else {
      mediaHtml = `<div class="media">${opts.icon||'⭐'}</div>`;
    }
    card.innerHTML = `${mediaHtml}<div class="content"><div class="title">${opts.title}</div><div class="body">${opts.body}</div></div><button class="cta">${opts.cta||'Learn'}</button>`;
    promoWrap.appendChild(card);
    promoWrap.classList.remove('hide'); promoWrap.classList.add('show'); promoWrap.setAttribute('aria-hidden','false');
    const btn = card.querySelector('.cta'); if(btn) btn.addEventListener('click', ()=>{ if(opts.onClick) opts.onClick(); hidePremiumPromo(); });
    // If the media is a gif element, clicking it will play the fullscreen transition
    const img = card.querySelector('.media img'); if(img){ img.style.cursor='pointer'; img.addEventListener('click', ()=>{ showTransitionOverlay(img.getAttribute('src'), 1800); }); }
    if(opts.duration && opts.duration>0){ setTimeout(()=>{ hidePremiumPromo(); }, opts.duration); }
  }
  function hidePremiumPromo(){ if(!promoWrap.classList.contains('show')) return; promoWrap.classList.remove('show'); promoWrap.classList.add('hide'); setTimeout(()=>{ promoWrap.innerHTML=''; promoWrap.classList.remove('hide'); promoWrap.setAttribute('aria-hidden','true'); }, 360); }

  // Cookie banner
  function showCookieBanner(){ if(localStorage.getItem('cc_cookie_accepted')) return; cookie.classList.add('show'); }
  function hideCookieBanner(){ cookie.classList.remove('show'); localStorage.setItem('cc_cookie_accepted','1'); }
  cookie.querySelector('#cbAccept').addEventListener('click', ()=>{ hideCookieBanner(); });
  cookie.querySelector('#cbManage').addEventListener('click', ()=>{ try{ window.location.href='#privacy'; }catch(e){} });

  // Auto show after short delay if not accepted
  setTimeout(()=>{ showCookieBanner(); }, 800);

  // Show a fullscreen transition GIF with optional duration (ms)
  function showTransitionOverlay(src='transition.gif', duration=1200, cb){
    try{
      const img = transOverlay.querySelector('img'); img.src = src; transOverlay.classList.add('show'); transOverlay.setAttribute('aria-hidden','false');
      // small entrance flourish
      setTimeout(()=>{
        // auto-hide after duration
        setTimeout(()=>{ transOverlay.classList.remove('show'); transOverlay.setAttribute('aria-hidden','true'); if(cb) cb(); }, duration);
      }, 60);
    }catch(e){ if(cb) cb(); }
  }

  // expose API
  window.UITransitions = { showPremiumPromo, hidePremiumPromo, showCookieBanner, hideCookieBanner, showTransitionOverlay };
  // Play a short page-enter overlay when the page is shown (including back/forward via bfcache)
  function playPageEnter(ms = 220){
    try{
      if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const overlay = document.getElementById('ptOverlay');
      if(!overlay) return;
      overlay.classList.add('show');
      // hide after ms (small buffer)
      setTimeout(()=>{ overlay.classList.remove('show'); }, ms);
    }catch(e){}
  }

  // Run on DOMContentLoaded and pageshow (handles back/forward and bfcache restores)
  document.addEventListener('DOMContentLoaded', ()=>{ setTimeout(()=>playPageEnter(220), 20); });
  window.addEventListener('pageshow', (ev)=>{ setTimeout(()=>playPageEnter(220), 20); });
})();
