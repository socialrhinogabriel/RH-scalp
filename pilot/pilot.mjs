// Pilot automat pentru QuantRhino, prin Claude Agent SDK (plătit din creditele API).
//
// Etapa 1 (lucru): Claude lucrează singur, cu ultracode, până când bugetul de lucru
// se termină sau scrie PILOT-GATA. Nu publică nimic pe site în etapa asta.
// Etapa 2 (deploy): cu rezerva rămasă (~10$) termină curat, verifică și publică live.
//
// Pornire, din folderul pilot, după `npm install`. SOLD = creditul rămas ACUM,
// citit din platform.claude.com/settings/billing:
//   read -rsp "Lipeste cheia si apasa Enter: " K && ANTHROPIC_API_KEY="$K" SOLD=122.47 node pilot.mjs
//
// Variabile opționale: REZERVA (implicit 10), PROIECT (implicit ~/Work), EFORT (implicit xhigh),
// TRANSCRIPT (transcriptul sesiunii anterioare, dacă nu e ales bine automat).

import { query } from '@anthropic-ai/claude-agent-sdk';
import { closeSync, existsSync, openSync, readFileSync, readdirSync, readSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SOLD = Number(process.env.SOLD);
const REZERVA = Number(process.env.REZERVA ?? 10);
const PROIECT = process.env.PROIECT ?? join(homedir(), 'Work');
const EFORT = process.env.EFORT ?? 'xhigh';
// Estimarea SDK-ului nu include clasificatorul de permisiuni, așa că lăsăm 10% marjă
const MARJA = 1.1;
// La oprirea pentru buget, agenții paraleli își mai termină cererile în curs
const DEPASIRE = 4;
// Atâtea ture la rând fără nicio unealtă și fără lucru în fundal = nu mai are ce face
const TURE_GOALE_MAX = 3;
const GATA = 'PILOT-GATA';
const MARCAJ_PILOT = 'pe pilot automat, plătit din creditele API';
// Doar un indiciu pentru următoarea pornire; bugetul se calculează mereu din SOLD
const STARE = new URL('./stare.json', import.meta.url);

const BUGET_LUCRU = (SOLD - REZERVA - DEPASIRE) / MARJA;
const BUGET_DEPLOY_MAX = (REZERVA - 1) / MARJA;

function verificari() {
  if (!Number.isFinite(SOLD) || SOLD <= 0) {
    let indiciu = '';
    try {
      indiciu = ` Ultima estimare a scriptului: ~${JSON.parse(readFileSync(STARE, 'utf8')).ramas.toFixed(2)}$.`;
    } catch {}
    console.error(
      'Scrie creditul rămas ACUM, din platform.claude.com/settings/billing, de exemplu: SOLD=122.47 node pilot.mjs.' + indiciu,
    );
    process.exit(1);
  }
  const cheie = process.env.ANTHROPIC_API_KEY ?? '';
  if (!/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(cheie)) {
    console.error(
      'Cheia API lipsește sau s-a stricat la copiere (are caractere ciudate).\n' +
        'Copiaz-o din nou direct din platform.claude.com și pornește iar.',
    );
    process.exit(1);
  }
  if (!existsSync(PROIECT) || readdirSync(PROIECT).length === 0) {
    console.error(`Folderul proiectului lipsește sau e gol: ${PROIECT}. Setează PROIECT=calea/corectă.`);
    process.exit(1);
  }
  if (SOLD < REZERVA / 2) {
    console.error(`Creditul de ${SOLD}$ e prea mic chiar și pentru un deploy sigur.`);
    process.exit(1);
  }
}

function estePilot(fisier) {
  const buf = Buffer.alloc(65536);
  const fd = openSync(fisier, 'r');
  const n = readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  return buf.subarray(0, n).toString('utf8').includes(MARCAJ_PILOT);
}

// Transcriptul ultimei sesiuni interactive din folderul proiectului (nu al unei rulări de pilot)
function transcriptAnterior() {
  if (process.env.TRANSCRIPT) return process.env.TRANSCRIPT;
  const dir = join(homedir(), '.claude', 'projects', PROIECT.replace(/[^A-Za-z0-9]/g, '-'));
  if (!existsSync(dir)) return null;
  const fisiere = readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return fisiere.find((f) => !estePilot(f)) ?? null;
}

function promptLucru(transcript) {
  return [
    `Continui lucrul la QuantRhino ${MARCAJ_PILOT}. Nimeni nu e la tastatură.`,
    'Sesiunea anterioară s-a oprit în timpul auditului profund pe build121, pentru că s-a terminat limita de utilizare.',
    '',
    '1. Citește mai întâi jurnalul, notele de reluare și memoria proiectului: starea exactă și cerințele utilizatorului.' +
      (transcript
        ? ` Transcriptul sesiunii anterioare e în ${transcript}. Caută în el doar ce lipsește din note`
        : ' Caută în note') +
      ' (semnale bullish/bearish exacte, semne mici pe fiecare oscilator gen „Epuizat” sau divergență, polish pe toate oscilatoarele ca la MACD, fluiditate la zoom out + mișcare spre 144 FPS, actualizare live fără lag, temperatura din bară).',
    '2. Reia auditul de unde a rămas, apoi fă reparațiile și îmbunătățirile în ordinea riscului pentru bani: întâi corectitudinea indicatorilor, a semnalelor și a căii ordinelor, apoi fluiditatea, apoi UI-ul.',
    '3. Folosește workflow-uri cu mai mulți agenți: efort medium pentru etapele mecanice, xhigh pentru verificările adversariale. Cât rulează un workflow în fundal, așteaptă-i notificarea și nu edita aceleași fișiere în paralel.',
    '4. Lucrează în loturi mici și complete: cod + teste + TypeScript curat + verificare în browser. Nu lăsa nimic pe jumătate și notează în jurnal după fiecare lot.',
    '5. NU publica pe site în etapa asta: deploy-ul se face separat, la final. Execuția reală rămâne OFF.',
    '6. Nu aștepta confirmări, nu răspunde nimeni. Ce cere o decizie de produs a utilizatorului (de exemplu levierul pe piață) notezi în jurnal și treci mai departe.',
    `7. Bugetul de lucru e de aproximativ ${BUGET_LUCRU.toFixed(0)}$. Prioritizează ce are cel mai mare impact și termină loturile începute.`,
    '',
    `Când nu mai ai nimic util de făcut, scrie pe ultimul rând exact: ${GATA}`,
  ].join('\n');
}

const CONTINUA_LUCRU =
  'Continuă pe pilot automat cu următorul pas din plan. Nu aștepta confirmări. ' +
  `Dacă totul e terminat și verificat, scrie pe ultimul rând exact: ${GATA}`;

function promptDeploy(buget, fresh) {
  return [
    `Etapa finală: scopul e ca munca verificată să ajungă LIVE pe site. Ai aproximativ ${buget.toFixed(0)}$. Nu mai începe nimic nou și nu porni workflow-uri.`,
    ...(fresh ? [`0. Rulezi ${MARCAJ_PILOT}, fără nimeni la tastatură. Citește întâi jurnalul și notele de reluare din proiect ca să afli ce s-a lucrat și ce e gata de publicat.`] : []),
    '1. Oprește curat lotul în curs: ce nu e terminat și testat se scoate (revii la ultima stare bună), nu rămâne nimic pe jumătate.',
    '2. Rulează testele, TypeScript și build-ul oficial. Dacă un lot pică, scoate-l și reîncearcă cu restul, până ai un build care trece.',
    '3. Publică pe site build-ul care trece, cu aceeași procedură ca la build121 (backup, verificarea publică a fișierelor, execuția reală rămâne OFF). Nu publica niciodată un build care pică testele sau build-ul.',
    '4. La final scrie scurt în jurnal ce s-a publicat și de unde se reia.',
    'Pe ultimul rând scrie exact „DEPLOY-OK build<număr>” dacă publicarea a reușit și e verificată, sau „DEPLOY-NU: <motiv>” dacă nu s-a putut publica nimic în siguranță.',
  ].join('\n');
}

const CONTINUA_DEPLOY =
  'Continuă finalizarea și publicarea. Când ai terminat, scrie pe ultimul rând exact „DEPLOY-OK build<număr>” sau „DEPLOY-NU: <motiv>”.';

function salveazaStare(stare) {
  try {
    writeFileSync(STARE, JSON.stringify(stare));
  } catch {}
}

// Intrare pentru modul streaming: mesajele noi se adaugă după fiecare tură
function coada() {
  const mesaje = [];
  let trezeste;
  let inchisa = false;
  return {
    adauga(text) {
      mesaje.push({ type: 'user', message: { role: 'user', content: text }, parent_tool_use_id: null });
      trezeste?.();
    },
    inchide() {
      inchisa = true;
      trezeste?.();
    },
    async *[Symbol.asyncIterator]() {
      while (true) {
        if (mesaje.length) yield mesaje.shift();
        else if (inchisa) return;
        else await new Promise((r) => (trezeste = r));
      }
    },
  };
}

let oprit = false;
let etapaCurenta = null;
function opreste() {
  if (oprit) process.exit(130);
  oprit = true;
  console.log('\n[Oprire cerută. Mai apasă o dată Ctrl+C ca să ieși imediat.]');
  etapaCurenta?.intrare.inchide();
  etapaCurenta?.q.interrupt().catch(() => {});
}
process.on('SIGINT', opreste);
process.on('SIGHUP', opreste);

const ultimulRand = (text) => text.trim().split('\n').pop()?.trim() ?? '';

// Rulează o etapă până apare unul dintre marcaje pe ultimul rând, se termină bugetul sau apare o eroare.
// `cheltuitInainte` = costul deja inclus în totalul sesiunii reluate.
async function etapa({ nume, prompt, continua, marcaje, buget, setari, resume, cheltuitInainte = 0 }) {
  console.log(`\n=== ${nume} (buget ~${buget.toFixed(2)}$) ===\n`);
  const intrare = coada();
  intrare.adauga(prompt);
  const q = query({
    prompt: intrare,
    options: {
      cwd: PROIECT,
      model: 'claude-opus-5-5',
      systemPrompt: { type: 'preset', preset: 'claude_code' },
      permissionMode: 'auto',
      permissionPrompts: 'none',
      maxBudgetUsd: buget,
      settings: setari,
      ...(resume ? { resume } : {}),
    },
  });
  etapaCurenta = { intrare, q };

  let sesiune = resume ?? null;
  let total = cheltuitInainte;
  let motiv = 'inchis';
  let text = '';
  let unelteInTura = 0;
  let tureGoale = 0;
  // Workflow-uri și agenți care rulează în fundal; când se termină, CLI-ul pornește singur tura următoare
  let fondActiv = 0;

  try {
    for await (const m of q) {
      if (m.type === 'system' && m.subtype === 'init') {
        sesiune = m.session_id;
        if (m.apiKeySource !== 'ANTHROPIC_API_KEY') {
          // Altă autentificare (de exemplu login-ul claude.ai) nu ar consuma creditele promoționale
          console.log(`[Oprit: Claude nu folosește cheia ta API, ci „${m.apiKeySource}”.]`);
          motiv = 'autentificare';
          intrare.inchide();
          await q.interrupt().catch(() => {});
          break;
        }
        if (m.permissionMode !== 'auto') {
          console.log(`[Atenție: modul de permisiuni e „${m.permissionMode}”, nu „auto”; comenzile care cer aprobare vor fi refuzate.]`);
        }
      } else if (m.type === 'system' && m.subtype === 'background_tasks_changed') {
        fondActiv = (m.tasks ?? []).filter(
          (t) => !t.ambient && (t.task_type === 'local_workflow' || t.task_type === 'local_agent'),
        ).length;
      } else if (m.type === 'assistant' && m.parent_tool_use_id === null) {
        for (const b of m.message.content) {
          if (b.type === 'text' && b.text.trim()) console.log(b.text);
          else if (b.type === 'tool_use') {
            unelteInTura++;
            console.log(`  · ${b.name}`);
          }
        }
      } else if (m.type === 'result') {
        sesiune = m.session_id;
        if (m.total_cost_usd != null) total = m.total_cost_usd;
        const ramas = SOLD - total * MARJA;
        console.log(
          `\n[${nume}: ~${(total - cheltuitInainte).toFixed(2)}$ din ${buget.toFixed(2)}$ · credit rămas estimat ~${ramas.toFixed(2)}$` +
            (fondActiv ? ` · ${fondActiv} în fundal` : '') +
            ']\n',
        );
        salveazaStare({ ramas, sesiune });

        text = m.result ?? (m.errors ?? []).join('\n');
        const rand = ultimulRand(text);
        if (m.subtype === 'error_max_budget_usd') {
          motiv = 'buget';
          intrare.inchide();
        } else if (m.is_error || m.subtype !== 'success') {
          motiv = /credit balance/i.test(text) ? 'credit' : 'eroare';
          console.log(`[Eroare: ${text || m.subtype}]`);
          intrare.inchide();
        } else if (marcaje.some((x) => rand.includes(x))) {
          // Dacă mai rulează ceva în fundal, CLI-ul îl termină înainte să închidă
          motiv = 'gata';
          intrare.inchide();
        } else if (fondActiv > 0) {
          // Lucrul continuă în fundal: nu trimitem nimic, notificarea pornește singură tura următoare
        } else {
          tureGoale = unelteInTura === 0 ? tureGoale + 1 : 0;
          if (tureGoale >= TURE_GOALE_MAX) {
            motiv = 'gol';
            intrare.inchide();
          } else {
            intrare.adauga(continua);
          }
        }
        unelteInTura = 0;
      }
    }
  } catch (err) {
    motiv = /credit balance/i.test(err.message) ? 'credit' : 'eroare';
    console.log(`[Eroare: ${err.message}]`);
  }
  etapaCurenta = null;
  if (oprit) motiv = 'oprit';
  return { sesiune, total, motiv, text };
}

async function deploy({ ramas, resume, cheltuitInainte }) {
  const buget = Math.min(BUGET_DEPLOY_MAX, (ramas - 1) / MARJA);
  if (buget < 3) {
    console.log(`Credit rămas estimat ~${ramas.toFixed(2)}$: prea puțin pentru un deploy sigur. Nu public nimic; site-ul rămâne pe build-ul actual.`);
    return;
  }
  const rez = await etapa({
    nume: 'Etapa 2: finalizare și deploy live',
    prompt: promptDeploy(buget, !resume),
    continua: CONTINUA_DEPLOY,
    marcaje: ['DEPLOY-OK', 'DEPLOY-NU'],
    buget,
    // Fără workflow-uri și cu efort mai mic, ca rezerva să ajungă până la publicare
    setari: { ultracode: false, effortLevel: 'medium' },
    resume,
    cheltuitInainte,
  });
  const rest = (SOLD - rez.total * MARJA).toFixed(2);
  const rand = ultimulRand(rez.text);
  if (rez.motiv === 'gata' && rand.includes('DEPLOY-OK')) {
    console.log(`\nPublicat live: ${rand}. Cost total estimat ~${rez.total.toFixed(2)}$ · credit rămas estimat ~${rest}$`);
  } else if (rez.motiv === 'gata') {
    console.log(`\nNu s-a publicat nimic: ${rand}. Site-ul rămâne pe build-ul actual. Credit rămas estimat ~${rest}$`);
  } else {
    console.log(
      `\n!!! ATENȚIE: etapa de deploy s-a oprit înainte de final (motiv: ${rez.motiv}). Publicarea poate fi incompletă.\n` +
        'Verifică site-ul ACUM și ultimul rând din jurnal. Dacă site-ul e stricat, restaurează backup-ul făcut înainte de publicare. !!!\n' +
        `Credit rămas estimat ~${rest}$`,
    );
  }
  if (rez.sesiune) console.log(`Sesiunea se poate redeschide cu: claude --resume ${rez.sesiune}`);
}

verificari();
console.log(`Proiect: ${PROIECT} · credit ${SOLD}$ · rezervă pentru deploy ${REZERVA}$ · efort ${EFORT} + ultracode`);

if (BUGET_LUCRU < 2) {
  console.log('Creditul ajunge doar pentru finalizare, așa că trec direct la deploy.');
  await deploy({ ramas: SOLD });
} else {
  const lucru = await etapa({
    nume: 'Etapa 1: lucru pe pilot automat',
    prompt: promptLucru(transcriptAnterior()),
    continua: CONTINUA_LUCRU,
    marcaje: [GATA],
    buget: BUGET_LUCRU,
    setari: { ultracode: true, effortLevel: EFORT },
  });

  if (lucru.motiv === 'credit') {
    console.log(
      'API-ul spune că nu e credit pentru rularea asta. Ori creditele promoționale nu acoperă și rulările prin Agent SDK,\n' +
        'ori s-au terminat. Verifică platform.claude.com/settings/billing.',
    );
  } else if (lucru.motiv === 'oprit') {
    console.log('Oprit manual. Deploy-ul final nu s-a mai făcut. Ca să-l faci, pornește din nou cu SOLD=<creditul rămas>.');
  } else if (lucru.motiv === 'autentificare') {
    console.log('Pornește scriptul dintr-un terminal nou, cu ANTHROPIC_API_KEY setată ca în instrucțiuni.');
  } else if (lucru.motiv === 'eroare' || lucru.motiv === 'inchis') {
    // Stare necunoscută: nu publicăm pe site
    console.log('Etapa de lucru s-a oprit cu o eroare, așa că nu fac deploy. Pornește din nou cu SOLD=<creditul rămas> după ce rezolvi eroarea.');
  } else {
    await deploy({ ramas: SOLD - lucru.total * MARJA, resume: lucru.sesiune, cheltuitInainte: lucru.total });
  }
}
