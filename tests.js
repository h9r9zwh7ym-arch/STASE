// STASE — tests, chargés seulement avec index.html?test (rien de tout ça au lancement normal).
/* =========================================================================
   Tests — ouvrir index.html?test
   ========================================================================= */
const Tests = {
  cases: [],
  add(name, fn) { Tests.cases.push([name, fn]); },
  eq(actual, expected, msg) {
    const a = JSON.stringify(actual), b = JSON.stringify(expected);
    if (a !== b) throw new Error(`${msg || ''} attendu ${b}, obtenu ${a}`);
  },
  near(actual, expected, msg, eps = 0.01) {
    if (Math.abs(actual - expected) > eps) throw new Error(`${msg || ''} attendu ≈${expected}, obtenu ${actual}`);
  },

  run() {
    const results = Tests.cases.map(([name, fn]) => {
      try { fn(); return { name, ok: true }; } catch (e) { return { name, ok: false, err: e.message }; }
    });
    const ko = results.filter((r) => !r.ok).length;
    document.body.classList.add('no-chrome');
    document.getElementById('view').innerHTML = `<div class="screen">
      <h1 class="title" id="test-summary">${ko ? `${ko} échec(s)` : 'Tous les tests passent'} · ${results.length} tests</h1>
      <p class="small faint">Fuseau : ${Util.esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}</p>
      <div>${results.map((r) => `<div class="test-row"><span class="${r.ok ? 'test-ok' : 'test-ko'}">${r.ok ? 'OK' : 'KO'}</span>
        <span>${Util.esc(r.name)}${r.ok ? '' : `<br><span class="small faint">${Util.esc(r.err)}</span>`}</span></div>`).join('')}</div>
    </div>`;
    console.log(results);
  }
};

/* ---- Étape 1 : utilitaires, dates, stockage ---- */
Tests.add('parseNum accepte la virgule et refuse le négatif', () => {
  Tests.eq(Util.parseNum('6,90'), 6.9);
  Tests.eq(Util.parseNum(' 20 '), 20);
  Tests.eq(Util.parseNum('0'), 0);
  Tests.eq(Util.parseNum('-1'), null);
  Tests.eq(Util.parseNum('abc'), null);
  Tests.eq(Util.parseNum(''), null);
});
Tests.add('dayKey utilise le jour local', () => {
  const ts = new Date(2026, 9, 7, 23, 59).getTime();
  Tests.eq(Dates.dayKey(ts), '2026-10-07');
  Tests.eq(Dates.dayKey(ts + 2 * 60000), '2026-10-08');
});
Tests.add('addDays et diffDays traversent les changements d’heure', () => {
  Tests.eq(Dates.addDays('2026-03-28', 1), '2026-03-29');
  Tests.eq(Dates.addDays('2026-03-29', 1), '2026-03-30');
  Tests.eq(Dates.addDays('2026-10-24', 2), '2026-10-26');
  Tests.eq(Dates.diffDays('2026-03-01', '2026-04-01'), 31);
  Tests.eq(Dates.range('2026-12-30', '2027-01-02').length, 4);
});
Tests.add('splitDuration', () => {
  Tests.eq(Dates.splitDuration((3 * 86400 + 14 * 3600 + 22 * 60 + 8) * 1000), { d: 3, h: 14, m: 22, s: 8 });
  Tests.eq(Dates.splitDuration(-5), { d: 0, h: 0, m: 0, s: 0 });
});
Tests.add('normalize complète un objet partiel', () => {
  const d = Store.normalize({ settings: { snusBoxPrice: 7, phase: 'n’importe' } });
  Tests.eq(d.settings.snusBoxPrice, 7);
  Tests.eq(d.settings.phase, 'observation');
  Tests.eq(d.settings.snusPerBox, 20);
  Tests.eq(d.intakes, []);
});
Tests.add('normalize écarte les entrées invalides et trie', () => {
  const d = Store.normalize({ intakes: [
    { type: 'snus', ts: 2000, trigger: 'cafe', intensity: 9 },
    { type: 'cigarette', ts: 1000 },
    { type: 'vape', ts: 1000, trigger: 'inconnu', intensity: 3 },
    null
  ] });
  Tests.eq(d.intakes.length, 2);
  Tests.eq(d.intakes[0].type, 'vape');
  Tests.eq(d.intakes[0].trigger, null);
  Tests.eq(d.intakes[1].intensity, null);
});
Tests.add('un check-in par jour, le dernier l’emporte', () => {
  const d = Store.normalize({ checkins: [{ date: '2026-10-07', sleep: 2 }, { date: '2026-10-07', sleep: 4 }, { date: 'hier' }] });
  Tests.eq(d.checkins.length, 1);
  Tests.eq(d.checkins[0].sleep, 4);
});
Tests.add('export puis import redonne les mêmes données', () => {
  const saved = Store.data;
  Store.data = Store.normalize({ intakes: [{ id: 'a', type: 'snus', ts: 1, trigger: 'stress', intensity: 2 }], settings: { snusBoxPrice: 6.9 } });
  const res = Store.parseImport(Store.exportJson());
  const expected = Store.data;
  Store.data = saved;
  Tests.eq(res.ok, true);
  Tests.eq(res.data, expected);
});
Tests.add('import refuse un fichier étranger', () => {
  Tests.eq(Store.parseImport('pas du json').ok, false);
  Tests.eq(Store.parseImport('{"foo":1}').ok, false);
});

