(() => {
  'use strict';
  const $=selector=>document.querySelector(selector);
  const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fold=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('it');
  const characters=window.SANMAURO_CATALOG?.characters;
  if(!characters?.length){$('#main').innerHTML='<p class="notice">Il catalogo non è disponibile.</p>';return;}
  const page=document.body.dataset.page??'roster',params=new URLSearchParams(location.search);
  const groups=MovesGroups.group(characters);
  const selected=characters.find(c=>c.id===params.get('id'));
  const currentMove=params.has('move')?groups.find(move=>move.id===params.get('move')):groups[0];
  const number=n=>String(n).padStart(2,'0');
  const href=(c,animation=params.get('anim'))=>'personaggio.html?id='+encodeURIComponent(c.id)+(animation?'&anim='+encodeURIComponent(animation):'');
  const menu=$('.menu-toggle'),sidebar=$('#sidebar');
  sidebar.innerHTML=`<a class="brand" href="index.html" aria-label="Sanmauro Fighters, tutti i personaggi"><span class="brand-mark" aria-hidden="true">SF</span><span class="brand-name">SANMAURO<small>FIGHTERS</small></span></a>
    <button class="sidebar-close icon-button" type="button" aria-label="Chiudi il menu">×</button>
    <label class="sidebar-search"><span aria-hidden="true">⌕</span><span class="screen-reader-only">Cerca un personaggio</span><input id="character-search" type="search" placeholder="Cerca personaggio…" autocomplete="off" spellcheck="false"></label>
    <a class="all-link" href="index.html" ${page==='roster'?'aria-current="page"':''}><span><b class="grid-symbol" aria-hidden="true">▦</b> Tutti i personaggi</span><span>${characters.length}</span></a>
    <a class="all-link" href="stages.html" ${page==='stages'?'aria-current="page"':''}><span>Stages</span><span aria-hidden="true">→</span></a>
    <a class="all-link" href="ui.html" ${page==='ui'?'aria-current="page"':''}><span>UI</span><span aria-hidden="true">→</span></a>
    <a class="all-link" href="specials.html" ${page==='specials'?'aria-current="page"':''}><span>Special e Super</span><span aria-hidden="true">→</span></a>
    <details class="sidebar-dropdown" ${page==='moves'?'open':''}><summary class="sidebar-dropdown-toggle">Per mossa<span class="dropdown-chevron" aria-hidden="true"></span></summary>
    <nav class="moves-nav" aria-label="Per mossa">${groups.map(move=>`<a class="nav-link move-nav-link" href="mosse.html?move=${encodeURIComponent(move.id)}" ${page==='moves'&&move===currentMove?'aria-current="page"':''}><span>${escape(move.name)}</span><span class="move-count">${move.animations.length}</span></a>`).join('')}</nav></details>
    <details class="sidebar-dropdown" ${page==='roster'||page==='character'?'open':''}><summary class="sidebar-dropdown-toggle">Per personaggio<span class="dropdown-summary-end"><span id="nav-count">${characters.length}</span><span class="dropdown-chevron" aria-hidden="true"></span></span></summary>
    <nav class="character-nav" aria-label="Per personaggio">${characters.map((c,i)=>`<a class="nav-link" data-character="${escape(c.id)}" href="${href(c)}" ${page==='character'&&c===selected?'aria-current="page"':''}><span class="nav-number" aria-hidden="true">${number(i+1)}</span><span>${escape(c.name.toUpperCase())}</span></a>`).join('')}<p class="nav-empty" hidden>Nessun risultato.</p></nav></details>
    <div class="sidebar-bottom">SANMAURO · ARCHIVIO MOSSE</div>`;
  const overlay=$('.menu-overlay');
  function toggleMenu(open,focus=true){
    document.body.classList.toggle('menu-open',open);overlay.hidden=!open;
    menu.setAttribute('aria-expanded',String(open));
    if(focus)(open?$('#character-search'):menu).focus();
  }
  menu.addEventListener('click',()=>toggleMenu(!document.body.classList.contains('menu-open')));
  $('.sidebar-close').addEventListener('click',()=>toggleMenu(false));
  overlay.addEventListener('click',()=>toggleMenu(false));
  document.addEventListener('keydown',event=>{
    if(!document.body.classList.contains('menu-open'))return;
    if(event.key==='Escape'){event.preventDefault();toggleMenu(false);}
    if(event.key==='Tab'){
      const nodes=[...sidebar.querySelectorAll('a,button,input,summary')].filter(el=>!el.hidden&&el.getClientRects().length);
      const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  matchMedia('(max-width:700px)').addEventListener('change',event=>{if(!event.matches)toggleMenu(false,false);});
  function imageFallbacks(){
    document.querySelectorAll('img[data-portrait]').forEach(img=>img.addEventListener('error',()=>{
      img.hidden=true;const message=document.createElement('span');message.className='portrait-error';
      message.textContent='Anteprima non disponibile';img.parentElement.append(message);
    },{once:true}));
  }
  let previews,gallery;
  if(page==='roster'){
    document.querySelectorAll('[data-total]').forEach(el=>el.textContent=characters.length);
    $('#character-grid').innerHTML=characters.map((c,i)=>`<a class="character-card" data-character="${escape(c.id)}" href="${href(c)}" aria-label="Esplora le animazioni di ${escape(c.name)}"><div class="card-portrait"><span class="card-number" aria-hidden="true">${number(i+1)} / ${number(characters.length)}</span><img data-portrait src="${escape(c.thumbnail)}" alt="${escape(c.name)}, posa idle" width="512" height="512" loading="lazy" decoding="async"></div><div class="card-label"><div><h3>${escape(c.name)}</h3><p>${c.animations.length} animazioni disponibili</p></div><span class="card-arrow" aria-hidden="true">↗</span></div></a>`).join('');
    imageFallbacks();previews=MovesRoster.install($('#character-grid'),characters);
  }
  if(page==='character'){
    if(!selected){
      document.title='Personaggio non trovato · Sanmauro Fighters';
      $('#character-detail').innerHTML='<p class="empty-state">Personaggio non trovato. <a href="index.html">Torna al roster</a>.</p>';
    }else{
      document.title=selected.name+' · Animazioni · Sanmauro Fighters';$('#breadcrumb-name').textContent=selected.name;
      const index=characters.indexOf(selected);
      const pager=(c,direction)=>c?`<a class="icon-button" href="${href(c)}" aria-label="${direction==='←'?'Precedente':'Successivo'}: ${escape(c.name)}">${direction}</a>`:`<span class="icon-button pager-disabled" aria-hidden="true">${direction}</span>`;
      $('#character-detail').innerHTML=`<a class="back-link" href="index.html">← Torna al roster</a><section class="detail-heading"><div class="detail-identity"><img class="detail-portrait" data-portrait src="${escape(selected.portrait ?? selected.thumbnail)}" alt="" width="100" height="100"><div class="detail-name"><p class="eyebrow">PERSONAGGIO ${number(index+1)} / ${number(characters.length)}</p><h1>${escape(selected.name.toUpperCase())}<span class="accent">.</span></h1><p class="intro">Esplora le mosse, osserva ogni frame.</p></div></div><nav class="character-pager" aria-label="Personaggio precedente e successivo">${pager(characters[index-1],'←')}${pager(characters[index+1],'→')}</nav></section><div id="animation-gallery"></div>`;
      imageFallbacks();gallery=MovesGallery.install($('#animation-gallery'),selected,{highlightId:params.get('anim')});
    }
  }
  function renderMove(query=''){
    if(!currentMove)return;
    gallery?.destroy();
    const filtered={...currentMove,animations:currentMove.animations.filter(a=>fold(a.characterName).includes(fold(query)))};
    const container=$('#move-gallery');
    $('#move-visible-count').textContent=filtered.animations.length;$('#move-empty').hidden=filtered.animations.length>0;
    container.hidden=filtered.animations.length===0;
    if(!filtered.animations.length){container.innerHTML='';gallery=null;return;}
    gallery=MovesGallery.install(container,filtered,{title:currentMove.name+' · Personaggi',description:'Controlla ogni personaggio oppure riproduci tutte le anteprime.'});
  }
  if(page==='moves'){
    if(!currentMove){
      document.title='Mossa non trovata · Sanmauro Fighters';
      $('#main').innerHTML='<p class="empty-state">Mossa non trovata. <a href="mosse.html?move=walk">Apri Camminata</a>.</p>';
    }else{
      document.title=currentMove.name+' · Per mossa · Sanmauro Fighters';
      $('#breadcrumb-name').textContent=currentMove.name;$('#move-name').textContent=currentMove.name;
      const reportPath=['jump','crouch','light-punch','medium-punch','heavy-punch'].includes(currentMove.id)||currentMove.id.startsWith('block-')||currentMove.id.startsWith('hurt-')||currentMove.animations.some(a=>a.remainingImport)?'reports/'+currentMove.id+'-timing.html':null;
      $('#move-report').hidden=!reportPath;
      if(reportPath){$('#move-report-link').href=reportPath;$('#move-report-link').textContent='Apri il report: '+currentMove.name+' →';}
      $('#move-total-count').textContent=currentMove.animations.length;renderMove();
    }
  }
  function filter(){
    const query=$('#character-search').value.trim();
    const matches=new Set(characters.filter(c=>fold(c.name).includes(fold(query))).map(c=>c.id));
    document.querySelectorAll('[data-character]').forEach(el=>el.hidden=!matches.has(el.dataset.character));
    $('#nav-count').textContent=matches.size;$('.nav-empty').hidden=matches.size>0;previews?.refresh();
    if(page==='roster'){$('#visible-count').textContent=matches.size;$('#empty-state').hidden=matches.size>0;}
    if(page==='moves')renderMove(query);
  }
  $('#character-search').addEventListener('input',filter);
  if(page==='roster')filter();
  window.addEventListener('pagehide',()=>{gallery?.destroy();previews?.stop();});
})();
