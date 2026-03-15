/* --- STATE VARIABLES --- */
let mode = 'std', origin = 'CW', special = { STR: 5, PER: 5, END: 5, CHA: 5, INT: 5, AGI: 5, LCK: 5 };
let currentSort = 'az';
let skillPoints = { BARTER:0,'BIG GUNS':0,'ENERGY WEAPONS':0,EXPLOSIVES:0,GUNS:0,LOCKPICK:0,MEDICINE:0,'MELEE WEAPONS':0,REPAIR:0,SCIENCE:0,SNEAK:0,SPEECH:0,SURVIVAL:0,UNARMED:0 };
let charLevel = 1;
let levelUpBonuses = []; // Tracks level-up bonus choices: 'hp', 'ap', or 'cw' for each level
let showEligibleOnly = false;
let skillBooksFound = { BARTER:0,'BIG GUNS':0,'ENERGY WEAPONS':0,EXPLOSIVES:0,GUNS:0,LOCKPICK:0,MEDICINE:0,'MELEE WEAPONS':0,REPAIR:0,SCIENCE:0,SNEAK:0,SPEECH:0,SURVIVAL:0,UNARMED:0 };
let _lvlupSession = {}, _lvlupPointsLeft = 0;
let _lvlupAttributeChoice = null; // Tracks current level-up attribute choice: 'hp', 'ap', or 'cw'
let _itTargetRow = null; // tracks which prog-row triggered the Intense Training modal
let _itCancelled = false; // tracks if IT modal was cancelled
let _hydrating = false; // true during hydrate() — suppresses choice modals (IT, Action Star, Tag!)
// skillHistory entry schema: [{level, allocation:{skill:pts_spent}, gains:{skill:pts_gained}, tagged:[...], pointsTotal}]
let skillHistory = [];
const sKeys = ["STR", "PER", "END", "CHA", "INT", "AGI", "LCK"];
const skills = ["BARTER", "BIG GUNS", "ENERGY WEAPONS", "EXPLOSIVES", "GUNS", "LOCKPICK", "MEDICINE", "MELEE WEAPONS", "REPAIR", "SCIENCE", "SNEAK", "SPEECH", "SURVIVAL", "UNARMED"];

/* ===== SKILL ENGINE ===== */
/* [SKILL_GOVERNING — moved to data.js] */
/* [SKILL_BOOKS — moved to data.js] */
function hasIdeologue() {
    return getChosenTraitNames && getChosenTraitNames().some(n => n.toLowerCase() === 'ideologue');
}
function bookBonus(s) {
    const count = skillBooksFound[s] || 0;
    if (!count) return 0;
    return count * (hasIdeologue() ? 3 : 2);
}

/* [SKILL_REQ_MAP — moved to data.js] */

// GECK formula: Skill = 2 + (GoverningSpecial * 2) + Ceil(Luck * 0.5)
function skillBase(s) {
    const stat = SKILL_GOVERNING[s];
    const primary = special[stat] || 1;
    const lck = special.LCK || 1;
    return 2 + (primary * 2) + Math.ceil(lck * 0.5);
}
function getTaggedSkills() {
    const t = new Set();
    document.querySelectorAll('#tag-area input').forEach((cb, i) => { if (cb.checked && skills[i]) t.add(skills[i]); });
    // Include 4th tag from Tag! perk if set
    if (_fourthTagSkill && !t.has(_fourthTagSkill)) t.add(_fourthTagSkill);
    return t;
}
function skillTotal(s) {
    const _tb = getActiveTraitBonuses ? getActiveTraitBonuses().skillDelta : {};
    const _pb = getActivePerkBonuses  ? getActivePerkBonuses().perkSkillDelta : {};
    const { skillDelta: _cd } = getConditionalToggleDelta ? getConditionalToggleDelta() : { skillDelta: {} };
    const _td = _tb[s]||0, _pd = _pb[s]||0, _cdd = _cd[s]||0;
    const _bd = bookBonus(s);
    return Math.min(100, Math.max(0, skillBase(s) + _td + _pd + _cdd + (skillPoints[s]||0) + _bd));
}

/* skillBase WITHOUT conditional toggles — for eligibility/perk requirement checks */
function skillBaseForEligibility(s) {
    const _tb = getActiveTraitBonuses ? getActiveTraitBonuses().skillDelta : {};
    const _pb = getActivePerkBonuses  ? getActivePerkBonuses().perkSkillDelta : {};
    const _td = _tb[s]||0, _pd = _pb[s]||0;
    const _bd = bookBonus(s);
    return Math.min(100, Math.max(0, skillBase(s) + _td + _pd + (skillPoints[s]||0) + _bd));
}
// GECK wiki formula: Floor(Min(INT,9) * 0.5 + 10)
// This equals 10 + floor(INT/2), capped at INT 9 = 14 pts
// HC uses a reduced base of 3 with similar scaling
function pointsPerLevel() {
    const int = Math.max(1, special.INT || 1);
    let base;
    if (mode === 'hc') {
        base = Math.floor(Math.min(int, 9) * 0.5) + 3;
    } else {
        base = Math.floor(Math.min(int, 9) * 0.5 + 10);
    }
    // Architect toggle: +floor(INT/2) when indoors
    const { skillPtsPerLevel } = getConditionalToggleDelta();
    return base + (skillPtsPerLevel || 0);
}

/* --- PERSISTENCE OBJECT --- */
let regionalStorage = { 'CW': { quests: [], colls: [] }, 'MW': { quests: [], colls: [] } };

/* --- PERK DATA (from Nuclear Sunset Perk Sheet) --- */
/* [PERKS_DATA — moved to data.js] */

/* [TRAITS_DATA — moved to data.js] */

/* ===== TRAIT STAT / SKILL BONUS DEFINITIONS =====
   Permanent, unconditional changes only.
   Conditional bonuses stored in TRAIT_CONDITIONAL for tooltip display. */
/* [TRAIT_BONUSES — moved to data.js] */

// Traits with conditional SPECIAL or skill effects — shown with ⚡ indicator
/* [TRAIT_CONDITIONAL_NAMES — moved to data.js] */



/* ===== UNDO SYSTEM (last 5 states) ===== */
let _undoStack = [];  // each entry = JSON string of collectData()
let _undoPaused = false;  // prevent capture during hydrate

function pushUndoState() {
    if (_undoPaused) return;
    const snap = JSON.stringify(collectData());
    // Don't push duplicate of the last state
    if (_undoStack.length && _undoStack[_undoStack.length - 1] === snap) return;
    _undoStack.push(snap);
    if (_undoStack.length > 5) _undoStack.shift();
    updateUndoBtn();
}

function undoLastAction() {
    if (_undoStack.length < 2) return; // need at least current + one prior
    _undoStack.pop(); // discard current state
    const prev = _undoStack[_undoStack.length - 1];
    if (!prev) return;
    _undoPaused = true;
    try {
        hydrate(JSON.parse(prev));
    } finally {
        _undoPaused = false;
    }
    updateUndoBtn();
    // Flash the undo button
    const btn = document.getElementById('undo-btn');
    if (btn) { btn.classList.add('undo-flash'); setTimeout(() => btn.classList.remove('undo-flash'), 600); }
}

function updateUndoBtn() {
    const btn = document.getElementById('undo-btn');
    if (!btn) return;
    const canUndo = _undoStack.length >= 2;
    btn.disabled = !canUndo;
    btn.title = canUndo ? `UNDO LAST ACTION (${_undoStack.length - 1} STEP${_undoStack.length > 2 ? 'S' : ''} AVAILABLE)` : 'NOTHING TO UNDO';
    btn.style.opacity = canUndo ? '1' : '0.35';
}

/* ===== SPECIAL RANK TITLES ===== */
/* [SPECIAL_RANKS — moved to data.js] */

function getSpecialRank(k) {
    const ranks = SPECIAL_RANKS[k];
    if (!ranks) return '';
    const val = Math.max(1, Math.min(10, special[k]));
    return ranks[val - 1] || '';
}

/* ===== PERK SKILL/SPECIAL BONUSES (permanent unconditional) ===== */
// Source tag: 'P' = perk, used to distinguish from trait 'T' deltas
/* [PERK_SKILL_BONUSES — moved to data.js] */

function getActivePerkBonuses() {
    // Collect all perk names currently in the build
    const allPerkEls = document.querySelectorAll(
        '#prog-list .prog-name-input, #extra-perk-list .prog-name-input'
    );
    const perkSpecialDelta = {STR:0,PER:0,END:0,CHA:0,INT:0,AGI:0,LCK:0};
    const perkSkillDelta = {};
    for (const el of allPerkEls) {
        const name = (el.value || '').trim();
        if (!name) continue;
        const bonus = PERK_SKILL_BONUSES[name];
        if (!bonus) continue;
        if (bonus.special) {
            for (const [k,v] of Object.entries(bonus.special)) {
                if (perkSpecialDelta[k] !== undefined) perkSpecialDelta[k] += v;
            }
        }
        if (bonus.skills) {
            for (const [k,v] of Object.entries(bonus.skills)) {
                perkSkillDelta[k] = (perkSkillDelta[k]||0) + v;
            }
        }
    }
    return { perkSpecialDelta, perkSkillDelta };
}

function getActiveTraitBonuses() {
    const specialDelta = {STR:0,PER:0,END:0,CHA:0,INT:0,AGI:0,LCK:0};
    const skillDelta = {};
    const activeNames = getChosenTraitNames();
    for (const name of activeNames) {
        const bonus = TRAIT_BONUSES[name];
        if (!bonus) continue;
        if (bonus.special) {
            for (const [k,v] of Object.entries(bonus.special)) {
                if (specialDelta[k] !== undefined) specialDelta[k] += v;
            }
        }
        if (bonus.skills) {
            if (bonus.skills.__ALL__ !== undefined) {
                for (const s of skills) skillDelta[s] = (skillDelta[s]||0) + bonus.skills.__ALL__;
            } else {
                for (const [k,v] of Object.entries(bonus.skills)) {
                    skillDelta[k] = (skillDelta[k]||0) + v;
                }
            }
        }
    }
    // Flag which active traits are conditional
    const hasConditional = activeNames.some(n => TRAIT_CONDITIONAL_NAMES.has(n));
    return { specialDelta, skillDelta, hasConditional };
}

/* [REWARD_PERKS_DATA — moved to data.js] */
/* [INTERNALIZED_TRAITS_DATA — moved to data.js] */
/* [IMPLANTS_DATA — moved to data.js] */

/* ===== TRAIT SYSTEM STATE ===== */
let _traitSlotId = null; // which slot is pending selection
let implantsTaken = {};  // { "STR": true, "NEMEAN": true, ... }
let rewardPerksList = []; // [{ name, notes }]
let internalizedTraitsList = []; // [{ name, notes }]
let _fourthTagSkill = null; // 4th tag skill from Tag! perk
let startingTraits = []; // free-form list of starting traits

/* === CONDITIONAL TOGGLE STATE ===
 * Tracks which conditional perk/trait effects are currently "active" for display.
 * Key = perk or trait name, Value = true/false
 * IMPORTANT: These NEVER affect perk eligibility checks — only visual display.
 */
let conditionalToggles = {}; // e.g. { "Alertness": true, "Night Person": false }

function setConditionalToggle(name, val) {
    conditionalToggles[name] = !!val;
    updateAll();          // full re-render so skills, SPECIAL badges, and overview all sync
    triggerAutosave();
}

function isConditionalActive(name) {
    return !!conditionalToggles[name];
}

/* Returns only conditional toggle bonuses for currently toggled-on items */
function getConditionalToggleDelta() {
    const specDelta = {};
    const skillDelta = {};
    let skillPtsPerLevel = 0;
    for (const [name, isOn] of Object.entries(conditionalToggles)) {
        if (!isOn) continue;
        const bonus = CONDITIONAL_TOGGLE_BONUSES[name];
        if (!bonus) continue;
        if (bonus.special) {
            for (const [k, v] of Object.entries(bonus.special)) {
                specDelta[k] = (specDelta[k] || 0) + v;
            }
        }
        if (bonus.skills) {
            for (const [k, v] of Object.entries(bonus.skills)) {
                skillDelta[k] = (skillDelta[k] || 0) + v;
            }
        }
        if (bonus.skillPtsPerLevel) {
            // Architect: +floor(INT / 2) skill points per level when indoors
            skillPtsPerLevel += Math.floor((special.INT || 1) / 2);
        }
    }
    return { specDelta, skillDelta, skillPtsPerLevel };
}

/* ===== TRAIT REQUIREMENTS ===== */
const TRAIT_STAT_MAP = {
  STR:'STR', PER:'PER', END:'END', CHR:'CHA', CHA:'CHA', INT:'INT', AGL:'AGI', AGI:'AGI', LCK:'LCK'
};

function getChosenTraitNames() {
    const names = [];
    document.querySelectorAll('.trait-slot-row').forEach(row => {
        const n = (row.getAttribute('data-chosen') || '').trim();
        if (n) names.push(n);
    });
    startingTraits.forEach(t => { if (t.name) names.push(t.name); });
    return names;
}

/* Returns a Map of UPPERCASE perk name → number of times it appears in the build */
function getTakenPerkCounts() {
    const counts = new Map();
    document.querySelectorAll(
        '#prog-list .prog-row:not(.trait-slot-row) .prog-name-input, #extra-perk-list .prog-row .prog-name-input'
    ).forEach(input => {
        const raw = (input.value || '').trim();
        if (!raw) return;
        // Strip rank suffix like " (Rank 2)" added by selectPerkInRow
        const name = raw.replace(/\s*\(Rank\s+\d+\)\s*$/i, '').trim().toUpperCase();
        if (name) counts.set(name, (counts.get(name) || 0) + 1);
    });
    return counts;
}

function checkTraitEligible(trait) {
    if (!trait.req || trait.req.trim() === '') return true;
    const chosen = getChosenTraitNames();
    const parts = trait.req.split(',').map(p => p.trim());
    for (const part of parts) {
        const up = part.toUpperCase();
        // NOT check
        if (up.startsWith('NOT ')) {
            const blocked = up.slice(4).trim();
            if (chosen.includes(blocked)) return false;
            continue;
        }
        // Level check
        const lvlM = up.match(/^LEVEL\s+(\d+)$/);
        if (lvlM) {
            if (charLevel < parseInt(lvlM[1])) return false;
            continue;
        }
        // SPECIAL max cap: STAT < N
        const capM = up.match(/^(STR|PER|END|CHR|CHA|INT|AGL|AGI|LCK)\s*<\s*(\d+)$/);
        if (capM) {
            const key = TRAIT_STAT_MAP[capM[1]] || capM[1];
            const cap = parseInt(capM[2]);
            if (effectiveSpecial(key) >= cap) return false;
            continue;
        }
        // SPECIAL min: STAT N
        const minM = up.match(/^(STR|PER|END|CHR|CHA|INT|AGL|AGI|LCK)\s+(\d+)$/);
        if (minM) {
            const key = TRAIT_STAT_MAP[minM[1]] || minM[1];
            const req = parseInt(minM[2]);
            if (effectiveSpecial(key) < req) return false;
            continue;
        }
        // Exclusive check
        const exclM = up.match(/^NOT\s+(.+)$/);
        if (exclM) {
            const blocked = exclM[1].trim();
            if (chosen.includes(blocked)) return false;
        }
    }
    return true;
}

/* ===== TRAIT MODAL ===== */
function openTraitModal(slotId) {
    _traitSlotId = slotId;
    // If this isn't a level-up call, clear the level picker state
    if (slotId !== '__levelup__') _traitPickerLevel = null;
    const titleEl = document.getElementById('trait-picker-title');
    if (titleEl) {
        if (_traitPickerLevel) {
            titleEl.textContent = `LEVEL ${_traitPickerLevel} — SELECT YOUR TRAIT`;
        } else if (slotId === '__starting__') {
            titleEl.textContent = 'ADD STARTING TRAIT';
        } else {
            titleEl.textContent = 'SELECT TRAIT';
        }
    }
    document.getElementById('trait-modal').style.display = 'flex';
    const srch = document.getElementById('trait-modal-search');
    if (srch) srch.value = '';
    _traitPickerSort = 'az';
    const azBtn = document.getElementById('tpick-sort-az');
    const reqBtn = document.getElementById('tpick-sort-req');
    if (azBtn) { azBtn.classList.add('active'); }
    if (reqBtn) { reqBtn.classList.remove('active'); }
    renderTraitGrid('');
}

function closeTraitModal() {
    document.getElementById('trait-modal').style.display = 'none';
    const isLevelUp = !!_traitPickerLevel;
    if (isLevelUp) {
        // Show sticky banner reminder
        const banner = document.getElementById('trait-lvlup-banner');
        if (banner) {
            const lvl = _traitPickerLevel;
            banner.innerHTML = `<span style="font-size:0.75rem; letter-spacing:1px; color:#c8ffd4;">◈ LVL ${lvl}: TRAIT AVAILABLE!</span><button onclick="showTraitLevelUpPrompt(${lvl})" style="margin-left:12px; padding:3px 12px; font-size:0.65rem; background:#c8ffd4; color:black; border:none; cursor:pointer; letter-spacing:1px; font-weight:bold;">→ PICK TRAIT</button><button onclick="this.parentElement.style.display='none'" style="margin-left:6px; padding:3px 8px; font-size:0.65rem; background:none; border:1px solid #c8ffd4; color:#c8ffd4; cursor:pointer;">LATER</button>`;
            banner.style.display = 'flex';
        }
    }
    _traitSlotId = null;
    _traitPickerLevel = null;
}

function showTraitLevelUpPrompt(lvl) {
    _traitPickerLevel = lvl;
    // Find the correct slot id for this level
    const slotId = `trait-slot-lvl-${lvl}`;
    _traitSlotId = slotId;
    const titleEl = document.getElementById('trait-picker-title');
    if (titleEl) titleEl.textContent = `LEVEL ${lvl} — SELECT YOUR TRAIT`;
    const srch = document.getElementById('trait-modal-search');
    if (srch) srch.value = '';
    _traitPickerSort = 'az';
    const azBtn2 = document.getElementById('tpick-sort-az');
    const reqBtn2 = document.getElementById('tpick-sort-req');
    if (azBtn2) { azBtn2.classList.add('active'); }
    if (reqBtn2) { reqBtn2.classList.remove('active'); }
    renderTraitGrid('');
    document.getElementById('trait-modal').style.display = 'flex';
    // Hide the banner while modal is open
    const banner = document.getElementById('trait-lvlup-banner');
    if (banner) banner.style.display = 'none';
}

let _traitPickerLevel = null;
let _traitPickerList  = [];
let _traitPickerSort  = 'az';   // 'az' | 'req'

function renderTraitGrid(search) {
    const container = document.getElementById('trait-modal-grid');
    if (!container) return;
    const q = (search || '').toLowerCase();
    const chosen = getChosenTraitNames();
    const chosenUp = chosen.map(c => c.toUpperCase());

    // Exclude traits that are already taken — they can't be taken again
    let filtered = TRAITS_DATA.filter(t => {
        if (chosenUp.includes(t.name.toUpperCase())) return false;
        if (q && !t.name.toLowerCase().includes(q) && !t.desc.toLowerCase().includes(q)) return false;
        return true;
    });

    // Helper: count how many SPECIAL/skill tokens a trait req has (proxy for complexity)
    function reqWeight(t) {
        if (!t.req) return 0;
        const tokens = t.req.split(',').map(s => s.trim()).filter(Boolean);
        return tokens.length;
    }

    // Sort: eligible group first, then ineligible — within each group apply chosen sort
    filtered = filtered.slice().sort((a, b) => {
        const eligA = checkTraitEligible(a);
        const eligB = checkTraitEligible(b);
        // Tier ordering: eligible=0, ineligible=1
        const tierA = eligA ? 0 : 1;
        const tierB = eligB ? 0 : 1;
        if (tierA !== tierB) return tierA - tierB;
        // Within tier apply chosen sort
        if (_traitPickerSort === 'req') {
            const wa = reqWeight(a), wb = reqWeight(b);
            if (wa !== wb) return wa - wb;
        }
        return a.name.localeCompare(b.name);
    });

    _traitPickerList = filtered;

    // Update count
    const eligible   = filtered.filter(t =>  checkTraitEligible(t));
    const ineligible = filtered.filter(t => !checkTraitEligible(t));
    const countEl = document.getElementById('trait-picker-count');
    if (countEl) countEl.textContent = `${eligible.length} ELIGIBLE · ${ineligible.length} INELIGIBLE · ${chosen.length} TAKEN`;

    container.innerHTML = _traitPickerList.map((t, i) => {
        const isElig = checkTraitEligible(t);
        const cardCls = isElig ? 'ptrait-card' : 'ptrait-card ptrait-ineligible';
        const badge = isElig
            ? `<span class="ptrait-badge ptrait-elig-badge">✓ ELIGIBLE</span>`
            : `<span class="ptrait-badge ptrait-inelig-badge">REQ NOT MET</span>`;
        const reqText = t.req ? `<div class="pperk-req">${t.req}</div>` : `<div class="pperk-req" style="opacity:0.3;">NO REQUIREMENTS</div>`;
        const btnLabel = isElig ? '◈ TAKE THIS TRAIT' : '⚠ TAKE ANYWAY';
        return `<div class="${cardCls}" onclick="selectTraitByIndex(${i})" title="${isElig ? 'TAKE TRAIT' : 'REQUIREMENTS NOT MET'}">
            <div class="pperk-card-top">
                <span class="ptrait-name">${t.name}</span>
                ${badge}
            </div>
            ${reqText}
            <div class="pperk-desc">${t.desc}</div>
            <button class="ptrait-take-btn">${btnLabel}</button>
        </div>`;
    }).join('') || '<div style="grid-column:1/-1;text-align:center;opacity:0.4;padding:24px;">NO TRAITS FOUND</div>';
}

function selectTraitByIndex(i) {
    const t = _traitPickerList[i];
    if (t) selectTraitForSlot(t.name);
}

function selectTraitForSlot(traitName) {
    // Starting trait mode
    if (_traitSlotId === '__starting__') { addStartingTrait(traitName); return; }
    if (!_traitSlotId) {
        // Called from view-all mode — find first empty trait slot
        const emptySlot = Array.from(document.querySelectorAll('.trait-slot-row')).find(r => !(r.getAttribute('data-chosen') || '').trim());
        if (!emptySlot) { closeTraitModal(); return; }
        _traitSlotId = emptySlot.id;
    }
    const row = document.getElementById(_traitSlotId);
    if (!row) { closeTraitModal(); return; }
    row.setAttribute('data-chosen', traitName);
    const nameEl = row.querySelector('.trait-slot-name');
    const btn = row.querySelector('.trait-slot-btn');
    const clearBtn = row.querySelector('.trait-slot-clear');
    if (nameEl) nameEl.textContent = traitName;
    if (btn) btn.textContent = 'CHANGE';
    if (clearBtn) clearBtn.style.display = 'inline-block';
    closeTraitModal();
    updateAll();
    triggerAutosave();
    checkAndOfferTraitPerk(traitName);
}

function clearTraitSlot(slotId) {
    const row = document.getElementById(slotId);
    if (!row) return;
    row.setAttribute('data-chosen', '');
    row.querySelector('.trait-slot-name').textContent = 'NONE SELECTED';
    row.querySelector('.trait-slot-btn').textContent = 'SELECT';
    row.querySelector('.trait-slot-clear').style.display = 'none';
    triggerAutosave();
}

/* ===== CONDITIONAL TOGGLE CONTEXT LABELS =====
 * Short label shown next to the toggle so the player knows what scenario is active.
 */
const COND_TOGGLE_LABELS = {
    "Claustrophobia":    "OUTDOORS",
    "Solar Powered":     "IN SUNLIGHT",
    "Early Bird":        "5AM–12PM",
    "Night Person":      "NIGHT",
    "War Child":         "IN COMBAT",
    "Hoarder":           "< 160 LBS",
    "Blind Luck":        "IN COMBAT",
    "Impartial Mediation": "NEUTRAL KARMA",
    "Confirmed Bachelor":  "TALKING TO MEN",
    "Lady Killer":       "TALKING TO WOMEN",
    "Graceful":          "SOBER",
    "Ideologue":         "GOOD KARMA",
    "Twisted":           "EVIL KARMA",
    "Breakin' A Sweat":  "MOVING",
    "Masochist":         "< 25% HP",
    "Desert Rose":       "> 50% HP",
    "Bankrupt":          "LOW CAPS",
    "Magnate":           "> 3000 CAPS",
    "Callous":           "ACTIVE",
    "Assassin's Step":   "SNEAKING",
    "Polar Personality": "EVEN LEVEL",
    "Four Eyes":         "WEARING GLASSES",
    "Architect":         "INDOORS",
};

/* ===== TRAIT ROW BUILDER ===== */
function makeTraitRow(slotId, levelLabel, chosenName) {
    const name = chosenName || '';
    const displayName = name || 'NONE SELECTED';
    const clearDisplay = name ? 'inline-block' : 'none';
    const btnLabel = name ? 'CHANGE' : 'SELECT';
    const isConditional = name && TRAIT_CONDITIONAL_NAMES.has(name);
    const isActive = isConditional && isConditionalActive(name);
    const ctxLabel = isConditional ? (COND_TOGGLE_LABELS[name] || 'ACTIVE') : '';

    const toggleHtml = isConditional ? `
        <span class="cond-toggle-wrap trait-row-toggle" title="Toggle: ${ctxLabel} (display only — never affects eligibility)">
            <label class="cond-toggle-lbl">
                <input type="checkbox" class="cond-toggle-input" ${isActive ? 'checked' : ''}
                    onchange="setConditionalToggle('${name.replace(/'/g,"\\'")}', this.checked)">
                <span class="cond-toggle-track"><span class="cond-toggle-thumb"></span></span>
            </label>
            <span class="cond-toggle-hint" title="${ctxLabel}">⚡</span>
            <span class="cond-toggle-ctx-label">${ctxLabel}</span>
        </span>` : '';

    return `<div class="prog-row trait-slot-row ${isActive ? 'cond-active' : ''}" id="${slotId}" data-chosen="${name.replace(/"/g,'&quot;')}">
        <div class="prog-card-header">
            <span class="lvl-tag is-trait">${levelLabel}</span>
            <button class="trait-slot-btn prog-clear-btn" onclick="openTraitModal('${slotId}')">${btnLabel}</button>
            <button class="trait-slot-clear prog-clear-btn" onclick="clearTraitSlot('${slotId}')" style="display:${clearDisplay}; color:rgba(255,80,80,0.8);">✕ CLEAR</button>
        </div>
        <div style="display:flex; align-items:center; gap:10px; padding:6px 10px;">
            <div class="trait-slot-name" style="flex:1; font-size:0.85rem; color:#c8ffd4; letter-spacing:0.05em; cursor:${name?'pointer':'default'};" ${name?`onclick="openTraitDetailModal('${name}', {type:'level', slotId:'${slotId}'})" title="Click for trait details"`:''}>
                ${displayName}${name?' <span style="font-size:0.6rem; opacity:0.4; margin-left:4px;">[INFO]</span>':''}
            </div>
            ${toggleHtml}
        </div>
    </div>`;
}

/* ===== IMPLANTS ===== */
function getNVImplantLimit() {
    // Limit = base END — the END implant itself does NOT increase your implant slots
    // (matches vanilla FNV: Doctor Usanagi gives slots = base END, not modified END)
    const endImplant = IMPLANTS_DATA.find(i => i.stat === 'END' && i.cat === 'special');
    const endFromImplant = (endImplant && implantsTaken[endImplant.name]) ? 1 : 0;
    return Math.max(0, (special.END || 1) - endFromImplant);
}

function getNVImplantCount() {
    // Only SPECIAL implants (cat === 'special') count against END limit
    let count = 0;
    IMPLANTS_DATA.forEach(imp => {
        if (imp.cat === 'special' && implantsTaken[imp.name]) count++;
    });
    return count;
}

function toggleImplantByIndex(idx) {
    const imp = IMPLANTS_DATA[idx];
    if (imp) toggleImplant(imp.name);
}