/* ---- Étape 2 : relevé et calculs du jour ---- */
Tests.add('dailyCounts répartit par jour local, minuit compris', () => {
  const t = (d, h, m) => new Date(2026, 9, d, h, m).getTime();
  const list = [
    { type: 'snus', ts: t(5, 23, 58) }, { type: 'vape', ts: t(6, 0, 2) },
    { type: 'vape', ts: t(6, 12, 0) }, { type: 'snus', ts: t(8, 9, 0) }
  ];
  const days = Calc.dailyCounts(list, '2026-10-05', '2026-10-08');
  Tests.eq(days.map((d) => d.total), [1, 2, 0, 1]);
  Tests.eq(days[1], { key: '2026-10-06', snus: 0, vape: 2, total: 2 });
});
Tests.add('moyenne 7 j : aujourd’hui exclu, historique court pris en compte', () => {
  const t = (d, h) => new Date(2026, 9, d, h).getTime();
  Tests.eq(Calc.avgPerDay([], '2026-10-10'), null);
  // Une seule prise aujourd'hui : pas encore de jour complet.
  Tests.eq(Calc.avgPerDay([{ type: 'snus', ts: t(10, 9) }], '2026-10-10'), null);
  // Deux jours complets (8 et 9) : 3 puis 1 prises → 2 par jour.
  const list = [8, 8, 8, 9, 10].map((d) => ({ type: 'snus', ts: t(d, 10) }));
  const avg = Calc.avgPerDay(list, '2026-10-10');
  Tests.eq(avg.days, 2);
  Tests.near(avg.total, 2);
});
Tests.add('moyenne 7 j : fenêtre glissante de 7 jours', () => {
  const t = (d) => new Date(2026, 9, d, 10).getTime();
  const list = [];
  for (let d = 1; d <= 14; d++) for (let i = 0; i < d; i++) list.push({ type: i % 2 ? 'vape' : 'snus', ts: t(d) });
  const avg = Calc.avgPerDay(list, '2026-10-15');
  Tests.eq(avg.days, 7);
  Tests.near(avg.total, (8 + 9 + 10 + 11 + 12 + 13 + 14) / 7);
});
Tests.add('ajout, modification, suppression d’une prise', () => {
  const saved = Store.data;
  Store.data = Store.defaults();
  const id = Intakes.add('snus', new Date(2026, 9, 7, 14, 32).getTime());
  Intakes.add('vape', new Date(2026, 9, 7, 9, 0).getTime());
  Tests.eq(Store.data.intakes[0].type, 'vape');
  Intakes.edit(id, { trigger: 'stress', intensity: 4, ts: new Date(2026, 9, 6, 22, 0).getTime() });
  Tests.eq(Calc.onDay(Store.data.intakes, '2026-10-06').length, 1);
  Tests.eq(Intakes.find(id).trigger, 'stress');
  Tests.eq(Intakes.remove(id), true);
  Tests.eq(Store.data.intakes.length, 1);
  Store.data = saved;
  Store.save();
});
Tests.add('une heure dans le futur est refusée', () => {
  Tests.eq(Intakes.isValidTs(Date.now() + 3600000), false);
  Tests.eq(Intakes.isValidTs(Date.now() - 60000), true);
  Tests.eq(Intakes.isValidTs(NaN), false);
});

/* ---- Étape 3 : stats, dépenses, démo ---- */
Tests.add('répartition par heure et heures de pointe', () => {
  const t = (h) => new Date(2026, 9, 7, h, 30).getTime();
  const hist = Calc.hourHistogram([9, 9, 16, 16, 16, 22].map((h) => ({ ts: t(h) })));
  Tests.eq(hist[16], 3);
  Tests.eq(hist.reduce((a, b) => a + b, 0), 6);
  Tests.eq(Calc.topHours(hist, 2), [9, 16]);
});
Tests.add('déclencheurs : parts qui font 100 %, « Sans contexte » à la fin', () => {
  const rows = Calc.triggerShare([{ trigger: 'cafe' }, { trigger: null }, { trigger: 'cafe' }, { trigger: 'stress' }]);
  Tests.eq(rows.map((r) => r.key), ['cafe', 'stress', 'none']);
  Tests.near(rows.reduce((a, r) => a + r.pct, 0), 100);
  Tests.eq(Calc.triggerShare([]), []);
});
Tests.add('coût unitaire : prix ou contenu à zéro = non renseigné', () => {
  const s = Store.defaults().settings;
  Tests.eq(Calc.unitCosts(s), { snus: null, vape: null, vapeMl: null });
  Object.assign(s, { snusBoxPrice: 6.9, snusPerBox: 20, vapeUnitPrice: 3.5, vapeSessionsPerUnit: 0 });
  Tests.near(Calc.unitCosts(s).snus, 0.345, '', 1e-9);
  Tests.eq(Calc.unitCosts(s).vape, null);
});
Tests.add('dépense : 10 snus + 8 vape, et type sans prix signalé', () => {
  const s = Object.assign(Store.defaults().settings, { snusBoxPrice: 6.9, snusPerBox: 20, vapeUnitPrice: 3.5, vapeSessionsPerUnit: 40 });
  const list = [...Array(10)].map(() => ({ type: 'snus' })).concat([...Array(8)].map(() => ({ type: 'vape' })));
  const sp = Calc.spend(list, s);
  Tests.near(sp.snus, 3.45);
  Tests.near(sp.vape, 0.7);
  Tests.near(sp.total, 4.15);
  Tests.eq(sp.missing, []);
  s.vapeUnitPrice = 0;
  const sp2 = Calc.spend(list, s);
  Tests.eq(sp2.missing, ['vape']);
  Tests.near(sp2.total, 3.45);
});
Tests.add('début de semaine (lundi) et de mois', () => {
  Tests.eq(Calc.weekStart('2026-10-07'), '2026-10-05'); // mercredi → lundi
  Tests.eq(Calc.weekStart('2026-10-05'), '2026-10-05');
  Tests.eq(Calc.weekStart('2026-10-11'), '2026-10-05'); // dimanche
  Tests.eq(Calc.monthStart('2026-10-07'), '2026-10-01');
});
Tests.add('nicotine snus : portions × mg', () => {
  Tests.eq(Calc.snusMg(4, { snusMg: 8 }), 32);
  Tests.eq(Calc.snusMg(4, { snusMg: 0 }), 0);
});
Tests.add('démo : reproductible, 21 jours, rien dans le futur', () => {
  const now = new Date(2026, 9, 7, 15, 0).getTime();
  const a = Demo.generate(now, 7), b = Demo.generate(now, 7);
  Tests.eq(a.intakes.length, b.intakes.length);
  Tests.eq(a.intakes.every((x) => x.ts <= now), true);
  const days = new Set(a.intakes.map((x) => Dates.dayKey(x.ts)));
  Tests.eq(days.size >= 20, true);
  Tests.eq(Store.normalize(a), a);
});
Tests.add('courbe : échantillonnage borné, dernier point gardé', () => {
  const v = [...Array(365)].map((_, i) => i);
  const out = Charts.sample(v, 120);
  Tests.eq(out.length, 120);
  Tests.eq(out[0], 0); Tests.eq(out[119], 364);
  Tests.eq(Charts.sample([1, 2], 120), [1, 2]);
});
Tests.add('graphe : une barre par valeur, rendu sans erreur', () => {
  const svg = Charts.bars([{ v: 1 }, { v: 0 }, { v: 5, hi: true }], { avg: 2 });
  Tests.eq((svg.match(/<rect/g) || []).length, 3);
  Tests.eq(svg.includes('c-avg'), true);
  Tests.eq((Charts.hbars([{ label: 'Café', pct: 50 }]).match(/<rect/g) || []).length, 2);
});

