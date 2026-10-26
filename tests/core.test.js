'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../core.js');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({window:{JAVA_TOPICS:[]}});
for (const file of ['fondamenti-input.js','tipi-math.js','condizioni-cicli.js','array-metodi.js','eccezioni-stream.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,'data',file),'utf8'),context,{filename:file});
}
// Normalize cross-realm arrays before using strict assertions.
const topics = JSON.parse(JSON.stringify(context.window.JAVA_TOPICS));
const allQuestions = topics.flatMap(t=>t.questions);
const topicFor = new Map(topics.flatMap(t=>t.questions.map(q=>[q.id,t.id])));
const questionFor = new Map(allQuestions.map(q=>[q.id,q]));
const ids = topics.map(t=>t.id);
function assertDeck(deck) {
  assert.equal(new Set(deck.map(q=>q.id)).size,deck.length,'no question repeats within a quiz');
  for(const item of deck){
    assert.ok(questionFor.has(item.id));
    assert.deepEqual([...item.order].sort((a,b)=>a-b),[0,1,2,3],'answer display order must be a permutation');
  }
}

test('bank: ten topics, 100 questions each, Italian teaching content and valid schema',()=>{
  assert.equal(topics.length,10);
  assert.equal(allQuestions.length,1000);
  assert.equal(new Set(ids).size,10);
  assert.equal(new Set(allQuestions.map(q=>q.id)).size,1000);
  for(const topic of topics){
    assert.equal(topic.questions.length,100,topic.id);
    assert.ok(topic.sections.length>=5,topic.id+' has a full lesson');
    assert.ok(topic.title && topic.subtitle && topic.source && topic.color && topic.minutes>0);
    for(const section of topic.sections){assert.ok(section.title && section.text && section.steps?.length && section.tip,topic.id+' lesson section');}
    assert.ok(topic.questions.filter(q=>q.type!=='teoria').length>=60,topic.id+' includes substantial code practice');
    const distinct = new Set();
    for(const q of topic.questions){
      assert.ok(['teoria','codice','debug'].includes(q.type),q.id);
      assert.equal(typeof q.prompt,'string',q.id);
      assert.ok(q.prompt.length>5,q.id);
      assert.equal(q.options.length,4,q.id);
      assert.equal(new Set(q.options).size,4,q.id+' has unique alternatives');
      assert.ok(q.options.every(x=>typeof x==='string'&&x.length),q.id);
      assert.ok(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<4,q.id);
      assert.equal(q.optionExplanations.length,4,q.id);
      assert.ok(q.optionExplanations.every(x=>typeof x==='string'&&x.length>5),q.id);
      assert.ok(q.explanation.length>30&&q.steps.length>=2&&q.tip.length>5,q.id);
      if(q.type!=='teoria')assert.ok(q.code?.length,q.id+' includes code');
      const key=q.prompt+'\n'+(q.code||'');
      assert.ok(!distinct.has(key),q.id+' is a distinct exercise');distinct.add(key);
      if(q.trace){assert.ok(q.trace.headers.length&&q.trace.rows.length,q.id);for(const row of q.trace.rows)assert.equal(row.length,q.trace.headers.length,q.id+' trace shape');}
    }
  }
});

test('selection: mixed quizzes balance topics and never repeat questions or mutate the bank',()=>{
  const before=JSON.stringify(topics);
  for(const count of [4,10,23,40,120,1000,1100]){
    const deck=core.selectQuestions(topics,ids,count);
    assertDeck(deck);
    assert.equal(deck.length,Math.min(count,1000));
    const counts=ids.map(id=>deck.filter(q=>topicFor.get(q.id)===id).length);
    assert.ok(Math.max(...counts)-Math.min(...counts)<=1,`balanced at ${count}`);
  }
  assert.equal(JSON.stringify(topics),before);
});

test('selection: topic, theory, code and retry filters compose correctly',()=>{
  const chosen=['array','metodi'];
  for(const kind of ['tutti','teoria','codice']){
    const deck=core.selectQuestions(topics,chosen,200,kind);
    assertDeck(deck);
    assert.ok(deck.every(item=>chosen.includes(topicFor.get(item.id))));
    if(kind==='teoria')assert.ok(deck.every(item=>questionFor.get(item.id).type==='teoria'));
    if(kind==='codice')assert.ok(deck.every(item=>questionFor.get(item.id).type!=='teoria'));
  }
  const retryIds=topics.find(t=>t.id==='array').questions.slice(0,4).map(q=>q.id);
  const deck=core.selectQuestions(topics,ids,100,'tutti',[],retryIds);
  assert.equal(deck.length,4);assertDeck(deck);
  assert.deepEqual(deck.map(q=>q.id).sort(),retryIds.sort());
  assert.deepEqual(core.selectQuestions(topics,[],10),[]);
  assert.deepEqual(core.selectQuestions(topics,ids,0),[]);
  assert.deepEqual(core.selectQuestions(topics,ids,10,'tutti',[],[]),[]);
});

test('selection: unseen exercises are preferred within a topic, then seen items may be reused',()=>{
  const topic=topics[0],seen=topic.questions.slice(0,90).map(q=>q.id);
  const short=core.selectQuestions(topics,[topic.id],10,'tutti',seen);assertDeck(short);
  assert.ok(short.every(item=>!seen.includes(item.id)));
  const full=core.selectQuestions(topics,[topic.id],100,'tutti',seen);assertDeck(full);
  assert.equal(full.length,100);
  assert.ok(full.slice(0,10).every(item=>!seen.includes(item.id)));
  assert.ok(full.slice(10).every(item=>seen.includes(item.id)));
});

const simpleTopics=[{id:'a',title:'Argomento A',questions:[
  {id:'a1',prompt:'Prima',options:['A','B','C','D'],answer:0,explanation:'Spiegazione prima',steps:['Passo 1','Passo 2'],optionExplanations:['Motivo A','Motivo B','Motivo C','Motivo D']},
  {id:'a2',prompt:'Seconda',code:'int x = 2;',options:['E','F','G','H'],answer:2,explanation:'Spiegazione seconda',steps:['Passo 1','Passo 2'],optionExplanations:['Motivo E','Motivo F','Motivo G','Motivo H']}
]},{id:'b',title:'Argomento B',questions:[
  {id:'b1',prompt:'Terza',options:['I','L','M','N'],answer:1,explanation:'Spiegazione terza',steps:['Passo 1','Passo 2'],optionExplanations:['Motivo I','Motivo L','Motivo M','Motivo N']},
  {id:'b2',prompt:'Quarta',options:['O','P','Q','R'],answer:3,explanation:'Spiegazione quarta',steps:['Passo 1','Passo 2'],optionExplanations:['Motivo O','Motivo P','Motivo Q','Motivo R']}
]}];
const deck=['a1','a2','b1','b2'].map(id=>({id,order:[2,0,3,1]}));
function summary(answers,extra={}){return core.summarize({id:'test',deck,answers,minutes:5,elapsedSeconds:20,label:'Quiz misto',nickname:'Alex',...extra},simpleTopics);}

test('summary: original answer indices survive shuffled display and mistakes differ from omissions',()=>{
  const r=summary({a1:0,a2:0,b1:null});
  assert.deepEqual({correct:r.correct,wrong:r.wrong,omitted:r.omitted,total:r.total},{correct:1,wrong:1,omitted:2,total:4});
  assert.equal(r.percentage,25);assert.equal(r.grade,2.5);
  assert.equal(r.details[0].status,'corretta');
  assert.equal(r.details[1].status,'errata');assert.equal(r.details[1].selected,'E');assert.equal(r.details[1].expected,'G');assert.equal(r.details[1].reason,'Motivo E');
  assert.equal(r.details[2].status,'omessa');assert.equal(r.details[3].status,'omessa');
  assert.equal(r.details[2].selected,'Non risposta');
  assert.equal(r.topics.find(t=>t.id==='a').wrong,1);
  assert.deepEqual(r.topics.find(t=>t.id==='b'),{id:'b',title:'Argomento B',total:2,correct:0,wrong:0,omitted:2});
  assert.equal(r.correct+r.wrong+r.omitted,r.total);
  for(const row of r.topics)assert.equal(row.correct+row.wrong+row.omitted,row.total);
  assert.equal(r.nickname,'Alex');assert.equal(r.elapsedSeconds,20);assert.equal(r.mode,'Quiz misto');
});

test('summary: Italian grade has minimum 1, maximum 10 and one decimal',()=>{
  assert.equal(summary({a1:1,a2:1,b1:0,b2:0}).grade,1);
  assert.equal(summary({}).grade,1);
  assert.equal(summary({a1:0,a2:2,b1:1,b2:3}).grade,10);
  const three=summary({a1:0,a2:2},{deck:deck.slice(0,3)});
  assert.equal(three.grade,6.7);
  assert.equal(three.omitted,1);
  const blank=summary({}, {deck:[]});
  assert.equal(blank.grade,1);assert.equal(blank.percentage,0);
  assert.equal(blank.total,0);assert.deepEqual(blank.topics,[]);
});

test('summary: early termination includes all unvisited questions as omitted and records reason',()=>{
  const r=summary({a1:0},{finishReason:'tempo scaduto'});
  assert.equal(r.total,4);assert.equal(r.omitted,3);assert.equal(r.grade,2.5);
  assert.equal(r.reason,'tempo scaduto');
  assert.ok(Number.isFinite(Date.parse(r.date)));
  assert.throws(()=>summary({},{deck:[{id:'missing',order:[0,1,2,3]}]}),/Domanda non trovata/);
});