function toggleImplant(name) {
    const imp = IMPLANTS_DATA.find(i => i.name === name);
    if (!imp) return;
    if (implantsTaken[name]) {
        // Remove
        implantsTaken[name] = false;
        // Reverse SPECIAL bonus
        if (imp.cat === 'special' && imp.stat) {
            special[imp.stat] = Math.max(1, (special[imp.stat] || 1) - 1);
        }
    } else {
        // Only check limit for SPECIAL implants
        if (imp.cat === 'special') {
            const limit = getNVImplantLimit();
            const current = getNVImplantCount();
            if (current >= limit) {
                const el = document.getElementById('implant-limit-warning');
                if (el) { el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 2500); }
                return;
            }
        }
        implantsTaken[name] = true;
        // Apply SPECIAL bonus
        if (imp.cat === 'special' && imp.stat) {
            special[imp.stat] = Math.min(10, (special[imp.stat] || 1) + 1);
        }
    }
    renderImplants();
    updateAll();
    reCheckAllPerkRows();
    triggerAutosave();
}

function renderImplants() {
    const container = document.getElementById('implants-list');
    if (!container) return;
    const limit = getNVImplantLimit();
    const count = getNVImplantCount();
    const header = document.getElementById('implants-limit-display');
    if (header) header.textContent = `SPECIAL IMPLANTS: ${count} / ${limit} (END ${special.END} LIMIT) — BODY & BIG MT: UNLIMITED`;

    const groups = { special: [], body: [], bigtmt: [] };
    IMPLANTS_DATA.forEach(imp => { if (groups[imp.cat]) groups[imp.cat].push(imp); });

    const groupLabels = { special: 'S.P.E.C.I.A.L. IMPLANTS', body: 'BODY IMPLANTS', bigtmt: 'BIG MT IMPLANTS' };

    const renderGroup = (cat, items) => {
        if (!items.length) return '';
        const atLimit = cat === 'special' && count >= limit;
        return `<div class="implant-group">
            <div class="implant-group-title">${groupLabels[cat]}${cat === 'special' ? ` <span class="implant-slot-counter">${count}/${limit}</span>` : ''}</div>
            <div class="implant-grid">
            ${items.map(imp => {
                const idx = IMPLANTS_DATA.indexOf(imp);
                const taken = !!implantsTaken[imp.name];
                const blocked = cat === 'special' && !taken && atLimit;
                const statLabel = cat === 'special' && imp.stat ? `+1 ${imp.stat}` : '';
                return `<div class="implant-item ${taken ? 'implant-taken' : ''} ${blocked ? 'implant-locked' : ''}" onclick="toggleImplantByIndex(${idx})" title="${imp.how || ''}">
                    <div class="implant-item-top">
                        <span class="implant-check">${taken ? '◉' : '○'}</span>
                        <span class="implant-name">${imp.name}</span>
                        ${statLabel ? `<span class="implant-stat-badge">${statLabel}</span>` : ''}
                    </div>
                    <div class="implant-desc">${imp.desc}</div>
                </div>`;
            }).join('')}
            </div>
        </div>`;
    };

    container.innerHTML = renderGroup('special', groups.special)
        + renderGroup('body', groups.body)
        + renderGroup('bigtmt', groups.bigtmt);
}

/* ===== PERK ZOOM MODAL ===== */
/* Shared helper: wires Take/Wishlist buttons given a perkData entry (or null) */
function _setupPerkZoomButtons(perkData) {
    const actionsDiv = document.getElementById('perk-zoom-actions');
    const takeBtn    = document.getElementById('perk-zoom-take-btn');
    const wishlistBtn = document.getElementById('perk-zoom-wishlist-btn');
    if (perkData && actionsDiv && takeBtn && wishlistBtn) {
        actionsDiv.style.display = 'flex';
        const isIT = perkData.name.trim().toUpperCase() === 'INTENSE TRAINING';
        const escapedName = perkData.name.replace(/'/g, "\\'");
        const escapedReq  = perkData.req.replace(/'/g, "\\'");
        takeBtn.onclick = () => {
            addPerkToBuild(escapedName, escapedReq, isIT);
            document.getElementById('perk-zoom-modal').style.display = 'none';
        };
        takeBtn.textContent = isIT ? '+ ADD TO BUILD (PICK SPECIAL)' : '+ ADD TO BUILD';
        const isWishlisted = isPerkWishlisted(perkData.name);
        wishlistBtn.classList.toggle('wishlisted', isWishlisted);
        wishlistBtn.textContent = isWishlisted ? '★ WISHLISTED' : '★ WISHLIST';
        wishlistBtn.onclick = () => {
            togglePerkWishlist(perkData.name);
            const newState = isPerkWishlisted(perkData.name);
            wishlistBtn.classList.toggle('wishlisted', newState);
            wishlistBtn.textContent = newState ? '★ WISHLISTED' : '★ WISHLIST';
        };
    } else {
        if (actionsDiv) actionsDiv.style.display = 'none';
    }
}

function openPerkZoom(name, req, desc) {
    document.getElementById('perk-zoom-name').textContent = name;
    document.getElementById('perk-zoom-req').textContent = req ? 'REQ: ' + req : '';
    document.getElementById('perk-zoom-desc').textContent = desc;
    const perkData = PERKS_DATA.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    _setupPerkZoomButtons(perkData || null);
    document.getElementById('perk-zoom-modal').style.display = 'flex';
}

// Clicked from PERK & TRAIT LOG overview panel
function ovPerkClick(encodedName) {
    const name = decodeURIComponent(encodedName);
    // Search perks, then traits, then internalized traits, then reward perks
    const perk = PERKS_DATA.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    const trait = !perk && TRAITS_DATA.find(t => t.name.trim().toLowerCase() === name.trim().toLowerCase());
    const intTrait = !perk && !trait && INTERNALIZED_TRAITS_DATA.find(t => t.name.trim().toLowerCase() === name.trim().toLowerCase());
    const rewardP = !perk && !trait && !intTrait && REWARD_PERKS_DATA.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
    const entry = perk || trait || intTrait || rewardP;
    
    // Always open the modal — show what we have, or a "custom entry" placeholder
    document.getElementById('perk-zoom-name').textContent = entry ? entry.name : name;
    document.getElementById('perk-zoom-req').textContent = entry ? (entry.req ? 'REQ: ' + entry.req : 'NO REQUIREMENTS') : 'CUSTOM ENTRY';
    document.getElementById('perk-zoom-desc').textContent = entry ? entry.desc : '(No description available — this is a custom or manually entered entry.)';
    
    const box = document.getElementById('perk-zoom-modal').querySelector('.perk-zoom-box');
    if (box) {
        box.removeAttribute('data-type');
        if (trait || intTrait) box.setAttribute('data-type', 'trait');
    }
    
    _setupPerkZoomButtons(perk || null);
    document.getElementById('perk-zoom-modal').style.display = 'flex';
}


/* ===== ACTION STAR CHOICE MODAL ===== */
let _actionStarRow = null;

function openActionStarModal(row) {
    _actionStarRow = row;
    document.getElementById('action-star-modal').style.display = 'flex';
}

function closeActionStarModal() {
    document.getElementById('action-star-modal').style.display = 'none';
    _actionStarRow = null;
}

function confirmActionStarChoice(choice) {
    if (!_actionStarRow) { closeActionStarModal(); return; }
    const nameInput = _actionStarRow.querySelector('.prog-name-input');
    // Append the choice annotation to the perk name
    const choiceLabels = {
        ap:    'ACTION STAR [+TOTAL AP]',
        regen: 'ACTION STAR [+AP REGEN]',
        cost:  'ACTION STAR [-WEAP AP COST]'
    };
    nameInput.value = choiceLabels[choice] || 'ACTION STAR';
    closeActionStarModal();
    triggerAutosave();
}

/* ===== IMPLANT PICKER MODAL ===== */
function openImplantModal() {
    document.getElementById('implant-modal').style.display = 'flex';
    document.getElementById('implant-modal-search').value = '';
    renderImplantModalGrid('');
}

function closeImplantModal() {
    document.getElementById('implant-modal').style.display = 'none';
}

function renderImplantModalGrid(search) {
    const container = document.getElementById('implant-modal-grid');
    const q = (search || '').toLowerCase();
    const limit = getNVImplantLimit();
    const count = getNVImplantCount();

    const catLabels = { special: 'S.P.E.C.I.A.L. IMPLANTS', body: 'BODY IMPLANTS', bigtmt: 'BIG MT IMPLANTS' };
    const catColors = { special: '#80d8ff', body: '#80ffb0', bigtmt: '#c0a0ff' };
    const groups = { special: [], body: [], bigtmt: [] };
    IMPLANTS_DATA.forEach(imp => { if (groups[imp.cat]) groups[imp.cat].push(imp); });

    let html = '';
    ['special', 'body', 'bigtmt'].forEach(cat => {
        const items = groups[cat].filter(imp =>
            !q || imp.name.toLowerCase().includes(q) || imp.desc.toLowerCase().includes(q)
        );
        if (!items.length) return;
        html += `<div style="margin-bottom:14px;">
            <div style="font-size:0.62rem; color:${catColors[cat]}; letter-spacing:0.12em; padding:4px 0 6px; border-bottom:1px solid rgba(128,216,255,0.15); margin-bottom:8px;">${catLabels[cat]}</div>`;
        items.forEach(imp => {
            const taken = !!implantsTaken[imp.name];
            const statLabel = imp.cat === 'special' && imp.stat ? ` (+1 ${imp.stat})` : '';
            const atLimit = imp.cat === 'special' && !taken && count >= limit;
            const opacity = atLimit ? 'opacity:0.4;' : '';
            const cursor = atLimit ? 'cursor:not-allowed;' : 'cursor:pointer;';
            const takenStyle = taken ? `background:rgba(128,216,255,0.15); border-color:rgba(128,216,255,0.5);` : '';
            html += `<div class="trait-card" style="${takenStyle}${opacity}${cursor}" onclick="${atLimit ? "document.getElementById('implant-limit-warning').style.display='block';setTimeout(()=>document.getElementById('implant-limit-warning').style.display='none',2500)" : `pickImplantFromModal('${imp.name.replace(/'/g,"\\'")}')` }">
                <div class="trait-card-header">
                    <span class="trait-card-name" style="color:${catColors[cat]};">${taken ? '☑ ' : '☐ '}${imp.name}${statLabel}</span>
                    ${taken ? '<span style="font-size:0.6rem;color:#80ff80;margin-left:auto;">INSTALLED</span>' : ''}
                    ${atLimit ? '<span style="font-size:0.6rem;color:#ff8080;margin-left:auto;">LIMIT REACHED</span>' : ''}
                </div>
                <div class="trait-card-desc">${imp.desc.slice(0,180)}${imp.desc.length>180?'...':''}</div>
                <div class="trait-req" style="color:#888;margin-top:4px;font-size:0.58rem;">${imp.how.slice(0,120)}${imp.how.length>120?'...':''}</div>
            </div>`;
        });
        html += '</div>';
    });
    container.innerHTML = html || '<div style="text-align:center;opacity:0.4;padding:24px;font-size:0.7rem;">NO IMPLANTS FOUND</div>';
}

function pickImplantFromModal(name) {
    toggleImplant(name);
    closeImplantModal();
}

/* ===== SKILL LOG ===== */
function renderSkillLog() {
    const wrap = document.getElementById('skilllog-table-wrap');
    const empty = document.getElementById('skilllog-empty');
    if (!wrap) return;

    if (!skillHistory.length) {
        if (empty) empty.style.display = 'block';
        wrap.innerHTML = '';
        return;
    }
    if (empty) empty.style.display = 'none';

    // Calculate cumulative totals at each level
    const cumulativeGains = {};
    skills.forEach(s => { cumulativeGains[s] = 0; });

    let html = `<div class="skilllog-summary">
        <span>TOTAL LEVELS RECORDED: <b>${skillHistory.length}</b></span>
        <span>CURRENT LEVEL: <b>${charLevel}</b></span>
    </div>`;

    // Build table
    html += `<div class="skilllog-scroll">
    <table class="skilllog-table">
        <thead>
            <tr>
                <th class="skilllog-th-skill">SKILL</th>
                ${skillHistory.map(e => `<th class="skilllog-th-lvl" title="Points budget: ${e.pointsTotal}">LV${e.level}</th>`).join('')}
                <th class="skilllog-th-total">TOTAL<br>GAINED</th>
            </tr>
        </thead>
        <tbody>`;

    skills.forEach(s => {
        let rowTotal = 0;
        const cells = skillHistory.map(entry => {
            const gain = entry.gains[s] || 0;
            const isTagged = entry.tagged && entry.tagged.includes(s);
            rowTotal += gain;
            if (gain === 0) return `<td class="skilllog-cell skilllog-zero">—</td>`;
            return `<td class="skilllog-cell skilllog-gain${isTagged ? ' skilllog-tagged' : ''}" title="${isTagged ? '★ TAGGED — 2pts gained per 1 spent' : ''}">${gain > 0 ? '+'+gain : gain}${isTagged ? '<span class="skilllog-star">★</span>' : ''}</td>`;
        }).join('');

        html += `<tr class="skilllog-row">
            <td class="skilllog-skill-name">${s}</td>
            ${cells}
            <td class="skilllog-total-cell">${rowTotal > 0 ? '+'+rowTotal : '—'}</td>
        </tr>`;
    });

    // Points budget row
    html += `<tr class="skilllog-pts-row">
        <td class="skilllog-skill-name" style="color:rgba(200,255,210,0.5); font-size:0.55rem;">PTS BUDGET</td>
        ${skillHistory.map(e => `<td class="skilllog-cell" style="color:rgba(200,255,210,0.45); font-size:0.6rem;">${e.pointsTotal}</td>`).join('')}
        <td class="skilllog-total-cell">—</td>
    </tr>`;

    html += `</tbody></table></div>`;

    // Add a reset note
    html += `<div style="font-size:0.58rem; opacity:0.35; text-align:center; margin-top:12px; letter-spacing:0.05em;">★ = TAGGED SKILL (1 PT SPENT = 2 PT GAINED) &nbsp;|&nbsp; LOG RESETS ON FULL BUILD RESET</div>`;

    wrap.innerHTML = html;
}

/* ===== STARTING TRAITS ===== */
function renderStartingTraitsList() {
    const container = document.getElementById('starting-traits-list');
    if (!container) return;
    // Update HC counter
    const counter = document.getElementById('hc-trait-counter');
    if (counter) counter.textContent = `${startingTraits.length}/5`;
    // Dim ADD button at limit in HC mode
    const addBtn = document.querySelector('.cs-start-trait-btn');
    if (addBtn && mode === 'hc') {
        addBtn.style.opacity = startingTraits.length >= 5 ? '0.35' : '1';
        addBtn.title = startingTraits.length >= 5 ? 'HARDERCORE LIMIT: 5 STARTING TRAITS MAX' : 'ADD STARTING TRAIT';
    }
    if (startingTraits.length === 0) {
        container.innerHTML = '<div style="font-size:0.58rem; opacity:0.3; padding:6px 0; letter-spacing:1px;">NO STARTING TRAITS SELECTED</div>';
        return;
    }
    container.innerHTML = startingTraits.map((t, idx) => {
        const isConditional = TRAIT_CONDITIONAL_NAMES.has(t.name);
        const isActive = isConditional && isConditionalActive(t.name);
        const ctxLabel = isConditional ? (COND_TOGGLE_LABELS[t.name] || 'ACTIVE') : '';
        const toggleHtml = isConditional ? `
            <span class="cond-toggle-wrap" title="Toggle: ${ctxLabel} (display only — never affects eligibility)">
                <label class="cond-toggle-lbl">
                    <input type="checkbox" class="cond-toggle-input" ${isActive?'checked':''}
                        onchange="setConditionalToggle('${t.name.replace(/'/g,"\\'")}', this.checked)">
                    <span class="cond-toggle-track"><span class="cond-toggle-thumb"></span></span>
                </label>
                <span class="cond-toggle-hint">⚡</span>
                <span class="cond-toggle-ctx-label">${ctxLabel}</span>
            </span>` : '';
        return `
        <div class="st-tag-chip ${isActive ? 'cond-active' : ''}">
            <span class="st-tag-name" onclick="openTraitDetailModal('${t.name}', {type:'starting', idx:${idx}})" style="cursor:pointer;">${t.name}${isConditional ? ' <span class="cond-icon">⚡</span>' : ''}</span>
            ${toggleHtml}
            <button class="st-tag-detail-btn" onclick="openTraitDetailModal('${t.name}', {type:'starting', idx:${idx}})" title="View / Remove">?</button>
            <button class="st-tag-remove" onclick="removeStartingTrait(${idx})" title="Remove trait">✕</button>
        </div>`;
    }).join('');
}

function addStartingTrait(name) {
    // Avoid duplicates
    if (startingTraits.some(t => t.name === name)) { closeTraitModal(); return; }
    // HC mode: max 5 starting traits
    if (mode === 'hc' && startingTraits.length >= 5) {
        closeTraitModal();
        return;
    }
    startingTraits.push({ name });
    renderStartingTraitsList();
    updateAll();
    closeTraitModal();
    triggerAutosave();
    checkAndOfferTraitPerk(name);
}

function removeStartingTrait(idx) {
    startingTraits.splice(idx, 1);
    renderStartingTraitsList();
    updateAll();
    triggerAutosave();
}

function openStartingTraitModal() {
    // HC mode: enforce 5 starting trait limit
    if (mode === 'hc' && startingTraits.length >= 5) {
        const el = document.getElementById('hc-trait-limit-warning');
        if (el) { el.style.display = 'block'; setTimeout(() => el.style.display = 'none', 2500); }
        return;
    }
    _traitSlotId = '__starting__';
    document.getElementById('trait-modal').style.display = 'flex';
    document.getElementById('trait-modal-search').value = '';
    renderTraitGrid('');
}

/* ===== REWARD PERKS ===== */
function renderRewardPerksList() {
    const container = document.getElementById('reward-perks-list');
    if (!container) return;
    container.innerHTML = rewardPerksList.map((rp, idx) => `
        <div class="prog-row">
            <div class="prog-card-header">
                <span class="lvl-tag" style="background: rgba(255,180,50,0.15); color:#ffd080; border-color:rgba(255,180,50,0.3);">REWARD</span>
                <span style="flex:1; padding: 0 8px; font-size:0.8rem; color:#ffd080;">${rp.name}</span>
                <button onclick="removeRewardPerk(${idx})" style="color:rgba(255,80,80,0.8);background:none;border:1px solid rgba(255,0,0,0.3);font-size:0.6rem;padding:2px 7px;cursor:pointer;">✕</button>
            </div>
            <input type="text" class="prog-notes-input" placeholder="NOTES..." value="${rp.notes||''}" oninput="rewardPerksList[${idx}].notes=this.value; triggerAutosave();">
        </div>`).join('');
}

function openRewardPerkSearch() {
    document.getElementById('reward-perk-modal').style.display = 'flex';
    document.getElementById('reward-perk-search').value = '';
    renderRewardPerkGrid('');
}

function closeRewardPerkModal() {
    document.getElementById('reward-perk-modal').style.display = 'none';
}

function renderRewardPerkGrid(search) {
    const container = document.getElementById('reward-perk-modal-grid');
    const q = (search || '').toLowerCase();
    const filtered = REWARD_PERKS_DATA.filter(p =>
        !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q)
    );
    container.innerHTML = filtered.map(p => {
        const desc = p.desc.length > 200 ? p.desc.slice(0,200)+'...' : p.desc;
        return `<div class="trait-card" onclick="addRewardPerk('${p.name.replace(/'/g,"\\'")}')">
            <div class="trait-card-header"><span class="trait-card-name">${p.name}</span></div>
            <div class="trait-req" style="color:#aaa;">${p.how.slice(0,100)}${p.how.length>100?'...':''}</div>
            <div class="trait-card-desc">${desc}</div>
        </div>`;
    }).join('');
}

function addRewardPerk(name) {
    rewardPerksList.push({ name, notes: '' });
    closeRewardPerkModal();
    renderRewardPerksList();
    triggerAutosave();
}

function removeRewardPerk(idx) {
    rewardPerksList.splice(idx, 1);
    renderRewardPerksList();
    triggerAutosave();
}

/* ===== INTERNALIZED TRAITS ===== */
function renderInternalizedTraitsList() {
    const container = document.getElementById('internalized-traits-list');
    if (!container) return;
    container.innerHTML = internalizedTraitsList.map((it, idx) => `
        <div class="prog-row">
            <div class="prog-card-header">
                <span class="lvl-tag is-trait" style="background: rgba(150,80,255,0.15); color:#c8a0ff; border-color:rgba(150,80,255,0.3);">INTERNALIZED</span>
                <span style="flex:1; padding: 0 8px; font-size:0.8rem; color:#c8a0ff;">${it.name}</span>
                <button onclick="removeInternalizedTrait(${idx})" style="color:rgba(255,80,80,0.8);background:none;border:1px solid rgba(255,0,0,0.3);font-size:0.6rem;padding:2px 7px;cursor:pointer;">✕</button>
            </div>
            <input type="text" class="prog-notes-input" placeholder="NOTES..." value="${it.notes||''}" oninput="internalizedTraitsList[${idx}].notes=this.value; triggerAutosave();">
        </div>`).join('');
}

function openInternalizedModal() {
    document.getElementById('internalized-modal').style.display = 'flex';
    document.getElementById('internalized-search').value = '';
    renderInternalizedGrid('');
}

function closeInternalizedModal() {
    document.getElementById('internalized-modal').style.display = 'none';
}

function renderInternalizedGrid(search) {
    const container = document.getElementById('internalized-modal-grid');
    const q = (search || '').toLowerCase();
    const filtered = INTERNALIZED_TRAITS_DATA.filter(t =>
        !q || t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q)
    );
    container.innerHTML = filtered.map(t => {
        const desc = t.desc.length > 200 ? t.desc.slice(0,200)+'...' : t.desc;
        return `<div class="trait-card" onclick="addInternalizedTrait('${t.name.replace(/'/g,"\\'")}')">
            <div class="trait-card-header"><span class="trait-card-name">${t.name}</span></div>
            <div class="trait-req">${t.req}</div>
            <div class="trait-card-desc">${desc}</div>
        </div>`;
    }).join('');
}

function addInternalizedTrait(name) {
    internalizedTraitsList.push({ name, notes: '' });
    closeInternalizedModal();
    renderInternalizedTraitsList();
    triggerAutosave();
    checkAndOfferTraitPerk(name);
}

function removeInternalizedTrait(idx) {
    internalizedTraitsList.splice(idx, 1);
    renderInternalizedTraitsList();
    triggerAutosave();
}


/* --- DATA: QUESTS --- */
/* [questsData — moved to data.js] */

/* --- DATA: UNIQUES --- */
/* [uniqueWeaponData — moved to data.js] */

/* ===== XSS SANITIZATION ===== */
function sanitizeStr(s) {
    if (typeof s !== 'string') return '';
    return s
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/javascript\s*:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<[^>]+>/g, '')
        .substring(0, 3000);
}

function sanitizeImport(d) {
    if (!d || typeof d !== 'object') return null;
    const clean = {};
    clean.name = sanitizeStr(d.name || '');
    clean.notes = sanitizeStr(d.notes || '');
    clean.mode = ['std', 'hc'].includes(d.mode) ? d.mode : 'std';
    clean.origin = ['CW', 'MW'].includes(d.origin) ? d.origin : 'CW';
    clean.special = {};
    sKeys.forEach(k => {
        const v = parseInt(d.special?.[k]);
        clean.special[k] = (!isNaN(v) && v >= 1 && v <= 10) ? v : 5;
    });
    ['tags', 'quests', 'colls', 'uniWpns', 'uniArmor'].forEach(key => {
        clean[key] = Array.isArray(d[key]) ? d[key].map(v => !!v) : [];
    });
    clean.traits = Array.isArray(d.traits) ? d.traits.map(v => sanitizeStr(v || '')).slice(0, 20) : [];
    clean.implantsTaken = (d.implantsTaken && typeof d.implantsTaken === 'object') ? Object.fromEntries(Object.entries(d.implantsTaken).filter(([k,v]) => typeof k === 'string' && typeof v === 'boolean')) : {};
    clean.rewardPerksList = Array.isArray(d.rewardPerksList) ? d.rewardPerksList.slice(0,100).map(rp => ({ name: sanitizeStr(rp.name||''), notes: sanitizeStr(rp.notes||'') })) : [];
    clean.internalizedTraitsList = Array.isArray(d.internalizedTraitsList) ? d.internalizedTraitsList.slice(0,50).map(it => ({ name: sanitizeStr(it.name||''), notes: sanitizeStr(it.notes||'') })) : [];
    clean.perks = Array.isArray(d.perks) ? d.perks.map(arr =>
        Array.isArray(arr) ? arr.map(v => sanitizeStr(v || '')) : ['', '']
    ) : [];
    clean.extraPerks = Array.isArray(d.extraPerks) ? d.extraPerks.map(arr =>
        Array.isArray(arr) ? arr.map(v => sanitizeStr(v || '')) : ['', '']
    ).slice(0, 50) : [];
    clean.weapons = Array.isArray(d.weapons) ? d.weapons.map(arr =>
        Array.isArray(arr) ? arr.map(v => sanitizeStr(v || '')) : ['', '', '']
    ).slice(0, 20) : [];
    clean.armor = Array.isArray(d.armor) ? d.armor.map(arr => {
        const slot = ['LIGHT', 'MEDIUM', 'HEAVY', 'POWER ARMOR'].includes(arr?.[2]) ? arr[2] : 'LIGHT';
        return [
            sanitizeStr(arr?.[0] || ''), // name
            sanitizeStr(arr?.[1] || ''), // notes
            slot,                        // armor type
            sanitizeStr(arr?.[3] || ''), // DR / extra field
            sanitizeStr(arr?.[4] || ''), // tag notes
            sanitizeStr(arr?.[5] || ''), // 6th field
        ];
    }).slice(0, 20) : [];
    if (d.regionalStorage && typeof d.regionalStorage === 'object') {
        clean.regionalStorage = {
            'CW': {
                quests: Array.isArray(d.regionalStorage['CW']?.quests) ? d.regionalStorage['CW'].quests.map(v => !!v) : [],
                colls: Array.isArray(d.regionalStorage['CW']?.colls) ? d.regionalStorage['CW'].colls.map(v => !!v) : []
            },
            'MW': {
                quests: Array.isArray(d.regionalStorage['MW']?.quests) ? d.regionalStorage['MW'].quests.map(v => !!v) : [],
                colls: Array.isArray(d.regionalStorage['MW']?.colls) ? d.regionalStorage['MW'].colls.map(v => !!v) : []
            }
        };
    } else {
        clean.regionalStorage = { 'CW': { quests: [], colls: [] }, 'MW': { quests: [], colls: [] } };
    }
    // Skill points and character level
    clean.skillPoints = {};
    skills.forEach(s => {
        const v = parseInt(d.skillPoints?.[s]);
        clean.skillPoints[s] = (!isNaN(v) && v >= 0 && v <= 100) ? v : 0;
    });
    clean.skillBooksFound = {};
    skills.forEach(s => {
        const v = parseInt(d.skillBooksFound?.[s]);
        clean.skillBooksFound[s] = (!isNaN(v) && v >= 0) ? v : 0;
    });
    clean.charLevel = (typeof d.charLevel === 'number' && d.charLevel >= 1 && d.charLevel <= 60) ? Math.floor(d.charLevel) : 1;
    clean.skillHistory = Array.isArray(d.skillHistory) ? d.skillHistory.slice(0, 50).map(e => ({
        level: typeof e.level === 'number' ? e.level : 1,
        allocation: (e.allocation && typeof e.allocation === 'object') ? Object.fromEntries(skills.map(s => [s, typeof e.allocation[s] === 'number' ? e.allocation[s] : 0])) : {},
        gains: (e.gains && typeof e.gains === 'object') ? Object.fromEntries(skills.map(s => [s, typeof e.gains[s] === 'number' ? e.gains[s] : 0])) : {},
        tagged: Array.isArray(e.tagged) ? e.tagged.filter(s => skills.includes(s)) : [],
        pointsTotal: typeof e.pointsTotal === 'number' ? e.pointsTotal : 0
    })) : [];
    clean.perkWishlist = Array.isArray(d.perkWishlist) ? d.perkWishlist.map(name => sanitizeStr(name || '')).filter(Boolean) : [];
    clean.currentBuildName = sanitizeStr(d.currentBuildName || 'Current Build');
    clean.buildKarma = ['very-good','good','neutral','evil','very-evil'].includes(d.buildKarma) ? d.buildKarma : 'neutral';
    clean.conditionalToggles = (d.conditionalToggles && typeof d.conditionalToggles === 'object')
        ? Object.fromEntries(Object.entries(d.conditionalToggles).filter(([k,v]) => typeof k === 'string' && typeof v === 'boolean'))
        : {};
    clean.humbledLevel = (typeof d.humbledLevel === 'number' && d.humbledLevel >= 0) ? Math.floor(d.humbledLevel) : 0;
    clean.humbledReductions = (d.humbledReductions && typeof d.humbledReductions === 'object')
        ? Object.fromEntries(Object.entries(d.humbledReductions).filter(([k,v]) => sKeys.includes(k) && typeof v === 'number'))
        : {};
    clean.hasBeenHumbled = !!d.hasBeenHumbled;
    clean.fourthTagSkill = (typeof d.fourthTagSkill === 'string' && skills.includes(d.fourthTagSkill)) ? d.fourthTagSkill : null;
    clean.startingTraits = Array.isArray(d.startingTraits)
        ? d.startingTraits.slice(0, 10).map(t => ({ name: sanitizeStr(t && t.name ? t.name : '') })).filter(t => t.name)
        : [];
    clean.levelUpBonuses = Array.isArray(d.levelUpBonuses)
        ? d.levelUpBonuses.filter(v => ['hp','ap','cw'].includes(v))
        : [];
    return clean;
}

/* ===== TAB CONTROLLER ===== */
function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display='none');
    document.querySelectorAll('.tab-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-'+t).style.display='block';
    document.getElementById('tab-btn-'+t).classList.add('active');
    // Sync mobile bottom nav
    document.querySelectorAll('.mobile-nav-btn').forEach(b => {
        b.classList.toggle('mobile-nav-active', b.dataset.tab === t);
    });
    if (t === 'perks') renderAllPerks();
    if (t === 'skilllog') renderSkillLog();
    if (t === 'prog') renderImplants();
    if (t === 'books') renderBooksTab();
    nsAudio.click();
}

/* Build Summary Drawer (Tablet/Laptop) */
function toggleBuildSummaryDrawer() {
    const drawer = document.getElementById('build-summary-drawer');
    if (!drawer) return;
    const isOpen = drawer.classList.toggle('drawer-open');
    const btn = document.getElementById('drawer-toggle-btn');
    if (btn) btn.textContent = isOpen ? '◀ HIDE SUMMARY' : '▶ BUILD SUMMARY';
    if (isOpen) updateBuildSummaryDrawer();
}

function updateBuildSummaryDrawer() {
    const el = document.getElementById('drawer-summary-content');
    if (!el) return;
    // Show key stats in the drawer
    const specHtml = sKeys.map(k => `<div class="drawer-stat"><span class="drawer-stat-key">${k}</span><span class="drawer-stat-val">${modifiedSpecial(k)}</span></div>`).join('');
    const traitNames = startingTraits.map(t=>t.name).join(', ') || '—';
    const tagSkills = Array.from(getTaggedSkills()).join(', ') || '—';
    el.innerHTML = `
        <div class="drawer-section-label">S.P.E.C.I.A.L.</div>
        <div class="drawer-spec-grid">${specHtml}</div>
        <div class="drawer-section-label">TAGS</div>
        <div class="drawer-value">${tagSkills}</div>
        <div class="drawer-section-label">TRAITS</div>
        <div class="drawer-value">${traitNames}</div>
        <div class="drawer-section-label">LEVEL</div>
        <div class="drawer-value">${charLevel}</div>
    `;
}

function addBook(skill, delta) {
    const val = (skillBooksFound[skill] || 0) + delta;
    skillBooksFound[skill] = Math.max(0, val);
    renderBooksTab();
    updateAll();
    triggerAutosave();
}

function renderBooksTab() {
    const el = document.getElementById('tab-books');
    if (!el) return;
    const ideologue = hasIdeologue();
    const ptsEach = ideologue ? 3 : 2;
    const totalFound = skills.reduce((acc, s) => acc + (skillBooksFound[s] || 0), 0);
    el.innerHTML = `
    <div class="books-header">
        <div class="books-title">📚 SKILL BOOKS</div>
        <div class="books-sub">EACH BOOK FOUND GRANTS <b>+2 PTS</b> TO ITS SKILL &nbsp;|&nbsp; <b>+3 PTS</b> WITH THE <b>IDEOLOGUE</b> TRAIT${ideologue ? ' <span class="books-ideologue-active">✦ IDEOLOGUE ACTIVE — +3 PER BOOK</span>' : ''}</div>
        <div class="books-count">${totalFound} TOTAL BOOKS FOUND</div>
    </div>
    <div class="books-grid">
    ${SKILL_BOOKS.map(b => {
        const count = skillBooksFound[b.skill] || 0;
        const bonus = count * ptsEach;
        const hasAny = count > 0;
        return `<div class="book-card ${hasAny ? 'book-found' : ''}">
            <div class="book-icon">${hasAny ? '📖' : '📕'}</div>
            <div class="book-info">
                <div class="book-name">${b.name}</div>
                <div class="book-skill-label">${b.skill}</div>
                <div class="book-bonus">${hasAny ? `<span class="book-bonus-val">+${bonus} PTS (×${count} ${count===1?'COPY':'COPIES'})</span>` : '<span class="book-bonus-none">NONE FOUND</span>'}</div>
            </div>
            <div class="book-controls">
                <button class="book-btn book-btn-minus" onclick="addBook('${b.skill}',-1)" ${count===0?'disabled':''}>−</button>
                <span class="book-count-num">${count}</span>
                <button class="book-btn book-btn-plus" onclick="addBook('${b.skill}',1)">+</button>
            </div>
        </div>`;
    }).join('')}
    </div>`;
}


/* ===== MODE & ORIGIN TOGGLES ===== */
function setMode(m, skipSave=false) {
    // Save current perk entries before wiping the list
    const prevPerks = Array.from(document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)')).map(r => [
        r.querySelector('.prog-name-input')?.value || '',
        r.querySelector('.prog-notes-input')?.value || ''
    ]);
    mode = m; document.body.classList.toggle('mode-hc', m==='hc');
    nsAudio.updateModeSound(m === 'hc');
    document.getElementById('hc-banner').style.display = m==='hc' ? 'flex' : 'none';
    document.getElementById('sysop-note').style.display = m==='hc' ? 'block' : 'none';
    document.getElementById('m-std').classList.toggle('active', m==='std');
    document.getElementById('m-hc').classList.toggle('active', m==='hc');
    // Reset add-trait button opacity when switching modes
    const addBtn = document.querySelector('.cs-start-trait-btn');
    if (addBtn) addBtn.style.opacity = '';
    renderStartingTraitsList();
    renderProgression();
    // Restore as many perks as will fit in the new layout
    if (!skipSave && prevPerks.some(p => p[0])) {
        const newRows = document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)');
        prevPerks.forEach((v, i) => {
            if (newRows[i] && v[0]) {
                tryHydratePerkRow(newRows[i], v[0]);
                const ni = newRows[i].querySelector('.prog-notes-input'); if(ni) ni.value = v[1] || '';
            }
        });
    }
    updateAll();
    if(!skipSave) triggerAutosave();
}

function setOrigin(o, skipSave=false) {
    if (!skipSave) {
        regionalStorage[origin].quests = Array.from(document.querySelectorAll('#quest-list-container input')).map(i => i.checked);
        regionalStorage[origin].colls = Array.from(document.querySelectorAll('#coll-list input')).map(i => i.checked);
    }
    origin = o;
    document.body.className = (o === 'MW') ? 'theme-mw' : 'theme-cw';
    if (!skipSave) {
        if (o === 'MW') nsAudio.mojaveJingle();
        else            nsAudio.cwMotif();
    }
    updateTransitBtn();
    if (_activeCustomTheme) document.body.classList.add('theme-' + _activeCustomTheme);
    if(mode==='hc') document.body.classList.add('mode-hc');
    document.getElementById('btn-cw').classList.toggle('active', o==='CW');
    document.getElementById('btn-mw').classList.toggle('active', o==='MW');
    renderQuests();
    renderCollectibles();
    const qC = document.querySelectorAll('#quest-list-container input');
    regionalStorage[origin].quests.forEach((c, i) => { if(qC[i]) { qC[i].checked = c; updateUniqueMarker(qC[i]); } });
    const cC = document.querySelectorAll('#coll-list input');
    regionalStorage[origin].colls.forEach((c, i) => { if(cC[i]) { cC[i].checked = c; updateUniqueMarker(cC[i]); } });
    document.querySelectorAll('.header-row').forEach(h => {
        const id = h.id.replace('h-', '');
        calcCat(id);
    });
    updateAll();
    if(!skipSave) triggerAutosave();
}

/* ===== COLLAPSE LOGIC ===== */
function toggleCollapse(id) {
    const grid = document.querySelector(`.grid-tidy[data-category="${id}"]`);
    if (grid) grid.style.display = (grid.style.display === 'none') ? 'grid' : 'none';
}

function toggleAllInContainer(cId,btn){
    const gs=document.querySelectorAll('#'+cId+' .grid-tidy');
    if(!gs.length)return;
    const vis=Array.from(gs).some(g=>g.style.display!=='none');
    gs.forEach(g=>{g.style.display=vis?'none':'grid';});
    if(btn)btn.textContent=vis?'▶ EXPAND ALL':'▼ COLLAPSE ALL';
}

/* ===== SEARCH LOGIC ===== */
function searchItems(inputId, containerId) {
    const query = document.getElementById(inputId).value.toUpperCase();
    const items = document.querySelectorAll(`#${containerId} .grid-item`);
    items.forEach(item => {
        item.style.display = item.innerText.toUpperCase().includes(query) ? 'flex' : 'none';
    });
    document.querySelectorAll(`#${containerId} .grid-tidy`).forEach(grid => {
        const visibleCount = Array.from(grid.querySelectorAll('.grid-item')).filter(i => i.style.display !== 'none').length;
        const categoryId = grid.getAttribute('data-category');
        const header = document.getElementById(`h-${categoryId}`);
        if (query !== "" && visibleCount > 0) { grid.style.display = 'grid'; header.style.display = 'flex'; }
        else if (query !== "" && visibleCount === 0) { grid.style.display = 'none'; header.style.display = 'none'; }
        else { header.style.display = 'flex'; }
    });
}

function searchQuests() { searchItems('quest-search-bar', 'quest-list-container'); }
function searchUniques() { searchItems('uni-search-bar', 'unique-weapon-checklist'); }

/* ===== ALL PERKS TAB: SORT & RENDER ===== */
function getPerkLevel(perk) {
    const m = perk.req.match(/Level\s+(\d+)/i);
    return m ? parseInt(m[1]) : 0;
}

function getPerkSPECIAL(perk) {
    const order = ['STR','PER','END','CHA','INT','AGI','LCK'];
    const m = perk.req.match(/\b(STR|PER|END|CHA|INT|AGI|LCK)\b/);
    if (!m) return 99;
    return order.indexOf(m[1]);
}

function setSort(s) {
    currentSort = s;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('sort-'+s).classList.add('active');
    renderAllPerks();
}

function toggleEligibleFilter() {
    showEligibleOnly = !showEligibleOnly;
    document.getElementById('toggle-eligible').classList.toggle('active', showEligibleOnly);
    renderAllPerks();
}

function renderAllPerks() {
    const query = (document.getElementById('perk-search-bar')?.value || '').toUpperCase().trim();
    let perks = PERKS_DATA.filter(p =>
        !query || p.name.toUpperCase().includes(query) || p.req.toUpperCase().includes(query) || p.desc.toUpperCase().includes(query)
    );

    if (showEligibleOnly) perks = perks.filter(p => meetsRequirements(p));

    if (currentSort === 'az') {
        perks = [...perks].sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSort === 'lvl') {
        perks = [...perks].sort((a, b) => getPerkLevel(a) - getPerkLevel(b) || a.name.localeCompare(b.name));
    } else if (currentSort === 'spec') {
        perks = [...perks].sort((a, b) => getPerkSPECIAL(a) - getPerkSPECIAL(b) || a.name.localeCompare(b.name));
    }

    const container = document.getElementById('all-perks-list');
    container.innerHTML = '';
    if (perks.length === 0) {
        container.innerHTML = '<div style="opacity:0.5; padding:20px; text-align:center;">NO PERKS MATCH QUERY</div>';
        return;
    }

    if (currentSort === 'spec') {
        const groups = {};
        const specNames = ['STR — STRENGTH','PER — PERCEPTION','END — ENDURANCE','CHA — CHARISMA','INT — INTELLIGENCE','AGI — AGILITY','LCK — LUCK','NO SPECIAL REQ.'];
        perks.forEach(p => {
            const idx = getPerkSPECIAL(p);
            const key = idx >= 7 ? 7 : idx;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        Object.keys(groups).sort((a,b)=>a-b).forEach(k => {
            const label = specNames[parseInt(k)] || 'OTHER';
            container.insertAdjacentHTML('beforeend', `<div style="background:var(--pip-color);color:black;font-weight:bold;padding:4px 8px;font-size:0.75rem;margin-bottom:5px;margin-top:10px;">${label}</div>`);
            groups[k].forEach(p => container.insertAdjacentHTML('beforeend', buildPerkCard(p)));
        });
    } else {
        perks.forEach(p => container.insertAdjacentHTML('beforeend', buildPerkCard(p)));
    }
}

function buildPerkCard(p) {
    const eligible = meetsRequirements(p);
    const isIT = p.name.trim().toUpperCase() === 'INTENSE TRAINING';
    const multiRank = p.ranks > 1;
    const rankBadgeClass = multiRank ? 'perk-rank-badge multi' : 'perk-rank-badge';
    const rankLabel = multiRank ? `★ ${p.ranks} RANKS` : `1 RANK`;
    const addBtnLabel = isIT ? '+ ADD TO BUILD (PICK SPECIAL)' : '+ ADD TO BUILD';
    const escapedName = p.name.replace(/'/g, "\\'");
    const escapedReq = p.req.replace(/'/g, "\\'");
    const cardClass = eligible ? 'perk-card' : 'perk-card perk-ineligible';

    // Show what's missing
    const missingLines = [];
    if (!eligible) {
        const lvlM = p.req.match(/Level\s+(\d+)/i);
        if (lvlM && charLevel < parseInt(lvlM[1])) missingLines.push(`LVL ${lvlM[1]} REQUIRED (HAVE ${charLevel})`);
        for (const chunk of p.req.split(',').map(s=>s.trim())) {
            if (/^Level\s/i.test(chunk)) continue;
            const anyMet = chunk.split(/\s+or\s+/i).some(part => parsePartMet(part));
            if (!anyMet) missingLines.push(chunk);
        }
    }

    const isWishlisted = isPerkWishlisted(p.name);
    const wishlistClass = isWishlisted ? 'wishlisted' : '';
    const wishlistTitle = isWishlisted ? 'Remove from wishlist' : 'Add to wishlist';
    const wishlistLabel = isWishlisted ? '★ WISHLISTED' : '★ WISHLIST';

    return `<div class="${cardClass}">
        <div class="perk-card-header">
            <h3>${p.name}</h3>
            <span class="${rankBadgeClass}">${rankLabel}</span>
            ${eligible ? '<span class="perk-eligible-badge">✓ ELIGIBLE</span>' : ''}
        </div>
        <div class="perk-req">REQ: ${p.req}</div>
        ${!eligible && missingLines.length ? `<div class="perk-missing">${missingLines.map(l=>`<span>${l}</span>`).join('')}</div>` : ''}
        <div class="perk-desc">${p.desc}</div>
        <div class="perk-card-actions">
            <button class="action-btn" onclick="addPerkToBuild('${escapedName}','${escapedReq}',${isIT})">${addBtnLabel}</button>
            <button class="action-btn perk-zoom-action" title="EXPAND DESCRIPTION" onclick="openPerkZoom('${escapedName}','${p.req.replace(/'/g,"\\'")}','${p.desc.replace(/'/g,"\\'")}')">⊕ ZOOM</button>
            <button class="action-btn perk-wishlist-action ${wishlistClass}" onclick="togglePerkWishlist('${escapedName}')" title="${wishlistTitle}">${wishlistLabel}</button>
        </div>
    </div>`;
}

function addPerkToBuild(name, req, isIT) {
    if (isIT) { openITModal(name, req); return; }
    const _pd = PERKS_DATA.find(p=>p.name.toUpperCase()===name.toUpperCase());
    if (_pd && !meetsRequirements(_pd)) { showPerkBlockedToast(name, 'REQUIREMENTS NOT MET'); return; }
    const _mr = _pd ? _pd.ranks : 1;
    const _tk = Array.from(document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row), #extra-perk-list .prog-row'))
        .filter(r=>{const v=(r.querySelector('.prog-name-input')?.value||'').trim().toUpperCase();return v===name.toUpperCase()||v.startsWith(name.toUpperCase());}).length;
    if (_tk>=_mr){showPerkBlockedToast(name,'MAX RANKS ('+_mr+'/'+_mr+')');return;}
    // Skip trait-slot-rows - only use real perk rows
    const rows = document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)');
    for (const row of rows) {
        const nameInput = row.querySelector('.prog-name-input');
        if (nameInput && !nameInput.value.trim()) {
            selectPerkInRow(row, name);
            showPerkToast(name);
            return;
        }
    }
    addExtraPerk();
    const extras = document.querySelectorAll('#extra-perk-list .prog-row');
    const last = extras[extras.length - 1];
    if (last) selectPerkInRow(last, name);
    showPerkToast(name);
}

function _getPerkToast() {
    let toast = document.getElementById('perk-added-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'perk-added-toast';
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;background:var(--pip-bg-2);border:1px solid var(--pip-color);color:var(--pip-color);padding:10px 18px;font-size:0.7rem;font-family:var(--font-main);letter-spacing:1px;box-shadow:0 0 20px rgba(40,255,40,0.2);transition:opacity 0.4s;opacity:0;pointer-events:none;text-transform:uppercase;';
        document.body.appendChild(toast);
    }
    return toast;
}

function showPerkToast(name) {
    const toast = _getPerkToast();
    toast.style.color = '';
    toast.style.borderColor = '';
    toast.textContent = '✓ PERK ADDED: ' + name;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

function showPerkBlockedToast(name, reason) {
    const toast = _getPerkToast();
    toast.style.color = '#ff6060';
    toast.style.borderColor = 'rgba(255,80,60,0.7)';
    toast.textContent = '✕ ' + reason + ': ' + name;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.color = ''; toast.style.borderColor = ''; }, 450);
    }, 2800);
}

/* ===== LEVEL UP MODAL ===== */
function openLevelUpModal() {
    const tagged = getTaggedSkills();
    if (tagged.size < 3) {
        // Flash the tag section to guide user
        const tagArea = document.getElementById('tag-area');
        tagArea.style.outline = '2px solid var(--danger-red)';
        setTimeout(() => tagArea.style.outline = '', 1500);
        document.getElementById('lvlup-not-ready').style.display = 'block';
        return;
    }
    document.getElementById('lvlup-not-ready').style.display = 'none';
    _lvlupSession = {};
    _lvlupAttributeChoice = null; // Reset attribute choice
    skills.forEach(s => { _lvlupSession[s] = 0; });
    _lvlupPointsLeft = pointsPerLevel();
    renderLevelUpGrid();
    // Reset attribute button selection
    document.querySelectorAll('.lvlup-attr-btn').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('lvlup-modal').classList.add('active');
}

function closeLevelUpModal() {
    document.getElementById('lvlup-modal').classList.remove('active');
}

function selectLevelUpAttribute(attr) {
    _lvlupAttributeChoice = attr;
    // Update button selection visuals
    document.querySelectorAll('.lvlup-attr-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.attr === attr);
    });
}

/* ===== LEVEL ROLLBACK MODAL ===== */
function openLevelRollbackModal() {
    if (charLevel <= 1) return; // Can't rollback from level 1
    const modal = document.getElementById('rollback-modal');
    const currentLevelEl = document.getElementById('rollback-current-level');
    const inputEl = document.getElementById('rollback-level-input');
    if (currentLevelEl) currentLevelEl.textContent = charLevel;
    if (inputEl) {
        inputEl.max = charLevel - 1;
        inputEl.value = Math.max(1, charLevel - 1);
    }
    if (modal) modal.style.display = 'flex';
}

function closeLevelRollbackModal() {
    const modal = document.getElementById('rollback-modal');
    if (modal) modal.style.display = 'none';
}

function confirmLevelRollback() {
    const inputEl = document.getElementById('rollback-level-input');
    const targetLevel = parseInt(inputEl.value);
    
    if (isNaN(targetLevel) || targetLevel < 1 || targetLevel >= charLevel) {
        alert('Invalid level selected');
        return;
    }
    
    // Remove perks gained after target level
    const allProgRows = document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)');
    allProgRows.forEach(row => {
        const lvlTag = row.querySelector('.lvl-tag');
        if (lvlTag) {
            const rowLevel = parseInt(lvlTag.textContent.match(/\d+/)?.[0] || '0');
            if (rowLevel > targetLevel) {
                // Check if this was Intense Training and revert the SPECIAL increase
                const perkName = row.querySelector('.prog-name-input')?.value || '';
                const itMatch = perkName.match(/^Intense Training \(\+1 (\w+)\)/i);
                if (itMatch) {
                    const statKey = itMatch[1];
                    if (special[statKey] > 1) special[statKey]--;
                }
                // Clear the row
                clearProgRow(row.querySelector('.prog-clear-btn'));
            }
        }
    });
    
    // Remove skill points gained after target level
    const levelsToRemove = charLevel - targetLevel;
    for (let i = 0; i < levelsToRemove; i++) {
        if (skillHistory.length > 0) {
            const lastEntry = skillHistory[skillHistory.length - 1];
            // Subtract the gains from that level
            skills.forEach(s => {
                const gain = lastEntry.gains[s] || 0;
                skillPoints[s] = Math.max(0, (skillPoints[s] || 0) - gain);
            });
            skillHistory.pop();
        }
        // Also remove the level-up bonus choice
        if (levelUpBonuses.length > 0) {
            levelUpBonuses.pop();
        }
    }
    
    // Update character level
    charLevel = targetLevel;
    
    // Close modal and update
    closeLevelRollbackModal();
    updateAll();
    reCheckAllPerkRows();
    triggerAutosave();
    pushUndoState();
    
    // Show confirmation toast
    showPerkToast(`ROLLED BACK TO LEVEL ${targetLevel}`);
}