/* ---- Étape 5 : phase arrêt ---- */
/** Scénario de référence : 4 snus et 5 vape par jour, arrêt le 1er octobre à 10 h. */
Tests.quitFixture = () => {
  const s = Object.assign(Store.defaults().settings, {
    phase: 'arret', snusBoxPrice: 6.9, snusPerBox: 20, vapeUnitPrice: 3.5, vapeSessionsPerUnit: 40,
    quitStart: new Date(2026, 9, 1, 10, 0).getTime(), baseline: { snusPerDay: 4, vapePerDay: 5, days: 14 }
  });
  // Une seule prise : une vape 2 jours après l'arrêt.
  const intakes = [{ id: 'r', type: 'vape', ts: s.quitStart + 2 * DAY_MS }];
  return { s, intakes, now: s.quitStart + 3.5 * DAY_MS };
};
Tests.add('référence = moyenne réelle des jours complets avant l’arrêt', () => {
  const t = (d, h) => new Date(2026, 8, d, h).getTime();
  const intakes = [
    { type: 'snus', ts: t(1, 9) }, { type: 'snus', ts: t(1, 15) }, { type: 'vape', ts: t(1, 20) },
    { type: 'vape', ts: t(2, 9) },
    { type: 'snus', ts: t(4, 8) } // jour de l'arrêt : exclu
  ];
  const b = Calc.baseline(intakes, t(4, 12));
  Tests.eq(b.days, 2); // 1 et 2 septembre ; le 3, sans prise notée, est un jour oublié
  Tests.near(b.snusPerDay, 1);
  Tests.near(b.vapePerDay, 1);
  Tests.eq(Calc.baseline(intakes.slice(4), t(4, 12)), null);
});
Tests.add('doses évitées et économies, snus et vape séparés', () => {
  const { s, intakes, now } = Tests.quitFixture();
  const a = Calc.avoided(intakes, s, now);
  Tests.eq(a.snus.avoided, 14);          // 4 × 3,5 j
  Tests.eq(a.vape.avoided, 16);          // 5 × 3,5 − 1 prise = 16,5 → 16
  Tests.near(a.snus.money, 14 * 0.345);  // 4,83 CHF
  Tests.near(a.vape.money, 16 * 0.0875); // 1,40 CHF
  Tests.near(a.money, 6.23);
  Tests.near(a.vape.units, 0.4);
});
Tests.add('économies : prix à zéro et jamais négatif', () => {
  const { s, intakes, now } = Tests.quitFixture();
  s.vapeUnitPrice = 0;
  const a = Calc.avoided(intakes, s, now);
  Tests.eq(a.vape.money, null);
  Tests.eq(a.missing, ['vape']);
  Tests.near(a.money, 4.83);
  s.snusBoxPrice = 0;
  Tests.eq(Calc.avoided(intakes, s, now).money, null);
  const many = [...Array(30)].map((_, i) => ({ type: 'snus', ts: s.quitStart + i * 60000 }));
  Tests.eq(Calc.avoided(many, s, now).snus.avoided, 0);
  s.baseline = null;
  Tests.eq(Calc.avoided(intakes, s, now).snus.avoided, 0);
});
Tests.add('enchaînements : en cours et meilleur, sans remise à zéro', () => {
  const { s, intakes, now } = Tests.quitFixture();
  const st = Calc.streaks(intakes, s.quitStart, now);
  Tests.near(st.current / DAY_MS, 1.5);
  Tests.near(st.best / DAY_MS, 2);
  Tests.eq(st.lastTs, intakes[0].ts);
  Tests.near(Calc.streaks([], s.quitStart, now).current / DAY_MS, 3.5);
});
Tests.add('jours sans nicotine au total (jours locaux, aujourd’hui exclu)', () => {
  const { s, intakes, now } = Tests.quitFixture();
  // Arrêt le 1er à 10 h, prise le 3, maintenant le 4 à 22 h : 1er et 2 sans nicotine.
  Tests.eq(Calc.cleanDays(intakes, s.quitStart, now), 2);
  Tests.eq(Calc.cleanDays([], s.quitStart, s.quitStart + 3600000), 0);
});
Tests.add('économies cumulées : une valeur par jour, croissante', () => {
  const { s, now } = Tests.quitFixture();
  const series = Calc.savingsSeries([], s, now);
  Tests.eq(series.length, 4);
  Tests.eq(series.every((p, i) => i === 0 || p.value >= series[i - 1].value), true);
  Tests.near(series[3].value, Calc.avoided([], s, now).money);
});
Tests.add('réduction progressive : cible qui baisse chaque semaine', () => {
  const red = { on: true, base: 10, weeklyStep: 1, startDate: '2026-10-01' };
  Tests.eq(Calc.reductionTarget(red, '2026-09-30'), null);
  Tests.eq(Calc.reductionTarget(red, '2026-10-01'), 10);
  Tests.eq(Calc.reductionTarget(red, '2026-10-07'), 10);
  Tests.eq(Calc.reductionTarget(red, '2026-10-08'), 9);
  Tests.eq(Calc.reductionTarget({ ...red, weeklyStep: 2 }, '2027-03-01'), 0);
  Tests.eq(Calc.reductionTarget({ ...red, on: false }, '2026-10-08'), null);
  const t = (d, h) => new Date(2026, 9, d, h).getTime();
  const intakes = [...Array(11)].map((_, i) => ({ type: 'snus', ts: t(1, 8) + i * 60000 }))
    .concat([...Array(9)].map((_, i) => ({ type: 'vape', ts: t(2, 8) + i * 60000 })));
  const days = Calc.reductionDays(intakes, red, '2026-10-03', 7);
  Tests.eq(days.map((d) => d.ok), [false, true]);
});
Tests.add('messages du jour : au moins 40, stables, sans vocabulaire d’échec', () => {
  Tests.eq(Messages.count() >= 40, true);
  Tests.eq(Messages.forDay('2026-10-07', 'peak'), Messages.forDay('2026-10-07', 'peak'));
  const all = Object.values(Messages.pools).flat().join(' ').toLowerCase();
  ['échec', 'rechute', 'craqu', 'faible', 'honte', 'faute'].forEach((w) => Tests.eq(all.includes(w), false, w));
  Tests.eq(Calc.stage(10 * 3600000), 'start');
  Tests.eq(Calc.stage(50 * 3600000), 'peak');
  Tests.eq(Calc.stage(10 * DAY_MS), 'weeks');
});
Tests.add('prochain jalon et progression', () => {
  const m = Calc.nextMilestone(3.6 * DAY_MS);
  Tests.eq(m.title, '1 semaine');
  Tests.near(m.progress, (86.4 - 72) / (168 - 72));
  Tests.eq(Calc.nextMilestone(400 * DAY_MS), null);
});
Tests.add('minuteur d’envie : respiration 4 s / 6 s, pause, durée plafonnée', () => {
  const c = { start: 1000000, pausedAt: null, pausedMs: 0 };
  Tests.eq(Craving.view(0, c).phase, 'Inspire');
  Tests.eq(Craving.view(5000, c).phase, 'Expire');
  Tests.eq(Craving.view(12000, c).phase, 'Inspire');
  Tests.eq(Craving.view(0, c).left, '10:00');
  Tests.eq(Craving.view(78000, c).left, '08:42');
  Tests.near(Number(Craving.view(300000, c).dash), Craving.CIRC / 2, '', 0.1);
  Tests.eq(Craving.elapsed(c, 1000000 + 20 * 60000), Craving.DURATION);
  Tests.eq(Craving.elapsed({ ...c, pausedAt: 1060000 }, 1900000), 60000);
});
Tests.add('démo arrêt : référence calculée, une prise, envies', () => {
  const now = new Date(2026, 9, 7, 15, 0).getTime();
  const d = Demo.generateQuit(now, 3);
  Tests.eq(d.settings.phase, 'arret');
  Tests.eq(d.settings.baseline !== null && d.settings.baseline.days >= 13, true);
  Tests.eq(Calc.quitIntakes(d.intakes, d.settings.quitStart).length, 1);
  Tests.eq(d.cravings.length > 10, true);
  Tests.eq(d.cravings.every((c) => c.ts <= now), true);
});

