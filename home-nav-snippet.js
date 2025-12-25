/* Home navigation snippet
   Paste into other dept pages (e.g., near end of <body>) to add a floating Home button
   that uses the same overlay animation before redirecting back to home.html.
*/
(function(){
  const btn = document.createElement('button');
  btn.innerHTML = '🏠&nbsp;<span style="font-weight:800">Home</span>';
  btn.setAttribute('aria-label','Back to Home');
  // Base styles; we'll adjust placement depending on header presence
  Object.assign(btn.style,{padding:'8px 12px',borderRadius:'10px',background:'linear-gradient(90deg,#ff1744,#ff6b9d)',color:'#fff',border:'none',fontWeight:800,boxShadow:'0 8px 24px rgba(0,0,0,0.45)',cursor:'pointer',zIndex:99999});

  // Try to place inside the page header (aligned right) if present
  const header = document.querySelector('header') || document.querySelector('.glass.hero') || document.querySelector('.glass');
  if (header) {
    // ensure header is flex (most pages already are) and place button on right
    try { header.style.display = header.style.display || getComputedStyle(header).display; } catch(e) {}
    btn.style.marginLeft = 'auto';
    btn.style.alignSelf = 'center';
    btn.style.height = '40px';
    header.appendChild(btn);
  } else {
    // fallback to floating button bottom-right
    Object.assign(btn.style,{position:'fixed',right:'18px',bottom:'18px'});
    document.body.appendChild(btn);
  }

  // create simple overlay if not present
  let overlay = document.getElementById('ptOverlay');
  if(!overlay){
    overlay = document.createElement('div');
    overlay.id = 'ptOverlay';
    Object.assign(overlay.style,{position:'fixed',inset:0,display:'grid',placeItems:'center',background:'radial-gradient(circle at center, rgba(255,23,68,0.12), rgba(0,0,0,0.85))',zIndex:99998,opacity:0,transition:'opacity .45s ease',pointerEvents:'none'});
    const spinner = document.createElement('div');
    Object.assign(spinner.style,{width:'100px',height:'100px',borderRadius:'50%',background:'conic-gradient(rgba(255,23,68,0.9), rgba(41,121,255,0.7))',filter:'blur(6px)'});
    overlay.appendChild(spinner);
    document.body.appendChild(overlay);
  }

  let navigating=false;
  function goHome(){ if(navigating) return; navigating=true; overlay.style.opacity=1; overlay.style.pointerEvents='auto'; setTimeout(()=>{ window.location.href='home.html'; },420); }
  btn.addEventListener('click',goHome);

  // optional keyboard shortcut: H to go home
  document.addEventListener('keydown',e=>{ if(e.key==='h' || e.key==='H') goHome(); });
})();