function renderLevelUpGrid() {
    const tagged = getTaggedSkills();
    const spent = Object.values(_lvlupSession).reduce((a,b)=>a+b,0);
    _lvlupPointsLeft = pointsPerLevel() - spent;

    document.getElementById('lvlup-level-from').textContent = charLevel;
    document.getElementById('lvlup-level-to').textContent = charLevel + 1;
    document.getElementById('lvlup-pts-left').textContent = _lvlupPointsLeft;
    document.getElementById('lvlup-pts-total').textContent = pointsPerLevel();

    const grid = document.getElementById('lvlup-skill-grid');
    grid.innerHTML = skills.map(s => {
        const isTagged = tagged.has(s);
        const cur = skillTotal(s);
        const pts = _lvlupSession[s] || 0;
        const gain = isTagged ? pts * 2 : pts; // tagged: x2 skill gain per point spent
        const nxt = Math.min(100, cur + gain);
        const canAdd = _lvlupPointsLeft > 0 && nxt < 100;
        const canSub = pts > 0;
        return `<div class="lvlup-row${isTagged ? ' lvlup-tagged' : ''}">
            <span class="lvlup-tag-star">${isTagged ? '★' : ' '}</span>
            <span class="lvlup-skill-name">${s}</span>
            <span class="lvlup-cur">${cur}</span>
            <div class="lvlup-ctrl">
                <button class="lvlup-adj" onclick="lvlupAdjust('${s}',-1)" ${canSub?'':'disabled'}>−</button>
                <span class="lvlup-delta${gain>0?' lvlup-active':''}">${gain>0?'+'+gain+(isTagged?'(×2)':''):'—'}</span>
                <button class="lvlup-adj" onclick="lvlupAdjust('${s}',1)" ${canAdd?'':'disabled'}>+</button>
            </div>
            <span class="lvlup-new${nxt!==cur?' lvlup-changed':''}">${nxt}</span>

        </div>`;
    }).join('');
}

function lvlupAdjust(skill, delta) {
    const isTagged = getTaggedSkills().has(skill);
    const pts = _lvlupSession[skill] || 0; // points SPENT (not gained)
    if (delta > 0) {
        if (_lvlupPointsLeft <= 0) return;
        // Tagged: 1 pt spent = 2 gained; untagged: 1 pt = 1 gained
        const gainSoFar = isTagged ? pts * 2 : pts;
        const curTotal = skillTotal(skill) + gainSoFar;
        if (curTotal >= 100) return;
        _lvlupSession[skill] = pts + 1;
    } else {
        if (pts <= 0) return;
        _lvlupSession[skill] = pts - 1;
    }
    const spent = Object.values(_lvlupSession).reduce((a,b)=>a+b,0);
    _lvlupPointsLeft = pointsPerLevel() - spent;
    renderLevelUpGrid();
}

function confirmLevelUp() {
    // Validate attribute choice
    if (!_lvlupAttributeChoice) {
        alert('Please select an attribute boost (Health, Action Points, or Carry Weight)');
        return;
    }
    
    const tagged = getTaggedSkills();
    const gains = {};
    skills.forEach(s => {
        const pts = _lvlupSession[s] || 0;
        const gain = tagged.has(s) ? pts * 2 : pts; // tagged: 1 spent = 2 gained
        gains[s] = gain;
        skillPoints[s] = (skillPoints[s] || 0) + gain;
        // Hard cap: total skill must not exceed 100
        const maxPts = 100 - skillBase(s);
        if (skillPoints[s] > maxPts) skillPoints[s] = Math.max(0, maxPts);
    });
    // Record this level's allocation for the Skill Log
    const totalPtsSpent = Object.values(_lvlupSession).reduce((a,b)=>a+b,0);
    if (totalPtsSpent > 0 || true) {
        skillHistory.push({
            level: charLevel + 1,
            allocation: Object.assign({}, _lvlupSession),
            gains: gains,
            tagged: Array.from(tagged),
            pointsTotal: pointsPerLevel()
        });
    }
    
    // Store the attribute choice for this level
    levelUpBonuses[charLevel - 1] = _lvlupAttributeChoice; // charLevel is still at current level (will increment next)
    
    charLevel++;
    closeLevelUpModal();
    updateAll();
    reCheckAllPerkRows();
    triggerAutosave();
    // Check if new level grants a perk and prompt
    const newLvl = charLevel;
    // Humbled perk frequency rules:
    //  Still below pre-humbled level →  STD: every 4;  HC: never
    //  At/above pre-humbled level    →  normal rules resume
    let isPerkLevel;
    if (hasBeenHumbled && humbledLevel > 0 && newLvl < humbledLevel) {
        isPerkLevel = (mode === 'hc') ? false : (newLvl % 4 === 0);
    } else {
        isPerkLevel = (mode === 'hc') ? (newLvl % 3 === 0) : (newLvl % 2 === 0);
    }
    if (isPerkLevel) {
        showPerkLevelUpPrompt(newLvl);
    }
    // Check if new level grants a trait slot (every 4 levels from 5: 5, 9, 13, 17...)
    const isTraitLevel = newLvl >= 5 && (newLvl - 1) % 4 === 0;
    if (isTraitLevel) {
        // Offset slightly so it fires after the perk prompt if same level
        setTimeout(() => showTraitLevelUpPrompt(newLvl), isPerkLevel ? 500 : 80);
    }
}

function showPerkLevelUpPrompt(lvl) {
    // Open the full perk picker modal
    setTimeout(() => openPerkPickerModal(lvl), 80);
}

/* ===== INTENSE TRAINING MODAL ===== */
function openITModal(name, req, sourceRow) {
    _itTargetRow = sourceRow || null;
    _itCancelled = true; // Assume cancelled until a stat is selected
    const grid = document.getElementById('it-picker-grid');
    grid.innerHTML = '';
    sKeys.forEach(k => {
        const val = special[k];
        const isMaxed = val >= 10;
        const cls = isMaxed ? 'special-pick-btn maxed' : 'special-pick-btn';
        const title = isMaxed ? `${k} IS ALREADY AT MAX (10)` : `ADD +1 TO ${k}`;
        grid.insertAdjacentHTML('beforeend',
            `<button class="${cls}" title="${title}" onclick="confirmIT('${name}','${req}','${k}')">
                <span>${k}</span>
                <span class="spk-val">${val}</span>
                <span style="font-size:0.6rem;">${isMaxed ? 'MAX' : '+1'}</span>
            </button>`
        );
    });
    document.getElementById('it-modal').classList.add('active');
}