/* ---- Étape 6 : frise Corps ---- */
Tests.add('jalon gencives seulement pour le snus', () => {
  const s = Store.defaults().settings;
  const has = (list) => list.some((m) => m.tag === 'snus');
  Tests.eq(has(Calc.visibleMilestones({ ...s, baseline: { snusPerDay: 0, vapePerDay: 6, days: 7 } }, [])), false);
  Tests.eq(has(Calc.visibleMilestones({ ...s, baseline: { snusPerDay: 2, vapePerDay: 0, days: 7 } }, [])), true);
  Tests.eq(has(Calc.visibleMilestones(s, [{ type: 'vape', ts: 1 }])), false);
  Tests.eq(has(Calc.visibleMilestones(s, [])), true);
});
Tests.add('frise : passés, prochain, à venir', () => {
  const states = Calc.milestoneStates(3.6 * DAY_MS, MILESTONES);
  Tests.eq(states.slice(0, 6).map((m) => m.state), ['done', 'done', 'done', 'done', 'next', 'future']); // 1 h, 12 h, 24 h, 3 j, puis 1 semaine
  Tests.eq(states.filter((m) => m.state === 'next').length, 1);
  Tests.eq(Calc.milestoneStates(0, MILESTONES)[0].state, 'next');
  Tests.eq(Calc.milestoneStates(400 * DAY_MS, MILESTONES).every((m) => m.state === 'done'), true);
});
Tests.add('jalons : formulés comme des tendances, sans promesse', () => {
  const all = MILESTONES.map((m) => m.text).join(' ').toLowerCase();
  ['garanti', 'à coup sûr', 'définitivement', 'disparaît complètement', 'cigarette', 'monoxyde', 'goudron'].forEach((w) => Tests.eq(all.includes(w), false, w));
  Tests.eq(MILESTONES.filter((m) => /souvent|en général/.test(m.text)).length >= 5, true);
});

/* ---- Questionnaire et bénéfices personnalisés ---- */
Tests.add('profil : nettoyage des réponses', () => {
  const p = Store.cleanProfile({ done: true, uses: 'both', goals: ['argent', 'argent', 'inconnu'], concerns: ['tension', 'rien'], firstUse: 'lt5' });
  Tests.eq(p, { done: true, uses: 'both', goals: ['argent'], concerns: ['tension'], firstUse: 'lt5', why: '' });
  Tests.eq(Store.cleanProfile(null).done, false);
  Tests.eq(Store.normalize({}).settings.profile.concerns, []);
});
Tests.add('points proposés selon l’usage (gencives = snus, souffle = vape)', () => {
  const keys = (u) => Calc.concernsFor(u).map((c) => c.key);
  Tests.eq(keys('vape').includes('gencives'), false);
  Tests.eq(keys('vape').includes('souffle'), true);
  Tests.eq(keys('snus').includes('souffle'), false);
  Tests.eq(keys('both').includes('gencives') && keys('both').includes('souffle'), true);
});
Tests.add('changer d’usage retire les points qui ne s’appliquent plus', () => {
  const saved = App.quiz;
  App.quiz = { step: 1, a: { uses: 'both', goals: [], concerns: ['gencives', 'stress'], firstUse: null } };
  Quiz.pick('uses', 'vape');
  Tests.eq(App.quiz.a.concerns, ['stress']);
  Quiz.pick('goals', 'argent'); Quiz.pick('goals', 'sante'); Quiz.pick('goals', 'argent');
  Tests.eq(App.quiz.a.goals, ['sante']);
  App.quiz = saved;
});
Tests.add('repères « pour toi » selon les points cochés', () => {
  const oneHour = MILESTONES.find((m) => m.h === 1);
  Tests.eq(Calc.isForMe(oneHour, ['tension']), true);
  Tests.eq(Calc.isForMe(oneHour, ['sommeil']), false);
  Tests.eq(MILESTONES.filter((m) => Calc.isForMe(m, ['sommeil'])).length >= 1, true);
});
Tests.add('coût annuel : référence, sinon moyenne récente ; null sans prix', () => {
  const s = Object.assign(Store.defaults().settings, { snusBoxPrice: 6.9, snusPerBox: 20, vapeUnitPrice: 3.5, vapeSessionsPerUnit: 40, baseline: { snusPerDay: 4, vapePerDay: 5, days: 10 } });
  Tests.near(Calc.yearlyCost(s, [], []), (4 * 0.345 + 5 * 0.0875) * 365);
  s.snusBoxPrice = 0; s.vapeUnitPrice = 0;
  Tests.eq(Calc.yearlyCost(s, [], []), null);
});
Tests.add('textes de bénéfices : prudents, sans promesse', () => {
  const all = CONCERNS.map((c) => c.text + ' ' + (c.note || '')).join(' ').toLowerCase();
  ['garanti', 'à coup sûr', 'guérit', 'définitivement', 'échec'].forEach((w) => Tests.eq(all.includes(w), false, w));
  Tests.eq(CONCERNS.every((c) => c.text.length < 330), true);
  const personal = Object.values(Messages.personal).flat().join(' ').toLowerCase();
  ['échec', 'rechute', 'craqu', 'honte', 'faute'].forEach((w) => Tests.eq(personal.includes(w), false, w));
});

