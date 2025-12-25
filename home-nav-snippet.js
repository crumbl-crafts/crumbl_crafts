/* Home navigation snippet
   Paste into other dept pages (e.g., near end of <body>) to add a floating Home button
   that uses the same overlay animation before redirecting back to home.html.
*/
(function(){
  const btn = document.createElement('button');
  // use FontAwesome if available, otherwise fallback to emoji
  const icon = (window.FontAwesome || document.querySelector('link[href*="font-awesome"]')) ? '<i class="fas fa-home" aria-hidden></i>' : '🏠';
  btn.innerHTML = icon + '&nbsp;<span class="hn-label">Home</span>';
  btn.setAttribute('aria-label','Go to Home');
  btn.setAttribute('title','Home');
  btn.className = 'home-nav-btn';

  // Mature, subtle styling — match header aesthetics when inserted
  Object.assign(btn.style,{display:'inline-flex',alignItems:'center',gap:'8px',padding:'6px 10px',height:'36px',borderRadius:'10px',background:'transparent',border:'1px solid rgba(255,255,255,0.06)',color:'var(--muted, #cbd6ee)',cursor:'pointer',fontWeight:700});

  // Find header and logo container to place button left-of-center near branding
  const header = document.querySelector('header') || document.querySelector('.glass.hero') || document.querySelector('.glass');
  const logoContainer = header && (header.querySelector('.logo-container') || header.querySelector('.logo'));

  if (logoContainer && logoContainer.parentNode) {
    // insert after the logo container so it sits visually near the brand
    logoContainer.parentNode.insertBefore(btn, logoContainer.nextSibling);
    // ensure spacing looks consistent
    btn.style.marginLeft = '12px';
  } else if (header) {
    // header exists but no logo container — append and let header layout handle it
    header.appendChild(btn);
  } else {
    // fallback: subtle bottom-left floating (non-intrusive)
    Object.assign(btn.style,{position:'fixed',left:'18px',bottom:'18px',boxShadow:'0 8px 24px rgba(0,0,0,0.45)',zIndex:99999});
    document.body.appendChild(btn);
  }

  // ensure there's a transition overlay (ptOverlay) available — create if missing
  let overlay = document.getElementById('ptOverlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'ptOverlay';
    Object.assign(overlay.style,{position:'fixed',inset:0,display:'grid',placeItems:'center',background:'radial-gradient(circle at center, rgba(0,0,0,0.6), rgba(0,0,0,0.95))',zIndex:99998,opacity:0,transition:'opacity .45s ease',pointerEvents:'none'});
    const spinner = document.createElement('div');
    Object.assign(spinner.style,{width:'84px',height:'84px',borderRadius:'50%',background:'conic-gradient(rgba(255,255,255,0.06), rgba(255,255,255,0.02))',filter:'blur(6px)'});
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
  }

  let navigating=false;
  function goHome(){ if(navigating) return; navigating=true; overlay.classList.add('show'); overlay.style.opacity=1; overlay.style.pointerEvents='auto'; setTimeout(()=>{ window.location.href='home.html'; },340); }
  btn.addEventListener('click',()=>{ try{ goHome(); }catch(e){ window.location.href='home.html'; } });

  // H keyboard shortcut (case-insensitive) — avoid firing when typing in inputs
  document.addEventListener('keydown',e=>{ const t = e.target; const tag = t && t.tagName && t.tagName.toLowerCase(); if(tag==='input' || tag==='textarea' || t.isContentEditable) return; if(e.key==='h' || e.key==='H') goHome(); });

  // expose a small API for integration tests / UI sounds
  window.__homeNav = { goHome };
})();