function closeITModal() {
    document.getElementById('it-modal').classList.remove('active');
    // If cancelled (no stat selected), clear the row
    if (_itTargetRow && _itCancelled) {
        clearProgRow(_itTargetRow.querySelector('.prog-clear-btn'));
        _itTargetRow = null;
    }
    _itCancelled = false;
}

function confirmIT(name, req, statKey) {
    if (special[statKey] < 10) special[statKey] += 1;
    _itCancelled = false; // Clear cancellation flag - user made a selection
    closeITModal();
    const label = `${name} (+1 ${statKey})`;

    // If we know which row triggered IT, just update its label in-place — no new row
    if (_itTargetRow) {
        const ni = _itTargetRow.querySelector('.prog-name-input');
        if (ni) ni.value = label;
        const notes = _itTargetRow.querySelector('.prog-notes-input');
        if (notes && !notes.value) notes.value = req;
        _itTargetRow = null;
        updateAll();
        reCheckAllPerkRows();
        triggerAutosave();
        showPerkToast(label);
        return;
    }

    // Fallback: find first empty prog row
    const rows = document.querySelectorAll('#prog-list .prog-row');
    for (const row of rows) {
        const nameInput = row.querySelector('.prog-name-input');
        if (!nameInput.value.trim()) {
            selectPerkInRow(row, name);
            nameInput.value = label;
            const ni = row.querySelector('.prog-notes-input'); if(ni) ni.value = req;
            triggerAutosave();
            showPerkToast(label);
            return;
        }
    }
    addExtraPerk();
    const extras = document.querySelectorAll('#extra-perk-list .prog-row');
    const last = extras[extras.length - 1];
    if (last) {
        selectPerkInRow(last, name);
        last.querySelector('.prog-name-input').value = label;
        const ni = last.querySelector('.prog-notes-input'); if(ni) ni.value = req;
    }
    triggerAutosave();
    showPerkToast(label);
}

/* Close modal on overlay click */
document.addEventListener('click', function(e) {
    if (e.target === document.getElementById('it-modal')) closeITModal();
    if (e.target === document.getElementById('lvlup-modal')) closeLevelUpModal();
});

/* ===== RENDER: QUESTS ===== */
function renderQuests() {
    const div = document.getElementById('quest-list-container'); div.innerHTML = '';
    for (const cat in questsData[origin]) {
        const safe = cat.replace(/[&\s]+/g, '-').toLowerCase().replace(/:/g, '');
        let h = `<div class="header-row" id="h-${safe}" onclick="toggleCollapse('${safe}')"><h2>${cat}</h2><span class="cat-pct" id="pct-${safe}">0%</span></div><div class="grid-tidy" data-category="${safe}">`;
        questsData[origin][cat].forEach(q => {
            h += `<div class="grid-item" onclick="this.querySelector('input').click()"><input type="checkbox" style="display:none;" onchange="calcCat('${safe}'); updateUniqueMarker(this); triggerAutosave();"><span class="tag-marker">[ ]</span><span>${q}</span></div>`;
        });
        div.insertAdjacentHTML('beforeend', h + `</div>`);
    }
}

/* ===== RENDER: UNIQUES ===== */
/* [uniqueArmorData — moved to data.js] */