/* ---- Finitions ---- */
Tests.add('rappel de sauvegarde : délais et « plus tard »', () => {
  const now = new Date(2026, 9, 20, 12).getTime();
  const d = Store.defaults();
  Tests.eq(Calc.backupDue(d, now), false); // aucune donnée
  d.intakes = [{ type: 'snus', ts: now - 3 * DAY_MS }];
  Tests.eq(Calc.backupDue(d, now), false); // trop récent
  d.intakes[0].ts = now - 8 * DAY_MS;
  Tests.eq(Calc.backupDue(d, now), true);
  d.settings.lastExportAt = now - 10 * DAY_MS;
  Tests.eq(Calc.backupDue(d, now), false);
  d.settings.lastExportAt = now - 15 * DAY_MS;
  Tests.eq(Calc.backupDue(d, now), true);
  d.settings.backupSnoozeUntil = now + DAY_MS;
  Tests.eq(Calc.backupDue(d, now), false);
});
Tests.add('chaque écran se dessine sans erreur, avec ou sans données', () => {
  const saved = Store.data, savedQuiz = App.quiz;
  const screens = ['todayObservation', 'stats', 'corps', 'reglages', 'historique', 'bienvenue', 'aide'];
  [Store.defaults(), Demo.generate(Date.now(), 1), Demo.generateQuit(Date.now(), 2)].forEach((data) => {
    Store.data = data;
    screens.concat(data.settings.phase === 'arret' ? ['todayQuit', 'reprendre'] : []).forEach((name) => {
      App.quiz = null;
      const html = Screens[name]();
      Tests.eq(typeof html === 'string' && html.length > 100, true, name);
      Tests.eq(/undefined|NaN/.test(html.replace(/<svg[\s\S]*?<\/svg>/g, '')), false, `${name} sans undefined/NaN`);
    });
  });
  Store.data = saved; App.quiz = savedQuiz; App.relapseDraft = null; 
});

/* ---- Francs suisses, ml de vape, robustesse ---- */
Tests.add('montants en francs suisses', () => {
  const t = Util.formatMoney(6.9).replace(/\s/g, ' ');
  Tests.eq(t.includes('CHF') && t.includes('6.90'), true, t);
  Tests.eq(Util.formatMoney(628.4, 0).replace(/\s/g, ' ').includes('628'), true);
});
Tests.add('vape : coût au ml, nicotine au ml', () => {
  const s = Object.assign(Store.defaults().settings, { vapeUnitPrice: 5.5, vapeMlPerUnit: 2, vapeMgPerMl: 20, vapeSessionsPerUnit: 8 });
  Tests.near(Calc.unitCosts(s).vapeMl, 2.75);
  Tests.near(Calc.unitCosts(s).vape, 0.6875);
  s.vapeMlPerUnit = 0;
  Tests.eq(Calc.unitCosts(s).vapeMl, null);
});
Tests.add('dépense : les ml notés priment sur les sessions ce jour-là', () => {
  const s = Object.assign(Store.defaults().settings, { snusBoxPrice: 8, snusPerBox: 20, vapeUnitPrice: 5.5, vapeMlPerUnit: 2, vapeSessionsPerUnit: 8 });
  const t = (d, h) => new Date(2026, 9, d, h).getTime();
  const intakes = [{ type: 'vape', ts: t(5, 9) }, { type: 'vape', ts: t(5, 10) }, { type: 'vape', ts: t(6, 9) }, { type: 'snus', ts: t(6, 12) }];
  // Le 5 : 1,2 ml notés → 1,2 × 2,75 ; le 6 : pas de ml → 1 session × 0,6875 ; + 1 portion × 0,40.
  const sp = Calc.spendRange(intakes, [{ date: '2026-10-05', ml: 1.2 }], s, '2026-10-05', '2026-10-06');
  Tests.near(sp.vape, 1.2 * 2.75 + 0.6875);
  Tests.near(sp.snus, 0.4);
  Tests.eq(sp.missing, []);
  s.vapeSessionsPerUnit = 0;
  Tests.eq(Calc.spendRange(intakes, [], s, '2026-10-05', '2026-10-06').missing, ['vape']);
});
Tests.add('référence en ml et ml évités depuis l’arrêt', () => {
  const t = (d, h) => new Date(2026, 8, d, h).getTime();
  const intakes = [{ type: 'vape', ts: t(1, 9) }, { type: 'vape', ts: t(2, 9) }];
  const b = Calc.baseline(intakes, t(4, 12), [{ date: '2026-09-01', ml: 1 }, { date: '2026-09-02', ml: 2 }, { date: '2026-09-04', ml: 9 }]);
  Tests.near(b.vapeMlPerDay, 1.5); // le 4 (jour de l'arrêt) est exclu
  const s = Object.assign(Store.defaults().settings, {
    phase: 'arret', quitStart: new Date(2026, 9, 1, 10).getTime(), vapeUnitPrice: 5.5, vapeMlPerUnit: 2, vapeMgPerMl: 20, snusMg: 8,
    baseline: { snusPerDay: 2, vapePerDay: 4, vapeMlPerDay: 1.6, days: 10 }
  });
  const now = s.quitStart + 2.5 * DAY_MS;
  // Une session reprise ≈ 0,4 ml (1,6 / 4) : 1,6 × 2,5 − 0,4 = 3,6 ml évités.
  const a = Calc.avoided([{ type: 'vape', ts: s.quitStart + DAY_MS }], s, now, []);
  Tests.near(a.vape.ml, 3.6);
  Tests.near(a.vape.money, 3.6 * 2.75);
  Tests.near(a.vape.units, 1.8);
  Tests.near(a.nicotineMg, 5 * 8 + 3.6 * 20);
  // Avec des ml notés depuis l'arrêt, ce sont eux qui comptent.
  Tests.near(Calc.avoided([], s, now, [{ date: Dates.dayKey(s.quitStart + DAY_MS), ml: 1 }]).vape.ml, 3);
});
Tests.add('relevé ml : un par jour, borné, arrondi', () => {
  const v = Store.cleanVapeMl([{ date: '2026-10-05', ml: 1.26 }, { date: '2026-10-05', ml: 2 }, { date: '2026-10-06', ml: -1 }, { date: 'x', ml: 1 }, { date: '2026-10-07', ml: 500 }]);
  Tests.eq(v, [{ date: '2026-10-05', ml: 2 }]);
  Tests.eq(Store.cleanVapeMl([{ date: '2026-10-05', ml: 1.26 }])[0].ml, 1.3);
});
Tests.add('réglages : valeurs invalides écartées, grandes valeurs gardées (pas de perte silencieuse)', () => {
  const d = Store.normalize({ settings: { snusBoxPrice: 690, vapeMgPerMl: 18, vapeMlPerUnit: -2, vapeSessionsPerUnit: 'abc' } });
  Tests.eq(d.settings.snusBoxPrice, 690);
  Tests.eq(d.settings.vapeSessionsPerUnit, 0);
  Tests.eq(d.settings.vapeMgPerMl, 18);
  Tests.eq(d.settings.vapeMlPerUnit, 0);
});
Tests.add('identifiants en double à l’import : un seul gardé', () => {
  const d = Store.normalize({ intakes: [{ id: 'a', type: 'snus', ts: 1 }, { id: 'a', type: 'vape', ts: 2 }, { id: 'b', type: 'snus', ts: 3 }] });
  Tests.eq(d.intakes.map((x) => x.id), ['a', 'b']);
  Tests.eq(d.intakes[0].type, 'vape');
});
Tests.add('envie en cours retrouvée après un rechargement d’iOS', () => {
  const saved = Craving.current;
  const now = Date.now();
  try {
    localStorage.setItem(Craving.KEY, JSON.stringify({ start: now - 90000, pausedAt: null, pausedMs: 0, step: 'timer', trigger: 'cafe', intensity: 9 }));
    Tests.eq(Craving.restore(now), true);
    Tests.eq(Craving.current.trigger, 'cafe');
    Tests.eq(Craving.current.intensity, null);
    Tests.eq(Craving.elapsed(Craving.current, now), 90000);
    localStorage.setItem(Craving.KEY, JSON.stringify({ start: now - 3 * 3600000, step: 'timer' }));
    Tests.eq(Craving.restore(now), false); // trop ancienne
    localStorage.setItem(Craving.KEY, '{pas du json');
    Tests.eq(Craving.restore(now), false);
  } finally {
    localStorage.removeItem(Craving.KEY);
    Craving.current = saved;
  }
});
Tests.add('écran de secours si un écran plante', () => {
  const html = Screens.failure(new Error('<b>boom</b>'));
  Tests.eq(html.includes('data-action="export"'), true);
  Tests.eq(html.includes('<b>'), false);
});

