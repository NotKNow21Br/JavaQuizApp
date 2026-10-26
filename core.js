(function (root) {
  'use strict';
  function shuffle(values, random = Math.random) {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function selectQuestions(topics, ids, count, kind = 'tutti', seen = [], onlyIds = null) {
    const seenSet = new Set(seen);
    const filterSet = onlyIds ? new Set(onlyIds) : null;
    const pools = shuffle(topics.filter(t => ids.includes(t.id))).map(topic => {
      const available = topic.questions.filter(q => (!filterSet || filterSet.has(q.id)) &&
        (kind === 'tutti' || (kind === 'teoria' ? q.type === 'teoria' : q.type !== 'teoria')));
      return [...shuffle(available.filter(q => !seenSet.has(q.id))), ...shuffle(available.filter(q => seenSet.has(q.id)))];
    });
    const selected = [];
    while (selected.length < count && pools.some(p => p.length)) {
      for (const pool of pools) {
        if (selected.length >= count) break;
        if (pool.length) selected.push(pool.shift());
      }
    }
    return selected.map(q => ({ id: q.id, order: shuffle(q.options.map((_, index) => index)) }));
  }
  function summarize(session, topics) {
    const questionMap = new Map(topics.flatMap(t => t.questions.map(q => [q.id, { q, topic: t }])));
    const byTopic = {};
    let correct = 0, wrong = 0, omitted = 0;
    const details = session.deck.map(item => {
      const entry = questionMap.get(item.id);
      if (!entry) throw new Error('Domanda non trovata: ' + item.id);
      const {q, topic} = entry;
      const answer = Object.prototype.hasOwnProperty.call(session.answers, q.id) ? session.answers[q.id] : null;
      const status = answer === null ? 'omessa' : answer === q.answer ? 'corretta' : 'errata';
      if (status === 'corretta') correct++; else if (status === 'errata') wrong++; else omitted++;
      byTopic[topic.id] ||= {id: topic.id, title: topic.title, total: 0, correct: 0, wrong: 0, omitted: 0};
      const row = byTopic[topic.id];
      row.total++;
      row[status === 'corretta' ? 'correct' : status === 'errata' ? 'wrong' : 'omitted']++;
      return {id:q.id, topicId:topic.id, topic:topic.title, prompt:q.prompt, code:q.code || '', status,
        selected:answer === null ? 'Non risposta' : q.options[answer], expected:q.options[q.answer],
        explanation:q.explanation, steps:q.steps, reason:answer === null ? 'Non hai dato una risposta.' : q.optionExplanations[answer]};
    });
    const total = session.deck.length;
    return {id:session.id, date:new Date().toISOString(), nickname:session.nickname || 'Studente',
      mode:session.label, minutes:session.minutes, elapsedSeconds:session.elapsedSeconds || 0,
      correct, wrong, omitted, total, percentage:total ? correct / total * 100 : 0,
      grade:total ? Math.max(1, Math.round(correct / total * 100) / 10) : 1,
      topics:Object.values(byTopic), details, reason:session.finishReason || 'completato'};
  }
  const api = {shuffle, selectQuestions, summarize};
  root.JavaCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