function renderUniqueArmor() {
    const div = document.getElementById('unique-armor-checklist'); div.innerHTML = '';
    Object.keys(uniqueArmorData).forEach(cat => {
        const safe = "a-" + cat.replace(/[&\s\(\)]+/g, '-').toLowerCase().replace(/-+/g,'-').replace(/-$/,'');
        let h = `<div class="header-row" id="h-${safe}" onclick="toggleCollapse('${safe}')"><h2>${cat}</h2><span class="cat-pct" id="pct-${safe}">0%</span></div><div class="grid-tidy" data-category="${safe}">`;
        uniqueArmorData[cat].forEach(w => {
            const tmp = document.createElement('div'); tmp.innerHTML = w;
            const plainName = (tmp.querySelector('a') || tmp).textContent.trim();
            const safeN = plainName.replace(/'/g, "\\'");
            h += `<div class="grid-item" onclick="this.querySelector('input').click()">
                <input type="checkbox" class="u-armor-check" onchange="calcCat('${safe}'); updateUniqueMarker(this); triggerAutosave();" style="display:none;">
                <span class="tag-marker">[ ]</span>
                <span style="flex:1;">${w}</span>
                <button class="uni-add-btn" title="ADD TO LOADOUT" onclick="event.stopPropagation(); addUniqueArmorToLoadout('${safeN}')">+</button>
            </div>`;
        });
        div.insertAdjacentHTML('beforeend', h + `</div>`);
    });
}

function addUniqueArmorToLoadout(name) {
    addArmor();
    const cards = document.querySelectorAll('#armor-list .gear-card');
    const card = cards[cards.length - 1];
    if (card) {
        const ins = card.querySelectorAll('.gear-field-input');
        if(ins[0]) ins[0].value = name;
        const n = name.toUpperCase();
        const sel = card.querySelector('.gear-field-select');
        if (sel) {
            if (n.includes('POWER ARMOR') || n.includes('T-51') || n.includes('REMNANTS') || n.includes('TESLA ARMOR') || n.includes('ASHUR') || n.includes('PROTOTYPE MEDIC') || n.includes('LINDEN') || n.includes('SALT-UPON') || n.includes('TRIBAL POWER')) sel.value = 'POWER ARMOR';
            else if (n.includes('COMBAT') || n.includes('RANGER') || n.includes('RECON') || n.includes('LEATHER') || n.includes('METAL') || n.includes('ASSASSIN') || n.includes('STEALTH ARMOR') || n.includes('RIOT GEAR') || n.includes('SIERRA MADRE') || n.includes('GREAT KHAN')) sel.value = 'MEDIUM';
            else sel.value = 'LIGHT';
            updateArmorBadge(sel);
        }
        triggerAutosave();
    }
    _flashGearTabBtn();
}

function updateUniqueMarker(cb) {
    const marker = cb.parentElement.querySelector('.tag-marker');
    if (marker) marker.textContent = cb.checked ? '[X]' : '[ ]';
    renderBadges();
}

function searchUniqueArmor() { searchItems('uni-armor-search-bar', 'unique-armor-checklist'); }

function renderUniques() {
    const div = document.getElementById('unique-weapon-checklist'); div.innerHTML = '';
    const categoryOrder = ["PISTOLS & REVOLVERS", "SMGS & RIFLES", "SHOTGUNS", "BIG GUNS", "ENERGY WEAPONS", "EXPLOSIVES", "MELEE WEAPONS", "UNARMED"];
    categoryOrder.forEach(cat => {
        if (uniqueWeaponData[cat]) {
            const safe = "u-" + cat.replace(/[&\s]+/g, '-').toLowerCase();
            let h = `<div class="header-row" id="h-${safe}" onclick="toggleCollapse('${safe}')"><h2>${cat}</h2><span class="cat-pct" id="pct-${safe}">0%</span></div><div class="grid-tidy" data-category="${safe}">`;
            uniqueWeaponData[cat].forEach(w => {
                // Extract plain text name from the anchor tag
                const tmp = document.createElement('div'); tmp.innerHTML = w;
                const plainName = (tmp.querySelector('a') || tmp).textContent.trim();
                const safeN = plainName.replace(/'/g, "\\'");
                h += `<div class="grid-item" onclick="this.querySelector('input').click()">
                    <input type="checkbox" class="u-wpn-check" onchange="calcCat('${safe}'); updateUniqueMarker(this); triggerAutosave();" style="display:none;">
                    <span class="tag-marker">[ ]</span>
                    <span style="flex:1;">${w}</span>
                    <button class="uni-add-btn" title="ADD TO LOADOUT" onclick="event.stopPropagation(); addUniqueToLoadout('${safeN}')">+</button>
                </div>`;
            });
            div.insertAdjacentHTML('beforeend', h + `</div>`);
        }
    });
}

function _flashGearTabBtn() {
    const btn = document.getElementById('tab-btn-gear');
    btn.style.boxShadow = '0 0 12px var(--pip-color)';
    btn.style.background = 'var(--pip-color)';
    btn.style.color = 'black';
    setTimeout(() => {
        if (!btn.classList.contains('active')) {
            btn.style.boxShadow = '';
            btn.style.background = '';
            btn.style.color = '';
        }
    }, 800);
}

function addUniqueToLoadout(name) {
    addWeapon();
    const cards = document.querySelectorAll('#weapon-list .gear-card');
    const card = cards[cards.length - 1];
    if (card) {
        const ins = card.querySelectorAll('.gear-field-input');
        if(ins[0]) ins[0].value = name;
        triggerAutosave();
    }
    // Flash the loadout tab button briefly to guide the user
    _flashGearTabBtn();
}

/* ===== RENDER: COLLECTIBLES ===== */
function renderCollectibles() {
    const div = document.getElementById('coll-list'); div.innerHTML = '';
    if(origin === 'CW') {
        div.innerHTML = `
            <div class="header-row" id="h-special-bobble" onclick="toggleCollapse('special-bobble')"><h2>BOBBLEHEADS: S.P.E.C.I.A.L.</h2></div>
            <div class="grid-tidy" data-category="special-bobble">${sKeys.map(s=>`<div class="grid-item" onclick="this.querySelector('input').click()"><input type="checkbox" style="display:none;" onchange="updateUniqueMarker(this); triggerAutosave()"><span class="tag-marker">[ ]</span><span>${s}</span></div>`).join('')}</div>
            <div class="header-row" id="h-skill-bobble" onclick="toggleCollapse('skill-bobble')"><h2>BOBBLEHEADS: SKILLS</h2></div>
            <div class="grid-tidy" data-category="skill-bobble">${skills.map(s=>`<div class="grid-item" onclick="this.querySelector('input').click()"><input type="checkbox" style="display:none;" onchange="updateUniqueMarker(this); triggerAutosave()"><span class="tag-marker">[ ]</span><span>${s}</span></div>`).join('')}</div>`;
    } else {
        div.innerHTML = `
            <div class="header-row" id="h-snow-base" onclick="toggleCollapse('snow-base')"><h2>SNOWGLOBES: BASE GAME</h2></div>
            <div class="grid-tidy" data-category="snow-base">${["GOODSPRINGS","STRIP","HOOVER DAM","MT. CHARLESTON","NELLIS","MORMON FORT","TEST SITE"].map(s=>`<div class="grid-item" onclick="this.querySelector('input').click()"><input type="checkbox" style="display:none;" onchange="updateUniqueMarker(this); triggerAutosave()"><span class="tag-marker">[ ]</span><span>${s}</span></div>`).join('')}</div>
            <div class="header-row" id="h-snow-dlc" onclick="toggleCollapse('snow-dlc')"><h2>SNOWGLOBES: DLC</h2></div>
            <div class="grid-tidy" data-category="snow-dlc">${["SIERRA MADRE","ZION","BIG MT","THE DIVIDE"].map(s=>`<div class="grid-item" onclick="this.querySelector('input').click()"><input type="checkbox" style="display:none;" onchange="updateUniqueMarker(this); triggerAutosave()"><span class="tag-marker">[ ]</span><span>${s}</span></div>`).join('')}</div>`;
    }
}

/* ===== CATEGORY COMPLETION ===== */
function calcCat(id) {
    const g = document.querySelector(`.grid-tidy[data-category="${id}"]`);
    if(!g) return;
    const checks = Array.from(g.querySelectorAll('input[type="checkbox"]'));
    const pct = Math.round((checks.filter(c => c.checked).length / checks.length) * 100);
    const pctEl = document.getElementById(`pct-${id}`);
    if(pctEl) pctEl.innerText = pct === 100 ? "DONE" : pct + "%";
    document.getElementById(`h-${id}`).classList.toggle('completed', pct === 100);
    renderBadges();
}


/* === KARMA FACE === */
function updateKarmaFace(k){
    const el=document.getElementById('karma-face');if(!el)return;
    const F={'very-good':{top:'∘ ∘ ∘',g:'✦◠‿◠✦',s:'VERY GOOD',c:'#a0e8ff'},
             'good':{top:'',g:'◠‿◠',s:'GOOD',c:'#70d870'},
             'neutral':{top:'',g:'◉_◉',s:'NEUTRAL',c:'#c8c888'},
             'evil':{top:'',g:'◉益◉',s:'EVIL',c:'#ff8040'},
             'very-evil':{top:'',g:'☠‿☠',s:'VERY EVIL',c:'#ff3030'}};
    const f=F[k]||F['neutral'];
    el.innerHTML=(f.top?'<div class="kface-halo" style="color:'+f.c+'">'+f.top+'</div>':'')
        +'<div class="kface-glyph" style="color:'+f.c+';text-shadow:0 0 8px '+f.c+'88">'+f.g+'</div>'
        +'<div class="kface-sub" style="color:'+f.c+'">'+f.s+'</div>';
}

/* === TRANSIT BUTTON === */
function updateTransitBtn(){
    const b=document.getElementById('transit-btn');if(!b)return;
    b.innerHTML=origin==='CW'?'☢ VENTURE TO THE MOJAVE':'☢ RETURN TO THE CAPITAL';
    b.title=origin==='CW'?'WASTELAND TRANSIT — TO THE MOJAVE':'WASTELAND TRANSIT — TO THE CAPITAL';
}

/* === BADGE SYSTEM === */
function _catComplete(sel,safe){
    const g=document.querySelector(sel+' .grid-tidy[data-category="'+safe+'"]');
    if(!g)return false;
    const all=g.querySelectorAll('input[type="checkbox"]');
    return all.length>0&&Array.from(all).every(c=>c.checked);
}
function computeBadges(){
    const e=[];
    [{safe:'u-pistols-revolvers',l:'PISTOLS & REVOLVERS'},{safe:'u-smgs-rifles',l:'SMGS & RIFLES'},
     {safe:'u-shotguns',l:'SHOTGUNS'},{safe:'u-big-guns',l:'BIG GUNS'},{safe:'u-energy-weapons',l:'ENERGY WEAPONS'},
     {safe:'u-explosives',l:'EXPLOSIVES'},{safe:'u-melee-weapons',l:'MELEE WEAPONS'},{safe:'u-unarmed',l:'UNARMED'}]
    .forEach(w=>{if(_catComplete('#unique-weapon-checklist',w.safe))e.push({group:'ARSENAL',label:w.l,icon:'⚔'});});
    [{safe:'a-power-armor-fo3',l:'POWER ARMOR (FO3)'},{safe:'a-combat-armor-fo3',l:'COMBAT ARMOR (FO3)'},
     {safe:'a-outfits-clothing-fo3',l:'CLOTHING (FO3)'},{safe:'a-headgear-fo3',l:'HEADGEAR (FO3)'},
     {safe:'a-power-armor-fnv',l:'POWER ARMOR (FNV)'},{safe:'a-combat-armor-fnv',l:'COMBAT ARMOR (FNV)'},
     {safe:'a-outfits-clothing-fnv',l:'CLOTHING (FNV)'},{safe:'a-headgear-fnv',l:'HEADGEAR (FNV)'},
     {safe:'a-dlc-armor-fnv',l:'DLC ARMOR (FNV)'}]
    .forEach(a=>{if(_catComplete('#unique-armor-checklist',a.safe))e.push({group:'ARSENAL',label:a.l,icon:'⛑'});});
    if(origin==='CW'){
        if(_catComplete('#coll-list','special-bobble'))e.push({group:'COLLECTIBLES',label:'BOBBLEHEADS: S.P.E.C.I.A.L.',icon:'◆'});
        if(_catComplete('#coll-list','skill-bobble'))  e.push({group:'COLLECTIBLES',label:'BOBBLEHEADS: SKILLS',icon:'◆'});
    }else{
        if(_catComplete('#coll-list','snow-base'))e.push({group:'COLLECTIBLES',label:'SNOWGLOBES: BASE',icon:'❅'});
        if(_catComplete('#coll-list','snow-dlc')) e.push({group:'COLLECTIBLES',label:'SNOWGLOBES: DLC', icon:'❅'});
    }
    const _si=IMPLANTS_DATA.filter(i=>i.cat==='special');
    if(_si.length&&_si.every(i=>!!implantsTaken[i.name]))e.push({group:'BODY MODS',label:'ALL SPECIAL IMPLANTS',icon:'⚕'});
    const _bi=IMPLANTS_DATA.filter(i=>i.cat==='body');
    if(_bi.length&&_bi.every(i=>!!implantsTaken[i.name]))e.push({group:'BODY MODS',label:'ALL BODY IMPLANTS',icon:'⚕'});
    const _bmt=IMPLANTS_DATA.filter(i=>i.cat==='bigtmt');
    if(_bmt.length&&_bmt.every(i=>!!implantsTaken[i.name]))e.push({group:'BODY MODS',label:'ALL BIG MT IMPLANTS',icon:'☆'});
    [{safe:'main-quest',l:'MAIN QUEST (FO3)'},{safe:'dlc-operation-anchorage',l:'OP. ANCHORAGE'},
     {safe:'dlc-the-pitt',l:'THE PITT'},{safe:'dlc-broken-steel',l:'BROKEN STEEL'},
     {safe:'dlc-point-lookout',l:'POINT LOOKOUT'},{safe:'dlc-mothership-zeta',l:'MOTHERSHIP ZETA'}]
    .forEach(b=>{if(_catComplete('#quest-list-container',b.safe))e.push({group:'CHRONICLE',label:b.l,icon:'☢'});});
    [{safe:'main-quest-(general)',l:"COURIER'S JOURNEY"},{safe:'main-quest-(ncr)',l:'FOR THE REPUBLIC'},
     {safe:'main-quest-(mr.-house)',l:"HOUSE'S GAMBIT"},{safe:'main-quest-(legion)',l:'AVE CAESAR'},
     {safe:'main-quest-(independent)',l:'NO GODS, NO MASTERS'},{safe:'dlc-dead-money',l:'DEAD MONEY'},
     {safe:'dlc-honest-hearts',l:'HONEST HEARTS'},{safe:'dlc-old-world-blues',l:'OLD WORLD BLUES'},
     {safe:'dlc-lonesome-road',l:'LONESOME ROAD'},{safe:'companion-quests',l:'ALL COMPANIONS'}]
    .forEach(b=>{if(_catComplete('#quest-list-container',b.safe))e.push({group:'CHRONICLE',label:b.l,icon:'◆'});});
    // ── LIBRARIAN: 5+ of any skill book ──────────────────────────
    const libSkillNames = {
        'BARTER':'Barter','BIG GUNS':'Big Guns','ENERGY WEAPONS':'Energy Weapons',
        'EXPLOSIVES':'Explosives','GUNS':'Guns','LOCKPICK':'Lockpick',
        'MEDICINE':'Medicine','MELEE WEAPONS':'Melee Weapons','REPAIR':'Repair',
        'SCIENCE':'Science','SNEAK':'Sneak','SPEECH':'Speech',
        'SURVIVAL':'Survival','UNARMED':'Unarmed'
    };
    Object.entries(skillBooksFound).forEach(([skill, count]) => {
        if (count >= 5) {
            e.push({ group: 'LIBRARIAN', label: libSkillNames[skill] || skill, icon: '📖' });
        }
    });
    return e;
}
function renderBadges(){
    const el=document.getElementById('badge-panel');if(!el)return;
    const badges=computeBadges();
    if(!badges.length){el.innerHTML='<div class="badge-empty">— NO COMMENDATIONS YET —</div>';return;}
    const grps={};
    badges.forEach(b=>{if(!grps[b.group])grps[b.group]=[];grps[b.group].push(b);});
    let h='';
    for(const g in grps){
        h+=`<div class="badge-group-block" data-group="${g}">`;
        h+=`<div class="badge-group-label">${g}</div>`;
        grps[g].forEach(b=>{
            h+=`<div class="badge-card">`;
            h+=`<span class="badge-icon-wrap">${b.icon}</span>`;
            h+=`<span class="badge-label">${b.label}</span>`;
            h+=`<span class="badge-check">✓</span>`;
            h+=`</div>`;
        });
        h+='</div>';
    }
    el.innerHTML=h;
}

/* ===== UPDATE ALL ===== */
function renderLevelUpBonuses() {
    const container = document.getElementById('ov-levelup-bonuses');
    if (!container) return;
    
    // Only show if there are any level-up bonuses recorded
    if (!levelUpBonuses || levelUpBonuses.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    // Calculate distribution
    const counts = { hp: 0, ap: 0, cw: 0 };
    levelUpBonuses.forEach(choice => {
        if (counts[choice] !== undefined) counts[choice]++;
    });
    
    const total = levelUpBonuses.length;
    if (total === 0) {
        container.style.display = 'none';
        return;
    }
    
    // Calculate percentages
    const hpPct = Math.round((counts.hp / total) * 100);
    const apPct = Math.round((counts.ap / total) * 100);
    const cwPct = Math.round((counts.cw / total) * 100);
    
    // Build display
    container.innerHTML = `
        <div class="levelup-dist-title">LEVEL-UP BONUSES (${total} levels)</div>
        <div class="levelup-dist-bars">
            <div class="levelup-dist-bar">
                <span class="levelup-dist-icon">❤️</span>
                <span class="levelup-dist-label">HEALTH</span>
                <div class="levelup-dist-track">
                    <div class="levelup-dist-fill hp-fill" style="width: ${hpPct}%;"></div>
                </div>
                <span class="levelup-dist-pct">${hpPct}%</span>
            </div>
            <div class="levelup-dist-bar">
                <span class="levelup-dist-icon">⚡</span>
                <span class="levelup-dist-label">ACTION PTS</span>
                <div class="levelup-dist-track">
                    <div class="levelup-dist-fill ap-fill" style="width: ${apPct}%;"></div>
                </div>
                <span class="levelup-dist-pct">${apPct}%</span>
            </div>
            <div class="levelup-dist-bar">
                <span class="levelup-dist-icon">📦</span>
                <span class="levelup-dist-label">CARRY WT</span>
                <div class="levelup-dist-track">
                    <div class="levelup-dist-fill cw-fill" style="width: ${cwPct}%;"></div>
                </div>
                <span class="levelup-dist-pct">${cwPct}%</span>
            </div>
        </div>
    `;
    container.style.display = 'block';
}

function getSPECIALPool() { return mode === 'hc' ? 30 : 33; }

function updateAll() {
    const pool = getSPECIALPool();
    let _ib=0; IMPLANTS_DATA.forEach(i=>{if(i.cat==='special'&&i.stat&&implantsTaken[i.name])_ib++;});
    let _itb=0; document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row), #extra-perk-list .prog-row')
        .forEach(r=>{if(/^Intense Training \(\+1 \w+\)/i.test(r.querySelector('.prog-name-input')?.value||''))_itb++;});
    const rem = pool - Math.max(0, (Object.values(special).reduce((a,b)=>a+b,0) - 7) - _ib - _itb);
    document.getElementById('pts-left').innerText = rem;
    const { specialDelta, skillDelta, hasConditional } = getActiveTraitBonuses();
    const { perkSpecialDelta, perkSkillDelta } = getActivePerkBonuses();
    const { specDelta: ctDelta, skillDelta: condSkillDelta } = getConditionalToggleDelta();
    // Merge perk deltas into combined display deltas
    const combSpecDelta = {};
    for (const k of Object.keys(specialDelta)) {
        combSpecDelta[k] = (specialDelta[k]||0) + (perkSpecialDelta[k]||0);
    }
    const combSkillDelta = {};
    const allSkillKeys = new Set([...Object.keys(skillDelta), ...Object.keys(perkSkillDelta)]);
    for (const k of allSkillKeys) {
        combSkillDelta[k] = (skillDelta[k]||0) + (perkSkillDelta[k]||0);
    }
    document.getElementById('special-list').innerHTML = sKeys.map(k => {
        const td = specialDelta[k] || 0;
        const pd = perkSpecialDelta[k] || 0;
        const cd = ctDelta[k] || 0;
        const rank = getSpecialRank(k);
        let deltaBadge = '';
        if (td !== 0) deltaBadge += `<span class="spec-delta-badge ${td>0?'sdelta-pos':'sdelta-neg'}" title="FROM TRAIT">${td>0?'+':''}${td}<span class="delta-src-tag">T</span></span>`;
        if (pd !== 0) deltaBadge += `<span class="spec-delta-badge ${pd>0?'sdelta-pos':'sdelta-neg'} sdelta-perk" title="FROM PERK">${pd>0?'+':''}${pd}<span class="delta-src-tag">P</span></span>`;
        if (cd !== 0) deltaBadge += `<span class="spec-delta-badge ${cd>0?'sdelta-cond-pos':'sdelta-cond-neg'}" title="FROM ACTIVE CONDITIONAL TOGGLE">${cd>0?'+':''}${cd}<span class="delta-src-tag">◆</span></span>`;
        const _ds = Math.max(1, special[k]);
        return `<div class="special-row" data-key="${k}">
            <span class="spec-abbr-lg spec-info-btn" title="Click for ${k} details — ${rank}" onclick="openSpecialInfoModal('${k}')">${k}</span>
            <div class="spec-track-wide" onclick="openSpecialInfoModal('${k}')" style="cursor:pointer;" title="${rank}">
                <div class="spec-fill-wide${_ds===10?' spec-fill-full':_ds>=7?' spec-fill-warm':_ds>=4?' spec-fill-mid':' spec-fill-dim'}" style="width:${_ds*10}%; opacity:${(0.3 + Math.max(0,_ds-1)/9*0.7).toFixed(2)};"></div>
            </div>
            <div class="special-controls">
                <button class="special-btn" onclick="mod('${k}',-1)" ${special[k]<=1?'disabled':''}>−</button>
                <span class="spec-val special-val">${special[k]}</span>
                <button class="special-btn" onclick="mod('${k}',1)" ${rem<=0 || special[k]>=10?'disabled':''}>+</button>
                <span class="spec-mod-badge" style="display:none;"></span>
                ${deltaBadge}
            </div>
            <div class="spec-rank-title">${rank}</div>
        </div>`;
    }).join('');

    document.getElementById('ov-name').innerText = (document.getElementById('char-name').value || "NO_ID").toUpperCase();
    document.getElementById('ov-spec').innerHTML = sKeys.map(k => `<div class="char-banner-stat"><span class="char-banner-stat-key">${k}</span><span class="char-banner-stat-val">${special[k]}</span></div>`).join('');
    document.getElementById('ov-tags').innerHTML = Array.from(document.querySelectorAll('#tag-area input:checked')).map(c => { const label = c.parentElement.querySelectorAll('span')[1]; return `<div class="ov-entry"><span>${label ? label.innerText : ''}</span></div>`; }).join('') || "NONE";
        const startingTraitHTML = startingTraits.map((t) => {
        const td = TRAITS_DATA.find(x => x.name.trim().toLowerCase() === t.name.trim().toLowerCase())
                 || INTERNALIZED_TRAITS_DATA.find(x => x.name.trim().toLowerCase() === t.name.trim().toLowerCase());
        const safeN = encodeURIComponent(t.name).replace(/'/g, '%27');
        // always clickable — ovPerkClick searches perks, traits, internalized, rewards
        return `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${safeN}')" title="${td ? 'CLICK FOR TRAIT DETAILS' : 'CLICK FOR DETAILS'}"><span>◈ ${t.name}</span></div>`;
    }).join('');
    const levelTraitHTML = Array.from(document.querySelectorAll('#prog-list .trait-slot-row')).map(r => {
        const n = r.getAttribute('data-chosen')||'';
        if (!n) return '';
        const td = TRAITS_DATA.find(x => x.name.trim().toLowerCase() === n.trim().toLowerCase())
                 || INTERNALIZED_TRAITS_DATA.find(x => x.name.trim().toLowerCase() === n.trim().toLowerCase());
        const safeN = encodeURIComponent(n).replace(/'/g, '%27');
        return `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${safeN}')" title="${td ? 'CLICK FOR TRAIT DETAILS' : 'CLICK FOR DETAILS'}"><span>▸ ${n}</span></div>`;
    }).join('');
    const traitHTML = startingTraitHTML + levelTraitHTML || 'NONE';
    const ovT = document.getElementById('ov-traits'); if(ovT) ovT.innerHTML = traitHTML;

    document.getElementById('ov-perks').innerHTML = (() => {
        // Strip annotations like [+AP REGEN] or (+1 STR) from perk names for lookup
        function baseName(v) { return v.replace(/\s*[\[(].*?[\])]$/, '').trim(); }
        // Helper: check if perk meets requirements
        function getReqIndicator(perkName) {
            const perk = PERKS_DATA.find(p => p.name.toUpperCase() === perkName.toUpperCase());
            if (!perk) return ''; // Not a standard perk
            const meets = meetsRequirements(perk);
            return meets 
                ? '<span class="ov-req-indicator ov-req-met" title="REQUIREMENTS CURRENTLY MET">✓</span>'
                : '<span class="ov-req-indicator ov-req-unmet" title="REQUIREMENTS NOT MET">⚠</span>';
        }
        const levelPerks = Array.from(document.querySelectorAll('#prog-list .prog-row')).map(r => {
            const lvl = r.querySelector('.lvl-tag')?.innerText || '';
            const val = r.querySelector('.prog-name-input')?.value || '';
            if (!val) return '';
            const reqIndicator = getReqIndicator(baseName(val));
            // always set onclick — ovPerkClick will look up across all data sources
            return `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${encodeURIComponent(baseName(val))}')" title="CLICK FOR DETAILS"><span>${reqIndicator}${val}</span><span style="opacity:0.5;">${lvl}</span></div>`;
        }).join('');
        const bonusPerks = Array.from(document.querySelectorAll('#extra-perk-list .prog-row')).map(r => {
            const val = r.querySelector('.prog-name-input')?.value || '';
            if (!val) return '';
            const reqIndicator = getReqIndicator(baseName(val));
            return `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${encodeURIComponent(baseName(val))}')" title="CLICK FOR DETAILS"><span>${reqIndicator}${val}</span><span style="opacity:0.5; color:#a0cfff;">BONUS</span></div>`;
        }).join('');
        const rewardPerks = rewardPerksList.map(rp => {
            const reqIndicator = getReqIndicator(rp.name);
            return `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${encodeURIComponent(rp.name)}')" title="CLICK FOR DETAILS"><span>${reqIndicator}${rp.name}</span><span style="opacity:0.5; color:#ffd080;">REWARD</span></div>`;
        }).join('');
        const internalized = internalizedTraitsList.map(it => {
            return `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${encodeURIComponent(it.name)}')" title="CLICK FOR DETAILS"><span>${it.name}</span><span style="opacity:0.5; color:#c8a0ff;">INT.</span></div>`;
        }).join('');
        return (levelPerks + bonusPerks + rewardPerks + internalized) || '<span style="opacity:0.3; font-size:0.65rem;">NONE YET</span>';
    })();

    let gearHTML = Array.from(document.querySelectorAll('#weapon-list .gear-card')).map(c => {
        const ins = c.querySelectorAll('.gear-field-input');
        const n = ins[0]?.value||''; const a = ins[2]?.value||''; const str = ins[3]?.value||''; const sel = c.querySelector('.gear-skill-type-select'); const st = sel?.value||''; const sr = ins[4]?.value||'';
        return n ? `<div class="ov-entry"><span>⚔ ${n}</span><div style="display:flex;gap:6px;align-items:center;">${st?`<span style="font-size:0.68rem;color:rgba(255,220,80,0.7);border:1px solid rgba(255,220,80,0.25);padding:0 4px;">${st}${sr?' '+sr:''}</span>`:''}${str?`<span style="font-size:0.68rem;color:rgba(100,180,255,0.7);border:1px solid rgba(100,180,255,0.2);padding:0 4px;">STR ${str}</span>`:''}${a?`<span style="opacity:0.55;">${a}</span>`:''}</div></div>` : '';
    }).join('');
    gearHTML += Array.from(document.querySelectorAll('#armor-list .gear-card')).map(c => {
        const ins = c.querySelectorAll('.gear-field-input');
        const n = ins[0]?.value||''; const sel = c.querySelector('.gear-field-select'); const w = sel?.value||'';
        return n ? `<div class="ov-entry"><span>🛡 ${n}</span><span style="opacity:0.6;">${w}</span></div>` : '';
    }).join('');
    document.getElementById('ov-gear').innerHTML = gearHTML || "EMPTY";
    updateGearCounts();

    // Implants overview
    const ovImplants = document.getElementById('ov-implants');
    if (ovImplants) {
        const takenList = Object.entries(implantsTaken).filter(([k,v]) => v).map(([k]) => {
            const imp = IMPLANTS_DATA.find(i => i.name === k);
            return imp ? `<div class="ov-entry"><span>${imp.name}${imp.cat==='special'&&imp.stat?' (+1 '+imp.stat+')':''}</span></div>` : '';
        }).join('');
        ovImplants.innerHTML = takenList || '<span style="opacity:0.35;">NONE</span>';
    }

    // Update ov-traits-inline visibility
    const ovTI = document.getElementById('ov-traits-inline');
    const ovTEmpty = document.getElementById('ov-traits-empty');
    const startingTraitHTML2 = startingTraits.map(t => `<div class="ov-trait-entry"><span class="ov-trait-dot" style="color:#c8ffd4;">◈</span><span>${t.name}</span></div>`).join('');
    const levelTraitHTML2 = Array.from(document.querySelectorAll('#prog-list .trait-slot-row')).map(r => { const n = r.getAttribute('data-chosen')||''; return n ? `<div class="ov-trait-entry"><span class="ov-trait-dot">▸</span><span>${n}</span></div>` : ''; }).join('');
    const traitHTML2 = startingTraitHTML2 + levelTraitHTML2;
    if (ovTI) ovTI.innerHTML = traitHTML2;
    if (ovTEmpty) ovTEmpty.style.display = traitHTML2 ? 'none' : 'block';

    syncTagLimit();

    // Skills panel
    const tagged = getTaggedSkills();
    const ptsLvl = pointsPerLevel();
    const lvlBtn = document.getElementById('lvlup-open-btn');
    if (lvlBtn) {
        document.getElementById('char-level-display').textContent = charLevel;
        renderKarmaSelector();
        renderHumbledBanner();
        document.getElementById('lvlup-pts-preview').textContent = ptsLvl + ' PTS';
        const ready = tagged.size >= 3;
        lvlBtn.classList.toggle('lvlup-btn-ready', ready);
        lvlBtn.classList.toggle('lvlup-btn-locked', !ready);
    }
    // Fix 5: Show/hide rollback button based on level
    const rollbackBtn = document.getElementById('rollback-btn');
    if (rollbackBtn) {
        rollbackBtn.style.display = charLevel > 1 ? 'inline-block' : 'none';
    }
    const skillListEl = document.getElementById('skill-list');
    if (skillListEl) {
        skillListEl.innerHTML = skills.map(s => {
            const isFourthTag = s === _fourthTagSkill;
            const isTagged = tagged.has(s);
            const base = skillBase(s);
                        const spent = skillPoints[s] || 0;
            const tDelta = skillDelta[s] || 0;
            const pDelta = perkSkillDelta[s] || 0;
            const cDelta = condSkillDelta[s] || 0;
            const bDelta = bookBonus(s);
            const val = Math.min(100, Math.max(0, base + tDelta + pDelta + cDelta + spent + bDelta));
            let deltaBadges = '';
            if (tDelta !== 0) deltaBadges += `<span class="skill-delta-badge ${tDelta>0?'sdelta-pos':'sdelta-neg'}" title="FROM TRAIT">${tDelta>0?'+':''}${tDelta}<span class="delta-src-tag">T</span></span>`;
            if (pDelta !== 0) deltaBadges += `<span class="skill-delta-badge ${pDelta>0?'sdelta-pos':'sdelta-neg'} sdelta-perk" title="FROM PERK">${pDelta>0?'+':''}${pDelta}<span class="delta-src-tag">P</span></span>`;
            if (bDelta !== 0) deltaBadges += `<span class="skill-delta-badge sdelta-pos sdelta-book" title="FROM SKILL BOOKS (×${skillBooksFound[s] || 0}${hasIdeologue()?', IDEOLOGUE':''})">+${bDelta}<span class="delta-src-tag">B</span></span>`;
            const breakdown = ('BASE:'+base+(isTagged?' TAG:x2'+(isFourthTag?' [TAG!]':''):'')+(spent?' LVL:+'+spent:'')+(tDelta?' TRAIT:'+(tDelta>0?'+':'')+tDelta:'')+(pDelta?' PERK:'+(pDelta>0?'+':'')+pDelta:'')+(cDelta?' COND:'+(cDelta>0?'+':'')+cDelta:'')+(bDelta?' BOOK:+'+bDelta:'')).trim();
            const tagClass = isFourthTag ? ' skill-row-tagged skill-row-tag4' : (isTagged ? ' skill-row-tagged' : '');
            const tagIcon = isFourthTag ? '✦ ' : (isTagged ? '★ ' : '');
            return `<div class="skill-row${tagClass}" title="${breakdown}">
                <span class="skill-row-name">${tagIcon}${s}</span>
                <div class="skill-row-bar"><div class="skill-row-fill" style="width:${val}%"></div></div>
                <span class="skill-row-val">${val}</span>${deltaBadges}
            </div>`;
        }).join('');
    }
    // Keep implant list in sync (limit changes when END changes)
    renderImplants();
    renderBadges();
    updateKarmaFace(buildKarma);
    updateTransitBtn();
    // Keep build summary drawer in sync if open
    const drawerEl = document.getElementById('build-summary-drawer');
    if (drawerEl && drawerEl.classList.contains('drawer-open')) updateBuildSummaryDrawer();
    // Fix 4: Real-time requirement updates - refresh All Perks tab if currently visible
    const perksTab = document.getElementById('tab-perks');
    if (perksTab && perksTab.style.display !== 'none') {
        renderAllPerks();
    }
    
    // Update wishlist count badge
    const wishlistCountEl = document.getElementById('wishlist-count');
    if (wishlistCountEl) {
        const count = perkWishlist.length;
        wishlistCountEl.textContent = count;
        wishlistCountEl.style.display = count > 0 ? 'inline-block' : 'none';
    }
    
    // Update level-up bonuses distribution display
    renderLevelUpBonuses();
}

function mod(k, v) { special[k] += v; updateAll(); reCheckAllPerkRows(); triggerAutosave(); }

function addTrait() {
    if(mode==='hc' && document.getElementById('trait-list').children.length>=5) return;
    document.getElementById('trait-list').insertAdjacentHTML('beforeend',
        `<div style="display:flex; margin-bottom:2px;"><input type="text" oninput="triggerAutosave()" style="flex:1; background:transparent; border:none; border-bottom:1px solid #444; color:#fff;" placeholder="TRAIT NAME..."><button onclick="this.parentElement.remove();updateAll();triggerAutosave();" style="color:red; background:none; border:none; cursor:pointer;">X</button></div>`);
    updateAll();
}

function addWeapon() {
    document.getElementById('weapon-list').insertAdjacentHTML('beforeend',
        `<div class="gear-card gear-weapon-card">
            <div class="gear-card-topbar">
                <span class="gear-card-type-badge">⚔ WEAPON</span>
                <button class="gear-card-remove" onclick="this.closest('.gear-card').remove();updateGearCounts();updateAll();triggerAutosave();">✕ REMOVE</button>
            </div>
            <div class="gear-card-fields">
                <div class="gear-field-group gear-field-primary">
                    <label class="gear-field-label">WEAPON NAME</label>
                    <input type="text" class="gear-field-input" oninput="triggerAutosave()" placeholder="E.G. LUCKY, THIS MACHINE...">
                </div>
                <div class="gear-field-row">
                    <div class="gear-field-group">
                        <label class="gear-field-label">FOUND / LOCATION</label>
                        <input type="text" class="gear-field-input" oninput="triggerAutosave()" placeholder="LOCATION...">
                    </div>
                    <div class="gear-field-group">
                        <label class="gear-field-label">AMMO TYPE</label>
                        <input type="text" class="gear-field-input" oninput="triggerAutosave()" placeholder=".357 MAG, 5MM...">
                    </div>
                </div>
                <div class="gear-field-row gear-weapon-req-row">
                    <div class="gear-field-group gear-str-req-group">
                        <label class="gear-field-label">STR REQ</label>
                        <input type="text" class="gear-field-input gear-stat-input gear-str-req-input" oninput="triggerAutosave()" placeholder="—">
                    </div>
                    <div class="gear-field-group gear-skill-type-group">
                        <label class="gear-field-label">SKILL TYPE</label>
                        <select class="gear-field-select gear-skill-type-select" onchange="triggerAutosave()">
                            <option value="">— NONE —</option>
                            <option value="GUNS">GUNS</option>
                            <option value="BIG GUNS">BIG GUNS</option>
                            <option value="ENERGY WEAPONS">ENERGY WEAPONS</option>
                            <option value="EXPLOSIVES">EXPLOSIVES</option>
                            <option value="MELEE WEAPONS">MELEE WEAPONS</option>
                            <option value="UNARMED">UNARMED</option>
                        </select>
                    </div>
                    <div class="gear-field-group gear-skill-req-group">
                        <label class="gear-field-label">SKILL REQ</label>
                        <input type="text" class="gear-field-input gear-stat-input gear-skill-req-input" oninput="triggerAutosave()" placeholder="—">
                    </div>
                </div>
            </div>
        </div>`);
    updateGearCounts();
}

function addArmor() {
    document.getElementById('armor-list').insertAdjacentHTML('beforeend',
        `<div class="gear-card gear-armor-card">
            <div class="gear-card-topbar">
                <span class="gear-card-type-badge armor-badge">🛡 APPAREL</span>
                <button class="gear-card-remove" onclick="this.closest('.gear-card').remove();updateGearCounts();updateAll();triggerAutosave();">✕ REMOVE</button>
            </div>
            <div class="gear-card-fields">
                <div class="gear-field-group gear-field-primary">
                    <label class="gear-field-label">APPAREL NAME</label>
                    <input type="text" class="gear-field-input" oninput="triggerAutosave()" placeholder="E.G. COMBAT ARMOR, ROVING TRADER...">
                </div>
                <div class="gear-field-row">
                    <div class="gear-field-group">
                        <label class="gear-field-label">FOUND / LOCATION</label>
                        <input type="text" class="gear-field-input" oninput="triggerAutosave()" placeholder="LOCATION...">
                    </div>
                    <div class="gear-field-group">
                        <label class="gear-field-label">CLASS</label>
                        <select class="gear-field-select" onchange="updateArmorBadge(this);triggerAutosave()">
                            <option>LIGHT</option><option>MEDIUM</option><option>HEAVY</option><option>POWER ARMOR</option>
                        </select>
                    </div>
                </div>
                <div class="gear-field-row gear-armor-stats-row">
                    <div class="gear-field-group">
                        <label class="gear-field-label">DT</label>
                        <input type="text" class="gear-field-input gear-stat-input" oninput="triggerAutosave()" placeholder="0">
                    </div>
                    <div class="gear-field-group">
                        <label class="gear-field-label">DR</label>
                        <input type="text" class="gear-field-input gear-stat-input" oninput="triggerAutosave()" placeholder="0%">
                    </div>
                    <div class="gear-field-group gear-field-effect">
                        <label class="gear-field-label">EFFECT / BONUS</label>
                        <input type="text" class="gear-field-input" oninput="triggerAutosave()" placeholder="E.G. +5 SNEAK, CHEM RESIST...">
                    </div>
                </div>
            </div>
        </div>`);
    updateGearCounts();
}

function updateArmorBadge(sel) {
    const card = sel.closest('.gear-card');
    const badge = card.querySelector('.gear-card-type-badge');
    const icons = { LIGHT: '🧥', MEDIUM: '🪖', HEAVY: '⛓', 'POWER ARMOR': '🤖' };
    badge.textContent = (icons[sel.value] || '🛡') + ' ' + sel.value;
}

function updateGearCounts() {
    const wc = document.querySelectorAll('#weapon-list .gear-card').length;
    const ac = document.querySelectorAll('#armor-list .gear-card').length;
    const wcEl = document.getElementById('gear-weapon-count');
    const acEl = document.getElementById('gear-armor-count');
    if (wcEl) wcEl.textContent = wc;
    if (acEl) acEl.textContent = ac;
    const we = document.getElementById('weapon-empty');
    const ae = document.getElementById('armor-empty');
    if (we) we.style.display = wc ? 'none' : 'block';
    if (ae) ae.style.display = ac ? 'none' : 'block';
}

function addExtraPerk() {
    document.getElementById('extra-perk-list').insertAdjacentHTML('beforeend', makeProgRow('BONUS PERK', false, true));
}

/* ===== PROGRESSION AUTOCOMPLETE ENGINE ===== */
let _acCloseTimer = null;

function onProgNameInput(input) {
    const row = input.closest('.prog-row');
    const dropdown = row.querySelector('.prog-ac-dropdown');
    const query = input.value.trim().toUpperCase();

    // If empty, just hide
    if (!query) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; return; }

    // Filter perks
    const matches = PERKS_DATA.filter(p =>
        p.name.toUpperCase().includes(query) || p.req.toUpperCase().includes(query)
    ).slice(0, 12);

    if (!matches.length) {
        dropdown.innerHTML = `<div class="ac-no-results">NO MATCHING PERKS</div>`;
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = matches.map((p, i) => {
        const multiLabel = p.ranks > 1 ? ` <span style="color:var(--pip-color);font-size:0.58rem;">[★${p.ranks}]</span>` : '';
        const safeName = p.name.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
        return `<div class="prog-ac-item" data-idx="${i}"
            onmousedown="selectPerkInRow(this.closest('.prog-row'), ${JSON.stringify(p.name)})">
            <span class="ac-item-name">${p.name}${multiLabel}</span>
            <span class="ac-item-req">${p.req}</span>
        </div>`;
    }).join('');
    dropdown.style.display = 'block';
}

function onProgNameKey(e, input) {
    const row = input.closest('.prog-row');
    const dropdown = row.querySelector('.prog-ac-dropdown');
    const items = Array.from(dropdown.querySelectorAll('.prog-ac-item'));
    if (!items.length) { if (e.key === 'Enter') triggerAutosave(); return; }

    const focused = dropdown.querySelector('.ac-focused');
    let idx = focused ? parseInt(focused.dataset.idx) : -1;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = Math.min(idx + 1, items.length - 1);
        items.forEach(i => i.classList.remove('ac-focused'));
        items[idx].classList.add('ac-focused');
        items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = Math.max(idx - 1, 0);
        items.forEach(i => i.classList.remove('ac-focused'));
        items[idx].classList.add('ac-focused');
        items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focused) { selectPerkInRow(row, focused.querySelector('.ac-item-name').textContent.replace(/\[★\d+\]/g,'').trim()); }
        else { dropdown.style.display = 'none'; triggerAutosave(); }
    } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
    }
}

function scheduleCloseAC(input) {
    _acCloseTimer = setTimeout(() => {
        const row = input.closest('.prog-row');
        if (row) { const d = row.querySelector('.prog-ac-dropdown'); if(d) d.style.display='none'; }
        triggerAutosave();
    }, 180);
}

// Map perk req abbreviations → special object keys
const REQ_STAT_MAP = { STR:'STR', PER:'PER', END:'END', CHR:'CHA', CHA:'CHA', INT:'INT', AGL:'AGI', AGI:'AGI', LCK:'LCK' };
const STAT_FULL = { STR:'Strength', PER:'Perception', END:'Endurance', CHR:'Charisma', INT:'Intelligence', AGL:'Agility', LCK:'Luck' };

/**
 * Returns the BASE value of a SPECIAL stat for PERK ELIGIBILITY purposes.
 * Base = allocated points + permanent trait bonuses + permanent perk bonuses.
 * Conditional toggle bonuses are EXCLUDED — they must never count toward requirements.
 */
function effectiveSpecial(key) {
    const base = special[key] ?? 0;
    const { specialDelta } = getActiveTraitBonuses();
    const { perkSpecialDelta } = getActivePerkBonuses();
    const td = specialDelta[key] ?? 0;
    const pd = perkSpecialDelta[key] ?? 0;
    return base + td + pd;
}

/**
 * Returns the MODIFIED (display) value of a SPECIAL stat.
 * Includes all conditional toggle bonuses on top of the base.
 * Used only for rendering — NEVER for eligibility checks.
 */
function modifiedSpecial(key) {
    const base = effectiveSpecial(key);
    const { specDelta } = getConditionalToggleDelta();
    return base + (specDelta[key] ?? 0);
}

/* Refresh SPECIAL panel without full re-render */
function refreshSPECIALDisplay() {
    document.querySelectorAll('.special-row').forEach(row => {
        const key = row.dataset.key;
        if (!key) return;
        const baseVal = effectiveSpecial(key);
        const modVal = modifiedSpecial(key);
        const valEl = row.querySelector('.spec-val');
        const modEl = row.querySelector('.spec-mod-badge');
        if (valEl) valEl.textContent = baseVal;
        if (modEl) {
            const diff = modVal - baseVal;
            if (diff !== 0) {
                modEl.textContent = (diff > 0 ? '+' : '') + diff;
                modEl.className = 'spec-mod-badge ' + (diff > 0 ? 'spec-mod-pos' : 'spec-mod-neg');
                modEl.style.display = 'inline';
            } else {
                modEl.style.display = 'none';
            }
        }
        const rankEl = row.querySelector('.spec-rank-title');
        if (rankEl) rankEl.textContent = getSpecialRank(key);
    });
}

// Returns whether a single OR-part of a requirement string is met
// ALWAYS uses BASE stats (no conditional toggles) for strict eligibility
function parsePartMet(part) {
    const p = part.trim();
    // SPECIAL cap: "STR < 6"
    const capM = p.match(/\b(STR|PER|END|CHR|INT|AGL|LCK)\s*<\s*(\d+)/i);
    if (capM) {
        const key = REQ_STAT_MAP[capM[1].toUpperCase()];
        return key ? effectiveSpecial(key) < parseInt(capM[2]) : true; // effectiveSpecial = BASE only
    }
    // SPECIAL min: "STR 7"
    const specM = p.match(/\b(STR|PER|END|CHR|INT|AGL|LCK)\s+(\d+)/i);
    if (specM) {
        const key = REQ_STAT_MAP[specM[1].toUpperCase()];
        return key ? effectiveSpecial(key) >= parseInt(specM[2]) : true; // BASE only
    }
    // Skill requirement — use base skill (no conditional toggles)
    for (const { pattern, skill } of SKILL_REQ_MAP) {
        const m = p.match(pattern);
        if (m) return skillBaseForEligibility(skill) >= parseInt(m[1]);
    }
    // Level handled elsewhere; karma/named-perk prereqs assumed met
    return true;
}

// Check if a perk's full requirement string is met (for eligibility)
function meetsRequirements(perk) {
    const req = perk.req;
    const lvlM = req.match(/Level\s+(\d+)/i);
    if (lvlM && charLevel < parseInt(lvlM[1])) return false;
    for (const chunk of req.split(',').map(s => s.trim())) {
        if (/^Level\s/i.test(chunk)) continue;
        const anyMet = chunk.split(/\s+or\s+/i).some(part => parsePartMet(part));
        if (!anyMet) return false;
    }
    return true;
}

function checkPerkRequirements(row, perk) {
    const warningEl = row.querySelector('.prog-req-warning');
    if (!warningEl) return;
    const failures = [];
    const req = perk.req;

    // Level check
    const lvlM = req.match(/Level\s+(\d+)/i);
    if (lvlM) {
        const need = parseInt(lvlM[1]);
        const rowLvl = parseInt((row.querySelector('.lvl-tag')?.textContent || '').match(/\d+/)?.[0] || '0');
        if (rowLvl > 0 && rowLvl < need)
            failures.push(`Level: slot is Lvl ${rowLvl}, perk needs Lvl ${need}`);
    }

    // AND-grouped requirement chunks
    for (const chunk of req.split(',').map(s => s.trim())) {
        if (/^Level\s/i.test(chunk)) continue;
        const parts = chunk.split(/\s+or\s+/i);

        // Describe what this chunk expects (for warning message)
        const anyMet = parts.some(part => parsePartMet(part));
        if (!anyMet) {
            // Build a readable description of what failed
            const desc = parts.map(part => {
                const capM = part.match(/\b(STR|PER|END|CHR|INT|AGL|LCK)\s*<\s*(\d+)/i);
                if (capM) { const k=REQ_STAT_MAP[capM[1].toUpperCase()]; return `${STAT_FULL[capM[1].toUpperCase()]||capM[1]} < ${capM[2]} (have ${effectiveSpecial(k)})`; }
                const specM = part.match(/\b(STR|PER|END|CHR|INT|AGL|LCK)\s+(\d+)/i);
                if (specM) { const k=REQ_STAT_MAP[specM[1].toUpperCase()]; return `${STAT_FULL[specM[1].toUpperCase()]||specM[1]} ${specM[2]} (have ${effectiveSpecial(k)})`; }
                for (const { pattern, skill } of SKILL_REQ_MAP) {
                    const m = part.match(pattern);
                    if (m) return `${skill} ${m[1]} (have ${skillTotal(skill)})`;
                }
                return part.trim();
            }).join(' or ');
            failures.push(desc);
        }
    }

    const _rc=Array.from(document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row), #extra-perk-list .prog-row'))
        .filter(r=>{const v=(r.querySelector('.prog-name-input')?.value||'').trim().toUpperCase();return v===perk.name.toUpperCase()||v.startsWith(perk.name.toUpperCase());}).length;
    if(_rc>perk.ranks)failures.push('Rank cap: '+_rc+' taken, max '+perk.ranks);
    if (failures.length) {
        warningEl.innerHTML = `<div class="req-warn-label">⚠ REQUIREMENTS NOT MET:</div>` +
            failures.map(f => `<div class="req-warn-item">${f}</div>`).join('');
        warningEl.style.display = 'block';
        row.classList.add('req-fail');
    } else {
        warningEl.innerHTML = ''; warningEl.style.display = 'none';
        row.classList.remove('req-fail');
    }
}

function reCheckAllPerkRows() {
    document.querySelectorAll('#prog-list .prog-row, #extra-perk-list .prog-row').forEach(row => {
        const name = (row.querySelector('.prog-name-input')?.value || '').trim();
        if (!name) return;
        const perk = PERKS_DATA.find(p => p.name.toUpperCase() === name.toUpperCase())
            || PERKS_DATA.find(p => name.toUpperCase().startsWith(p.name.toUpperCase()));
        if (perk) checkPerkRequirements(row, perk);
    });
}

function selectPerkInRow(row, perkName) {
    if (_acCloseTimer) { clearTimeout(_acCloseTimer); _acCloseTimer = null; }
    const perk = PERKS_DATA.find(p => p.name === perkName);
    if (!perk) return;

    const nameInput = row.querySelector('.prog-name-input');
    const dropdown = row.querySelector('.prog-ac-dropdown');
    const info = row.querySelector('.prog-perk-info');
    const reqEl = row.querySelector('.prog-perk-req');
    const descEl = row.querySelector('.prog-perk-desc');
    const badge = row.querySelector('.prog-rank-badge');
    const clearBtn = row.querySelector('.prog-clear-btn');

    nameInput.value = perk.name;
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';

    reqEl.textContent = 'REQ: ' + perk.req;
    descEl.textContent = perk.desc;
    info.style.display = 'block';

    // Add zoom button if not already there
    let zoomBtn = info.querySelector('.perk-zoom-btn');
    if (!zoomBtn) {
        zoomBtn = document.createElement('button');
        zoomBtn.className = 'perk-zoom-btn';
        zoomBtn.title = 'EXPAND TEXT';
        zoomBtn.textContent = '⊕ ZOOM';
        info.appendChild(zoomBtn);
    }
    zoomBtn.onclick = () => openPerkZoom(perk.name, perk.req, perk.desc);

    // Add conditional toggle for perks with situational bonuses
    let existingCondToggle = row.querySelector('.cond-toggle-row');
    if (existingCondToggle) existingCondToggle.remove();
    if (CONDITIONAL_PERK_NAMES && CONDITIONAL_PERK_NAMES.has(perk.name)) {
        const isActive = isConditionalActive(perk.name);
        const safeName = perk.name.replace(/'/g, "\\'");
        const ctxLabel = (typeof COND_TOGGLE_LABELS !== 'undefined' && COND_TOGGLE_LABELS[perk.name]) || 'ACTIVE';
        const condDiv = document.createElement('div');
        condDiv.className = 'cond-toggle-row';
        condDiv.innerHTML = `
            <span class="cond-toggle-label">
                <span class="cond-icon">⚡</span>
                <span class="cond-toggle-ctx-label">${ctxLabel}</span>
                <span class="cond-toggle-hint-text">(display only)</span>
            </span>
            <label class="cond-toggle-lbl">
                <input type="checkbox" class="cond-toggle-input" ${isActive?'checked':''}
                    onchange="setConditionalToggle('${safeName}', this.checked)">
                <span class="cond-toggle-track"><span class="cond-toggle-thumb"></span></span>
            </label>`;
        info.insertAdjacentElement('afterend', condDiv);
    }

    const multiRank = perk.ranks > 1;
    badge.textContent = multiRank ? `★ ${perk.ranks} RANKS` : `1 RANK`;
    badge.style.display = 'inline';
    badge.classList.toggle('multi', multiRank);
    clearBtn.style.display = 'inline';
    row.classList.add('has-perk');

    // Check requirements against current level + SPECIAL
    checkPerkRequirements(row, perk);

    // If Intense Training / Tag! / Action Star — only trigger interactive modal when NOT hydrating
    if (!_hydrating) {
        if (perk.name.trim().toUpperCase() === 'INTENSE TRAINING') {
            openITModal(perk.name, perk.req, row);
        }
        if (perk.name.trim().toUpperCase() === 'TAG!') {
            setTimeout(() => openTagModal(), 80);
        }
        if (perk.name.trim().toUpperCase() === 'ACTION STAR') {
            setTimeout(() => openActionStarModal(row), 80);
        }
    }

    triggerAutosave();
}

function tryHydratePerkRow(row, name) {
    if (!name) return;
    const perk = PERKS_DATA.find(p => p.name.toUpperCase() === name.toUpperCase())
        || PERKS_DATA.find(p => name.toUpperCase().startsWith(p.name.toUpperCase()));
    if (perk) {
        selectPerkInRow(row, perk.name);
        // Restore actual typed name (may include IT annotation)
        row.querySelector('.prog-name-input').value = name;
    } else {
        // Plain text — just show it, no extra info
        row.querySelector('.prog-name-input').value = name;
    }
}

function clearProgRow(btn) {
    const row = btn.closest('.prog-row');
    row.querySelector('.prog-name-input').value = '';
    row.querySelector('.prog-notes-input').value = '';
    row.querySelector('.prog-perk-info').style.display = 'none';
    row.querySelector('.prog-rank-badge').style.display = 'none';
    row.querySelector('.prog-clear-btn').style.display = 'none';
    row.classList.remove('has-perk', 'req-fail');
    const warn = row.querySelector('.prog-req-warning');
    if (warn) { warn.style.display = 'none'; warn.innerHTML = ''; }
    triggerAutosave();
}

function makeProgRow(levelLabel, isTrait, removable) {
    const tagClass = isTrait ? 'lvl-tag is-trait' : 'lvl-tag';
    const removeBtn = removable
        ? `<button onclick="this.closest('.prog-row').remove();updateAll();triggerAutosave();" style="margin-left:auto;font-size:0.6rem;border:1px solid rgba(255,0,0,0.4);color:rgba(255,80,80,0.8);padding:2px 8px;cursor:pointer;background:rgba(255,0,0,0.05);border-bottom:1px solid rgba(255,0,0,0.4)!important;">✕ REMOVE</button>`
        : '';
    return `<div class="prog-row">
        <div class="prog-card-header">
            <span class="${tagClass}">${levelLabel}</span>
            <span class="prog-rank-badge"></span>
            <button class="prog-clear-btn" onclick="clearProgRow(this)">✕ CLEAR</button>
            ${removeBtn}
        </div>
        <div class="prog-input-wrap">
            <input type="text" class="prog-name-input" autocomplete="off"
                placeholder="TYPE TO SEARCH PERKS..."
                oninput="onProgNameInput(this)"
                onkeydown="onProgNameKey(event,this)"
                onblur="scheduleCloseAC(this)"
                onfocus="onProgNameInput(this)">
            <div class="prog-ac-dropdown"></div>
        </div>
        <div class="prog-perk-info">
            <div class="prog-req-warning" style="display:none;"></div>
            <div class="prog-perk-req"></div>
            <div class="prog-perk-desc"></div>
        </div>
        <input type="text" class="prog-notes-input" placeholder="NOTES / REQUIREMENTS..." oninput="triggerAutosave()">
    </div>`;
}

function renderProgression() {
    const div = document.getElementById('prog-list');
    // Save current trait slot choices before wiping
    const savedTraits = {};
    div.querySelectorAll('.trait-slot-row').forEach(r => {
        const id = r.id, chosen = r.getAttribute('data-chosen') || '';
        if (id && chosen) savedTraits[id] = chosen;
    });
    div.innerHTML = '';
    // Level progression rows (starting traits are managed separately)
    let traitIdx = 0;
    for(let i=2; i<=50; i++) {
        const isP = mode === 'std' ? (i%2===0) : (i%3===0);
        const isT = (i>=5 && (i-5)%4===0);
        if(isP) div.insertAdjacentHTML('beforeend', makeProgRow(`LVL ${i} PERK`, false, false));
        if(isT) {
            const slotId = `trait-slot-lvl-${i}`;
            div.insertAdjacentHTML('beforeend', makeTraitRow(slotId, `LVL ${i} TRAIT`, savedTraits[slotId] || ''));
            traitIdx++;
        }
    }
}

function syncTagLimit() {
    const cbs = Array.from(document.querySelectorAll('#tag-area input'));
    const count = cbs.filter(c => c.checked).length;
    cbs.forEach(c => {
        const item = c.parentElement;
        const marker = item.querySelector('.tag-marker');
        if(!c.checked && count >= 3) {
            c.disabled = true;
            item.classList.add('locked');
            if (marker) marker.textContent = '[ ]';
        } else {
            c.disabled = false;
            item.classList.remove('locked');
            if (marker) marker.textContent = c.checked ? '[X]' : '[ ]';
        }
    });
    // Guard: add-trait-btn may not exist if traits managed via modal
    const addTraitBtn = document.getElementById('add-trait-btn');
    if (addTraitBtn) addTraitBtn.disabled = (mode==='hc' && document.getElementById('trait-list').children.length>=5);
}

function toggleTag(itemEl) {
    const cb = itemEl.querySelector('input[type="checkbox"]');
    if (!cb || cb.disabled) return;
    cb.checked = !cb.checked;
    const marker = itemEl.querySelector('.tag-marker');
    if (marker) marker.textContent = cb.checked ? '[X]' : '[ ]';
    triggerAutosave();
}

/* ===== AUTOSAVE & PERSISTENCE ===== */
let _autosaveDebounce = null;
function triggerAutosave() {
    pushUndoState();
    clearTimeout(_autosaveDebounce);
    _autosaveDebounce = setTimeout(() => {
        try {
            const data = collectData();
            localStorage.setItem('Nuclear_Sunset_Permanent_Vault', JSON.stringify(data));
            document.getElementById('sync-status').innerText = "V_MEMORY_SYNCED_" + new Date().toLocaleTimeString();
        } catch(e) {
            console.warn('Autosave failed (storage unavailable):', e);
            const s = document.getElementById('sync-status');
            if (s) s.innerText = 'V_MEMORY_SYNC_FAILED';
        }
        updateAll();
    }, 150);
}

function collectData() {
    regionalStorage[origin].quests = Array.from(document.querySelectorAll('#quest-list-container input')).map(i => i.checked);
    regionalStorage[origin].colls = Array.from(document.querySelectorAll('#coll-list input')).map(i => i.checked);
    return {
        name: document.getElementById('char-name').value, special, mode, origin,
        regionalStorage,
        notes: document.getElementById('user-notes').value,
        tags: Array.from(document.querySelectorAll('#tag-area input')).map(i => i.checked),
        traits: Array.from(document.querySelectorAll('.trait-slot-row')).map(r => r.getAttribute('data-chosen')||''),
        // Note: startingTraits is serialized separately
        perks: Array.from(document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)')).map(r => [
            r.querySelector('.prog-name-input')?.value || '',
            r.querySelector('.prog-notes-input')?.value || ''
        ]),
        extraPerks: Array.from(document.querySelectorAll('#extra-perk-list .prog-row')).map(r => [
            r.querySelector('.prog-name-input')?.value || '',
            r.querySelector('.prog-notes-input')?.value || ''
        ]),
        weapons: Array.from(document.querySelectorAll('#weapon-list .gear-card')).map(c => { const ins = c.querySelectorAll('.gear-field-input'); const sel = c.querySelector('.gear-skill-type-select'); return [ins[0]?.value||'', ins[1]?.value||'', ins[2]?.value||'', ins[3]?.value||'', sel?.value||'', ins[4]?.value||'']; }),
        armor: Array.from(document.querySelectorAll('#armor-list .gear-card')).map(c => { const ins = c.querySelectorAll('.gear-field-input'); const sel = c.querySelector('.gear-field-select'); return [ins[0]?.value||'', ins[1]?.value||'', sel?.value||'LIGHT', ins[2]?.value||'', ins[3]?.value||'', ins[4]?.value||'']; }),
        quests: Array.from(document.querySelectorAll('#quest-list-container input')).map(i => i.checked),
        colls: Array.from(document.querySelectorAll('#coll-list input')).map(i => i.checked),
        uniWpns: Array.from(document.querySelectorAll('.u-wpn-check')).map(i => i.checked),
        uniArmor: Array.from(document.querySelectorAll('.u-armor-check')).map(i => i.checked),
        skillPoints, charLevel, buildKarma,
        skillBooksFound,
        humbledLevel, humbledReductions, hasBeenHumbled,
        implantsTaken, rewardPerksList, internalizedTraitsList,
        fourthTagSkill: _fourthTagSkill || null,
        startingTraits: startingTraits,
        skillHistory: skillHistory,
        conditionalToggles: conditionalToggles,
        perkWishlist: perkWishlist || [],
        currentBuildName: currentBuildName || 'Current Build',
        levelUpBonuses: levelUpBonuses || []
    };
}