/* ---- Corrections issues de la revue de code ---- */
Tests.quitMlFixture = () => {
  const quitStart = new Date(2026, 9, 1, 18, 0).getTime();
  const s = Object.assign(Store.defaults().settings, {
    phase: 'arret', quitStart, vapeUnitPrice: 5, vapeMlPerUnit: 2,
    baseline: { snusPerDay: 0, vapePerDay: 4, vapeMlPerDay: 2, days: 10 }
  });
  return { s, quitStart };
};
Tests.add('ml repris : le jour de l’arrêt compte en sessions après l’heure de l’arrêt', () => {
  const { s, quitStart } = Tests.quitMlFixture();
  // 1,5 ml notés le 1er (vapotés le matin, avant l'arrêt à 18 h) : ne comptent pas.
  const taken = Calc.mlTakenSinceQuit([], [{ date: '2026-10-01', ml: 1.5 }], s.baseline, quitStart, quitStart + DAY_MS);
  Tests.near(taken, 0);
});
Tests.add('ml repris : jours sans ml notés = sessions × ml par session', () => {
  const { s, quitStart } = Tests.quitMlFixture();
  const t = (d, h) => new Date(2026, 9, d, h).getTime();
  const intakes = [{ type: 'vape', ts: t(3, 10) }, { type: 'vape', ts: t(3, 11) }, { type: 'vape', ts: t(4, 9) }];
  // Le 2 : 0,5 ml notés ; le 3 : 2 sessions sans ml → 2 × 0,5 ; le 4 : 1 session → 0,5.
  const taken = Calc.mlTakenSinceQuit(intakes, [{ date: '2026-10-02', ml: 0.5 }], s.baseline, quitStart, t(5, 0));
  Tests.near(taken, 0.5 + 1 + 0.5);
});
Tests.add('courbe d’économies : un jour passé n’inclut pas les ml du lendemain', () => {
  const { s, quitStart } = Tests.quitMlFixture();
  const series = Calc.savingsSeries([], s, quitStart + 2.5 * DAY_MS, [{ date: '2026-10-03', ml: 1 }]);
  // Fin du 1er (6 h après l'arrêt) : 0,5 ml évités, sans le ml noté le 3.
  Tests.near(series[0].value, 0.5 * 2.5);
  Tests.eq(series.every((p, i) => i === 0 || p.value >= series[i - 1].value - 1e-9), true);
  // Un jour au-dessus de la référence (3 ml > 2 ml/j) fait honnêtement baisser le cumul.
  const over = Calc.savingsSeries([], s, quitStart + 2.5 * DAY_MS, [{ date: '2026-10-03', ml: 3 }]);
  Tests.eq(over[2].value < over[1].value, true);
});
Tests.add('coût annuel : prix au ml seul suffit ; la référence prime sur les ml d’après l’arrêt', () => {
  const s = Object.assign(Store.defaults().settings, { vapeUnitPrice: 5, vapeMlPerUnit: 2, vapeSessionsPerUnit: 0 });
  const today = '2026-10-10';
  Tests.near(Calc.yearlyCost(s, [], [{ date: '2026-10-08', ml: 2 }], today), 2 * 2.5 * 365);
  s.vapeSessionsPerUnit = 10;
  s.baseline = { snusPerDay: 0, vapePerDay: 10, vapeMlPerDay: null, days: 7 };
  Tests.near(Calc.yearlyCost(s, [], [{ date: '2026-10-08', ml: 0.2 }], today), 10 * 0.5 * 365);
});
Tests.add('saisie de ml : vide, invalide, arrondi', () => {
  Tests.eq(Vape.parse(''), null);
  Tests.eq(Number.isNaN(Vape.parse('abc')), true);
  Tests.eq(Number.isNaN(Vape.parse('150')), true);
  Tests.eq(Vape.parse('1,26'), 1.3);
});

/* ---- Rappels et aide ---- */
/* ---- Version finale : repères célébrés ---- */
Tests.add('nouveau repère : célébré une fois, recalé après une prise', () => {
  const H = 3600000;
  Tests.eq(Calc.newMilestone(80 * H, MILESTONES, 24).title, '3 jours');
  Tests.eq(Calc.newMilestone(80 * H, MILESTONES, 72), null);
  Tests.eq(Calc.newMilestone(0.5 * H, MILESTONES, 0), null);
  Tests.eq(Calc.newMilestone(2 * H, MILESTONES, 0).title, '1 heure');
});

Tests.add('repères : données d’avant la 2.0, rien de célébré après coup', () => {
  Tests.eq(Calc.newMilestone(40 * DAY_MS, MILESTONES, null), null);
  Tests.eq(Store.normalize({ settings: {} }).settings.seenMilestoneH, null);
  Tests.eq(Calc.lastPassed(40 * DAY_MS, MILESTONES).title, '1 mois');
  Tests.eq(Calc.lastPassed(0, MILESTONES), null);
});

