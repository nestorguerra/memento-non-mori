(() => {
  'use strict';
  const $ = (s,root=document) => root.querySelector(s);
  const $$ = (s,root=document) => [...root.querySelectorAll(s)];
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const goToNews=()=>$('#noticias')?.scrollIntoView({behavior:reduceMotion?'instant':'smooth'});
  let scrollFrame=0;
  const paintScroll=()=>{
    const max=document.documentElement.scrollHeight-window.innerHeight;
    const progress=$('#reading-progress');
    if(progress)progress.style.transform='scaleX('+(max>0?Math.min(1,window.scrollY/max):0)+')';
    $('#site-header')?.classList.toggle('is-scrolled',window.scrollY>80);
    scrollFrame=0;
  };
  window.addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(paintScroll);},{passive:true});
  window.addEventListener('resize',paintScroll);
  paintScroll();
  if(!reduceMotion&&'IntersectionObserver' in window){
    const reveal=new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('reveal-in');reveal.unobserve(entry.target);}
    }),{threshold:.07});
    $$('.opening-grid,.feature-card,.human-intro,.news-card[data-article],.voice').forEach(el=>reveal.observe(el));
  }
  let saved = new Set();
  try { const raw=JSON.parse(localStorage.getItem('mnm-lecturas')||'[]'); if(Array.isArray(raw))saved=new Set(raw.filter(x=>typeof x==='string')); }catch(_){}
  let toastTimer;
  const toast = text => { const box=$('#toast'); if(!box)return;box.textContent=text;box.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{box.hidden=true},2800); };
  function syncSaved(){
    $$('.save-button,[data-save-article]').forEach(b=>{ const on=saved.has(b.dataset.id);b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',on?'Quitar de guardados':'Guardar artículo');const label=$('[data-save-label]',b);if(label)label.textContent=on?'Guardado':'Guardar artículo'; });
    $$('[data-saved-count]').forEach(x=>x.textContent=String(saved.size));
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('.save-button,[data-save-article]');
    if(!b)return;
    const id=b.dataset.id;
    const was=saved.has(id);was?saved.delete(id):saved.add(id);
    let persisted=true;
    try{localStorage.setItem('mnm-lecturas',JSON.stringify([...saved]));}catch(_){persisted=false;}
    syncSaved();if($('#news-grid'))refresh();
    toast(was?'Artículo eliminado de guardados':persisted?'Artículo guardado en este navegador':'Guardado durante esta visita');
  });
  syncSaved();
  const searchPanel=$('#search-panel'), search=$('#search');
  let searchTrigger;
  function closeSearch(){
    if(!searchPanel)return;
    searchPanel.hidden=true;
    $$('[data-toggle-search]').forEach(b=>b.setAttribute('aria-expanded','false'));
    searchTrigger?.focus({preventScroll:true});
  }
  $$('[data-toggle-search]').forEach(b=>b.addEventListener('click',()=>{
    if(!searchPanel){window.location.href=b.dataset.home+'?buscar=1#noticias';return;}
    searchTrigger=b;
    if(!searchPanel.hidden){closeSearch();return;}
    searchPanel.hidden=false;b.setAttribute('aria-expanded','true');
    goToNews();search.focus({preventScroll:true});
  }));
  $('[data-close-search]')?.addEventListener('click',closeSearch);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&searchPanel&&!searchPanel.hidden)closeSearch();});
  const copy=$('[data-copy]');
  if(copy)copy.addEventListener('click',async()=>{
    const url=new URL(window.location.href);
    if(url.protocol==='file:'){toast('Vista local: enlace de publicación pendiente');return;}
    try{await navigator.clipboard.writeText(url.href);toast('Enlace copiado');}catch(_){toast('Puede copiar el enlace desde la barra del navegador');}
  });
  if(!$('#news-grid'))return;
  const cards=$$('.news-card[data-article]',$('#news-grid'));
  const topicButtons=$$('.filter[data-topic]'), evidence=$('#evidence'), order=$('#order'), count=$('#results-count'), shown=$('#shown-count'), load=$('#load-more'), empty=$('#empty'), clear=$('#clear-filters');
  let topic='Todos',onlySaved=false,limit=30;
  const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const params=new URLSearchParams(location.search);
  if(params.get('tema')&&topicButtons.some(b=>b.dataset.topic===params.get('tema')))topic=params.get('tema');
  if(evidence&&[...evidence.options].some(o=>o.value===params.get('evidencia')))evidence.value=params.get('evidencia');
  if(params.has('q'))search.value=params.get('q');
  if(params.has('buscar')||search.value){searchPanel.hidden=false;$$('[data-toggle-search]').forEach(b=>b.setAttribute('aria-expanded','true'));}
  function updateUrl(){
    const p=new URLSearchParams();
    if(topic!=='Todos')p.set('tema',topic);
    if(search.value)p.set('q',search.value);
    if(evidence.value!=='all')p.set('evidencia',evidence.value);
    if(onlySaved)p.set('guardados','1');
    try{history.replaceState(null,'',location.pathname+(p.size?'?'+p.toString():'')+location.hash);}catch(_){}
  }
  function refresh(){
    const q=norm(search.value.trim());
    let matches=cards.filter(c=>(topic==='Todos'||c.dataset.topic===topic)&&(!q||norm(c.dataset.search).includes(q))&&(evidence.value==='all'||c.dataset.group===evidence.value)&&(!onlySaved||saved.has(c.dataset.article)));
    if(order.value==='oldest')matches.sort((a,b)=>a.dataset.sort.localeCompare(b.dataset.sort));else if(order.value==='study')matches.sort((a,b)=>b.dataset.sort.localeCompare(a.dataset.sort));else if(order.value==='title')matches.sort((a,b)=>a.dataset.title.localeCompare(b.dataset.title,'es'));else matches.sort((a,b)=>b.dataset.added.localeCompare(a.dataset.added));
    cards.forEach(c=>{c.hidden=true;});
    const grid=$('#news-grid');
    matches.forEach((c,i)=>{
      c.hidden=i>=limit;c.dataset.position=String(i%6);
      if(grid.children[i]!==c)grid.insertBefore(c,grid.children[i]||null);
    });
    topicButtons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.topic===topic)));
    const visible=Math.min(limit,matches.length);
    const filtered=topic!=='Todos'||q||evidence.value!=='all';
    count.textContent=onlySaved?matches.length+' '+(matches.length===1?'artículo guardado':'artículos guardados'):filtered?matches.length+' '+(matches.length===1?'resultado':'resultados'):'Explora la actualidad científica';
    shown.textContent=visible<matches.length?'Más investigaciones por descubrir':'Sigue leyendo, sigue preguntando.';
    load.hidden=visible>=matches.length;
    empty.hidden=matches.length>0;
    clear.hidden=topic==='Todos'&&!q&&evidence.value==='all'&&!onlySaved;
    $$('#saved-toggle').forEach(b=>{b.setAttribute('aria-pressed',String(onlySaved));b.setAttribute('aria-label',onlySaved?'Ver todos los artículos':'Ver artículos guardados');});
    updateUrl();
    paintScroll();
  }
  topicButtons.forEach(b=>b.addEventListener('click',()=>{topic=b.dataset.topic;limit=30;refresh();}));
  search.addEventListener('input',()=>{limit=30;refresh();});
  $('#clear-search').addEventListener('click',()=>{search.value='';limit=30;refresh();search.focus();});
  evidence.addEventListener('change',()=>{limit=30;refresh();});
  order.addEventListener('change',()=>{limit=30;refresh();});
  load.addEventListener('click',()=>{limit+=9;refresh();});
  clear.addEventListener('click',()=>{topic='Todos';search.value='';evidence.value='all';onlySaved=false;limit=30;refresh();});
  $('#saved-toggle').addEventListener('click',()=>{onlySaved=!onlySaved;limit=30;refresh();goToNews();});
  onlySaved=params.get('guardados')==='1';
  refresh();
})();