function exportJSON() {
    const data = collectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${data.name || 'dweller'}.json`; a.click();
}

function importJSON(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const raw = JSON.parse(ev.target.result);
            const safe = sanitizeImport(raw);
            if (!safe) { alert('IMPORT ERROR: INVALID FILE FORMAT'); return; }
            hydrate(safe);
        } catch(err) {
            alert('IMPORT ERROR: COULD NOT PARSE JSON FILE');
        }
    };
    reader.readAsText(e.target.files[0]);
    e.target.value = '';
}

function hydrate(d) {
    if(!d) return;
    _hydrating = true;
    special = d.special;
    if (d.skillPoints && typeof d.skillPoints === 'object') {
        skills.forEach(s => { skillPoints[s] = typeof d.skillPoints[s] === 'number' ? d.skillPoints[s] : 0; });
    } else {
        skills.forEach(s => { skillPoints[s] = 0; });
    }
    charLevel = (typeof d.charLevel === 'number' && d.charLevel >= 1) ? d.charLevel : 1;
    buildKarma = d.buildKarma || 'neutral';
    if (d.skillBooksFound && typeof d.skillBooksFound === 'object') {
        skills.forEach(s => {
            const v = parseInt(d.skillBooksFound[s]);
            skillBooksFound[s] = (!isNaN(v) && v >= 0) ? v : 0;
        });
    } else {
        skills.forEach(s => { skillBooksFound[s] = 0; });
    }
    humbledLevel = (typeof d.humbledLevel === 'number') ? d.humbledLevel : 0;
    humbledReductions = (d.humbledReductions && typeof d.humbledReductions === 'object') ? d.humbledReductions : {};
    hasBeenHumbled = !!d.hasBeenHumbled;
    document.getElementById('char-name').value = d.name || "";
    document.getElementById('user-notes').value = d.notes || "";
    if(d.regionalStorage) regionalStorage = d.regionalStorage;
    implantsTaken = d.implantsTaken || {};
    rewardPerksList = Array.isArray(d.rewardPerksList) ? d.rewardPerksList : [];
    internalizedTraitsList = Array.isArray(d.internalizedTraitsList) ? d.internalizedTraitsList : [];
    _fourthTagSkill = d.fourthTagSkill || null;
    startingTraits = Array.isArray(d.startingTraits) ? d.startingTraits : [];
    skillHistory = Array.isArray(d.skillHistory) ? d.skillHistory : [];
    conditionalToggles = (d.conditionalToggles && typeof d.conditionalToggles === 'object') ? d.conditionalToggles : {};
    perkWishlist = Array.isArray(d.perkWishlist) ? d.perkWishlist : [];
    currentBuildName = d.currentBuildName || 'Current Build';
    levelUpBonuses = Array.isArray(d.levelUpBonuses) ? d.levelUpBonuses : [];
    setMode(d.mode, true);
    setOrigin(d.origin, true);
    const tI = document.querySelectorAll('#tag-area input');
    d.tags.forEach((c, i) => {
        if(tI[i]) {
            tI[i].checked = c;
            const marker = tI[i].parentElement.querySelector('.tag-marker');
            if (marker) marker.textContent = c ? '[X]' : '[ ]';
        }
    });
    // Restore trait slots from saved traits array (legacy #trait-list element no longer used)
    document.getElementById('weapon-list').innerHTML = '';
    d.weapons.forEach(v => { addWeapon(); const c = document.querySelector('#weapon-list .gear-card:last-child'); const ins = c.querySelectorAll('.gear-field-input'); const sel = c.querySelector('.gear-skill-type-select'); if(ins[0]) ins[0].value = v[0]||''; if(ins[1]) ins[1].value = v[1]||''; if(ins[2]) ins[2].value = v[2]||''; if(ins[3]) ins[3].value = v[3]||''; if(sel && v[4]) sel.value = v[4]; if(ins[4]) ins[4].value = v[5]||''; });
    document.getElementById('armor-list').innerHTML = '';
    d.armor.forEach(v => { addArmor(); const c = document.querySelector('#armor-list .gear-card:last-child'); const ins = c.querySelectorAll('.gear-field-input'); const sel = c.querySelector('.gear-field-select'); if(ins[0]) ins[0].value = v[0]||''; if(ins[1]) ins[1].value = v[1]||''; if(sel && v[2]) { sel.value = v[2]; updateArmorBadge(sel); } if(ins[2]) ins[2].value = v[3]||''; if(ins[3]) ins[3].value = v[4]||''; if(ins[4]) ins[4].value = v[5]||''; });
    // Restore trait slots from saved traits array
    if (d.traits && Array.isArray(d.traits)) {
        const traitSlots = Array.from(document.querySelectorAll('#prog-list .trait-slot-row'));
        d.traits.forEach((traitName, i) => {
            if (traitName && traitSlots[i]) {
                const slotId = traitSlots[i].id;
                traitSlots[i].setAttribute('data-chosen', traitName);
                traitSlots[i].querySelector('.trait-slot-name').textContent = traitName;
                traitSlots[i].querySelector('.trait-slot-btn').textContent = 'CHANGE';
                const clearBtn = traitSlots[i].querySelector('.trait-slot-clear');
                if (clearBtn) clearBtn.style.display = 'inline-block';
            }
        });
    }
    const pI = document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)');
    d.perks && d.perks.forEach((v, i) => {
        if(pI[i]) {
            tryHydratePerkRow(pI[i], v[0] || '');
            const ni = pI[i].querySelector('.prog-notes-input'); if(ni) ni.value = v[1] || '';
        }
    });
    document.getElementById('extra-perk-list').innerHTML = '';
    if (d.extraPerks) d.extraPerks.forEach(v => {
        addExtraPerk();
        const ep = document.querySelector('#extra-perk-list .prog-row:last-child');
        if(ep) {
            tryHydratePerkRow(ep, v[0] || '');
            const ni = ep.querySelector('.prog-notes-input'); if(ni) ni.value = v[1] || '';
        }
    });
    const uC = document.querySelectorAll('.u-wpn-check');
    if(d.uniWpns) d.uniWpns.forEach((c, i) => { if(uC[i]) { uC[i].checked = c; updateUniqueMarker(uC[i]); } });
    const uA = document.querySelectorAll('.u-armor-check');
    if(d.uniArmor) d.uniArmor.forEach((c, i) => { if(uA[i]) { uA[i].checked = c; updateUniqueMarker(uA[i]); } });
    _hydrating = false;
    updateAll();
    reCheckAllPerkRows();
    renderImplants();
    renderRewardPerksList();
    renderInternalizedTraitsList();
    renderStartingTraitsList();
}

/* ===== BUILD ARCHETYPES SYSTEM ===== */

function openArchetypesModal() {
    const modal = document.getElementById('archetypes-modal');
    if (!modal) return;
    renderArchetypeGrid();
    document.getElementById('archetype-detail').style.display = 'none';
    modal.style.display = 'flex';
}

function closeArchetypesModal() {
    const modal = document.getElementById('archetypes-modal');
    if (modal) modal.style.display = 'none';
}

let _selectedArchetypeId = null;

function renderArchetypeGrid() {
    const grid = document.getElementById('archetype-grid');
    if (!grid || typeof ARCHETYPES_DATA === 'undefined') return;
    grid.innerHTML = ARCHETYPES_DATA.map(a => {
        const isSel = _selectedArchetypeId === a.id;
        return `<div class="archetype-card${isSel ? ' archetype-selected' : ''}" onclick="selectArchetype('${a.id}')"
            style="border-color:${isSel ? a.color : 'rgba(255,255,255,0.1)'};">
            <div class="archetype-card-icon" style="background:${a.color}22;border-color:${a.color}55;color:${a.color};">${a.icon}</div>
            <div class="archetype-card-body">
                <div class="archetype-name">${a.name}</div>
                <div class="archetype-tagline">${a.tagline}</div>
                <div class="archetype-badges">
                    <span class="archetype-badge" style="color:${a.color};border-color:${a.color}44;">${a.origin === 'CW' ? 'Capital' : 'Mojave'}</span>
                    <span class="archetype-badge">${a.mode === 'hc' ? 'HC' : 'STD'}</span>
                    <span class="archetype-badge" style="text-transform:capitalize;">${a.buildKarma.replace('-',' ')}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

function selectArchetype(id) {
    _selectedArchetypeId = id;
    renderArchetypeGrid();
    const a = ARCHETYPES_DATA.find(x => x.id === id);
    if (!a) return;
    const skillNames = ['BARTER','BIG GUNS','ENERGY WEAPONS','EXPLOSIVES','GUNS','LOCKPICK','MEDICINE','MELEE WEAPONS','REPAIR','SCIENCE','SNEAK','SPEECH','SURVIVAL','UNARMED'];
    const taggedSkills = skillNames.filter((_,i) => a.tags[i]);
    const perkLevels = [2,4,6,8,10,12,14,16,18,20,22,24,26,28,30];
    const specHtml = ['STR','PER','END','CHA','INT','AGI','LCK'].map(k => {
        const v = a.special[k];
        const bars = Array.from({length:10},(_,i)=>`<span class="aspec-pip${i<v?' aspec-pip-on':''}"></span>`).join('');
        return `<div class="aspec-row"><span class="aspec-key">${k}</span>${bars}<span class="aspec-num">${v}</span></div>`;
    }).join('');
    const perksPreview = a.perks.slice(0,8).map((p,i) =>
        p[0] ? `<div class="arch-perk-row"><span class="arch-perk-lvl">LVL ${perkLevels[i]}</span><span class="arch-perk-name">${p[0]}</span></div>` : ''
    ).filter(Boolean).join('');
    const remaining = a.perks.filter(p=>p[0]).length - 8;
    const traitNames = a.startingTraits.map(t=>t.name).join(', ') || 'None';
    const detail = document.getElementById('archetype-detail');
    detail.style.display = 'block';
    detail.innerHTML = `
    <div class="archetype-detail-box" style="border-color:${a.color}44;">
        <div class="arch-detail-header" style="border-bottom-color:${a.color}33;">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
                <div class="archetype-card-icon" style="background:${a.color}22;border-color:${a.color}55;color:${a.color};font-size:1.5rem;width:44px;height:44px;">${a.icon}</div>
                <div>
                    <div style="font-size:0.95rem;font-weight:bold;letter-spacing:1px;color:var(--pip-color);">${a.name}</div>
                    <div style="font-size:0.65rem;opacity:0.6;margin-top:2px;">${a.tagline}</div>
                </div>
            </div>
            <p style="font-size:0.68rem;opacity:0.7;line-height:1.7;margin:0;">${a.description}</p>
        </div>
        <div class="arch-detail-cols">
            <div class="arch-detail-col">
                <div class="arch-section-label">S.P.E.C.I.A.L.</div>
                <div class="aspec-grid">${specHtml}</div>
                <div class="arch-section-label" style="margin-top:12px;">TAGGED SKILLS</div>
                <div style="font-size:0.72rem;color:var(--pip-color);letter-spacing:0.5px;">${taggedSkills.join(' · ') || 'None'}</div>
                <div class="arch-section-label" style="margin-top:12px;">STARTING TRAITS</div>
                <div style="font-size:0.72rem;color:#c8a0ff;letter-spacing:0.5px;">${traitNames}</div>
                <div class="arch-section-label" style="margin-top:12px;">ORIGIN &amp; MODE</div>
                <div style="font-size:0.72rem;opacity:0.75;">${a.origin === 'CW' ? 'CAPITAL WASTELAND' : 'MOJAVE WASTELAND'} &nbsp;·&nbsp; ${a.mode.toUpperCase()}</div>
            </div>
            <div class="arch-detail-col">
                <div class="arch-section-label">SUGGESTED PERK PATH (LVL 2–${perkLevels[Math.min(7, a.perks.filter(p=>p[0]).length-1)]})</div>
                ${perksPreview}
                ${remaining > 0 ? `<div style="font-size:0.6rem;opacity:0.4;margin-top:6px;letter-spacing:1px;">+ ${remaining} MORE PERKS LOADED INTO BUILD</div>` : ''}
            </div>
        </div>
        <div style="margin-top:16px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.07);display:flex;gap:10px;flex-wrap:wrap;">
            <button class="action-btn" onclick="loadArchetype('${a.id}')"
                style="background:${a.color}22;border-color:${a.color};color:${a.color};font-size:0.72rem;padding:8px 20px;flex:1;letter-spacing:1px;">
                ◈ LOAD THIS ARCHETYPE
            </button>
            <button class="modal-cancel-btn" onclick="closeArchetypesModal()" style="font-size:0.68rem;padding:8px 16px;">CANCEL</button>
        </div>
        <div style="font-size:0.58rem;opacity:0.35;margin-top:10px;text-align:center;letter-spacing:1px;">
            ★ LOADING WILL OVERWRITE YOUR CURRENT BUILD — EXPORT FIRST IF YOU WANT TO KEEP IT
        </div>
    </div>`;
    detail.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function loadArchetype(id) {
    const a = ARCHETYPES_DATA.find(x => x.id === id);
    if (!a) return;
    if (!confirm('LOAD ARCHETYPE: "' + a.name.toUpperCase() + '"?\n\nThis will overwrite your current build. Export first if you want to keep it.')) return;
    const buildData = {
        name: a.name,
        notes: 'Archetype: ' + a.name + ' — ' + a.tagline,
        mode: a.mode,
        origin: a.origin,
        buildKarma: a.buildKarma,
        special: Object.assign({}, a.special),
        tags: a.tags.slice(),
        traits: a.traits ? a.traits.slice() : Array(12).fill(''),
        startingTraits: a.startingTraits ? a.startingTraits.map(t => ({ name: t.name })) : [],
        perks: a.perks.slice(),
        extraPerks: [],
        weapons: [],
        armor: [],
        quests: [],
        colls: [],
        uniWpns: [],
        uniArmor: [],
        skillPoints: a.skillPoints ? Object.assign({}, a.skillPoints) : Object.fromEntries(skills.map(s => [s, 0])),
        skillBooksFound: Object.fromEntries(skills.map(s => [s, 0])),
        charLevel: a.charLevel || 1,
        skillHistory: a.skillHistory ? a.skillHistory.slice() : [],
        conditionalToggles: {},
        implantsTaken: a.implantsTaken ? Object.assign({}, a.implantsTaken) : {},
        rewardPerksList: [],
        internalizedTraitsList: [],
        fourthTagSkill: null,
        perkWishlist: [],
        currentBuildName: a.name,
        levelUpBonuses: a.levelUpBonuses ? a.levelUpBonuses.slice() : [],
        humbledLevel: 0,
        humbledReductions: {},
        hasBeenHumbled: false,
        regionalStorage: { CW:{quests:[],colls:[]}, MW:{quests:[],colls:[]} },
    };
    const safe = sanitizeImport(buildData);
    if (!safe) { alert('ARCHETYPE LOAD ERROR'); return; }
    closeArchetypesModal();
    _selectedArchetypeId = null;
    hydrate(safe);
    nsAudio.diceRoll();
    showPerkToast('ARCHETYPE LOADED: ' + a.name.toUpperCase());
    triggerAutosave();
    const btn = document.getElementById('tab-btn-prog');
    if (btn) {
        btn.style.boxShadow = '0 0 12px var(--pip-color)';
        btn.style.background = 'var(--pip-color)';
        btn.style.color = 'black';
        setTimeout(() => { if (!btn.classList.contains('active')) { btn.style.boxShadow=''; btn.style.background=''; btn.style.color=''; } }, 1200);
    }
}

function purgeMemory() { if(confirm("INITIATE TOTAL ATOMIC ANNIHILATION?")) { try { localStorage.clear(); } catch(e) {} location.reload(); } }

/* ===== BUILD MANAGEMENT SYSTEM ===== */

// Load saved builds from localStorage
function loadSavedBuildsList() {
    let stored = null;
    try { stored = localStorage.getItem('NS_SavedBuilds'); } catch(e) {}
    savedBuilds = stored ? JSON.parse(stored) : [];
    return savedBuilds;
}

// Save builds list to localStorage
function saveBuildsList() {
    try { localStorage.setItem('NS_SavedBuilds', JSON.stringify(savedBuilds)); } catch(e) {}
}

// Save current build to the builds list
function saveCurrentBuild() {
    const name = prompt('ENTER BUILD NAME:', currentBuildName || 'My Build');
    if (!name) return;
    
    const buildData = collectData();
    buildData.currentBuildName = name;
    
    // Check if build with this name exists
    const existingIndex = savedBuilds.findIndex(b => b.name === name);
    
    if (existingIndex >= 0) {
        if (!confirm(`Overwrite existing build "${name}"?`)) return;
        savedBuilds[existingIndex] = {
            name: name,
            data: buildData,
            timestamp: Date.now()
        };
    } else {
        savedBuilds.push({
            name: name,
            data: buildData,
            timestamp: Date.now()
        });
    }
    
    currentBuildName = name;
    saveBuildsList();
    showPerkToast(`BUILD SAVED: ${name}`);
    renderBuildsManager();
}

// Load a build
function loadBuild(index) {
    if (index < 0 || index >= savedBuilds.length) return;
    
    const build = savedBuilds[index];
    const safe = sanitizeImport(build.data);
    if (safe) {
        hydrate(safe);
        currentBuildName = build.name;
        showPerkToast(`BUILD LOADED: ${build.name}`);
        closeBuildManager();
    }
}

// Delete a build
function deleteBuild(index) {
    if (index < 0 || index >= savedBuilds.length) return;
    
    const build = savedBuilds[index];
    if (!confirm(`DELETE BUILD "${build.name}"?`)) return;
    
    savedBuilds.splice(index, 1);
    saveBuildsList();
    showPerkToast(`BUILD DELETED`);
    renderBuildsManager();
}

// Duplicate a build
function duplicateBuild(index) {
    if (index < 0 || index >= savedBuilds.length) return;
    
    const original = savedBuilds[index];
    const copy = JSON.parse(JSON.stringify(original));
    copy.name = prompt('ENTER NAME FOR COPY:', `${original.name} (Copy)`);
    if (!copy.name) return;
    
    copy.timestamp = Date.now();
    savedBuilds.push(copy);
    saveBuildsList();
    showPerkToast(`BUILD DUPLICATED`);
    renderBuildsManager();
}

// Open build manager modal
function openBuildManager() {
    loadSavedBuildsList();
    renderBuildsManager();
    const modal = document.getElementById('build-manager-modal');
    if (modal) modal.style.display = 'flex';
}

// Close build manager
function closeBuildManager() {
    const modal = document.getElementById('build-manager-modal');
    if (modal) modal.style.display = 'none';
}

// Render builds list
function renderBuildsManager() {
    const list = document.getElementById('builds-list');
    if (!list) return;
    
    if (savedBuilds.length === 0) {
        list.innerHTML = '<div style="text-align:center; opacity:0.4; padding:24px;">NO SAVED BUILDS YET</div>';
        return;
    }
    
    list.innerHTML = savedBuilds.map((build, i) => {
        const date = new Date(build.timestamp).toLocaleString();
        const isCurrent = build.name === currentBuildName;
        return `<div class="build-item ${isCurrent ? 'build-current' : ''}">
            <div class="build-info">
                <div class="build-name">${build.name} ${isCurrent ? '<span class="build-current-badge">ACTIVE</span>' : ''}</div>
                <div class="build-meta">Level ${build.data.charLevel || 1} • ${date}</div>
            </div>
            <div class="build-actions">
                <button class="build-action-btn" onclick="loadBuild(${i})" title="LOAD THIS BUILD">LOAD</button>
                <button class="build-action-btn" onclick="duplicateBuild(${i})" title="DUPLICATE BUILD">COPY</button>
                <button class="build-action-btn build-action-delete" onclick="deleteBuild(${i})" title="DELETE BUILD">DELETE</button>
            </div>
        </div>`;
    }).join('');
}

// Open build comparison modal
/* ===== PERK WISHLIST SYSTEM ===== */

function togglePerkWishlist(perkName) {
    const index = perkWishlist.indexOf(perkName);
    if (index >= 0) {
        perkWishlist.splice(index, 1);
    } else {
        perkWishlist.push(perkName);
    }
    triggerAutosave();
    renderPerkPickerGrid();
    renderAllPerks();
    renderWishlist(); // Re-render wishlist modal if it's open
}

function isPerkWishlisted(perkName) {
    return perkWishlist.includes(perkName);
}

function openWishlist() {
    renderWishlist();
    const modal = document.getElementById('wishlist-modal');
    if (modal) modal.style.display = 'flex';
}

function closeWishlist() {
    const modal = document.getElementById('wishlist-modal');
    if (modal) modal.style.display = 'none';
}

function renderWishlist() {
    const container = document.getElementById('wishlist-container');
    if (!container) return;
    
    if (perkWishlist.length === 0) {
        container.innerHTML = '<div style="text-align:center; opacity:0.4; padding:24px;">NO WISHLISTED PERKS YET<br><span style="font-size:0.7em; margin-top:8px; display:block;">Click the ★ icon on perks to add them to your wishlist</span></div>';
        return;
    }
    
    const wishlistedPerks = PERKS_DATA.filter(p => perkWishlist.includes(p.name));
    
    container.innerHTML = wishlistedPerks.map(p => {
        const meets = meetsRequirements(p);
        const statusClass = meets ? 'wishlist-ready' : 'wishlist-not-ready';
        const statusText = meets ? '✓ READY TO TAKE' : '⚠ REQUIREMENTS NOT MET';
        
        return `<div class="wishlist-item ${statusClass}">
            <div class="wishlist-perk-info">
                <div class="wishlist-perk-name">${p.name}</div>
                <div class="wishlist-perk-req">${p.req}</div>
                <div class="wishlist-status">${statusText}</div>
            </div>
            <button class="wishlist-remove-btn" onclick="togglePerkWishlist('${p.name}')" title="Remove from wishlist">✕</button>
        </div>`;
    }).join('');
}



/* ===== TAG! PERK — 4TH SKILL PICKER ===== */

function openTagModal() {
    const tagged = getTaggedSkills();
    const modal = document.getElementById('tag-pick-modal');
    if (!modal) return;
    const grid = document.getElementById('tag-pick-grid');
    grid.innerHTML = skills.map(s => {
        const isAlready = tagged.has(s);
        const cls = isAlready ? 'tag-pick-item tag-pick-taken' : 'tag-pick-item';
        const icon = isAlready ? '[★ TAGGED]' : '[ ]';
        return `<div class="${cls}" onclick="selectFourthTag('${s}')">
            <span class="tag-pick-icon">${icon}</span>
            <span class="tag-pick-name">${s}</span>
        </div>`;
    }).join('');
    modal.style.display = 'flex';
}

function selectFourthTag(skill) {
    _fourthTagSkill = skill;
    const modal = document.getElementById('tag-pick-modal');
    if (modal) modal.style.display = 'none';
    // Find the tag-area checkbox for this skill and check it
    const cbs = Array.from(document.querySelectorAll('#tag-area input'));
    const skillIndex = skills.indexOf(skill);
    if (skillIndex >= 0 && cbs[skillIndex]) {
        cbs[skillIndex].checked = true;
        cbs[skillIndex].disabled = false;
        const marker = cbs[skillIndex].parentElement.querySelector('.tag-marker');
        if (marker) marker.textContent = '[X]';
    }
    updateAll();
    triggerAutosave();
}

function closeTagModal() {
    const modal = document.getElementById('tag-pick-modal');
    if (modal) modal.style.display = 'none';
}

/* ===== RANDOMIZE BUILD ===== */
function randomizeBuild() {
    if (!confirm('RANDOMIZE S.P.E.C.I.A.L., TAGS, AND STARTING TRAITS? (THIS WILL OVERWRITE CURRENT SELECTIONS)')) return;
    nsAudio.diceRoll();

    // ── Step 0: Random name
    const nameInput = document.getElementById('char-name');
    if (nameInput) nameInput.value = getRandomWastelandName();

    // ── Step 1: Randomize SPECIAL — distribute the FULL pool so all points are used
    const pool = getSPECIALPool();
    const newSpecial = { STR:1,PER:1,END:1,CHA:1,INT:1,AGI:1,LCK:1 };
    let remaining = pool; // pool = total SPECIAL to distribute (not extra above baseline)
    while (remaining > 0) {
        const available = sKeys.filter(k => newSpecial[k] < 10);
        if (!available.length) break; // all maxed (safety)
        const k = available[Math.floor(Math.random() * available.length)];
        newSpecial[k]++; remaining--;
    }
    Object.assign(special, newSpecial);

    // ── Step 2: Randomize 3 Tags
    const shuffledSkills = [...skills].sort(() => Math.random() - 0.5);
    const chosenTags = shuffledSkills.slice(0, 3);
    const cbs = Array.from(document.querySelectorAll('#tag-area input'));
    cbs.forEach((cb, i) => {
        cb.checked = chosenTags.includes(skills[i]);
        cb.disabled = false;
        const marker = cb.parentElement.querySelector('.tag-marker');
        if (marker) marker.textContent = cb.checked ? '[X]' : '[ ]';
    });

    // ── Step 3: Randomize starting traits — SPECIAL is set first so eligibility checks work
    startingTraits = []; // clear so checkTraitEligible sees a clean slate
    const eligibleTraits = TRAITS_DATA.filter(t => checkTraitEligible(t));
    const shuffledTraits = [...eligibleTraits].sort(() => Math.random() - 0.5);
    // Pick up to 5 eligible traits, excluding conflicting NOT pairs
    const chosenTraits = [];
    for (const t of shuffledTraits) {
        if (chosenTraits.length >= 5) break;
        // Temporarily register chosen so NOT checks work
        const tempNames = chosenTraits.map(x => x.name);
        const notBlocked = !t.req.split(',').some(p => {
            const up = p.trim().toUpperCase();
            return up.startsWith('NOT ') && tempNames.map(n => n.toUpperCase()).includes(up.slice(4).trim());
        });
        if (notBlocked && checkTraitEligible(t)) chosenTraits.push(t);
    }
    startingTraits = chosenTraits.map(t => ({ name: t.name }));
    renderStartingTraitsList();

    updateAll();
    reCheckAllPerkRows();
    triggerAutosave();

    // Flash confirmation
    const banner = document.getElementById('perk-lvlup-banner');
    if (banner) {
        banner.innerHTML = `<span style="font-size:0.75rem; letter-spacing:1px;">🎲 BUILD RANDOMIZED — REVIEW YOUR S.P.E.C.I.A.L., TAGS &amp; TRAITS</span><button onclick="this.parentElement.style.display='none'" style="margin-left:12px; padding:3px 8px; font-size:0.6rem; background:none; border:1px solid var(--pip-color); color:var(--pip-color); cursor:pointer;">DISMISS</button>`;
        banner.style.display = 'flex';
        setTimeout(() => { banner.style.display = 'none'; }, 5000);
    }
}


/* ===== PERK PICKER MODAL (LEVEL UP + TRAIT BONUS) ===== */
/* Shared modal for: (a) level-up perk selection and (b) trait-granted bonus perk selection.
   Mode is signalled via data-mode="trait" attribute on the modal element. */
/* [PERK_GRANTING_TRAITS — moved to data.js] */

let _traitPerkPickerList = []; // full list used for trait perk modal (eligible + ineligible)

function checkAndOfferTraitPerk(traitName) {
    if (!PERK_GRANTING_TRAITS.has(traitName)) return;
    setTimeout(() => openTraitPerkPickerModal(traitName), 120);
}

function openTraitPerkPickerModal(traitName) {
    // Re-use the perk picker modal but in 'trait' mode
    _perkPickerLevel = null; // not a level-up
    const titleEl = document.getElementById('perk-picker-title');
    if (titleEl) titleEl.innerHTML = `◈ TRAIT BONUS &mdash; <span style="color:#c8ffd4;">${traitName}</span>: SELECT A FREE PERK`;
    const srchEl = document.getElementById('perk-picker-search');
    if (srchEl) srchEl.value = '';
    // Reset sort
    _perkPickerSort = 'az';
    const azP = document.getElementById('ppick-sort-az');
    const lvlP = document.getElementById('ppick-sort-lvl');
    if (azP) azP.classList.add('active');
    if (lvlP) lvlP.classList.remove('active');
    // Set mode flag so renderer knows
    const modal = document.getElementById('perk-picker-modal');
    if (modal) {
        modal.setAttribute('data-mode', 'trait');
        modal.setAttribute('data-trait', traitName);
    }
    renderPerkPickerGrid();
    if (modal) modal.style.display = 'flex';
}

let _perkPickerLevel = null;
let _perkPickerList  = [];
let _perkPickerSort  = 'az';    // 'az' | 'lvl'
let _perkPickerShowIneligible = false; // Toggle to show ineligible perks
let _perkPickerFilters = { level: true, stats: true, skills: true }; // What blocks to show
let perkWishlist = []; // Array of favorited perk names
let savedBuilds = []; // Array of saved builds
let currentBuildName = 'Current Build'; // Name of the active build

function openPerkPickerModal(lvl) {
    _perkPickerLevel = lvl;
    const titleEl = document.getElementById('perk-picker-title');
    if (titleEl) titleEl.textContent = `LEVEL ${lvl} — SELECT YOUR PERK`;
    const srchEl = document.getElementById('perk-picker-search');
    if (srchEl) srchEl.value = '';
    // Reset sort to A-Z on each open
    _perkPickerSort = 'az';
    const azP = document.getElementById('ppick-sort-az');
    const lvlP = document.getElementById('ppick-sort-lvl');
    if (azP) azP.classList.add('active');
    if (lvlP) lvlP.classList.remove('active');
    // Reset filter state
    _perkPickerShowIneligible = false;
    const toggleBtn = document.getElementById('ppick-toggle-ineligible');
    const filterOpts = document.getElementById('ppick-filter-options');
    if (toggleBtn) toggleBtn.classList.remove('active');
    if (filterOpts) filterOpts.style.display = 'none';
    // Reset checkboxes to all checked
    ['level', 'stats', 'skills'].forEach(type => {
        _perkPickerFilters[type] = true;
        const checkbox = document.getElementById(`ppick-filter-${type}`);
        if (checkbox) checkbox.checked = true;
    });
    renderPerkPickerGrid();
    const modal = document.getElementById('perk-picker-modal');
    if (modal) modal.style.display = 'flex';
}

function closePerkPickerModal() {
    const modal = document.getElementById('perk-picker-modal');
    const isTraitMode = modal && modal.getAttribute('data-mode') === 'trait';
    if (modal) {
        modal.style.display = 'none';
        modal.removeAttribute('data-mode');
        modal.removeAttribute('data-trait');
    }
    if (isTraitMode) {
        // Just close, no reminder banner for trait perks
        return;
    }
    // Show the classic banner as a reminder for level-up perks
    const banner = document.getElementById('perk-lvlup-banner');
    if (banner && _perkPickerLevel) {
        const lvl = _perkPickerLevel;
        banner.innerHTML = `<span style="font-size:0.75rem; letter-spacing:1px;">⬆ LVL ${lvl}: PERK AVAILABLE!</span><button onclick="openPerkPickerModal(${lvl})" style="margin-left:12px; padding:3px 12px; font-size:0.65rem; background:var(--pip-color); color:black; border:none; cursor:pointer; letter-spacing:1px; font-weight:bold;">→ PICK PERK</button><button onclick="this.parentElement.style.display='none'" style="margin-left:6px; padding:3px 8px; font-size:0.65rem; background:none; border:1px solid var(--pip-color); color:var(--pip-color); cursor:pointer;">LATER</button>`;
        banner.style.display = 'flex';
    }
    _perkPickerLevel = null;
}

function renderPerkPickerGrid() {
    const modal = document.getElementById('perk-picker-modal');
    const isTraitMode = modal && modal.getAttribute('data-mode') === 'trait';
    const search = ((document.getElementById('perk-picker-search')||{}).value || '').toLowerCase().trim();

    const grid = document.getElementById('perk-picker-grid');
    if (!grid) return;

    // How many times is this perk already in the build?
    const takenCounts = getTakenPerkCounts();
    function takenCount(p) { return takenCounts.get(p.name.toUpperCase()) || 0; }
    // Is every rank of this perk already filled?
    function isFullyTaken(p) { return takenCount(p) >= p.ranks; }

    // Helper: parse the minimum level from a perk's req string
    function perkLevel(p) {
        const m = (p.req || '').match(/Level\s+(\d+)/i);
        return m ? parseInt(m[1]) : 0;
    }

    // Helper: determine what's blocking a perk (level, stats, or skills)
    function getBlockType(p) {
        const req = p.req;
        const lvlM = req.match(/Level\s+(\d+)/i);
        if (lvlM && charLevel < parseInt(lvlM[1])) return 'level';
        
        // Check each requirement chunk
        for (const chunk of req.split(',').map(s => s.trim())) {
            if (/^Level\s/i.test(chunk)) continue;
            const anyMet = chunk.split(/\s+or\s+/i).some(part => parsePartMet(part));
            if (!anyMet) {
                // Determine if it's a stat or skill requirement
                if (/\b(STR|PER|END|CHR|INT|AGL|LCK)\s+\d+/i.test(chunk)) return 'stats';
                // Check for skill requirements
                for (const { pattern } of SKILL_REQ_MAP) {
                    if (pattern.test(chunk)) return 'skills';
                }
                return 'stats'; // default to stats if unclear
            }
        }
        return null; // meets all requirements
    }

    // Comparator respecting _perkPickerSort
    function sortPerks(a, b) {
        if (_perkPickerSort === 'lvl') {
            const la = perkLevel(a), lb = perkLevel(b);
            if (la !== lb) return la - lb;
        }
        return a.name.localeCompare(b.name);
    }

    if (isTraitMode) {
        // Trait mode: show all perks except fully-taken ones
        const available = PERKS_DATA.filter(p => !isFullyTaken(p));
        const eligible = available
            .filter(p => meetsRequirements(p))
            .filter(p => !search || p.name.toLowerCase().includes(search) || p.desc.toLowerCase().includes(search))
            .sort(sortPerks);
        const ineligible = available
            .filter(p => !meetsRequirements(p))
            .filter(p => !search || p.name.toLowerCase().includes(search) || p.desc.toLowerCase().includes(search))
            .sort(sortPerks);

        _perkPickerList = [...eligible, ...ineligible];
        const countEl = document.getElementById('perk-picker-count');
        if (countEl) countEl.textContent = `${eligible.length} ELIGIBLE · ${ineligible.length} INELIGIBLE`;

        grid.innerHTML = _perkPickerList.map((p, i) => {
            const isElig = i < eligible.length;
            const taken = takenCount(p);
            const lvlNum = perkLevel(p);
            const lvlBadge = lvlNum > 0 ? `<span class="pperk-lvl-badge">LVL ${lvlNum}</span>` : '';
            const rankBadge = p.ranks > 1
                ? `<span class="pperk-rank-badge pperk-rank-multi">★ ${taken}/${p.ranks} RANKS</span>`
                : `<span class="pperk-rank-badge">1 RANK</span>`;
            const isWishlisted = isPerkWishlisted(p.name);
            const wishlistBtn = `<button class="pperk-wishlist-btn ${isWishlisted ? 'wishlisted' : ''}" onclick="event.stopPropagation(); togglePerkWishlist('${p.name}')" title="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}">★</button>`;
            return `<div class="pperk-card pperk-trait-card ${isElig ? '' : 'pperk-ineligible'}" onclick="takePerkFromModal(${i})" title="${isElig ? 'TAKE THIS PERK' : 'REQUIREMENTS NOT MET — YOU MAY STILL SELECT AS A TRAIT REWARD'}">
                ${wishlistBtn}
                <div class="pperk-card-top">
                    <span class="pperk-name">${p.name}</span>
                    ${lvlBadge}
                    ${rankBadge}
                    ${!isElig ? '<span class="pperk-inelig-tag">REQ NOT MET</span>' : ''}
                </div>
                <div class="pperk-req">${p.req}</div>
                <div class="pperk-desc">${p.desc}</div>
                <button class="pperk-take-btn">${isElig ? '✓ TAKE THIS PERK' : '⚠ TAKE ANYWAY'}</button>
            </div>`;
        }).join('') || '<div style="grid-column:1/-1;text-align:center;opacity:0.4;padding:24px;">NO PERKS FOUND</div>';
    } else {
        // Level-up mode: show eligible and optionally ineligible perks with filters
        const available = PERKS_DATA.filter(p => !isFullyTaken(p));
        const eligible = available.filter(p => meetsRequirements(p));
        
        let list, ineligibleList = [];
        
        if (_perkPickerShowIneligible) {
            // Get ineligible perks and filter by block type
            const allIneligible = available.filter(p => !meetsRequirements(p));
            ineligibleList = allIneligible.filter(p => {
                const blockType = getBlockType(p);
                if (blockType === 'level' && !_perkPickerFilters.level) return false;
                if (blockType === 'stats' && !_perkPickerFilters.stats) return false;
                if (blockType === 'skills' && !_perkPickerFilters.skills) return false;
                return true;
            });
            
            // Apply search filter
            const eligibleFiltered = eligible.filter(p => 
                !search || p.name.toLowerCase().includes(search) || p.desc.toLowerCase().includes(search)
            );
            const ineligibleFiltered = ineligibleList.filter(p =>
                !search || p.name.toLowerCase().includes(search) || p.desc.toLowerCase().includes(search)
            );
            
            list = [...eligibleFiltered.sort(sortPerks), ...ineligibleFiltered.sort(sortPerks)];
            _perkPickerList = list;
            
            const countEl = document.getElementById('perk-picker-count');
            if (countEl) countEl.textContent = `${eligibleFiltered.length} ELIGIBLE · ${ineligibleFiltered.length} INELIGIBLE`;
        } else {
            // Show only eligible perks (original behavior)
            list = search ? eligible.filter(p =>
                p.name.toLowerCase().includes(search) || p.desc.toLowerCase().includes(search)
            ) : eligible;
            list = list.slice().sort(sortPerks);
            _perkPickerList = list;
            
            const countEl = document.getElementById('perk-picker-count');
            if (countEl) countEl.textContent = `${_perkPickerList.length} ELIGIBLE`;
        }

        grid.innerHTML = _perkPickerList.map((p, i) => {
            const isElig = meetsRequirements(p);
            const taken = takenCount(p);
            const lvlNum = perkLevel(p);
            const lvlBadge = lvlNum > 0 ? `<span class="pperk-lvl-badge">LVL ${lvlNum}</span>` : '';
            const rankBadge = p.ranks > 1
                ? `<span class="pperk-rank-badge pperk-rank-multi">★ ${taken}/${p.ranks} RANKS</span>`
                : `<span class="pperk-rank-badge">1 RANK</span>`;
            
            // Show what's blocking if ineligible
            let blockInfo = '';
            if (!isElig && _perkPickerShowIneligible) {
                const blockType = getBlockType(p);
                const blockLabels = { level: '⏱ LEVEL', stats: '⚡ STATS', skills: '📖 SKILLS' };
                blockInfo = `<span class="pperk-inelig-tag">${blockLabels[blockType] || 'REQ NOT MET'}</span>`;
            }
            
            const isWishlisted = isPerkWishlisted(p.name);
            const wishlistBtn = `<button class="pperk-wishlist-btn ${isWishlisted ? 'wishlisted' : ''}" onclick="event.stopPropagation(); togglePerkWishlist('${p.name}')" title="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}">★</button>`;
            
            return `<div class="pperk-card ${isElig ? '' : 'pperk-ineligible'}" onclick="takePerkFromModal(${i})">
                ${wishlistBtn}
                <div class="pperk-card-top">
                    <span class="pperk-name">${p.name}</span>
                    ${lvlBadge}
                    ${rankBadge}
                    ${blockInfo}
                </div>
                <div class="pperk-req">${p.req}</div>
                <div class="pperk-desc">${p.desc}</div>
                <button class="pperk-take-btn">${isElig ? '✓ TAKE THIS PERK' : '⚠ REQ NOT MET'}</button>
            </div>`;
        }).join('') || '<div style="grid-column:1/-1;text-align:center;opacity:0.4;padding:24px;">NO PERKS FOUND</div>';
    }
}

function setPerkPickerSort(mode) {
    _perkPickerSort = mode;
    document.getElementById('ppick-sort-az')  && document.getElementById('ppick-sort-az').classList.toggle('active',  mode === 'az');
    document.getElementById('ppick-sort-lvl') && document.getElementById('ppick-sort-lvl').classList.toggle('active', mode === 'lvl');
    renderPerkPickerGrid();
}

function togglePerkPickerIneligible() {
    _perkPickerShowIneligible = !_perkPickerShowIneligible;
    const btn = document.getElementById('ppick-toggle-ineligible');
    const filterOpts = document.getElementById('ppick-filter-options');
    if (btn) btn.classList.toggle('active', _perkPickerShowIneligible);
    if (filterOpts) filterOpts.style.display = _perkPickerShowIneligible ? 'flex' : 'none';
    renderPerkPickerGrid();
}

function togglePerkPickerFilter(type, enabled) {
    _perkPickerFilters[type] = enabled;
    renderPerkPickerGrid();
}

function setTraitPickerSort(mode) {
    _traitPickerSort = mode;
    document.getElementById('tpick-sort-az')  && document.getElementById('tpick-sort-az').classList.toggle('active',  mode === 'az');
    document.getElementById('tpick-sort-req') && document.getElementById('tpick-sort-req').classList.toggle('active', mode === 'req');
    const search = (document.getElementById('trait-modal-search') || {}).value || '';
    renderTraitGrid(search);
}

function takePerkFromModal(idx) {
    const perk = _perkPickerList[idx];
    if (!perk) return;

    const modal = document.getElementById('perk-picker-modal');
    const isTraitMode = modal && modal.getAttribute('data-mode') === 'trait';

    if (isTraitMode) {
        // Add as a bonus perk in extra-perk-list
        addExtraPerk();
        const extras = document.querySelectorAll('#extra-perk-list .prog-row');
        const last = extras[extras.length - 1];
        if (last) selectPerkInRow(last, perk.name);
        // Clean up modal state
        if (modal) { modal.style.display = 'none'; modal.removeAttribute('data-mode'); modal.removeAttribute('data-trait'); }
        showPerkToast(perk.name);
        triggerAutosave();
        return;
    }

    const lvl = _perkPickerLevel;
    let targetRow = null;

    // Try to find the exact prog-row for this level
    if (lvl) {
        document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)').forEach(row => {
            if (targetRow) return;
            const tag = row.querySelector('.lvl-tag');
            if (tag) {
                const tagLvl = parseInt((tag.textContent.match(/\d+/) || ['0'])[0]);
                if (tagLvl === lvl) targetRow = row;
            }
        });
    }

    // Fall back to first empty perk row
    if (!targetRow) {
        document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)').forEach(row => {
            if (targetRow) return;
            if (!((row.querySelector('.prog-name-input')?.value || '').trim())) targetRow = row;
        });
    }

    if (targetRow) selectPerkInRow(targetRow, perk.name);

    // Close modal and hide banner
    if (modal) modal.style.display = 'none';
    const banner = document.getElementById('perk-lvlup-banner');
    if (banner) banner.style.display = 'none';
    _perkPickerLevel = null;

    showPerkToast(perk.name);
}