/* ---- Objectif d'achat ---- */
Tests.add('objectif : progression, plafond à 100 %, rien sans nom ni prix', () => {
  const st = Store.defaults().settings;
  Tests.eq(Calc.goal(st, 100), null);
  st.goalName = 'Vélo'; st.goalPrice = 450;
  Tests.eq(Calc.goal(st, 171).pct, 38);
  Tests.eq(Calc.goal(st, null).saved, 0);
  Tests.eq(Calc.goal(st, 900).done, true);
  Tests.eq(Calc.goal(st, 900).ratio, 1);
  Tests.eq(Calc.goal(st, 900).left, 0);
  st.goalPrice = 0;
  Tests.eq(Calc.goal(st, 100), null);
  const n = Store.normalize({ settings: { goalName: '  ' + 'x'.repeat(80), goalPrice: -3 } }).settings;
  Tests.eq([n.goalName.length, n.goalPrice], [40, 0]);
  Tests.eq(Store.normalize({ settings: { goalName: { a: 1 } } }).settings.goalName, '');
  const d = Demo.generateQuit(Date.now(), 6);
  d.settings.goalName = 'Vélo'; d.settings.goalPrice = 100000;
  Tests.eq(/objectif : Vélo/.test(Calc.reasons(d).find((r) => r.title === 'Ton argent').text), true);
});

/* ---- Raisons, constats, calendrier ---- */
Tests.add('raisons : ta phrase en premier, progrès et bénéfices, jamais vide', () => {
  const d = Demo.generateQuit(Date.now(), 6);
  d.settings.profile.why = 'Pour respirer';
  const r = Calc.reasons(d);
  Tests.eq(r[0], { title: 'Ta raison', text: 'Pour respirer' });
  Tests.eq(r.some((x) => x.title === 'Déjà'), true);
  Tests.eq(r.filter((x) => x.title === 'Ton argent').length, 1);
  Tests.eq(Calc.reasons(Store.defaults()).length, 1);
  Tests.eq(Store.cleanProfile({ why: '  x'.padEnd(300, 'y') }).why.length, 140);
});
Tests.add('constats : rien sans assez de données ; heures, déclencheur, tendance', () => {
  Tests.eq(Calc.insights(Store.defaults()), []);
  const today = '2026-10-29';
  const d = Store.defaults();
  for (let day = 1; day <= 28; day++) {
    const key = `2026-10-${String(day).padStart(2, '0')}`;
    const n = day > 21 ? 4 : 8; // dernière semaine en baisse
    for (let i = 0; i < n; i++) d.intakes.push({ type: 'snus', ts: Dates.keyToStart(key) + (16 * 60 + i * 10) * 60000, trigger: i % 2 ? 'cafe' : null });
  }
  const out = Calc.insights(d, today);
  Tests.eq(out.length >= 3 && out.length <= 4, true, out.join(' | '));
  Tests.eq(/^100 % de tes prises tombent entre 1[56] h et 1[89] h\.$/.test(out[0]), true, out[0]);
  Tests.eq(out[1].includes('le café'), true, out[1]);
  Tests.eq(out.some((t) => t.startsWith('En baisse')), true, out.join(' | '));
  const all = out.join(' ').toLowerCase();
  ['échec', 'trop', 'mauvais'].forEach((w) => Tests.eq(all.includes(w), false, w));
});
Tests.add('constats en arrêt : baisse des envies depuis les premiers jours', () => {
  const now = new Date(2026, 9, 20, 20).getTime();
  const d = Store.defaults();
  Object.assign(d.settings, { phase: 'arret', quitStart: new Date(2026, 9, 10, 8).getTime() });
  [6, 6, 6, 4, 3, 3, 2, 2, 1, 1].forEach((n, i) => { for (let k = 0; k < n; k++) d.cravings.push({ ts: d.settings.quitStart + i * DAY_MS + (2 + k) * 3600000, trigger: 'stress', resolved: true }); });
  const out = Calc.insights(d, '2026-10-20');
  Tests.eq(out.some((t) => t.includes('ont baissé')), true, out.join(' | '));
});
Tests.add('calendrier : décalage du lundi, niveaux, jours sans nicotine', () => {
  const d = Store.defaults();
  const t = (day, h) => new Date(2026, 9, day, h).getTime();
  d.intakes = [{ type: 'snus', ts: t(1, 9) }, { type: 'snus', ts: t(2, 9) }, { type: 'snus', ts: t(2, 10) }, { type: 'vape', ts: t(2, 11) }, { type: 'vape', ts: t(2, 12) }];
  const cells = Calc.monthCells(d, '2026-10', '2026-10-05');
  Tests.eq(cells.filter((c) => c === null).length, 3); // le 1er octobre 2026 est un jeudi
  Tests.eq(cells.length, 3 + 31);
  Tests.eq(cells[3].state, 'level1'); // 1 prise = le minimum du mois
  Tests.eq(cells[4].state, 'level4'); // 4 prises = le maximum
  Tests.eq(cells[5].state, 'level0'); // aucune prise
  Tests.eq(cells[3 + 9].state, 'future');
  Object.assign(d.settings, { phase: 'arret', quitStart: t(3, 8) });
  const q = Calc.monthCells(d, '2026-10', '2026-10-05');
  Tests.eq([q[5].state, q[7].state].join(), 'clean,today');
  Tests.eq(Calc.shiftMonth('2026-01', -1), '2025-12');
  Tests.eq(Calc.shiftMonth('2026-12', 1), '2027-01');
});

/* ---- Version finale : sécurité et robustesse ---- */
Tests.add('import : clés inconnues ignorées, rien d’injecté', () => {
  const d = Store.parseImport('{"intakes":[],"settings":{"__proto__":{"polluted":1},"snusMg":9,"inconnu":"x","reduction":{"__proto__":{"p":1},"on":false}}}').data;
  Tests.eq(d.settings.snusMg, 9);
  Tests.eq('inconnu' in d.settings, false);
  Tests.eq(({}).polluted, undefined);
  Tests.eq(Object.getPrototypeOf(d.settings), Object.prototype);
  Tests.eq(Object.getPrototypeOf(d.settings.reduction), Object.prototype);
});
Tests.add('import : dates absurdes écartées (le rappel de sauvegarde reste actif)', () => {
  const d = Store.normalize({ settings: { lastExportAt: 1e15, backupSnoozeUntil: 1e15, quitStart: true } });
  Tests.eq([d.settings.lastExportAt, d.settings.backupSnoozeUntil, d.settings.quitStart], [null, null, null]);
  Tests.eq(Store.tsOrNull(''), null);
  Tests.eq(Store.tsOrNull(1000), 1000);
});
Tests.add('import : identifiants en double fusionnés, même non conventionnels', () => {
  const d = Store.normalize({ intakes: [{ id: 'a b', type: 'snus', ts: 1 }, { id: 'a b', type: 'vape', ts: 2 }] });
  Tests.eq(d.intakes.length, 1);
});
Tests.add('messages d’observation : rien sur l’arrêt', () => {
  for (let i = 0; i < 30; i++) {
    const m = Messages.forDay(Dates.addDays('2026-10-01', i), 'observe');
    Tests.eq(Messages.pools.observe.includes(m), true, m);
  }
  Tests.eq(Messages.count() >= 60, true);
});

