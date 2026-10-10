// Pilot automat pentru QuantRhino, prin Claude Agent SDK (plătit din creditele API).
//
// Etapa 1 (lucru): Claude lucrează singur, cu ultracode, până când bugetul de lucru
// se termină sau scrie PILOT-GATA. Nu publică nimic pe site în etapa asta.
// Etapa 2 (deploy): cu rezerva rămasă (~10$) termină curat, verifică și publică.
//
// Pornire, din folderul pilot, după `npm install`:
//   read -rsp "Lipeste cheia si apasa Enter: " K && ANTHROPIC_API_KEY="$K" node pilot.mjs
//
// Variabile opționale: SOLD (creditul de la început, implicit 122.47),
// REZERVA (implicit 10), PROIECT (implicit ~/Work), EFORT (implicit xhigh).

import { query } from '@anthropic-ai/claude-agent-sdk';
import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SOLD = Number(process.env.SOLD ?? 122.47);
const REZERVA = Number(process.env.REZERVA ?? 10);
const PROIECT = process.env.PROIECT ?? join(homedir(), 'Work');
const EFORT = process.env.EFORT ?? 'xhigh';
// Estimarea SDK-ului nu include clasificatorul de permisiuni, așa că lăsăm 10% marjă
const MARJA = 1.1;
const GATA = 'PILOT-GATA';
// Atâtea ture la rând fără nicio unealtă folosită = nu mai are ce face
const TURE_GOALE_MAX = 3;

const BUGET_LUCRU = (SOLD - REZERVA) / MARJA;
const BUGET_DEPLOY = (REZERVA - 1) / MARJA;

function verificaCheia() {
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
  if (SOLD <= REZERVA + 1) {
    console.error(`Soldul (${SOLD}$) e prea mic față de rezerva de ${REZERVA}$.`);
    process.exit(1);
  }
}

const MARCAJ_PILOT = 'pe pilot automat, plătit din creditele API';

function estePilot(fisier) {
  const buf = Buffer.alloc(65536);
  const fd = openSync(fisier, 'r');
  const n = readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  return buf.subarray(0, n).toString('utf8').includes(MARCAJ_PILOT);
}

// Transcriptul ultimei sesiuni interactive din folderul proiectului (nu al unei rulări de pilot).
// TRANSCRIPT=cale îl alege explicit.
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
    '3. Folosește workflow-uri cu mai mulți agenți: efort medium pentru etapele mecanice, xhigh pentru verificările adversariale.',
    '4. Lucrează în loturi mici și complete: cod + teste + TypeScript curat + verificare în browser. Nu lăsa nimic pe jumătate și notează în jurnal după fiecare lot.',
    '5. NU publica pe site în etapa asta: deploy-ul se face separat, la final. Execuția reală rămâne OFF.',
    '6. Nu aștepta confirmări, nu răspunde nimeni. Ce cere o decizie de produs a utilizatorului (de exemplu levierul pe piață) notezi în jurnal și treci mai departe.',
    `7. Bugetul de lucru e de aproximativ ${BUGET_LUCRU.toFixed(0)}$. Prioritizează ce are cel mai mare impact și termină loturile începute.`,
    '',
    `Când nu mai ai nimic util de făcut, scrie pe ultimul rând exact: ${GATA}`,
  ].join('\n');
}

const PROMPT_CONTINUA =
  'Continuă pe pilot automat cu următorul pas din plan. Nu aștepta confirmări. ' +
  `Dacă totul e terminat și verificat, scrie pe ultimul rând exact: ${GATA}`;

const PROMPT_DEPLOY = [
  `Bugetul de lucru s-a terminat. Au mai rămas aproximativ ${BUGET_DEPLOY.toFixed(0)}$ doar pentru finalizare. Nu mai începe nimic nou.`,
  '1. Termină sau anulează curat lotul în curs: în codul oficial nu rămâne nimic pe jumătate.',
  '2. Rulează testele, TypeScript și build-ul oficial. Dacă trec, publică build-ul nou pe site cu aceeași procedură ca la build121 (backup, verificarea publică a fișierelor, execuția reală rămâne OFF).',
  '3. Dacă ceva nu trece, NU publica și lasă site-ul pe build-ul actual.',
  '4. Scrie în jurnal starea finală: ce s-a publicat, ce a rămas și de unde se reia.',
].join('\n');

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
process.on('SIGINT', () => {
  if (oprit) process.exit(130);
  oprit = true;
  console.log('\n[Oprire cerută. Mai apasă o dată Ctrl+C ca să ieși imediat.]');
  etapaCurenta?.intrare.inchide();
  etapaCurenta?.q.interrupt().catch(() => {});
});