/* ===== STICKY NOTE EASTER EGG ===== */
let _stickyClicks = 0;
let _stickyActive = false;

function stickyNoteClick() {
    if (_stickyActive) return; // prevent retriggering mid-animation
    _stickyClicks++;
    const note = document.getElementById('sysop-note');
    const hint = document.getElementById('sticky-click-hint');

    // Update hint text with countdown
    const remaining = 5 - _stickyClicks;
    if (hint && remaining > 0) {
        hint.textContent = remaining <= 2 ? `(${remaining}...)` : `(click)`;
        // Micro-jolt on each click
        note.style.animation = 'none';
        void note.offsetHeight; // reflow
        note.style.animation = 'stickyJolt 0.25s ease forwards';
    }

    if (_stickyClicks >= 5) {
        _stickyActive = true;
        if (hint) hint.style.display = 'none';
        // Stop HC flicker, then shake + fall
        note.classList.add('sticky-falling');
        note.style.animation = 'stickyShake 0.5s ease, stickyFall 0.6s 0.5s ease forwards';
        setTimeout(() => {
            note.style.display = 'none';
            // Reveal doomsday note
            const doom = document.getElementById('doomsday-note');
            if (doom) {
                doom.style.display = 'block';
                doom.style.animation = 'doomReveal 0.5s ease forwards';
            }
            _stickyClicks = 0;
            _stickyActive = false;
        }, 1100);
    }
}


/* ===== RANDOM NAME LISTS ===== */
/* [RAND_MALE_FIRST — moved to data.js] */
/* [RAND_FEMALE_FIRST — moved to data.js] */
/* [RAND_LAST — moved to data.js] */

function getRandomWastelandName() {
    const gender = Math.random() < 0.5 ? 'M' : 'F';
    const firsts = gender === 'M' ? RAND_MALE_FIRST : RAND_FEMALE_FIRST;
    const first = firsts[Math.floor(Math.random() * firsts.length)];
    const last = RAND_LAST[Math.floor(Math.random() * RAND_LAST.length)];
    return first + ' ' + last;
}

/* ===== SPECIAL INFO DATA ===== */
/* [SPECIAL_INFO — moved to data.js] */

function hasMagneticPersonalityPerk() {
    const allPerkInputs = document.querySelectorAll('#prog-list .prog-name-input, #extra-perk-list .prog-name-input');
    for (const inp of allPerkInputs) {
        if ((inp.value || '').trim().toUpperCase() === 'MAGNETIC PERSONALITY') return true;
    }
    return false;
}

function openSpecialInfoModal(k) {
    const info = SPECIAL_INFO[k];
    if (!info) return;
    const val = special[k];
    const modal = document.getElementById('special-info-modal');
    const title = document.getElementById('sinfo-title');
    const valEl = document.getElementById('sinfo-val');
    const effects = document.getElementById('sinfo-effects');
    const extra = document.getElementById('sinfo-extra');

    if (title) { title.textContent = info.label; title.style.color = info.color; }
    if (valEl) { valEl.textContent = val; valEl.style.color = info.color; }
    if (effects) {
        effects.innerHTML = info.effects.map(e => `<div class="sinfo-effect-row">▸ ${e}</div>`).join('');
    }
    if (extra) {
        extra.innerHTML = info.extra ? info.extra(val) : '';
    }
    if (modal) modal.style.display = 'flex';
}

function closeSpecialInfoModal() {
    const modal = document.getElementById('special-info-modal');
    if (modal) modal.style.display = 'none';
}

/* ===== TRAIT DETAIL MODAL ===== */
let _traitDetailIdx = null;
let _traitDetailIsLevel = false;
let _traitDetailSlotId = null;

