(function () {
  'use strict';
  const topics = window.JAVA_TOPICS;
  const core = window.JavaCore;
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icons = {
    home:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    book:'<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/>',
    bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
    chart:'<path d="M4 3v17h17M8 15v-4m5 4V6m5 9v-7"/>',
    folder:'<path d="M3 7V4h6l3 3h9v13H3V7Z"/>',
    settings:'<path d="m9 3-1 3-3 1-2 4 2 3v4l4 2 3-1 4 1 3-3-1-4 2-3-2-4-4-1-2-2Z"/><circle cx="11" cy="12" r="3"/>',
    chevron:'<path d="m9 5 7 7-7 7"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    spark:'<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.code}</svg>`;
  const pct = (n,d) => d ? Math.round(n/d*100) : 0;
  const number = n => n.toLocaleString('it-IT');
  const time = ms => { const sec = Math.max(0,Math.ceil(ms/1000)); return `${Math.floor(sec/60).toString().padStart(2,'0')}:${(sec%60).toString().padStart(2,'0')}`; };
  const date = iso => new Date(iso).toLocaleDateString('it-IT', {day:'numeric',month:'short',year:'numeric'});
  const questionMap = new Map(topics.flatMap(t=>t.questions.map(q=>[q.id,{q,topic:t}])));
  const KEY = 'java-passo-passo-v1';
  function read(storage,key,fallback) {try {const value = storage.getItem(key); return value ? JSON.parse(value) : fallback;} catch {return fallback;}}
  let storageWarning = false;
  function write(storage,key,value) {try {storage.setItem(key,JSON.stringify(value)); return true;} catch {if(!storageWarning){storageWarning=true; toast('Il browser non permette di salvare i progressi. Scarica il resoconto prima di chiudere.');} return false;}}
  let saved = read(localStorage,KEY,{});
  let state = {nickname:typeof saved.nickname === 'string' ? saved.nickname : '', history:Array.isArray(saved.history) ? saved.history.filter(r=>r && Array.isArray(r.details) && Array.isArray(r.topics)).slice(-30) : [], lessons:Array.isArray(saved.lessons) ? saved.lessons : []};
  let session = read(localStorage,KEY+'-active',null);
  if(session && (!Array.isArray(session.deck) || !session.deck.length || !session.answers || session.deck.some(d=>!questionMap.has(d.id) || !Array.isArray(d.order)) || !Number.isInteger(session.index) || session.index<0 || session.index>=session.deck.length)) session=null;
  let discord = read(sessionStorage,KEY+'-discord',{url:'',enabled:false});
  let notifications = read(sessionStorage,KEY+'-outbox',[]);
  if(!Array.isArray(notifications)) notifications=[];
  let delivering=false;
  let timer=null;
  let setup = {ids:topics.map(t=>t.id),minutes:10,kind:'tutti',retry:false};
  let lessonIndex=0;
  let toastTimer;
  function toast(message) {$('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,6500);}
  function save() {write(localStorage,KEY,state);}
  function saveSession() {write(localStorage,KEY+'-active',session);}
  function profile() {$('#profile-name').textContent=state.nickname || 'Studente'; $('#avatar').textContent=(state.nickname || 'S').slice(0,1).toUpperCase();}
  function hydrate() {document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
  function show(html,nav) {
    $('#main').innerHTML=html;
    document.querySelectorAll('[data-nav]').forEach(a=>{a.classList.toggle('active',a.dataset.nav===nav); if(a.dataset.nav===nav)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    hydrate(); profile();
    window.scrollTo({top:0,behavior:'instant'});
    $('#main').focus({preventScroll:true});
  }
  function go(hash) {if(location.hash===hash) route(); else location.hash=hash;}
  function heading(eyebrow,title,description,extra='') {return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div>${extra}</div>`;}
  function cumulative() {
    const totals={correct:0,wrong:0,omitted:0,total:0};
    state.history.forEach(r=>['correct','wrong','omitted','total'].forEach(k=>totals[k]+=r[k]));
    return totals;
  }
  function topicTotals(id) {let total=0,correct=0,wrong=0,omitted=0; state.history.forEach(r=>{const row=r.topics.find(t=>t.id===id); if(row){total+=row.total;correct+=row.correct;wrong+=row.wrong;omitted+=row.omitted;}});return {total,correct,wrong,omitted};}
  function missedIds() {const latest=new Map(); state.history.forEach(r=>r.details.forEach(d=>latest.set(d.id,d.status)));return [...latest].filter(([,status])=>status!=='corretta').map(([id])=>id);}
  function codeBlock(code,label='JAVA') {return `<div class="code-block"><div class="code-top"><span><i></i><i></i><i></i></span><span>${label}</span><button class="copy-button" data-action="copy-code" aria-label="Copia codice">Copia</button></div><pre><code>${esc(code)}</code></pre></div>`;}
  function topicCard(t,index) {
    const s=topicTotals(t.id), learned=state.lessons.includes(t.id);
    return `<article class="topic-card" style="--topic:${t.color}"><div class="topic-top"><span class="topic-icon">${icon(['code','book','code','target','bolt','clock','folder','code','info','book'][index%10])}</span><span class="pill ${learned?'success':'quiet'}">${learned?'Teoria letta':`${t.questions.length} domande`}</span></div><small class="module-number">MODULO ${String(index+1).padStart(2,'0')}</small><h3>${esc(t.title)}</h3><p>${esc(t.subtitle)}</p><div class="topic-progress"><span>${s.total?`${pct(s.correct,s.total)}% corrette · ${s.total} risposte`:'Il tuo prossimo passo'}</span><span>${icon('clock')} ${t.minutes} min di teoria</span></div><div class="thin-progress"><span style="width:${pct(s.correct,s.total)}%"></span></div><div class="card-actions"><a class="text-link" href="#lezione/${t.id}">Studia la teoria ${icon('arrow')}</a><button class="small-quiz" data-action="topic-quiz" data-id="${t.id}" aria-label="Quiz su ${esc(t.title)}">Quiz ${icon('chevron')}</button></div></article>`;
  }
  function home() {
    const s=cumulative(), last=state.history.at(-1), pending=missedIds().length;
    show(`${heading('PICCOLI PASSI, GRANDI PROGRESSI',`Ciao${state.nickname?', '+esc(state.nickname):''}, da dove iniziamo?`,'Il tuo spazio per capire Java. Una spiegazione, un esempio, una domanda alla volta.',`<a class="button secondary" href="#materiali">${icon('folder')} I tuoi PDF</a>`)}
      <section class="hero"><div class="hero-copy"><span class="pill hero-pill"><span class="status-dot"></span> IL TUO PERCORSO JAVA P1</span><h2>Non solo la risposta giusta.<br><em>Capisci il perché.</em></h2><p>Studia con esempi concreti, leggi il codice e mettiti alla prova. Ogni errore diventa un'occasione per imparare.</p><div class="hero-actions"><a href="#quiz" class="button primary">Inizia un quiz ${icon('arrow')}</a><a href="#studio" class="hero-text-link">Esplora la teoria</a></div><div class="hero-footnote">${icon('check')} Tutto in italiano <span>·</span> Al tuo ritmo <span>·</span> Anche da telefono</div></div><div class="hero-visual" aria-label="Esempio: imparare, provare e capire"><div class="floating-tag">${icon('spark')} Un errore in meno, un concetto in più.</div><div class="hero-editor"><div class="editor-title"><span><i></i><i></i><i></i></span> IlTuoProssimoPasso.java</div><pre><span class="line-no">1</span> <span class="syntax-purple">while</span> (stoImparando) {
<span class="line-no">2</span>     <span class="syntax-blue">prova</span>();
<span class="line-no">3</span>     <span class="syntax-blue">capisciGliErrori</span>();
<span class="line-no">4</span>     <span class="syntax-blue">faiUnPassoAvanti</span>();
<span class="line-no">5</span> }</pre><div class="editor-output"><span>✓</span> Il progresso si costruisce, una riga alla volta.</div></div><div class="visual-caption"><span class="mini-avatar">J</span> Il tuo prossimo «ah, ho capito!» è qui.</div></div></section>
      <section class="stat-grid" aria-label="I tuoi numeri"><div class="stat-card"><span class="stat-icon teal">${icon('book')}</span><div><span class="stat-value">${state.lessons.length}<small> / ${topics.length}</small></span><span class="stat-label">Argomenti letti</span></div></div><div class="stat-card"><span class="stat-icon violet">${icon('check')}</span><div><span class="stat-value">${s.total?`${pct(s.correct,s.total)}<small>%</small>`:'—'}</span><span class="stat-label">Risposte corrette</span></div></div><div class="stat-card"><span class="stat-icon orange">${icon('target')}</span><div><span class="stat-value">${state.history.length}</span><span class="stat-label">Quiz completati</span></div></div><div class="stat-card"><span class="stat-icon blue">${icon('chart')}</span><div><span class="stat-value">${last?last.grade.toFixed(1).replace('.',','):'—'}<small>${last?' / 10':''}</small></span><span class="stat-label">Ultimo voto</span></div></div></section>
      ${pending?`<div class="review-banner"><span>${icon('spark')} <strong>${pending} domande da rivedere.</strong> Riparti da quello che non era ancora chiaro.</span><button class="text-link" data-action="retry-errors">Ripassa gli errori ${icon('arrow')}</button></div>`:''}
      <div class="section-heading"><div><span class="eyebrow">COSTRUISCI LE TUE BASI</span><h2>Un argomento alla volta</h2><p>Prima capisci il concetto. Poi mettilo in pratica.</p></div><a class="text-link" href="#studio">Tutti i ${topics.length} argomenti ${icon('arrow')}</a></div><div class="topics-grid">${topics.slice(0,3).map(topicCard).join('')}</div>
      <section class="bottom-callout"><span class="stat-icon orange">${icon('bolt')}</span><div><h3>Vuoi vedere a che punto sei?</h3><p>Prova il quiz misto: argomenti diversi, un unico resoconto per orientare il ripasso.</p></div><button class="button secondary" data-action="mixed-quiz">Prova il quiz misto ${icon('arrow')}</button></section>`, 'home');
  }
  function studio() {
    show(`${heading('LEGGI. OSSERVA. PROVA.','Le basi, spiegate bene.','Dieci moduli dai tuoi PDF, con esempi commentati e un quiz alla fine di ogni lezione.')}<div class="info-strip">${icon('info')} Nessun blocco: puoi leggere o esercitarti nell'ordine che preferisci. Le domande combinano teoria, codice ed errori da riconoscere.</div><div class="topics-grid">${topics.map(topicCard).join('')}</div>`,'studio');
  }
  function lesson(id) {
    const t=topics.find(t=>t.id===id); if(!t){go('#studio');return;}
    lessonIndex=Math.max(0,Math.min(lessonIndex,t.sections.length-1));
    const section=t.sections[lessonIndex];
    show(`<a class="back-link" href="#studio">← Tutti gli argomenti</a>${heading(`MODULO ${String(topics.indexOf(t)+1).padStart(2,'0')} · ${t.minutes} MINUTI DI LETTURA`,esc(t.title),esc(t.subtitle))}<div class="lesson-layout"><aside class="lesson-nav"><span class="eyebrow">IN QUESTA LEZIONE</span>${t.sections.map((sec,i)=>`<button data-action="lesson-step" data-step="${i}" class="${i===lessonIndex?'active':''}"><span>${String(i+1).padStart(2,'0')}</span>${esc(sec.title)}</button>`).join('')}<small>${esc(t.source)}</small></aside><article class="lesson-card"><span class="pill quiet">${lessonIndex+1} di ${t.sections.length} · TEORIA + PRATICA</span><h2>${esc(section.title)}</h2><p class="lesson-text">${esc(section.text)}</p>${section.code?codeBlock(section.code):''}${section.steps?.length?`<h3>Guardiamolo da vicino</h3><ol class="explanation-steps">${section.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`:''}${section.tip?`<div class="tip-box">${icon('spark')}<div><strong>Da ricordare</strong><p>${esc(section.tip)}</p></div></div>`:''}<div class="lesson-actions"><button class="button secondary" data-action="lesson-step" data-step="${lessonIndex-1}" ${lessonIndex===0?'disabled':''}>← Precedente</button>${lessonIndex<t.sections.length-1?`<button class="button primary" data-action="lesson-step" data-step="${lessonIndex+1}">Continua ${icon('arrow')}</button>`:`<button class="button primary" data-action="lesson-done" data-id="${t.id}">Ho capito, provo il quiz ${icon('arrow')}</button>`}</div><p class="field-help">I frammenti mostrano il concetto: salvo indicazione diversa, le istruzioni vanno nel main. Il sito non è un compilatore Java.</p></article></div>`, 'studio');
  }
  function availableCount() {const ids=setup.retry?new Set(missedIds()):null; return topics.filter(t=>setup.ids.includes(t.id)).flatMap(t=>t.questions).filter(q=>(!ids||ids.has(q.id)) && (setup.kind==='tutti' || (setup.kind==='teoria'?q.type==='teoria':q.type!=='teoria'))).length;}
  function plannedCount() {return Math.min(Math.max(1,Math.floor(setup.minutes*60/75)),availableCount());}
  function setupView() {
    const count=plannedCount();
    show(`${heading('IL TUO ALLENAMENTO, AL TUO RITMO',setup.retry?'Riparti dai tuoi errori.':'Come vuoi metterti alla prova?',setup.retry?'Rivedi solo le domande sbagliate o lasciate in bianco, finché diventano chiare.':'Scegli cosa ripassare e quanto tempo hai. Al numero di domande pensiamo noi.')}<div class="quiz-setup-layout"><form id="quiz-form" class="panel"><div class="form-step"><span class="step-number">1</span><div><h2>Scegli gli argomenti</h2><p>Selezionali tutti per una simulazione mista.</p></div><button type="button" class="text-link" data-action="select-all">${setup.ids.length===topics.length?'Deseleziona tutti':'Seleziona tutti'}</button></div><div class="topic-checkbox-grid">${topics.map((t,i)=>`<label class="topic-choice"><input type="checkbox" name="topic" value="${t.id}" ${setup.ids.includes(t.id)?'checked':''}><span><strong>${String(i+1).padStart(2,'0')} · ${esc(t.title)}</strong><small>${esc(t.subtitle)}</small></span></label>`).join('')}</div><div class="form-step"><span class="step-number">2</span><div><h2>Quanto tempo hai?</h2><p>Circa 75 secondi per domanda. Il tempo si ferma durante le spiegazioni.</p></div></div><div class="time-choices">${[5,10,15,30,45].map(n=>`<label><input type="radio" name="minutes" value="${n}" ${setup.minutes===n?'checked':''}><span>${n}<small>minuti</small></span></label>`).join('')}</div><div class="form-step"><span class="step-number">3</span><div><h2>Che tipo di domande?</h2></div></div><div class="kind-choices">${[['tutti','Un po’ di tutto'],['codice','Leggo e correggo il codice'],['teoria','Consolidiamo la teoria']].map(([value,label])=>`<label><input type="radio" name="kind" value="${value}" ${setup.kind===value?'checked':''}><span>${label}</span></label>`).join('')}</div>${setup.retry?'<button type="button" class="text-link" data-action="normal-quiz">Torna alla banca completa</button>':''}</form><aside class="setup-summary panel"><span class="eyebrow">IL TUO QUIZ</span><div class="summary-illustration">${icon('bolt')}</div><h2><span id="planned-count">${count}</span> domande,<br>un passo avanti.</h2><dl><div><dt>Argomenti selezionati</dt><dd id="planned-topics">${setup.ids.length}</dd></div><div><dt>Tempo per rispondere</dt><dd id="planned-time">${setup.minutes} min</dd></div><div><dt>Domande disponibili</dt><dd id="available-count">${availableCount()}</dd></div></dl><div class="summary-note">${icon('check')} Correzione subito dopo ogni risposta<br>${icon('check')} Voto in decimi e analisi finale<br>${icon('check')} Esempi e ripasso personalizzato</div><p id="coverage-note" class="field-help">${coverageNote()}</p><button class="button primary full" type="submit" form="quiz-form" id="begin-quiz" ${count===0?'disabled':''}>Cominciamo ${icon('arrow')}</button><p class="field-help centered">Nessuna penalità aggiuntiva per gli errori.<br>Le risposte omesse valgono zero.</p></aside></div>`, 'quiz');
  }
  function coverageNote() {return plannedCount()<setup.ids.length?'In questo tempo non entrano tutti gli argomenti: ne verrà estratto un sottoinsieme. Per coprire 10 argomenti scegli almeno 15 minuti.':'Le domande vengono distribuite tra gli argomenti selezionati con domande disponibili.';}
  function updateSetup() {
    const f=$('#quiz-form'); if(!f)return;
    setup.ids=[...f.querySelectorAll('[name="topic"]:checked')].map(x=>x.value);
    setup.minutes=Number(f.querySelector('[name="minutes"]:checked').value);
    setup.kind=f.querySelector('[name="kind"]:checked').value;
    $('#planned-count').textContent=plannedCount();$('#planned-topics').textContent=setup.ids.length;$('#planned-time').textContent=setup.minutes+' min';$('#available-count').textContent=availableCount();$('#coverage-note').textContent=coverageNote();$('#begin-quiz').disabled=plannedCount()===0;
    const select=$('[data-action="select-all"]');if(select)select.textContent=setup.ids.length===topics.length?'Deseleziona tutti':'Seleziona tutti';
  }
  function startQuiz() {
    updateSetup();
    const seen=state.history.flatMap(r=>r.details.map(d=>d.id));
    const deck=core.selectQuestions(topics,setup.ids,plannedCount(),setup.kind,seen,setup.retry?missedIds():null);
    if(!deck.length){toast('Seleziona almeno un argomento con domande disponibili.');return;}
    session={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),nickname:state.nickname || 'Studente',deck,answers:{},index:0,feedback:false,minutes:setup.minutes,remainingMs:setup.minutes*60000,deadline:Date.now()+setup.minutes*60000,label:setup.retry?'Ripasso errori':setup.ids.length===1?topics.find(t=>t.id===setup.ids[0]).title:'Quiz misto',selectedTopics:[...setup.ids],startedAt:Date.now()};
    saveSession();go('#sessione');
  }
  function remaining() {return session.feedback?session.remainingMs:Math.max(0,session.deadline-Date.now());}
  function timerStart() {
    clearInterval(timer);
    timer=setInterval(()=>{
      if(!session)return;
      const node=$('#timer');if(node){node.textContent=time(remaining());node.classList.toggle('urgent',remaining()<60000);}
      if(!session.feedback && remaining()<=0) finish('tempo scaduto');
    },500);
  }
  function feedback(q,answer) {
    const good=answer===q.answer, missed=answer===null;
    return `<section class="feedback ${good?'correct':'incorrect'}" aria-labelledby="feedback-title-${esc(q.id)}"><div class="feedback-heading"><span class="feedback-symbol">${good?'✓':missed?'–':'!'}</span><div><span class="eyebrow">${good?'BEN FATTO':'UN’OCCASIONE PER CAPIRE'}</span><h2 id="feedback-title-${esc(q.id)}">${good?'Esatto! Ecco perché.':missed?'L’hai lasciata in bianco. Vediamola insieme.':'Non ancora. Facciamo chiarezza.'}</h2></div></div>${!good?`<div class="answer-comparison"><div><span>LA TUA RISPOSTA</span><p>${missed?'Non risposta':esc(q.options[answer])}</p></div><div><span>RISPOSTA CORRETTA</span><p>${esc(q.options[q.answer])}</p></div></div>`:''}<p>${esc(q.explanation)}</p>${!good && !missed?`<div class="why-box"><strong>Perché la tua risposta non funziona</strong><p>${esc(q.optionExplanations[answer])}</p></div>`:''}<h3>Il ragionamento, passo passo</h3><ol class="explanation-steps">${q.steps.map(step=>`<li>${esc(step)}</li>`).join('')}</ol>${q.trace?`<div class="table-scroll"><table class="trace-table"><caption>Segui i valori durante l'esecuzione</caption><thead><tr>${q.trace.headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${q.trace.rows.map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}<details class="distractors"><summary>Capisci anche le altre alternative</summary>${q.options.map((option,i)=>`<div><strong>${esc(option)} ${i===q.answer?'✓':''}</strong><p>${esc(q.optionExplanations[i])}</p></div>`).join('')}</details><div class="tip-box">${icon('spark')}<div><strong>Porta con te questa regola</strong><p>${esc(q.tip)}</p></div></div></section>`;
  }
  function quizView() {
    if(!session){go('#quiz');return;}
    if(!session.feedback && remaining()<=0){finish('tempo scaduto');return;}
    const item=session.deck[session.index],{q,topic}=questionMap.get(item.id),chosen=session.answers[q.id];
    const answered=Object.keys(session.answers).length, correct=Object.entries(session.answers).filter(([id,a])=>a===questionMap.get(id)?.q.answer).length;
    show(`<div class="session-top"><div><span class="eyebrow">${esc(session.label)}</span><h1>Una domanda alla volta.</h1></div><button class="button secondary" data-action="end-quiz">Termina e correggi</button></div><div class="session-meta"><span>Domanda <strong>${session.index+1}</strong> di ${session.deck.length}</span><span>${correct} corrette su ${answered} risposte</span><span class="timer-wrap">${icon('clock')} <strong id="timer" role="timer" aria-label="Tempo rimanente">${time(remaining())}</strong><small>${session.feedback?'in pausa':'rimanenti'}</small></span></div><div class="quiz-progress" role="progressbar" aria-label="Avanzamento quiz" aria-valuemin="0" aria-valuemax="${session.deck.length}" aria-valuenow="${answered}"><span style="width:${pct(answered,session.deck.length)}%"></span></div><article class="question-card"><div class="question-badges"><span class="pill quiet">${esc(topic.title)}</span><span class="pill ${q.type==='teoria'?'violet':'blue'}">${q.type==='teoria'?'Concetti e teoria':q.type==='debug'?'Trova l’errore':'Comprendi il codice'}</span></div><h2>${esc(q.prompt)}</h2>${q.code?codeBlock(q.code):''}<div class="answer-options" role="group" aria-label="Scegli una risposta">${item.order.map((index,i)=>`<button class="answer-option ${session.feedback?(index===q.answer?'is-correct':index===chosen?'is-wrong':'dimmed'):''}" data-action="answer" data-answer="${index}" ${session.feedback?'disabled':''}><span class="option-letter">${String.fromCharCode(65+i)}</span><span class="option-text">${esc(q.options[index])}</span>${session.feedback&&index===q.answer?'<span class="option-mark">✓</span>':session.feedback&&index===chosen?'<span class="option-mark">×</span>':''}</button>`).join('')}</div>${session.feedback?'':`<div class="question-bottom"><span>${icon('info')} Scegli una risposta per vedere la spiegazione.</span><button class="text-link" data-action="skip">Non lo so, spiegamelo →</button></div>`}</article>${session.feedback?feedback(q,chosen)+`<div class="after-feedback"><span>${icon('clock')} Prenditi il tempo per capire: il timer è in pausa.</span><button class="button primary" data-action="next">${session.index===session.deck.length-1?'Vedi il risultato':'Prossima domanda'} ${icon('arrow')}</button></div>`:''}`, 'quiz');
    timerStart();
  }
  function answer(index) {
    if(!session || session.feedback)return;
    if(remaining()<=0){finish('tempo scaduto');return;}
    const {q,topic}=questionMap.get(session.deck[session.index].id);
    session.remainingMs=remaining();session.feedback=true;session.answers[q.id]=index;saveSession();quizView();
    if(index!==null && index!==q.answer) queueNotification('error-'+session.id+'-'+q.id,{
      content:[`📘 Java P1 · Risposta da rivedere`,`Studente: ${session.nickname}`,`Argomento: ${topic.title}`,`Domanda ${session.index+1}/${session.deck.length} · ${q.id}`,q.prompt,q.code?'Codice:\n'+q.code:'',`Risposta: ${q.options[index]}`,`Corretta: ${q.options[q.answer]}`,`Perché: ${q.optionExplanations[index]}`,`Risultato provvisorio: ${Object.entries(session.answers).filter(([id,a])=>a===questionMap.get(id)?.q.answer).length}/${Object.keys(session.answers).length} corrette (non è il voto finale).`].filter(Boolean).join('\n').slice(0,1950),allowed_mentions:{parse:[]}});
  }
  function next() {
    if(!session?.feedback)return;
    if(session.index===session.deck.length-1){finish('completato');return;}
    session.index++;session.feedback=false;session.deadline=Date.now()+session.remainingMs;saveSession();quizView();
  }
  function finish(reason) {
    if(!session)return;
    clearInterval(timer);
    session.elapsedSeconds=Math.round((session.minutes*60000-remaining())/1000);session.finishReason=reason;
    const report=core.summarize(session,topics);
    state.history.push(report);state.history=state.history.slice(-30);save();session=null;saveSession();
    if(report.wrong || report.omitted || discord.enabled) queueNotification('result-'+report.id,{content:`📊 Java P1 · ${report.nickname}\n${report.mode} · Voto ${report.grade.toFixed(1)}/10\n${report.correct}/${report.total} corrette · ${report.wrong} errate · ${report.omitted} omesse.\nIl file allegato contiene argomenti, domande, risposte e spiegazioni.`,allowed_mentions:{parse:[]}},report);
    go('#risultato/'+report.id);
  }
  function donut(r) {
    const good=r.percentage, bad=r.wrong/r.total*100;
    return `<div class="donut" style="--good:${good}%;--wrong:${good+bad}%" role="img" aria-label="${r.correct} corrette, ${r.wrong} errate, ${r.omitted} omesse su ${r.total}"><div><strong>${Math.round(good)}<small>%</small></strong><span>corrette</span></div></div>`;
  }
  function notificationStatus() {
    if(!discord.enabled)return 'Invio Discord disattivato. Puoi attivarlo dalle impostazioni del tutor.';
    const failed=notifications.filter(n=>n.status==='failed').length,waiting=notifications.filter(n=>n.status==='pending').length;
    return failed?`${failed} invii non riusciti. Il quiz è salvato: controlla la connessione e riprova.`:waiting?`${waiting} resoconti in attesa di invio…`:notifications.some(n=>n.status==='sent')?'Invii completati: Discord ha confermato la ricezione dei resoconti in coda.':'Invio attivo: i prossimi errori e risultati saranno inviati al tutor.';
  }
  function reportView(id) {
    const r=state.history.find(r=>r.id===id);if(!r){go('#progressi');return;}
    const weak=[...r.topics].filter(t=>t.wrong+t.omitted).sort((a,b)=>(b.wrong+b.omitted)/b.total-(a.wrong+a.omitted)/a.total);
    const untested=topics.filter(t=>!r.topics.some(row=>row.id===t.id));
    show(`${heading('IL RISULTATO È SOLO L’INIZIO',r.grade>=6?'Un altro passo avanti.':'Ora sai da dove ripartire.',`${esc(r.mode)} · ${date(r.date)} · ${r.total} domande · ${esc(r.reason)}`,`<button class="button secondary" data-action="download" data-id="${r.id}">${icon('download')} Scarica resoconto</button>`)}<div class="result-overview panel"><div class="grade-block"><span class="eyebrow">IL TUO VOTO</span><div class="grade">${r.grade.toFixed(1).replace('.',',')}<small>/10</small></div><span class="pill ${r.grade>=6?'success':'orange'}">${r.grade>=9?'Ottimo lavoro':r.grade>=8?'Molto bene':r.grade>=7?'Buon risultato':r.grade>=6?'Sufficienza raggiunta':'Da consolidare'}</span><p>Voto = corrette ÷ domande × 10, minimo 1.<br>La sufficienza è 6/10. Ogni domanda ha lo stesso peso.</p></div><div class="result-chart">${donut(r)}<div class="chart-legend"><span><i class="legend-dot green"></i><strong>${r.correct}</strong> corrette <small>${pct(r.correct,r.total)}%</small></span><span><i class="legend-dot red"></i><strong>${r.wrong}</strong> errate <small>${pct(r.wrong,r.total)}%</small></span><span><i class="legend-dot gray"></i><strong>${r.omitted}</strong> omesse <small>${pct(r.omitted,r.total)}%</small></span></div></div></div><div class="result-columns"><section class="panel"><div class="section-heading"><div><span class="eyebrow">DOVE SEI ARRIVATO</span><h2>Argomento per argomento</h2></div></div><p class="muted">Barre: risposte corrette, errate e omesse sul totale di quell'argomento. Anche una sola domanda conta: non è una valutazione definitiva.</p>${r.topics.map(t=>`<div class="analysis-row"><div><strong>${esc(t.title)}</strong><span>${t.correct}/${t.total} corrette · ${pct(t.wrong,t.total)}% errori${t.omitted?` · ${pct(t.omitted,t.total)}% omesse`:''}</span></div><div class="stacked-bar" role="img" aria-label="${esc(t.title)}: ${t.correct} corrette, ${t.wrong} errate, ${t.omitted} omesse"><span class="green" style="width:${t.correct/t.total*100}%"></span><span class="red" style="width:${t.wrong/t.total*100}%"></span><span class="gray" style="width:${t.omitted/t.total*100}%"></span></div></div>`).join('')}<div class="inline-legend"><span><i class="legend-dot green"></i> Corrette</span><span><i class="legend-dot red"></i> Errate</span><span><i class="legend-dot gray"></i> Omesse</span></div></section><section class="panel study-plan"><span class="eyebrow">IL TUO PROSSIMO PASSO</span><h2>Cosa ripassare adesso</h2>${weak.length?weak.map((t,i)=>`<a class="study-plan-item" href="#lezione/${t.id}"><span class="step-number">${i+1}</span><div><strong>${esc(t.title)}</strong><p>${t.wrong} errate e ${t.omitted} omesse su ${t.total}. ${esc(topics.find(x=>x.id===t.id)?.sections[0]?.tip || 'Rileggi gli esempi e segui i valori una riga alla volta.')}</p></div>${icon('arrow')}</a>`).join(''):'<div class="tip-box">'+icon('spark')+'<p>Tutte corrette! Prova altre domande o spiega il ragionamento a voce senza guardare le risposte.</p></div>'}${untested.length?`<p class="field-help">Non valutati in questo quiz: ${untested.map(t=>esc(t.title)).join(', ')}. Per capire il tuo livello su questi argomenti serve un altro quiz.</p>`:''}<button class="button primary full" data-action="retry-report" data-id="${r.id}" ${weak.length?'':'disabled'}>Riprova queste domande ${icon('arrow')}</button></section></div><section class="panel correction-list"><span class="eyebrow">IL PERCHÉ DI OGNI RISPOSTA</span><h2>Rivediamo il quiz, insieme.</h2><p class="muted">Apri una domanda per rileggere codice, soluzione, ragionamento e alternative.</p>${r.details.map((d,i)=>{const entry=questionMap.get(d.id);return `<details class="review-question"><summary><span class="review-status ${d.status}">${d.status==='corretta'?'✓':d.status==='errata'?'×':'–'}</span><span><small>${i+1} · ${esc(d.topic)} · ${d.status==='omessa'?'Non risposta':d.status==='errata'?'Da rivedere':'Corretta'}</small><strong>${esc(d.prompt)}</strong></span>${icon('chevron')}</summary><div class="review-body">${d.code?codeBlock(d.code):''}${entry?feedback(entry.q,d.status==='omessa'?null:entry.q.options.indexOf(d.selected)):''}<a class="text-link" href="#lezione/${d.topicId}">Ripassa la lezione ${icon('arrow')}</a></div></details>`;}).join('')}</section><div class="discord-status panel"><span>${icon('info')} <span id="delivery-status" role="status">${esc(notificationStatus())}</span></span><button class="text-link" data-action="retry-discord">Riprova invii falliti</button></div><div class="result-actions"><a class="button secondary" href="#progressi">Guarda i progressi</a><a class="button primary" href="#quiz">Un nuovo quiz ${icon('arrow')}</a></div>`, 'progressi');
  }
  function progressView() {
    const s=cumulative();
    show(`${heading('RENDI VISIBILI I TUOI PROGRESSI','Ogni tentativo conta.','Statistiche degli ultimi 30 quiz salvati in questo browser. Confronta, ripassa e riprova.')}<div class="stat-grid"><div class="stat-card"><span class="stat-icon teal">${icon('target')}</span><div><span class="stat-value">${s.total}</span><span class="stat-label">Domande affrontate</span></div></div><div class="stat-card"><span class="stat-icon violet">${icon('check')}</span><div><span class="stat-value">${pct(s.correct,s.total)}<small>%</small></span><span class="stat-label">Corrette sul totale</span></div></div><div class="stat-card"><span class="stat-icon orange">${icon('info')}</span><div><span class="stat-value">${pct(s.wrong,s.total)}<small>%</small></span><span class="stat-label">Errori sul totale</span></div></div><div class="stat-card"><span class="stat-icon blue">${icon('clock')}</span><div><span class="stat-value">${pct(s.omitted,s.total)}<small>%</small></span><span class="stat-label">Omesse sul totale</span></div></div></div>${!state.history.length?`<section class="panel empty-state"><span class="stat-icon teal">${icon('chart')}</span><h2>Il tuo percorso comincia dal primo quiz.</h2><p>Qui vedrai voti, errori e argomenti da approfondire. Nessun confronto con gli altri: solo i tuoi progressi.</p><a class="button primary" href="#quiz">Fai il primo quiz ${icon('arrow')}</a></section>`:`<section class="panel"><div class="section-heading"><div><span class="eyebrow">UN TENTATIVO DOPO L’ALTRO</span><h2>Come stanno andando i tuoi quiz?</h2></div><button class="button secondary" data-action="retry-errors">Ripassa gli errori ${icon('arrow')}</button></div><p class="muted">Ultimi 12 voti, in ordine cronologico. Quiz con argomenti o quantità di domande diversi non sono direttamente confrontabili.</p><div class="history-chart" role="img" aria-label="Voti degli ultimi quiz: ${state.history.slice(-12).map(r=>r.grade+'/10').join(', ')}">${state.history.slice(-12).map((r,i)=>`<a href="#risultato/${r.id}" class="history-column" aria-label="Quiz ${i+1}, voto ${r.grade}/10"><strong>${r.grade.toFixed(1).replace('.',',')}</strong><div class="history-track"><span style="height:${r.grade*10}%" class="${r.grade<6?'low':''}"></span></div><small>${new Date(r.date).toLocaleDateString('it-IT',{day:'numeric',month:'numeric'})}</small></a>`).join('')}</div></section><section class="panel history-list"><div class="section-heading"><h2>Il tuo diario dei quiz</h2><button class="text-link danger-text" data-action="reset">Azzera progressi</button></div>${[...state.history].reverse().map(r=>`<a class="history-row" href="#risultato/${r.id}"><span class="history-grade ${r.grade>=6?'passed':''}">${r.grade.toFixed(1).replace('.',',')}<small>/10</small></span><div><strong>${esc(r.mode)}</strong><small>${date(r.date)} · ${r.correct}/${r.total} corrette · ${r.wrong} errate · ${r.omitted} omesse</small></div>${icon('chevron')}</a>`).join('')}</section>`}`, 'progressi');
  }
  function materials() {
    show(`${heading('I TUOI APPUNTI, SEMPRE A PORTATA DI MANO','Torna alle fonti.','Le dispense originali affiancano lezioni e quiz. Aprile nel browser o scaricale per studiare offline.')}<div class="materials-grid">${[{title:'Java P1',file:'JAVA-P1.pdf',tag:'DISPENSA DEL CORSO',description:'Il materiale originale: caratteristiche di Java, sintassi, input, operatori, selezione, cicli, array, metodi ed eccezioni.',pages:35},{title:'Riassunto, studio ed esercizi',file:'Java-P1-Riassunto.pdf',tag:'RIPASSO GUIDATO',description:'La scheda di studio con esempi, trucchi di memoria, esercizi e soluzioni. Prova gli esercizi prima di leggere le correzioni.',pages:12}].map(m=>`<article class="panel material-card"><div class="pdf-cover"><span>JAVA P1</span>${icon('book')}<small>${m.pages} PAGINE · PDF</small></div><span class="eyebrow">${m.tag}</span><h2>${m.title}</h2><p>${m.description}</p><div class="material-actions"><a class="button primary" href="./materiali/${m.file}" target="_blank" rel="noopener">Apri PDF ${icon('arrow')}</a><a class="button secondary" href="./materiali/${m.file}" download>${icon('download')} Scarica</a></div></article>`).join('')}</div><div class="tip-box source-note">${icon('info')}<div><strong>Una nota sugli esempi</strong><p>Le lezioni seguono gli argomenti delle dispense, correggendone i refusi: in Java i decimali usano il punto; Math appartiene a java.lang; Math.max confronta due valori alla volta; \\a e \\? non sono escape validi. Gli esempi usano la sintassi classica Java 21.</p></div></div><section class="panel method-card"><span class="eyebrow">UN METODO SEMPLICE</span><h2>10 minuti per capire, 3 per ricordare, 1 per provare.</h2><div class="method-grid"><div><span>01</span><h3>Leggi e osserva</h3><p>Studia una sezione. Segui il codice e scrivi i valori delle variabili su un foglio.</p></div><div><span>02</span><h3>Chiudi e racconta</h3><p>Spiega il concetto a voce con parole tue. Se ti blocchi, torna all'esempio.</p></div><div><span>03</span><h3>Prova e correggi</h3><p>Fai il quiz. Prima di continuare, spiega perché le alternative sbagliate non funzionano.</p></div></div></section>`, 'materiali');
  }
  function queueNotification(id,payload,report=null) {
    if(!discord.enabled || !discord.url)return;
    if(notifications.some(n=>n.id===id))return;
    notifications.push({id,payload,report,status:'pending'});notifications=notifications.slice(-150);write(sessionStorage,KEY+'-outbox',notifications);deliver();
  }
  async function deliver() {
    if(delivering || !discord.enabled || !validWebhook(discord.url))return;
    delivering=true;
    try {
      while(discord.enabled && validWebhook(discord.url)) {
        const item=notifications.find(n=>n.status==='pending');
        if(!item)break;
        try {
          const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
          let response;
          try {
            const target=new URL(discord.url);target.searchParams.set('wait','true');
            if(item.report) {
              const form=new FormData();form.append('payload_json',JSON.stringify(item.payload));form.append('files[0]',new Blob([JSON.stringify(item.report,null,2)],{type:'application/json'}),'java-p1-resoconto.json');
              response=await fetch(target.href,{method:'POST',body:form,signal:controller.signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
            } else response=await fetch(target.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item.payload),signal:controller.signal,credentials:'omit',redirect:'error',referrerPolicy:'no-referrer'});
          } finally {clearTimeout(timeout);}
          if(!response.ok) throw new Error('Invio non confermato');
          item.status='sent'; item.report=null; item.payload={};
        } catch {item.status='failed'; toast('Un invio a Discord non è riuscito. Il quiz resta salvato; puoi riprovare dal risultato.');}
        write(sessionStorage,KEY+'-outbox',notifications);refreshDelivery();
        if(item.status==='failed')break;
        await new Promise(resolve=>setTimeout(resolve,600));
      }
    } finally {delivering=false;refreshDelivery();}
  }
  function refreshDelivery() {if($('#delivery-status'))$('#delivery-status').textContent=notificationStatus();}
  function validWebhook(value) {try {const url=new URL(value);return url.protocol==='https:' && ['discord.com','canary.discord.com','ptb.discord.com'].includes(url.hostname) && /^\/api(?:\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url.pathname) && !url.username && !url.password && !url.port && !url.search && !url.hash;}catch{return false;}}
  function openSettings() {$('#nickname').value=state.nickname;$('#webhook').value=discord.url;$('#discord-enabled').checked=discord.enabled;$('#settings-error').textContent='';$('#settings-dialog').showModal();}
  $('#settings-form').addEventListener('submit',e=>{e.preventDefault();const url=$('#webhook').value.trim(),enabled=$('#discord-enabled').checked;
    if((url || enabled)&&!validWebhook(url)){$('#settings-error').textContent='Inserisci un webhook HTTPS valido di discord.com o canary.discord.com, senza parametri aggiuntivi.';return;}
    state.nickname=$('#nickname').value.trim().slice(0,50);discord={url,enabled};save();write(sessionStorage,KEY+'-discord',discord);profile();$('#settings-dialog').close();toast('Impostazioni salvate.');if(!session)route();deliver();
  });
  document.addEventListener('change',e=>{if(e.target.closest('#quiz-form'))updateSetup();});
  document.addEventListener('submit',e=>{if(e.target.id==='quiz-form'){e.preventDefault();startQuiz();}});
  document.addEventListener('click',async e=>{
    const nav=e.target.closest('a[href^="#"]');
    if(nav && session && nav.getAttribute('href')!=='#sessione'){e.preventDefault();toast('Il quiz è in corso. Usa “Termina e correggi” per salvare il risultato prima di uscire.');return;}
    if(nav && nav.getAttribute('href').startsWith('#lezione/'))lessonIndex=0;
    const button=e.target.closest('[data-action]');if(!button || button.disabled)return;
    const action=button.dataset.action,id=button.dataset.id;
    if(action==='settings')openSettings();
    else if(action==='close-settings')$('#settings-dialog').close();
    else if(action==='topic-quiz' || action==='lesson-done'){if(action==='lesson-done'&&!state.lessons.includes(id)){state.lessons.push(id);save();} setup={...setup,ids:[id],retry:false};go('#quiz');}
    else if(action==='mixed-quiz'){setup={...setup,ids:topics.map(t=>t.id),kind:'tutti',retry:false};go('#quiz');}
    else if(action==='lesson-step'){lessonIndex=Number(button.dataset.step);lesson(location.hash.split('/')[1]);}
    else if(action==='select-all'){setup.ids=setup.ids.length===topics.length?[]:topics.map(t=>t.id);setupView();}
    else if(action==='normal-quiz'){setup.retry=false;setupView();}
    else if(action==='answer')answer(Number(button.dataset.answer));
    else if(action==='skip')answer(null);
    else if(action==='next')next();
    else if(action==='end-quiz'){if(confirm('Terminare il quiz? Le domande rimanenti saranno conteggiate come omesse.'))finish('interrotto');}
    else if(action==='copy-code'){try {await navigator.clipboard.writeText(button.closest('.code-block').querySelector('code').textContent);toast('Codice copiato.');}catch {toast('Copia non disponibile: seleziona il testo del codice.');}}
    else if(action==='retry-errors' || action==='retry-report'){
      const ids=action==='retry-report'?state.history.find(r=>r.id===id)?.details.filter(d=>d.status!=='corretta').map(d=>d.id):missedIds();
      if(!ids?.length){toast('Non ci sono errori da ripassare. Prova un nuovo quiz!');return;}
      if(action==='retry-report'){
        const deck=core.selectQuestions(topics,topics.map(t=>t.id),Math.min(ids.length,Math.floor(setup.minutes*60/75)),'tutti',[],ids);
        session={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),nickname:state.nickname||'Studente',deck,answers:{},index:0,feedback:false,minutes:setup.minutes,remainingMs:setup.minutes*60000,deadline:Date.now()+setup.minutes*60000,label:'Ripasso del quiz',startedAt:Date.now()};saveSession();go('#sessione');
      }else{setup={...setup,ids:topics.map(t=>t.id),kind:'tutti',retry:true};go('#quiz');}
    }
    else if(action==='download'){
      const report=state.history.find(r=>r.id===id);if(!report)return;
      const text=[`JAVA P1 — RESOCONTO QUIZ`,`Studente: ${report.nickname}`,`Data: ${date(report.date)}`,`Modalità: ${report.mode}`,`Voto: ${report.grade.toFixed(1)}/10 (minimo 1; corrette / totale × 10)`,`${report.correct}/${report.total} corrette · ${report.wrong} errate · ${report.omitted} omesse`,'',...report.topics.map(t=>`${t.title}: ${t.correct}/${t.total} corrette; ${pct(t.wrong,t.total)}% errori; ${pct(t.omitted,t.total)}% omesse`),'',...report.details.flatMap((d,i)=>[`${i+1}. [${d.status}] ${d.topic} — ${d.prompt}`,d.code,`Risposta: ${d.selected}`,`Corretta: ${d.expected}`,d.reason,d.explanation,...d.steps.map((s,j)=>`${j+1}) ${s}`),''])].join('\n');
      const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='Java-P1-resoconto-'+report.id.slice(0,8)+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    else if(action==='retry-discord'){if(!discord.enabled){openSettings();return;}notifications.forEach(n=>{if(n.status==='failed')n.status='pending';});write(sessionStorage,KEY+'-outbox',notifications);deliver();refreshDelivery();}
    else if(action==='reset'){if(confirm('Eliminare lo storico dei quiz e le lezioni lette da questo browser? Questa operazione non si può annullare.')){state.history=[];state.lessons=[];save();progressView();}}
  });
  function route() {
    const hash=location.hash || '#home';
    if(session && hash!=='#sessione'){history.replaceState(null,'','#sessione');quizView();return;}
    clearInterval(timer);
    if(hash==='#sessione')quizView();
    else if(hash==='#studio')studio();
    else if(hash.startsWith('#lezione/'))lesson(decodeURIComponent(hash.split('/')[1]));
    else if(hash==='#quiz')setupView();
    else if(hash==='#progressi')progressView();
    else if(hash==='#materiali')materials();
    else if(hash.startsWith('#risultato/'))reportView(hash.split('/')[1]);
    else home();
  }
  window.addEventListener('hashchange',route);
  window.addEventListener('pagehide',()=>{if(session){if(!session.feedback)session.remainingMs=remaining();saveSession();}});
  if(topics.length!==10 || topics.some(t=>t.questions.length!==100)) {show('<section class="panel empty-state"><h1>Non è stato possibile caricare tutte le domande.</h1><p>Ricarica la pagina e verifica che la cartella data sia stata pubblicata insieme al sito.</p></section>','home');return;}
  route();deliver();
})();