// The camera travels along a conceptual helix. Scrolling remains native.
(() => {
  'use strict';
  const journey = document.querySelector('.dna-journey');
  const canvas = document.querySelector('#dna-canvas');
  if (!journey || !canvas) return;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return;
  const panels = [...journey.querySelectorAll('[data-dna-panel]')];
  let width = 0, height = 0, frame = 0;
  const clamp = n => Math.max(0, Math.min(1, n));
  function draw(progress) {
    ctx.fillStyle = '#071a25';
    ctx.fillRect(0, 0, width, height);
    const mobile = width < 700;
    const cameraY = progress * height * 3.6;
    const radius = Math.min(width * (mobile ? .32 : .145), height * .34);
    const pitch = height * .83;
    const tilt = -.26 + progress * .18;
    const centerX = width * (mobile ? .69 : .745) + Math.sin(progress * Math.PI) * width * .025;
    const centerY = height * (mobile ? .58 : .52);
    const zoom = 1 + Math.sin(progress * Math.PI) * .38;
    const project = (x, y, z) => {
      const scale = 1500 / (1500 - z) * zoom;
      return { x: centerX + (x * Math.cos(tilt) - y * Math.sin(tilt)) * scale,
        y: centerY + (x * Math.sin(tilt) + y * Math.cos(tilt)) * scale, z, scale };
    };
    // A deterministic particle field, with no loop when the page is idle.
    for (let i = 0; i < 64; i++) {
      const x = ((i * 137.51) % 997) / 997 * width;
      const y = ((i * 91.7 + progress * height * (i % 3 + 1) * .18) % height + height) % height;
      ctx.fillStyle = `rgba(175,216,198,${.06 + (i % 5) * .025})`;
      ctx.beginPath(); ctx.arc(x, y, i % 7 === 0 ? 1.6 : .7, 0, Math.PI * 2); ctx.fill();
    }
    const shapes = [];
    const step = mobile ? 9 : 7;
    const first = Math.floor((cameraY - height * 1.5) / step);
    const last = Math.ceil((cameraY + height * 1.5) / step);
    const point = (row, strand) => {
      const worldY = row * step;
      const theta = worldY / pitch * Math.PI * 2 + progress * Math.PI * 1.8 + strand * Math.PI;
      const wobble = Math.sin(worldY / 330) * radius * .1;
      return project(Math.cos(theta) * radius + wobble, worldY - cameraY, Math.sin(theta) * radius);
    };
    for (let row = first; row <= last; row++) {
      for (let strand = 0; strand < 2; strand++) {
        const p = point(row, strand), next = point(row + 1, strand);
        shapes.push({ type: 'strand', a: p, b: next, z: (p.z + next.z) / 2, strand });
        shapes.push({ type: 'bead', a: p, z: p.z, strand });
      }
      if (row % 5 === 0) {
        const a = point(row, 0), b = point(row, 1);
        shapes.push({ type: 'pair', a, b, z: (a.z + b.z) / 2, row });
      }
    }
    shapes.sort((a, b) => a.z - b.z);
    for (const shape of shapes) {
      const a = shape.a;
      if (a.y < -height * .5 || a.y > height * 1.5) continue;
      const depth = clamp((shape.z / radius + 1) / 2);
      const color = shape.strand ? '103,188,180' : '216,243,106';
      if (shape.type === 'strand') {
        ctx.strokeStyle = `rgba(${color},${.12 + depth * .55})`;
        ctx.lineWidth = (1.6 + depth * 2) * a.scale;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(shape.b.x, shape.b.y); ctx.stroke();
      } else if (shape.type === 'bead') {
        const r = (2.2 + depth * 2.8) * a.scale;
        const glow = ctx.createRadialGradient(a.x - r * .3, a.y - r * .3, 0, a.x, a.y, r);
        glow.addColorStop(0, `rgba(${depth > .55 ? '244,255,210' : color},${.45 + depth * .5})`);
        glow.addColorStop(.6, `rgba(${color},${.18 + depth * .65})`);
        glow.addColorStop(1, `rgba(${color},.03)`);
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, Math.PI * 2); ctx.fill();
      } else {
        const b = shape.b;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        ctx.lineWidth = 1.1 * a.scale;
        ctx.strokeStyle = 'rgba(216,243,106,.35)';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mid.x - 2, mid.y); ctx.stroke();
        ctx.strokeStyle = 'rgba(103,188,180,.35)';
        ctx.beginPath(); ctx.moveTo(mid.x + 2, mid.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        for (let j = 1; j < 9; j++) {
          const x = a.x + (b.x - a.x) * j / 9;
          const y = a.y + (b.y - a.y) * j / 9;
          ctx.fillStyle = j < 5 ? 'rgba(216,243,106,.32)' : 'rgba(103,188,180,.32)';
          ctx.beginPath(); ctx.arc(x, y, 1.5 * a.scale, 0, Math.PI * 2); ctx.fill();
        }
        if (!mobile && shape.row % 20 === 0 && Math.abs(a.x - b.x) > 120) {
          ctx.font = '10px "Work Sans", sans-serif';
          ctx.fillStyle = 'rgba(216,243,106,.55)';
          ctx.fillText(shape.row % 40 === 0 ? 'A — T' : 'C — G', mid.x - 13, mid.y - 9);
        }
      }
    }
  }
  function paint() {
    frame = 0;
    if (motion.matches) return;
    const bounds = journey.getBoundingClientRect();
    if (bounds.bottom < 0 || bounds.top > window.innerHeight) return;
    const progress = clamp(-bounds.top / Math.max(1, bounds.height - height));
    journey.style.setProperty('--dna-progress', progress);
    journey.dataset.dnaProgress = progress.toFixed(3);
    draw(progress * .32);
  }
  function requestPaint() { if (!frame) frame = requestAnimationFrame(paint); }
  function resize() {
    if (motion.matches) return;
    const stage = journey.querySelector('.dna-stage');
    width = stage.clientWidth; height = stage.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    requestPaint();
  }
  function setMotionMode() {
    journey.classList.toggle('dna-ready', !motion.matches);
    if (motion.matches) {
      panels.forEach(panel => { panel.style.removeProperty('opacity'); panel.style.removeProperty('transform'); panel.inert = false; panel.removeAttribute('aria-hidden'); });
    } else resize();
  }
  window.addEventListener('scroll', requestPaint, { passive: true });
  window.addEventListener('resize', resize);
  motion.addEventListener('change', setMotionMode);
  setMotionMode();
})();