function openTraitDetailModal(name, opts) {
    // opts: { type: 'starting', idx: N } or { type: 'level', slotId: 'xxx' }
    const trait = TRAITS_DATA.find(t => t.name === name);
    const modal = document.getElementById('trait-detail-modal');
    if (!modal) return;

    document.getElementById('td-name').textContent = name;
    document.getElementById('td-req').textContent = trait ? (trait.req || 'NO REQUIREMENTS') : '';
    document.getElementById('td-desc').textContent = trait ? trait.desc : name;

    // Delta badge info
    const bonus = TRAIT_BONUSES ? TRAIT_BONUSES[name] : null;
    const deltaEl = document.getElementById('td-delta');
    if (deltaEl && bonus) {
        let parts = [];
        if (bonus.special) {
            for (const [k,v] of Object.entries(bonus.special)) {
                parts.push(`<span class="${v>0?'sdelta-pos':'sdelta-neg'}" style="padding:1px 6px; border-radius:2px; font-size:0.65rem; font-weight:bold;">${k} ${v>0?'+':''}${v}</span>`);
            }
        }
        if (bonus.skills) {
            for (const [k,v] of Object.entries(bonus.skills)) {
                if (k === '__ALL__') parts.push(`<span class="${v>0?'sdelta-pos':'sdelta-neg'}" style="padding:1px 6px; border-radius:2px; font-size:0.65rem; font-weight:bold;">ALL SKILLS ${v>0?'+':''}${v}</span>`);
                else parts.push(`<span class="${v>0?'sdelta-pos':'sdelta-neg'}" style="padding:1px 6px; border-radius:2px; font-size:0.65rem; font-weight:bold;">${k} ${v>0?'+':''}${v}</span>`);
            }
        }
        deltaEl.innerHTML = parts.length ? `<div style="margin-bottom:8px; display:flex; flex-wrap:wrap; gap:4px;">${parts.join('')}</div>` : '';
    } else if (deltaEl) {
        deltaEl.innerHTML = '';
    }

    // Wire up remove button
    const removeBtn = document.getElementById('td-remove-btn');
    if (removeBtn) {
        if (opts.type === 'starting') {
            removeBtn.onclick = () => { removeStartingTrait(opts.idx); closeTraitDetailModal(); };
            removeBtn.style.display = 'inline-block';
        } else if (opts.type === 'level') {
            removeBtn.onclick = () => { clearTraitSlot(opts.slotId); closeTraitDetailModal(); };
            removeBtn.style.display = 'inline-block';
        } else {
            removeBtn.style.display = 'none';
        }
    }

    // Wire up change button
    const changeBtn = document.getElementById('td-change-btn');
    if (changeBtn) {
        if (opts.type === 'starting') {
            changeBtn.onclick = () => { closeTraitDetailModal(); openStartingTraitModal(); };
            changeBtn.style.display = 'inline-block';
        } else if (opts.type === 'level') {
            changeBtn.onclick = () => { closeTraitDetailModal(); openTraitModal(opts.slotId); };
            changeBtn.style.display = 'inline-block';
        } else {
            changeBtn.style.display = 'none';
        }
    }
    
    // Wire up wishlist button (traits can be wishlisted too)
    const wishlistBtn = document.getElementById('td-wishlist-btn');
    if (wishlistBtn) {
        const isWishlisted = isPerkWishlisted(name);
        wishlistBtn.classList.toggle('wishlisted', isWishlisted);
        wishlistBtn.textContent = isWishlisted ? '★ WISHLISTED' : '★ WISHLIST';
        wishlistBtn.onclick = () => {
            togglePerkWishlist(name);
            // Update button state
            const newState = isPerkWishlisted(name);
            wishlistBtn.classList.toggle('wishlisted', newState);
            wishlistBtn.textContent = newState ? '★ WISHLISTED' : '★ WISHLIST';
        };
        wishlistBtn.style.display = 'inline-block';
    }

    modal.style.display = 'flex';
}

function closeTraitDetailModal() {
    const modal = document.getElementById('trait-detail-modal');
    if (modal) modal.style.display = 'none';
}

/* ===== INITIALIZATION ===== */

/* ═══════════════════════════════════════════════
   CUSTOM HUD THEMES
═══════════════════════════════════════════════ */
/* [CUSTOM_THEMES — moved to data.js] */
let _activeCustomTheme = '';

/* ── Karma & Humbled ── */
let buildKarma = 'neutral';  // 'very-good'|'good'|'neutral'|'evil'|'very-evil'
let humbledLevel = 0;        // level at time of transit (0 = not yet humbled)
let humbledReductions = {};  // {STR:1, PER:1, ...} — 4 stats chosen, each -1
let hasBeenHumbled = false;

function setCustomTheme(name, skipSave) {
    _activeCustomTheme = name || '';
    // Remove all theme-* classes, then re-apply origin + custom + hc
    const isHC = document.body.classList.contains('mode-hc');
    const originClass = (origin === 'MW') ? 'theme-mw' : 'theme-cw';
    document.body.className = originClass;
    if (_activeCustomTheme) document.body.classList.add('theme-' + _activeCustomTheme);
    if (isHC) document.body.classList.add('mode-hc');
    if (!skipSave) localStorage.setItem('NS_CustomTheme', _activeCustomTheme);
    // Update selector button states
    document.querySelectorAll('.theme-btn').forEach(btn => {
        const active = (btn.dataset.theme || '') === _activeCustomTheme;
        btn.classList.toggle('active-theme', active);
    });
    // Inject faction quote
    const quoteBar = document.getElementById('faction-quote-bar');
    if (quoteBar) {
        const themeData = FACTION_THEMES[_activeCustomTheme] || FACTION_THEMES[''];
        if (themeData && themeData.quote) {
            quoteBar.innerHTML = `<span class="faction-quote-text">❝ ${themeData.quote} ❞</span><span class="faction-quote-label">${themeData.label}</span>`;
            quoteBar.style.display = 'flex';
        } else {
            quoteBar.style.display = 'none';
        }
    }
    // Play theme jingle on switch (not on initial load via skipSave)
    if (!skipSave) {
        nsAudio.playThemeJingle(_activeCustomTheme);
    }
    // Sync HUD THEME panel tile highlight + button state
    document.querySelectorAll('.hud-theme-tile').forEach(tile => {
        tile.classList.toggle('active-tile', (tile.dataset.theme || '') === _activeCustomTheme);
    });
    const hudBtn = document.getElementById('hud-theme-btn');
    if (hudBtn) {
        if (_activeCustomTheme) {
            hudBtn.classList.add('theme-active');
        } else {
            hudBtn.classList.remove('theme-active');
        }
    }
}

function applyStoredTheme() {
    let saved = ''; try { saved = localStorage.getItem('NS_CustomTheme') || ''; } catch(e) {}
    if (saved) {
        setCustomTheme(saved, true);
    } else {
        _activeCustomTheme = '';
        document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active-theme'));
    }
    // Sync HUD panel tiles
    document.querySelectorAll('.hud-theme-tile').forEach(tile => {
        tile.classList.toggle('active-tile', (tile.dataset.theme || '') === _activeCustomTheme);
    });
}

function toggleThemePanel() {
    const panel = document.getElementById('hud-theme-panel');
    if (!panel) return;
    const open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    const btn = document.getElementById('hud-theme-btn');
    if (btn) btn.textContent = open ? '🎨 HUD THEME' : '🎨 CLOSE THEME';
}

function closeThemePanel() {
    const panel = document.getElementById('hud-theme-panel');
    if (panel) panel.style.display = 'none';
    const btn = document.getElementById('hud-theme-btn');
    if (btn) btn.textContent = '🎨 HUD THEME';
}

/* ═══════════════════════════════════════════════
   KARMA SYSTEM
═══════════════════════════════════════════════ */
/* [KARMA_TIERS — moved to data.js] */

function setKarma(k) {
    buildKarma = k;
    document.querySelectorAll('.karma-btn').forEach(b => {
        b.classList.toggle('karma-active', b.dataset.karma === k);
    });
    updateKarmaFace(k);
    triggerAutosave();
}

function renderKarmaSelector() {
    const el = document.getElementById('karma-selector');
    if (!el) return;
    el.innerHTML = KARMA_TIERS.map(t =>
        `<button class="karma-btn${buildKarma === t.id ? ' karma-active' : ''}"
            data-karma="${t.id}"
            style="--kc:${t.color}"
            onclick="setKarma('${t.id}')"
            title="${t.label}">${t.label}</button>`
    ).join('');
}

/* ═══════════════════════════════════════════════
   HUMBLED / WASTELAND TRANSIT SYSTEM
═══════════════════════════════════════════════ */
let _humbledPickedStats = [];

function openHumbledModal() {
    if (hasBeenHumbled) { alert('HEAD TRAUMA: Transit already applied.'); return; }
    document.getElementById('humbled-modal').style.display = 'flex';
}

function closeHumbledModal() {
    document.getElementById('humbled-modal').style.display = 'none';
    _humbledPickedStats = [];
    renderHumbledPicker();
}

function renderHumbledPicker() {
    const grid = document.getElementById('humbled-special-grid');
    if (!grid) return;
    const stats = ['STR','PER','END','CHA','INT','AGL','LCK'];
    grid.innerHTML = stats.map(s => {
        const picked = _humbledPickedStats.includes(s);
        const cur = special[s] || 5;
        return `<button class="humbled-stat-btn${picked ? ' humbled-stat-picked' : ''}"
            onclick="toggleHumbledStat('${s}')"
            title="${s}: ${cur} → ${cur - 1}">
            <span class="hs-name">${s}</span>
            <span class="hs-val">${cur}</span>
            ${picked ? '<span class="hs-arrow">→ '+(cur-1)+'</span>' : ''}
        </button>`;
    }).join('');
    const cntEl = document.getElementById('humbled-pick-count');
    if (cntEl) cntEl.textContent = _humbledPickedStats.length;
    const confirmBtn = document.getElementById('humbled-confirm-btn');
    if (confirmBtn) confirmBtn.disabled = _humbledPickedStats.length !== 4;
}

function toggleHumbledStat(s) {
    if (_humbledPickedStats.includes(s)) {
        _humbledPickedStats = _humbledPickedStats.filter(x => x !== s);
    } else if (_humbledPickedStats.length < 4) {
        _humbledPickedStats.push(s);
    }
    renderHumbledPicker();
}

function confirmHumbled() {
    if (_humbledPickedStats.length !== 4) return;
    // Record state
    hasBeenHumbled = true;
    humbledLevel = charLevel;
    humbledReductions = {};
    _humbledPickedStats.forEach(s => { humbledReductions[s] = 1; });
    // Reset level and skills
    charLevel = 1;
    Object.keys(skillPoints).forEach(k => { skillPoints[k] = 0; });
    // Clear skill history too
    if (typeof skillHistory !== 'undefined') skillHistory = [];
    // Close modal
    document.getElementById('humbled-modal').style.display = 'none';
    _humbledPickedStats = [];
    // Rebuild progression (wipe level rows, keep perks/traits from previous run)
    updateAll();
    reCheckAllPerkRows();
    renderHumbledBanner();
    triggerAutosave();
}

function renderHumbledBanner() {
    const el = document.getElementById('humbled-status-banner');
    if (!el) return;
    if (!hasBeenHumbled) { el.style.display = 'none'; return; }
    const stats = Object.keys(humbledReductions);
    const reachedOld = charLevel >= humbledLevel;
    const modeLabel = (mode === 'hc') ? 'HARDERCORE' : 'STANDARD';
    let perkRule;
    if (reachedOld) {
        perkRule = 'PERK PENALTY LIFTED — NORMAL RATES RESTORED';
    } else if (mode === 'hc') {
        perkRule = `NO NEW PERKS UNTIL LVL ${humbledLevel}`;
    } else {
        perkRule = `PERKS EVERY 4 LEVELS UNTIL LVL ${humbledLevel} (CURRENTLY LVL ${charLevel})`;
    }
    el.style.display = 'flex';
    el.innerHTML = `
        <span class="hb-icon">☣</span>
        <span class="hb-main">HEAD TRAUMA ACTIVE — PRE-TRANSIT LEVEL: <b>${humbledLevel}</b></span>
        <span class="hb-sep">|</span>
        <span class="hb-stats">SPECIAL REDUCTIONS: ${stats.map(s=>`${s} -1`).join(', ')}</span>
        <span class="hb-sep">|</span>
        <span class="hb-rule">${perkRule}</span>
    `;
}

/* ===== AUDIO SYSTEM ===== */
const nsAudio = (() => {
    let ctx = null, muted = false, crtNode = null, hcAlertNode = null;

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function playTone(freq, type, duration, vol, attack=0.005, startOffset=0) {
        if (muted) return;
        try {
            const c = getCtx();
            const osc = c.createOscillator();
            const gain = c.createGain();
            osc.connect(gain); gain.connect(c.destination);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, c.currentTime + startOffset);
            gain.gain.setValueAtTime(0, c.currentTime + startOffset);
            gain.gain.linearRampToValueAtTime(vol, c.currentTime + startOffset + attack);
            gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + startOffset + duration);
            osc.start(c.currentTime + startOffset);
            osc.stop(c.currentTime + startOffset + duration + 0.01);
        } catch(e) {}
    }

    function playNoise(duration, vol, filterFreq=800, startOffset=0) {
        if (muted) return;
        try {
            const c = getCtx();
            const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
            const src = c.createBufferSource();
            src.buffer = buf;
            const filter = c.createBiquadFilter();
            filter.type = 'lowpass'; filter.frequency.value = filterFreq;
            const gain = c.createGain();
            gain.gain.setValueAtTime(vol, c.currentTime + startOffset);
            gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + startOffset + duration);
            src.connect(filter); filter.connect(gain); gain.connect(c.destination);
            src.start(c.currentTime + startOffset);
            src.stop(c.currentTime + startOffset + duration + 0.01);
        } catch(e) {}
    }

    return {
        click() {
            if (muted) return;
            // Theme-specific click SFX
            const t = typeof _activeCustomTheme !== 'undefined' ? _activeCustomTheme : '';
            if (t === 'bos') {
                // Heavy armoured clunk — low square thud
                playNoise(0.035, 0.18, 500);
                playTone(180, 'square', 0.04, 0.08);
            } else if (t === 'enclave') {
                // Cold institutional beep — clean sine double-tap
                playTone(1800, 'sine', 0.02, 0.05);
                playTone(2200, 'sine', 0.015, 0.03, 0.002, 0.025);
            } else if (t === 'vault21') {
                // Vegas coin-drop chime — bright triangle ping
                playTone(1046, 'triangle', 0.06, 0.09);
                playTone(1318, 'sine', 0.04, 0.04, 0.002, 0.03);
            } else if (t === 'legion') {
                // Roman war drum snap — sharp noise burst
                playNoise(0.05, 0.22, 350);
                playTone(90, 'sawtooth', 0.03, 0.07);
            } else if (t === 'ncr') {
                // Frontier typewriter clack
                playNoise(0.045, 0.16, 900);
                playTone(600, 'square', 0.025, 0.04);
            } else if (t === 'house') {
                // Neon flicker buzz — quick electric zap
                playTone(440, 'sawtooth', 0.025, 0.06);
                playNoise(0.02, 0.10, 3000);
            } else if (t === 'shi') {
                // Soft bamboo knock — muted sine tap
                playTone(320, 'sine', 0.045, 0.07);
                playNoise(0.02, 0.06, 400);
            } else if (t === 'vaulttec') {
                // Cheerful plastic click — high sine pop
                playTone(1400, 'sine', 0.025, 0.07);
                playTone(1800, 'triangle', 0.015, 0.03, 0.002, 0.018);
            } else {
                // Default NS green terminal click
                playNoise(0.04, 0.15, 1200);
                playTone(1200, 'square', 0.03, 0.06);
            }
        },
        clack() {
            if (muted) return;
            playNoise(0.06, 0.2, 600);
            playTone(400, 'sawtooth', 0.05, 0.04);
        },
        diceRoll() {
            if (muted) return;
            try {
                const c = getCtx();
                for (let i = 0; i < 8; i++) {
                    setTimeout(() => {
                        playNoise(0.07, 0.18, 900);
                        playTone(300 + Math.random()*400, 'triangle', 0.06, 0.05);
                    }, i * 80);
                }
            } catch(e) {}
        },
        // Quick ascending pentatonic jingle — G4 B4 D5 G5 E5 G5 (Mojave western fanfare)
        mojaveJingle() {
            if (muted) return;
            const notes = [392, 494, 587, 784, 659, 784];
            const durs  = [0.12, 0.10, 0.10, 0.18, 0.10, 0.28];
            let t = 0;
            notes.forEach((freq, i) => {
                playTone(freq, 'triangle', durs[i] + 0.05, 0.09, 0.008, t);
                playTone(freq * 2, 'sine', durs[i], 0.022, 0.005, t);
                t += durs[i] + 0.03;
            });
        },
        // ── Faction theme switch jingles ────────────────────────────────────
        bosJingle() {
            if (muted) return;
            // Heavy march motif — low square tones with metallic noise
            playNoise(0.12, 0.12, 300);
            const notes = [196, 220, 196, 262];
            const durs  = [0.14, 0.10, 0.10, 0.32];
            let t = 0.05;
            notes.forEach((f, i) => { playTone(f, 'square', durs[i]+0.06, 0.07, 0.01, t); t += durs[i]+0.04; });
        },
        enclaveJingle() {
            if (muted) return;
            // Cold military fanfare — clean sine fourths
            const notes = [880, 1174, 1318, 1760];
            const durs  = [0.08, 0.08, 0.08, 0.22];
            let t = 0;
            notes.forEach((f, i) => { playTone(f, 'sine', durs[i]+0.04, 0.06, 0.005, t); t += durs[i]+0.03; });
        },
        vault21Jingle() {
            if (muted) return;
            // Vegas coin cascade — descending triangle glitter
            const notes = [1318, 1174, 1046, 880, 1046, 1318];
            const durs  = [0.06, 0.06, 0.06, 0.06, 0.08, 0.22];
            let t = 0;
            notes.forEach((f, i) => {
                playTone(f, 'triangle', durs[i]+0.04, 0.08, 0.004, t);
                playNoise(0.03, 0.05, 4000, t);
                t += durs[i]+0.02;
            });
        },
        legionJingle() {
            if (muted) return;
            // Roman war drums — low sawtooth march
            playNoise(0.3, 0.14, 250);
            const beats = [0, 0.18, 0.32, 0.46];
            beats.forEach(bt => { playTone(80, 'sawtooth', 0.10, 0.10, 0.005, bt); playNoise(0.05, 0.12, 300, bt); });
        },
        ncrJingle() {
            if (muted) return;
            // Frontier harmonica riff — sine slides
            const notes = [392, 440, 494, 440, 523];
            const durs  = [0.12, 0.10, 0.12, 0.10, 0.35];
            let t = 0;
            notes.forEach((f, i) => { playTone(f, 'sine', durs[i]+0.08, 0.06, 0.02, t); t += durs[i]+0.04; });
        },
        houseJingle() {
            if (muted) return;
            // Neon casino arpeggio — electric sawtooth glimmer
            const notes = [494, 622, 784, 988, 784, 622, 784];
            const durs  = [0.06, 0.06, 0.06, 0.10, 0.06, 0.06, 0.22];
            let t = 0;
            notes.forEach((f, i) => {
                playTone(f, 'sawtooth', durs[i]+0.03, 0.055, 0.006, t);
                t += durs[i]+0.02;
            });
        },
        shiJingle() {
            if (muted) return;
            // Pentatonic eastern motif — soft sine
            const notes = [523, 587, 659, 784, 659, 523];
            const durs  = [0.14, 0.10, 0.12, 0.20, 0.10, 0.32];
            let t = 0;
            notes.forEach((f, i) => { playTone(f, 'sine', durs[i]+0.10, 0.055, 0.025, t); t += durs[i]+0.05; });
        },
        vaulttecJingle() {
            if (muted) return;
            // Cheerful retro major arpeggio — triangle waves
            const notes = [523, 659, 784, 1046, 784, 1046, 1318];
            const durs  = [0.07, 0.07, 0.07, 0.12, 0.07, 0.07, 0.28];
            let t = 0;
            notes.forEach((f, i) => {
                playTone(f, 'triangle', durs[i]+0.04, 0.08, 0.006, t);
                playTone(f*2, 'sine', durs[i]+0.02, 0.02, 0.003, t);
                t += durs[i]+0.02;
            });
        },
        dosJingle() {
            if (muted) return;
            // Classic computer beeps — square wave DOS boot sequence
            const notes = [880, 1174, 1318, 1760, 2093];
            const durs  = [0.08, 0.08, 0.08, 0.10, 0.20];
            let t = 0;
            notes.forEach((f, i) => {
                playTone(f, 'square', durs[i], 0.04, 0.002, t);
                t += durs[i]+0.04;
            });
            // Terminal click
            playNoise(0.06, 0.03, 2500, t);
        },
        nukacolaJingle() {
            if (muted) return;
            // Bright fizzy pop — triangle sparkle with noise bursts
            const notes = [659, 784, 880, 1046, 784, 880, 1046, 1318];
            const durs  = [0.06, 0.06, 0.06, 0.10, 0.06, 0.06, 0.08, 0.28];
            let t = 0;
            notes.forEach((f, i) => {
                playTone(f, 'triangle', durs[i]+0.03, 0.08, 0.004, t);
                playTone(f*2, 'sine', durs[i]+0.02, 0.02, 0.002, t);
                // Fizz bursts
                if (i % 2 === 0) playNoise(0.04, 0.04, 5000, t);
                t += durs[i]+0.02;
            });
        },
        sierramadreJingle() {
            if (muted) return;
            // Ghostly casino — haunting sine with rumble and distant echo
            playNoise(0.08, 0.35, 180); // Deep rumble (The Cloud)
            const notes = [392, 330, 294, 247, 220, 196];
            const durs  = [0.18, 0.16, 0.18, 0.20, 0.22, 0.40];
            let t = 0.08;
            notes.forEach((f, i) => {
                playTone(f, 'sine', durs[i]+0.15, 0.05, 0.035, t);
                // Ghostly echo
                playTone(f*1.5, 'sine', durs[i]+0.12, 0.015, 0.020, t+0.08);
                t += durs[i]+0.06;
            });
        },
        playThemeJingle(themeName) {
            const jingles = {
                'bos':      () => this.bosJingle(),
                'enclave':  () => this.enclaveJingle(),
                'vault21':  () => this.vault21Jingle(),
                'legion':   () => this.legionJingle(),
                'ncr':      () => this.ncrJingle(),
                'house':    () => this.houseJingle(),
                'shi':      () => this.shiJingle(),
                'vaulttec': () => this.vaulttecJingle(),
                'dos':      () => this.dosJingle(),
                'nukacola': () => this.nukacolaJingle(),
                'sierramadre': () => this.sierramadreJingle(),
                '':         () => this.cwMotif(),
            };
            if (jingles[themeName] !== undefined) jingles[themeName]();
        },
        // Slow descending minor melody with low rumble & geiger ticks (Capital Wasteland)
        cwMotif() {
            if (muted) return;
            const notes = [440, 370, 330, 277, 294];
            const durs  = [0.22, 0.20, 0.22, 0.28, 0.45];
            let t = 0;
            notes.forEach((freq, i) => {
                playTone(freq, 'sine', durs[i] + 0.12, 0.06, 0.025, t);
                if (i === 0) playNoise(0.5, 0.04, 160, t);
                t += durs[i] + 0.06;
            });
            // Scattered geiger-counter ticks
            for (let k = 0; k < 5; k++) {
                const tickT = 0.08 + k * 0.26 + Math.random() * 0.1;
                playNoise(0.025, 0.07, 3500, tickT);
                playTone(2400 + Math.random() * 600, 'sine', 0.02, 0.04, 0.002, tickT);
            }
        },
        startCRT() {
            if (muted || crtNode) return;
            try {
                const c = getCtx();
                const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
                const data = buf.getChannelData(0);
                for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
                crtNode = c.createBufferSource();
                crtNode.buffer = buf; crtNode.loop = true;
                const filter = c.createBiquadFilter();
                filter.type = 'bandpass'; filter.frequency.value = 60; filter.Q.value = 0.5;
                const gain = c.createGain(); gain.gain.value = 0.015;
                crtNode.connect(filter); filter.connect(gain); gain.connect(c.destination);
                crtNode.start();
            } catch(e) {}
        },
        stopCRT() {
            try { if (crtNode) { crtNode.stop(); crtNode = null; } } catch(e) { crtNode = null; }
        },
        // Replaces the harsh sawtooth claxon with a low ominous DEFCON-style pulse:
        // slow sine wobble at ~195Hz with a 0.5Hz heartbeat volume envelope
        startHCAlert() {
            if (hcAlertNode) return;
            try {
                const c = getCtx();
                const osc = c.createOscillator();
                const lfo = c.createOscillator();
                const lfoGain = c.createGain();
                const masterGain = c.createGain();
                const filter = c.createBiquadFilter();
                const pulseOsc = c.createOscillator();
                const pulseGain = c.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(195, c.currentTime);
                lfo.type = 'sine'; lfo.frequency.value = 0.7;
                lfoGain.gain.value = 10;
                lfo.connect(lfoGain); lfoGain.connect(osc.frequency);

                filter.type = 'lowpass'; filter.frequency.value = 600; filter.Q.value = 1.5;
                masterGain.gain.setValueAtTime(0.008, c.currentTime);

                pulseOsc.type = 'sine'; pulseOsc.frequency.value = 0.5;
                pulseGain.gain.value = 0.006;
                pulseOsc.connect(pulseGain); pulseGain.connect(masterGain.gain);

                osc.connect(filter); filter.connect(masterGain); masterGain.connect(c.destination);
                osc.start(); lfo.start(); pulseOsc.start();
                hcAlertNode = { osc, lfo, pulseOsc };
            } catch(e) {}
        },
        stopHCAlert() {
            try {
                if (hcAlertNode) {
                    hcAlertNode.osc.stop();
                    hcAlertNode.lfo.stop();
                    hcAlertNode.pulseOsc.stop();
                    hcAlertNode = null;
                }
            } catch(e) { hcAlertNode = null; }
        },
        updateModeSound(isHC) {
            if (isHC) { this.stopCRT(); this.startHCAlert(); }
            else { this.stopHCAlert(); this.startCRT(); }
        },
        isMuted() { return muted; },
        toggleMute() {
            muted = !muted;
            if (muted) { this.stopCRT(); this.stopHCAlert(); }
            else { this.startCRT(); if (mode === 'hc') this.startHCAlert(); }
            const btn = document.getElementById('ns-mute-btn');
            if (btn) btn.textContent = muted ? '🔇 MUTED' : '🔊 SFX';
            return muted;
        },
        init() {
            // Universal delegated sound — fires on every interactive click.
            // Elements with their own explicit nsAudio calls are skipped to avoid doubling.
            document.addEventListener('click', (e) => {
                const t = e.target;
                if (t.closest('.tab-nav')) return;       // showTab() calls click() itself
                if (t.matches('.randomize-btn')) return;  // diceRoll() called directly
                if (t.matches('#ns-mute-btn')) return;    // toggleMute handles its own sound
                // Checkboxes
                if (t.tagName === 'INPUT' && t.type === 'checkbox') { this.clack(); return; }
                // Grid / book cards
                if (t.classList.contains('grid-item') || t.closest('.grid-item')) { this.clack(); return; }
                if (t.classList.contains('book-card') || t.closest('.book-card')) { this.clack(); return; }
                // Everything else interactive
                if (t.tagName === 'BUTTON' || t.closest('button')) { this.click(); return; }
                if (t.tagName === 'SELECT') { this.click(); return; }
                if (t.tagName === 'LABEL') { this.click(); return; }
                if (t.closest('.trait-slot-row') || t.closest('.karma-option') ||
                    t.closest('.perk-row') || t.closest('.implant-cell') ||
                    t.closest('.skill-row') || t.closest('.special-cell') ||
                    t.closest('.origin-btn') || t.closest('.cs-entry')) {
                    this.click(); return;
                }
            }, { capture: true });
            document.addEventListener('keydown', (e) => {
                const t = e.target;
                if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') { this.click(); }
            }, { passive: true });
            this.startCRT();
        }
    };
})();

window.onload = () => {
    document.getElementById('tag-area').innerHTML = skills.map(s => `<div class="grid-item" onclick="toggleTag(this)"><input type="checkbox"><span class="tag-marker">[ ]</span><span>${s}</span></div>`).join('');
    renderUniques();
    renderUniqueArmor();
    const saved = localStorage.getItem('Nuclear_Sunset_Permanent_Vault');
    if (saved) {
        try {
            const raw = JSON.parse(saved);
            const safe = sanitizeImport(raw);
            if (safe) hydrate(safe);
            else { setMode('std', true); setOrigin('CW', true); renderImplants(); }
        } catch(e) {
            setMode('std', true); setOrigin('CW', true); renderImplants();
        }
    } else {
        setMode('std', true);
        setOrigin('CW', true);
        renderImplants();
    }
    applyStoredTheme();
    nsAudio.init();
    renderBooksTab();
    loadSavedBuildsList(); // Load saved builds list
};