/* ---- Corps enrichi ---- */
Tests.add('corps : usage déduit (référence, historique, questionnaire)', () => {
  const s = Store.defaults().settings;
  Tests.eq(Calc.usage(s, []), 'both');
  Tests.eq(Calc.usage({ ...s, profile: { ...s.profile, uses: 'vape' } }, []), 'vape');
  Tests.eq(Calc.usage(s, [{ type: 'snus' }]), 'snus');
  Tests.eq(Calc.usage({ ...s, profile: { ...s.profile, uses: 'vape' } }, [{ type: 'snus' }]), 'vape'); // le choix l'emporte
  Tests.eq(Calc.tracks('snus', { ...s, profile: { ...s.profile, uses: 'vape' } }, []), false);
  Tests.eq(Calc.tracks('vape', { ...s, profile: { ...s.profile, uses: 'both' } }, []), true);
  Tests.eq(Calc.defaultType({ ...s, profile: { ...s.profile, uses: 'vape' } }, []), 'vape');
  const b = { snusPerDay: 4, vapePerDay: 6, vapeMlPerDay: 1.2, days: 7 };
  Tests.eq(Calc.trackedBaseline({ ...s, baseline: b, profile: { ...s.profile, uses: 'snus' } }), { ...b, vapePerDay: 0, vapeMlPerDay: null });
  Tests.eq(Calc.trackedBaseline({ ...s, baseline: b, profile: { ...s.profile, uses: 'both' } }), b);
  const q = { ...s, baseline: b, quitStart: 1e12, snusBoxPrice: 8, snusPerBox: 20, vapeUnitPrice: 6, vapeMlPerUnit: 2, profile: { ...s.profile, uses: 'snus' } };
  Tests.near(Calc.avoided([], q, 1e12 + 2 * DAY_MS).money, 8 * 0.4);
  Tests.eq(Calc.usage({ ...s, baseline: { snusPerDay: 0, vapePerDay: 5, days: 7 } }, [{ type: 'snus' }]), 'vape');
  const keys = (u) => Calc.forUsage(SYSTEMS, u).map((x) => x.key);
  Tests.eq(keys('vape').includes('bouche'), false);
  Tests.eq(keys('snus').includes('gorge'), false);
  Tests.eq(keys('both').includes('bouche') && keys('both').includes('gorge'), true);
});
Tests.add('corps : progression des systèmes et étape du moment', () => {
  const H = 3600000;
  Tests.eq(Calc.systemProgress(12 * H, SYSTEMS[0]), 0.5);
  Tests.eq(Calc.systemProgress(1000 * H, SYSTEMS[0]), 1);
  Tests.eq(Calc.systemProgress(-5, SYSTEMS[0]), 0);
  Tests.eq(Calc.stageInfo(2 * H).title, 'Les premières heures');
  Tests.eq(Calc.stageInfo(50 * H).title, 'Le pic du manque');
  Tests.eq(Calc.stageInfo(10 * 24 * H).title, 'Ça redescend');
  Tests.eq(Calc.stageInfo(400 * 24 * H).title, 'Consolider');
});
Tests.add('corps : contenu santé prudent (repères, systèmes, étapes, effets)', () => {
  const all = [...MILESTONES.flatMap((m) => [m.text, m.more || '']), ...SYSTEMS.flatMap((x) => [x.before, x.after]),
    ...STAGES.flatMap((x) => [...x.normal, ...x.helps]), ...NICOTINE_EFFECTS.map((e) => e.text)].join(' ').toLowerCase();
  ['garanti', 'à coup sûr', 'guérit', 'définitivement', 'cigarette', 'goudron', 'monoxyde', 'échec'].forEach((w) => Tests.eq(all.includes(w), false, w));
  Tests.eq(MILESTONES.every((m) => m.more), true);
  Tests.eq(MILESTONES.every((m, i) => i === 0 || m.h > MILESTONES[i - 1].h), true);
});

/* ---- Plus malin : jours oubliés, rythme, déclencheur habituel ---- */
Tests.add('moyenne : un jour sans prise notée est oublié, pas compté à zéro', () => {
  const t = (d, h) => new Date(2026, 8, d, h).getTime();
  const intakes = [{ type: 'snus', ts: t(1, 9) }, { type: 'snus', ts: t(1, 15) }, { type: 'snus', ts: t(3, 9) }, { type: 'vape', ts: t(3, 12) }];
  const a = Calc.avgPerDay(intakes, '2026-09-05', 7);
  Tests.eq([a.days, a.skipped], [2, 2]); // 1 et 3 notés ; 2 et 4 oubliés
  Tests.near(a.total, 2);
  Tests.eq(Calc.avgPerDay([{ type: 'snus', ts: t(4, 9) }], '2026-09-04', 7), null);
});
Tests.add('rythme : première prise et écart habituels, « d’habitude à cette heure »', () => {
  const t = (d, h, m = 0) => new Date(2026, 8, d, h, m).getTime();
  const intakes = [];
  for (let d = 1; d <= 6; d++) intakes.push({ type: 'snus', ts: t(d, 8, 30) }, { type: 'snus', ts: t(d, 10, 30) }, { type: 'snus', ts: t(d, 12, 30) }, { type: 'snus', ts: t(d, 18, 30) });
  const r = Calc.rhythm(intakes, '2026-09-01', '2026-09-06');
  Tests.eq(r.firstMin, 8 * 60 + 30);
  Tests.eq(r.gapMin, 120);
  Tests.near(Calc.usualByNow(intakes, '2026-09-07', t(7, 11)), 2);
  Tests.eq(Calc.usualByNow(intakes.slice(0, 8), '2026-09-07', t(7, 11)), null);
});
Tests.add('déclencheur habituel à cette heure : mis en avant seulement s’il est net', () => {
  const t = (d, h) => new Date(2026, 8, d, h).getTime();
  const intakes = [1, 2, 3, 4].map((d) => ({ type: 'snus', ts: t(d, 8), trigger: 'cafe' })).concat([{ type: 'snus', ts: t(5, 8), trigger: 'stress' }]);
  Tests.eq(Calc.suggestTrigger(intakes, t(6, 8)), 'cafe');
  Tests.eq(Calc.suggestTrigger(intakes, t(6, 15)), null);
  Tests.eq(Calc.suggestTrigger(intakes.slice(0, 2), t(6, 8)), null);
});
