// crew.js — Crew profile modals
(function() {
// ── CREW PROFILE MODALS ─────────────────────────────────────────────
const CREW_DATA = {
  wiseman: {
    name:    'REID WISEMAN',
    role:    'CDR — COMMANDER',
    agency:  'NASA',
    flag:    '🇺🇸',
    photo:   'https://www.nasa.gov/wp-content/uploads/2023/06/jsc2023e0016434-alt.jpg',
    missions: [
      'ISS Expedition 40/41 (2014) — 165 days in space',
      'Two spacewalks totalling 13h 5m',
      'Chief of the NASA Astronaut Office, 2020–2024',
    ],
    firsts: [
      'Most experienced commander on a NASA lunar-distance mission',
    ],
    quote: '"We\'re not just going back to the Moon — we\'re going for all of us."',
    bio:   'U.S. Navy Captain and former F/A-18 test pilot. Selected by NASA in 2009. Commanded ISS Expedition 41 before becoming Chief of the Astronaut Office.',
  },
  glover: {
    name:    'VICTOR GLOVER',
    role:    'PLT — PILOT',
    agency:  'NASA',
    flag:    '🇺🇸',
    photo:   'https://www.nasa.gov/wp-content/uploads/2023/06/jsc2023e0016433-alt.jpg',
    missions: [
      'SpaceX Crew-1 (Nov 2020 – May 2021) — 168 days aboard ISS',
      '4 spacewalks totalling 23h 37m',
      'First operational Crew Dragon long-duration mission',
    ],
    firsts: [
      '★ FIRST person of colour to travel beyond low Earth orbit',
      'First Black pilot on a long-duration ISS mission',
    ],
    quote: '"The sky is not the limit — it never was."',
    bio:   'U.S. Navy Commander and naval aviator. Flew F/A-18 and F-35 jets. Selected by NASA in 2013. Crew-1 pilot, setting a precedent for Commercial Crew operations.',
  },
  koch: {
    name:    'CHRISTINA KOCH',
    role:    'MS — MISSION SPECIALIST',
    agency:  'NASA',
    flag:    '🇺🇸',
    photo:   'https://www.nasa.gov/wp-content/uploads/2023/06/jsc2023e0016435-alt.jpg',
    missions: [
      'ISS Expedition 59/60/61 (2019–2020) — 328 consecutive days',
      'Then-record for longest single spaceflight by a woman',
      'First all-female spacewalk with Jessica Meir (Oct 2019)',
    ],
    firsts: [
      '★ FIRST woman to travel beyond low Earth orbit',
      '★ Holds women\'s record: 328 consecutive days in space',
      '★ First all-female spacewalk (with Jessica Meir)',
    ],
    quote: '"Exploration is not a choice, it\'s an imperative."',
    bio:   'Electrical engineer and NASA astronaut selected in 2013. Spent nearly a year on the ISS, conducting research on human health in microgravity. Holds multiple records for women in spaceflight.',
  },
  hansen: {
    name:    'JEREMY HANSEN',
    role:    'MS — MISSION SPECIALIST',
    agency:  'CSA',
    flag:    '🇨🇦',
    photo:   'https://www.nasa.gov/wp-content/uploads/2023/06/jsc2023e0016436-alt.jpg',
    missions: [
      'Artemis II — First spaceflight',
      'Over 2,000 flight hours on CF-18 Hornet jets',
      'CSA Director of Operations at JSC (2018–2021)',
    ],
    firsts: [
      '★ FIRST Canadian to travel beyond low Earth orbit',
      '★ FIRST non-American to fly on a lunar mission',
      '★ One of only two Canadians active in deep-space programmes',
    ],
    quote: '"Canada has always been an explorer nation. Now we go to the Moon."',
    bio:   'Canadian Armed Forces Colonel and CF-18 fighter pilot. Selected as a CSA astronaut in 2009. Has supported ISS missions from Mission Control and served as astronaut liaison in Russia.',
  },
  douglas: {
    name:    'ANDRÉ DOUGLAS',
    role:    'MS — BACKUP MISSION SPECIALIST',
    agency:  'NASA',
    flag:    '🇺🇸',
    photo:   'https://www.nasa.gov/wp-content/uploads/2021/12/astronaut_candidate_andre_douglas.jpg',
    missions: [
      'Artemis II — Backup Mission Specialist (named 2024)',
      'Johns Hopkins APL — DART planetary defense mission',
      'Maritime robotics & space exploration research at APL',
    ],
    firsts: [
      'PhD in Systems Engineering (George Washington University)',
      'Former U.S. Coast Guard officer — naval architect & salvage engineer',
      '5 degrees: mech. engineering, naval architecture, electrical/computer engineering',
      'Black Engineer of the Year Award recipient',
      'White House Fellowship National Finalist',
    ],
    quote: '"From the Coast Guard to the cosmos — service is at the core of everything I do."',
    bio:   'Born in Miami, raised in Chesapeake, Virginia. Former U.S. Coast Guard officer with 5 degrees and a PhD in Systems Engineering from George Washington University. Previously at Johns Hopkins Applied Physics Lab on DART (planetary defense) and maritime robotics. Selected as NASA astronaut candidate 2021. Named Artemis II backup crew 2024.',
  },
  gibbons: {
    name:    'JENNI GIBBONS',
    role:    'MS — BACKUP MISSION SPECIALIST',
    agency:  'CSA',
    flag:    '🇨🇦',
    photo:   'https://www.asc-csa.gc.ca/images/recherche/tiles/b4c3e9c7-e839-4569-ab6a-a4b14607649b.jpg',
    missions: [
      'Artemis II — Backup Mission Specialist (named 2024)',
      'First spaceflight',
    ],
    firsts: [
      'Would be second Canadian beyond low Earth orbit',
      'CSA astronaut candidate',
    ],
    quote: '"Canada\'s commitment to space exploration runs deep — I\'m proud to carry that forward."',
    bio:   'Canadian Space Agency astronaut selected as Artemis II backup crew alongside André Douglas. Would be the second Canadian to travel beyond low Earth orbit if called upon. CSA astronaut candidate.',
  },
};

const SILHOUETTE = '👤';
const overlay    = document.getElementById('crew-modal-overlay');
const modal      = document.getElementById('crew-modal');

function openCrewModal(key) {
  const d = CREW_DATA[key];
  if (!d) return;

  // Photo with fallback
  const photo = document.getElementById('crew-modal-photo');
  photo.src   = d.photo;
  photo.style.display = 'block';
  photo.onerror = () => {
    photo.style.display = 'none';
  };

  document.getElementById('cm-name').textContent   = d.name;
  document.getElementById('cm-role').textContent   = d.role;
  document.getElementById('cm-flag').textContent   = d.flag;
  document.getElementById('cm-agency').textContent = d.agency;

  document.getElementById('cm-missions').innerHTML =
    d.missions.map(m => `<div style="margin-bottom:3px;">· ${m}</div>`).join('');

  document.getElementById('cm-firsts').innerHTML =
    d.firsts.map(f => `<div class="crew-modal-first">${f}</div>`).join('');

  document.getElementById('cm-quote').textContent = d.quote;

  overlay.classList.add('open');
  overlay.style.opacity = '1';
  overlay.style.pointerEvents = 'all';
  document.body.style.overflow = 'hidden';
}

function closeCrewModal() {
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  setTimeout(() => overlay.classList.remove('open'), 260);
  document.body.style.overflow = '';
}

document.getElementById('crew-modal-close').addEventListener('click', closeCrewModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeCrewModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCrewModal(); });

document.querySelectorAll('.crew-strip-member[data-crew]').forEach(el => {
  el.addEventListener('click', () => openCrewModal(el.dataset.crew));
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCrewModal(el.dataset.crew);
    }
  });
});
})();