// Rulează o etapă. `cheltuitInainte` = costul deja inclus în totalul sesiunii reluate.
async function etapa({ nume, prompt, buget, continuaAutomat, resume, cheltuitInainte = 0 }) {
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
      settings: { ultracode: true, effortLevel: EFORT },
      ...(resume ? { resume } : {}),
    },
  });
  etapaCurenta = { intrare, q };

  let sesiune = resume ?? null;
  let total = cheltuitInainte;
  let motiv = 'inchis';
  let unelteInTura = 0;
  let tureGoale = 0;

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
        const cheltuit = total - cheltuitInainte;
        const ramasEstimat = SOLD - total * MARJA;
        console.log(`\n[${nume}: ~${cheltuit.toFixed(2)}$ din ${buget.toFixed(2)}$ · credit rămas estimat ~${ramasEstimat.toFixed(2)}$]\n`);

        const text = m.result ?? (m.errors ?? []).join('\n');
        if (m.subtype === 'error_max_budget_usd') {
          motiv = 'buget';
          intrare.inchide();
        } else if (m.is_error || m.subtype !== 'success') {
          motiv = /credit balance/i.test(text) ? 'credit' : 'eroare';
          console.log(`[Eroare: ${text || m.subtype}]`);
          intrare.inchide();
        } else if (!continuaAutomat || text.includes(GATA)) {
          motiv = 'gata';
          intrare.inchide();
        } else {
          tureGoale = unelteInTura === 0 ? tureGoale + 1 : 0;
          if (tureGoale >= TURE_GOALE_MAX) {
            motiv = 'gata';
            intrare.inchide();
          } else {
            intrare.adauga(PROMPT_CONTINUA);
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
  return { sesiune, total, motiv };
}

verificaCheia();
console.log(`Proiect: ${PROIECT} · sold de pornire ${SOLD}$ · rezervă pentru deploy ${REZERVA}$ · efort ${EFORT} + ultracode`);

const lucru = await etapa({
  nume: 'Etapa 1: lucru pe pilot automat',
  prompt: promptLucru(transcriptAnterior()),
  buget: BUGET_LUCRU,
  continuaAutomat: true,
});

if (lucru.motiv === 'credit') {
  console.log(
    'API-ul spune că nu e credit pentru rularea asta. Ori creditele promoționale nu acoperă și rulările prin Agent SDK,\n' +
      'ori s-au terminat. Verifică platform.claude.com/settings/billing.',
  );
} else if (lucru.motiv === 'oprit') {
  console.log('Oprit manual. Deploy-ul final nu s-a mai făcut.');
} else if (lucru.motiv === 'autentificare') {
  console.log('Pornește scriptul dintr-un terminal nou, cu ANTHROPIC_API_KEY setată ca în instrucțiuni.');
} else if (lucru.motiv !== 'buget' && lucru.motiv !== 'gata') {
  // Eroare neașteptată: nu publicăm pe site dintr-o stare necunoscută
  console.log('Etapa de lucru s-a oprit cu o eroare, așa că nu fac deploy. Pornește scriptul din nou după ce rezolvi eroarea.');
} else {
  const deploy = await etapa({
    nume: 'Etapa 2: finalizare și deploy',
    prompt: PROMPT_DEPLOY,
    buget: BUGET_DEPLOY,
    continuaAutomat: false,
    resume: lucru.sesiune,
    cheltuitInainte: lucru.total,
  });
  console.log(`Gata. Cost total estimat: ~${deploy.total.toFixed(2)}$ · credit rămas estimat ~${(SOLD - deploy.total * MARJA).toFixed(2)}$`);
  console.log(`Sesiunea se poate redeschide cu: claude --resume ${deploy.sesiune ?? lucru.sesiune}`);
}
