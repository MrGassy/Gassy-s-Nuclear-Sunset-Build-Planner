/* UX Enhancement Helper Functions - Optional enhancements, all core functionality preserved */

// Animate number changes
function animateNumber(el, val) {
    const old = parseInt(el.textContent) || 0;
    if (old === val) return;
    el.classList.add('number-changing');
    setTimeout(() => el.classList.remove('number-changing'), 250);
    el.textContent = val;
}

// Progressive reveal
function progressiveReveal(container) {
    const items = container.querySelectorAll('.prog-row, .perk-card, .trait-card');
    items.forEach((item, i) => {
        item.classList.add('progressive-reveal');
        item.style.animationDelay = `${i * 0.03}s`;
    });
}


/* --- BUILD CONSTANTS ---
 * Named constants for the magic strings used throughout the codebase.
 * Comparing against a named constant instead of a string literal makes typos a
 * loud ReferenceError rather than a silent logic failure. Existing string
 * literals remain valid for now; new code should prefer these constants.
 */
const ORIGIN     = Object.freeze({ CW:  'CW',          MW: 'MW' });
const TRAIT_SLOT = Object.freeze({ STARTING: '__starting__', LEVELUP: '__levelup__' });
const ATTR_BOOST = Object.freeze({ HP: 'hp', AP: 'ap', CW: 'cw' });

/* --- STATE VARIABLES --- */
let mode = 'std', origin = 'CW', special = { STR: 5, PER: 5, END: 5, CHA: 5, INT: 5, AGI: 5, LCK: 5 };
let currentSort = 'az';
let skillPoints = { BARTER:0,'BIG GUNS':0,'ENERGY WEAPONS':0,EXPLOSIVES:0,GUNS:0,LOCKPICK:0,MEDICINE:0,'MELEE WEAPONS':0,REPAIR:0,SCIENCE:0,SNEAK:0,SPEECH:0,SURVIVAL:0,UNARMED:0 };
let charLevel = 1;
// Creation choices (SPECIAL, starting traits, tagged skills) lock once the
// character levels up for the first time. Lock is derived from level so that
// a ROLLBACK back to level 1 re-enables editing.
function isCreationLocked() { return charLevel > 1; }
// Starting traits stay editable even after level-up (SPECIAL and tagged
// skills remain gated by isCreationLocked).
function isTraitsLocked() { return false; }
let companions = []; // [{ name, butchBonus: 'improved' | 'worsened' | null }]
let levelUpBonuses = []; // Tracks level-up bonus choices: 'hp', 'ap', or 'cw' for each level
let showEligibleOnly = false;
let _forceEnable = false; // Global override: allow adding traits/perks regardless of requirements
let skillBooksFound = {
  CW: { BARTER:[],'BIG GUNS':[],'ENERGY WEAPONS':[],EXPLOSIVES:[],GUNS:[],LOCKPICK:[],MEDICINE:[],'MELEE WEAPONS':[],REPAIR:[],SCIENCE:[],SNEAK:[],SPEECH:[],SURVIVAL:[],UNARMED:[] },
  MW: { BARTER:[],'BIG GUNS':[],'ENERGY WEAPONS':[],EXPLOSIVES:[],GUNS:[],LOCKPICK:[],MEDICINE:[],'MELEE WEAPONS':[],REPAIR:[],SCIENCE:[],SNEAK:[],SPEECH:[],SURVIVAL:[],UNARMED:[] }
};
function resetSkillBooksFound() {
  skillBooksFound = { CW: {...Object.fromEntries(skills.map(k=>[k,[]]))}, MW: {...Object.fromEntries(skills.map(k=>[k,[]]))} };
}
let _lvlupSession = {}, _lvlupPointsLeft = 0;
let _lvlupAttributeChoice = null; // Tracks current level-up attribute choice: 'hp', 'ap', or 'cw'
let _itTargetRow = null; // tracks which prog-row triggered the Intense Training modal
let _itCancelled = false; // tracks if IT modal was cancelled
let _showBaseSpecial = false; // toggle: show base-only SPECIAL (allocated points before IT/implants/traits/perks)
let _showDetailedSpecial = false; // toggle: show detailed breakdown of SPECIAL bonuses by source
let _hydrating = false; // true during hydrate() — suppresses choice modals (IT, Action Star, Tag!)
let _specialModDebounce = null; // debounce timer for SPECIAL +/- button clicks
let _toastQueue = []; // queue for managing multiple toasts
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
function hasPawnToQueen() {
    // Check regular perks and extra perks
    const counts = getTakenPerkCounts();
    if (counts.has('PAWN TO QUEEN')) return true;
    
    // Also check reward perks list
    if (typeof rewardPerksList !== 'undefined') {
        return rewardPerksList.some(rp => rp.name && rp.name.toUpperCase() === 'PAWN TO QUEEN');
    }
    return false;
}
function bookBonus(s) {
    const count = (skillBooksFound.CW?.[s]?.length || 0) + (skillBooksFound.MW?.[s]?.length || 0);
    if (!count) return 0;
    return count * (hasIdeologue() ? 3 : 2);
}

function getSkillBooksForOrigin() {
    return origin === 'CW' ? SKILL_BOOKS_CW : SKILL_BOOKS_MW;
}

/* [SKILL_REQ_MAP — moved to data.js] */

// GECK formula: Skill = 2 + (GoverningSpecial * 2) + Ceil(Luck * 0.5)
function skillBaseRaw(governing, luck) {
    return 2 + (governing * 2) + Math.ceil(luck * 0.5);
}
function skillBase(s) {
    const stat = SKILL_GOVERNING[s];
    return skillBaseRaw(effectiveSpecial(stat) || 1, effectiveSpecial('LCK') || 1);
}
function getTaggedSkills() {
    const t = new Set();
    document.querySelectorAll('#tag-area input').forEach((cb, i) => { if (cb.checked && skills[i]) t.add(skills[i]); });
    // Include 4th tag from Tag! perk if set
    if (_fourthTagSkill && !t.has(_fourthTagSkill)) t.add(_fourthTagSkill);
    return t;
}
/* Level at which Tag! is taken in the current progression (null if absent). */
function tagPerkLevel() {
    let lvl = null;
    document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)').forEach(row => {
        if (lvl !== null) return;
        const name = (row.querySelector('.prog-name-input')?.value || '').trim();
        if (!/^tag!/i.test(name)) return;
        const tag = row.querySelector('.lvl-tag');
        const m = tag && tag.textContent.match(/\d+/);
        if (m) lvl = parseInt(m[0], 10);
    });
    return lvl;
}
/* Tags in force for the level being built right now. The fourth tag only counts
   from the level AFTER Tag! is taken: that level's points are spent before the
   perk is picked (confirmLevelUp runs before the perk prompt), so pre-perk rows
   must never record a tagged x2 on it. */
function getLevelUpTaggedSkills() {
    const t = getTaggedSkills();
    const tl = tagPerkLevel();
    if (_fourthTagSkill && tl !== null && (charLevel + 1) <= tl) t.delete(_fourthTagSkill);
    return t;
}
function skillTotal(s) {
    const c = getCachedBonuses();
    const _td = (c.trait.skillDelta[s]||0);
    const _pd = (c.perk.perkSkillDelta[s]||0);
    const _cdd = (c.cond.skillDelta[s]||0);
    const _gd = (getGearEffectsDelta().skillDelta[s]||0);
    const _bd = bookBonus(s);
    return Math.min(100, Math.max(0, skillBase(s) + _td + _pd + _cdd + _gd + (skillPoints[s]||0) + _bd));
}

/* skillBase WITHOUT conditional toggles — for eligibility/perk requirement checks */
function skillBaseForEligibility(s) {
    const c = getCachedBonuses();
    const _td = (c.trait.skillDelta[s]||0);
    const _pd = (c.perk.perkSkillDelta[s]||0);
    const _bd = bookBonus(s);
    return Math.min(100, Math.max(0, skillBase(s) + _td + _pd + (skillPoints[s]||0) + _bd));
}
// GECK wiki formula: Floor(Min(INT,9) * 0.5 + 10)
// This equals 10 + floor(INT/2), capped at INT 9 = 14 pts
// Rule A: For an ODD effective INT, the per-level point total alternates with the
//         level being reached (even/odd). Odd levels use the value of INT-1, even
//         levels use the value of INT+1 (e.g. effective INT 5: level 1 = INT4 pts,
//         level 2 = INT6 pts, repeating). Even effective INT stays flat as before.
function pointsPerLevel(atLevel) {
    // Use effective INT (base + trait/perk/conditional/gear) so +INT modifiers affect skill points
    const int = Math.max(1, effectiveSpecial('INT') || 1);
    const eff = (int % 2 === 1)
        ? ((atLevel % 2 === 1) ? Math.max(1, int - 1) : int + 1)
        : int;
    const base = Math.floor(Math.min(eff, 9) * 0.5 + 10);
    // Architect toggle: +floor(INT/2) when indoors
    const { skillPtsPerLevel } = getCachedBonuses().cond;
    // Ideologue trait: +1 skill point per level
    const ideologueBonus = hasIdeologue() ? 1 : 0;
    // Pawn To Queen perk: +1 skill point per level
    const pawnToQueenBonus = hasPawnToQueen() ? 1 : 0;
    // Talented trait: +5 all skills at start but -1 skill point per level
    const talentedPenalty = getChosenTraitNames().some(n => n.toLowerCase() === 'talented') ? -1 : 0;
    return base + (skillPtsPerLevel || 0) + ideologueBonus + pawnToQueenBonus + talentedPenalty;
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
    // Collect all perk names currently in the build (prog-list, extra-perk-list, AND reward perks)
    const allPerkEls = document.querySelectorAll(
        '#prog-list .prog-name-input, #extra-perk-list .prog-name-input'
    );
    const perkSpecialDelta = {STR:0,PER:0,END:0,CHA:0,INT:0,AGI:0,LCK:0};
    const perkSkillDelta = {};
    const applyBonus = (name) => {
        if (!name) return;
        const bonus = PERK_SKILL_BONUSES[name];
        if (!bonus) return;
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
    };
    for (const el of allPerkEls) applyBonus((el.value || '').trim());
    // Also apply unconditional bonuses from reward perks
    if (typeof rewardPerksList !== 'undefined') {
        for (const rp of rewardPerksList) applyBonus(rp.name);
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
let gearEffectsList = []; // [{ name, effect, notes, toggled }]
let _fourthTagSkill = null; // 4th tag skill from Tag! perk
let startingTraits = []; // free-form list of starting traits

/* === CONDITIONAL TOGGLE STATE ===
 * Tracks which conditional perk/trait effects are currently "active" for display.
 * Key = perk or trait name, Value = true/false
 * IMPORTANT: These NEVER affect perk eligibility checks — only visual display.
 */
let conditionalToggles = {}; // e.g. { "Alertness": true, "Night Person": false }

function setConditionalToggle(name, val) {
    if (isKarmaDrivenConditional(name)) return;  // karma-driven → auto-applied, never stored manually
    conditionalToggles[name] = !!val;
    updateAll();          // full re-render so skills, SPECIAL badges, and overview all sync
    syncProgToggleStates(); // prog/extra rows persist in the DOM, so sync their checkboxes/highlight
    triggerAutosave();
}

function syncProgToggleStates() {
    document.querySelectorAll('#prog-list .prog-row, #level-up-traits-list .prog-row, #extra-perk-list .prog-row, #starting-traits-list .st-tag-chip').forEach(row => {
        const ni = row.querySelector('.prog-name-input');
        let base = '';
        if (ni) {
            base = ni.value.trim().replace(/\s*[\[(].*?[\])]$/, '').trim();
        } else {
            base = (row.getAttribute('data-chosen') || '').trim();
        }
        if (!base) return;
        const isCond = (CONDITIONAL_PERK_NAMES && CONDITIONAL_PERK_NAMES.has(base)) ||
                       (TRAIT_CONDITIONAL_NAMES && TRAIT_CONDITIONAL_NAMES.has(base));
        if (!isCond) return;
        const active = isConditionalActive(base);
        const cb = row.querySelector('.cond-toggle-input');
        if (cb) cb.checked = active;
        row.classList.toggle('cond-active', active);
        const st = row.querySelector('.cond-toggle-state');
        if (st) {
            st.textContent = active ? 'ON' : 'OFF';
            st.classList.toggle('on', active);
            st.classList.toggle('off', !active);
        }
    });
}

/* Karma-driven conditional traits/perks (e.g. Twisted, Devil's Advocate, Non Ducor,
 * Duco) have no manual toggle: the effect auto-applies from the karma selected on
 * the planner.  CTB entry shape: { karma: ['evil','very-evil'], special/skills: ... }
 */
function isKarmaActive(tiers) {
    return Array.isArray(tiers) && tiers.includes(buildKarma);
}

function isKarmaDrivenConditional(name) {
    const b = CONDITIONAL_TOGGLE_BONUSES && CONDITIONAL_TOGGLE_BONUSES[name];
    return !!(b && b.karma);
}

function isConditionalActive(name) {
    // Level-parity traits (e.g. Polar Personality) are locked to the current
    // character level — even = ON (SOCIALS), odd = OFF (COMBAT) — no checkbox.
    if (CONDITIONAL_TOGGLE_BONUSES[name] && CONDITIONAL_TOGGLE_BONUSES[name].parity) {
        return typeof charLevel === 'number' && charLevel % 2 === 0;
    }
    // Karma-driven traits/perks follow the build's karma automatically — no checkbox.
    if (isKarmaDrivenConditional(name)) {
        return isKarmaActive(CONDITIONAL_TOGGLE_BONUSES[name].karma);
    }
    return !!conditionalToggles[name];
}

/* Whether the character currently holds a trait (starting or level-up slot). */
function characterHasTrait(name) {
    if (Array.isArray(startingTraits)) {
        for (const t of startingTraits) {
            if (t && (t.name === name || t === name)) return true;
        }
    }
    const rows = document.querySelectorAll('#level-up-traits-list .trait-slot-row');
    for (const row of rows) {
        if ((row.getAttribute('data-chosen') || '').trim() === name) return true;
    }
    return false;
}

/* Whether the character holds a trait/perk anywhere (starting, level-up, reward,
 * extra/internalized-grant) — scans the same DOM rows the cond toggles render in.
 */
function characterHasName(name) {
    if (Array.isArray(startingTraits)) {
        for (const t of startingTraits) {
            if (t && (t.name === name || t === name)) return true;
        }
    }
    const rows = document.querySelectorAll('#prog-list .prog-row, #level-up-traits-list .prog-row, #extra-perk-list .prog-row, #reward-perks-list .prog-row, #starting-traits-list .st-tag-chip');
    for (const row of rows) {
        const ni = row.querySelector('.prog-name-input');
        let base = '';
        if (ni) {
            base = ni.value.trim().replace(/\s*[\[(].*?[\])]$/, '').trim();
        } else {
            base = (row.getAttribute('data-chosen') || '').trim();
        }
        if (base === name) return true;
    }
    return false;
}

/* Returns only conditional toggle bonuses for currently toggled-on items */
function getConditionalToggleDelta() {
    const specDelta = {};
    const skillDelta = {};
    const paritySkillDelta = {};
    let skillPtsPerLevel = 0;
    for (const [name, isOn] of Object.entries(conditionalToggles)) {
        if (!isOn) continue;
        const bonus = CONDITIONAL_TOGGLE_BONUSES[name];
        if (!bonus || bonus.karma) continue;   // karma-driven handled below (auto)
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
    // Level-parity traits: the side is derived from the current character level
    // and behaves like a toggle for DISPLAY only. The same swing is also returned
    // separately as paritySkillDelta so level-up caps can exclude it — the ledger
    // stays identical on both sides of the split.
    for (const [name, bonus] of Object.entries(CONDITIONAL_TOGGLE_BONUSES)) {
        if (!bonus || !bonus.parity) continue;
        if (!characterHasTrait(name)) continue;
        const even = typeof charLevel === 'number' && charLevel % 2 === 0;
        const side = even ? (bonus.on || {}) : (bonus.off || {});
        for (const [k, v] of Object.entries(side.skills || {})) {
            skillDelta[k] = (skillDelta[k] || 0) + v;
            paritySkillDelta[k] = (paritySkillDelta[k] || 0) + v;
        }
    }
    // Karma-driven traits/perks: the effect auto-applies for the karma selected
    // on the planner (display only — never counted in perk/trait eligibility).
    for (const [name, bonus] of Object.entries(CONDITIONAL_TOGGLE_BONUSES)) {
        if (!bonus || !bonus.karma) continue;
        if (!characterHasName(name)) continue;
        if (!isKarmaActive(bonus.karma)) continue;
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
            skillPtsPerLevel += Math.floor((special.INT || 1) / 2);
        }
    }
    return { specDelta, skillDelta, skillPtsPerLevel, paritySkillDelta };
}

/* ===== GEAR EFFECTS ===== */
const SPECIAL_STATS = ['STR','PER','END','CHA','INT','AGI','LCK'];

function getGearEffectsDelta() {
    const specDelta = {STR:0,PER:0,END:0,CHA:0,INT:0,AGI:0,LCK:0};
    const skillDelta = {};
    for (const ge of gearEffectsList) {
        if (!ge.toggled || !ge.effect) continue;
        const m = ge.effect.match(/^([+-]\d+)\s+(.+)$/);
        if (!m) continue;
        const val = parseInt(m[1], 10);
        const target = m[2].toUpperCase().trim();
        if (SPECIAL_STATS.includes(target)) {
            specDelta[target] = (specDelta[target]||0) + val;
        } else if (skills.includes(target)) {
            skillDelta[target] = (skillDelta[target]||0) + val;
        }
    }
    return { specDelta, skillDelta };
}

function setGearEffectToggle(idx, val) {
    if (gearEffectsList[idx]) {
        gearEffectsList[idx].toggled = !!val;
        updateAll();
        triggerAutosave();
    }
}

function renderGearEffectsList() {
    const container = document.getElementById('gear-effects-list');
    if (!container) return;
    container.innerHTML = gearEffectsList.map((ge, idx) => {
        const isActive = ge.toggled;
        return `
        <div class="prog-row${isActive ? ' cond-active' : ''}">
            <div class="prog-card-header">
                <span class="lvl-tag" style="background:rgba(100,220,255,0.12);color:#80d8ff;border-color:rgba(100,220,255,0.3);">GEAR</span>
                <span style="flex:1;padding:0 8px;font-size:0.8rem;color:#80d8ff;white-space:normal;word-break:break-word;">
                    ${escHtml(ge.name)}${ge.effect ? ' <span style="opacity:0.6;">— ' + escHtml(ge.effect) + '</span>' : ''}
                </span>
                <span class="cond-toggle-wrap" title="Toggle gear effect (display only — never affects eligibility)">
                    <label class="cond-toggle-lbl">
                        <input type="checkbox" class="cond-toggle-input" ${isActive ? 'checked' : ''}
                            onchange="setGearEffectToggle(${idx}, this.checked)">
                        <span class="cond-toggle-track"><span class="cond-toggle-thumb"></span></span>
                    </label>
                    <span class="cond-toggle-hint">⚡</span>
                </span>
                <button onclick="removeGearEffect(${idx})" style="color:rgba(255,80,80,0.8);background:none;border:1px solid rgba(255,0,0,0.3);font-size:0.6rem;padding:2px 7px;cursor:pointer;flex-shrink:0;">✕</button>
            </div>
            <input type="text" class="prog-notes-input" placeholder="NOTES..." value="${escHtml(ge.notes||'')}" oninput="gearEffectsList[${idx}].notes=this.value; triggerAutosave();">
        </div>`;
    }).join('');
}

function _populateGearEffectSkills() {
    const sel = document.getElementById('ge-skill');
    if (!sel || sel.options.length > 0) return;
    skills.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s; opt.textContent = s;
        sel.appendChild(opt);
    });
}

function toggleGearEffectFields() {
    const cat = document.getElementById('ge-category').value;
    document.getElementById('ge-special-fields').style.display = cat === 'special' ? 'flex' : 'none';
    document.getElementById('ge-skill-fields').style.display = cat === 'skill' ? 'flex' : 'none';
    document.getElementById('ge-other-field').style.display = cat === 'other' ? 'block' : 'none';
}

function openGearEffectModal() {
    document.getElementById('gear-effect-modal').style.display = 'flex';
    document.getElementById('ge-name').value = '';
    document.getElementById('ge-category').value = 'special';
    document.getElementById('ge-other-text').value = '';
    document.getElementById('ge-notes').value = '';
    document.getElementById('ge-skill-val').value = 15;
    _populateGearEffectSkills();
    toggleGearEffectFields();
    setTimeout(() => document.getElementById('ge-name').focus(), 50);
}

function closeGearEffectModal() {
    document.getElementById('gear-effect-modal').style.display = 'none';
}

function addGearEffect() {
    const name = document.getElementById('ge-name').value.trim();
    if (!name) return;
    const cat = document.getElementById('ge-category').value;
    let effect = '';
    if (cat === 'special') {
        const stat = document.getElementById('ge-stat').value;
        const val = document.getElementById('ge-stat-val').value;
        effect = `+${val} ${stat}`;
    } else if (cat === 'skill') {
        const skill = document.getElementById('ge-skill').value;
        const val = document.getElementById('ge-skill-val').value;
        effect = `+${val} ${skill}`;
    } else {
        effect = document.getElementById('ge-other-text').value.trim();
    }
    if (!effect) return;
    const notes = document.getElementById('ge-notes').value.trim();
    gearEffectsList.push({ name, effect, notes, toggled: true });
    closeGearEffectModal();
    renderGearEffectsList();
    updateAll();
    triggerAutosave();
}

function removeGearEffect(idx) {
    gearEffectsList.splice(idx, 1);
    renderGearEffectsList();
    updateAll();
    triggerAutosave();
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

function checkTraitEligible(trait, opts) {
    if (!trait.req || trait.req.trim() === '') return true;
    // Defaults read live build state; randomize passes overrides to evaluate against a clean SPECIAAL only
    const chosen = (opts && opts.chosen) ? opts.chosen : getChosenTraitNames().map(n => n.toUpperCase());
    const statOf = (opts && opts.stat) ? opts.stat : (k) => effectiveSpecial(k);
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
            if (statOf(key) >= cap) return false;
            continue;
        }
        // SPECIAL min: STAT N
        const minM = up.match(/^(STR|PER|END|CHR|CHA|INT|AGL|AGI|LCK)\s+(\d+)$/);
        if (minM) {
            const key = TRAIT_STAT_MAP[minM[1]] || minM[1];
            const req = parseInt(minM[2]);
            if (statOf(key) < req) return false;
            continue;
        }
        // (No further checks needed — the NOT branch above already handles exclusion and continues)
    }
    return true;
}

/* ===== TRAIT MODAL ===== */
function openTraitModal(slotId) {
    _traitSlotId = slotId;
    // If this isn't a level-up call, clear the level picker state
    if (slotId !== '__levelup__') {
        const lvlM = /^trait-slot-lvl-(\d+)$/.exec(slotId || '');
        _traitPickerLevel = lvlM ? parseInt(lvlM[1]) : null;
    }
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
    if (srch) {
        srch.value = '';
        // Auto-focus for immediate typing
        setTimeout(() => srch.focus(), 50);
    }
    _traitPickerSort = 'az';
    const azBtn = document.getElementById('tpick-sort-az');
    const reqBtn = document.getElementById('tpick-sort-req');
    if (azBtn) { azBtn.classList.add('active'); }
    if (reqBtn) { reqBtn.classList.remove('active'); }
    syncForceButtons();
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
    syncForceButtons();
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
    beginBonusCache();
    try {
    const container = document.getElementById('trait-modal-grid');
    if (!container) return;
    const q = (search || '').toLowerCase();
    const chosen = getChosenTraitNames();
    const chosenUp = chosen.map(c => c.toUpperCase());

    // Exclude traits that are already taken — they can't be taken again
    let filtered = TRAITS_DATA.filter(t => {
        if (chosenUp.includes(t.name.toUpperCase())) return false;
        if (q) {
            // Use fuzzy search for better matching
            const nameMatch = fuzzyMatch(t.name, q);
            const descMatch = t.desc.toLowerCase().includes(q);
            if (!nameMatch && !descMatch) return false;
        }
        return true;
    });

    // Helper: count how many SPECIAL/skill tokens a trait req has (proxy for complexity)
    function reqWeight(t) {
        if (!t.req) return 0;
        const tokens = t.req.split(',').map(s => s.trim()).filter(Boolean);
        return tokens.length;
    }

    // Pre-compute eligibility once per trait — checkTraitEligible does DOM reads internally
    // (it calls getChosenTraitNames and effectiveSpecial), so caching avoids doing that
    // work O(n) times during sort, O(n) times for the count, and O(n) times for HTML build.
    const natMap = new Map(filtered.map(t => [t.name, checkTraitEligible(t, { chosen: chosenUp })]));
    const eligMap = new Map(filtered.map(t => [t.name, _forceEnable ? true : natMap.get(t.name)]));

    // Sort: eligible group first, then ineligible — within each group apply chosen sort
    filtered = filtered.slice().sort((a, b) => {
        const eligA = eligMap.get(a.name);
        const eligB = eligMap.get(b.name);
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

    // Update count — read from the cached map, no extra DOM work
    const eligible   = filtered.filter(t =>  eligMap.get(t.name));
    const ineligible = filtered.filter(t => !eligMap.get(t.name));
    const forced     = _forceEnable ? filtered.filter(t => !natMap.get(t.name)) : [];
    const countEl = document.getElementById('trait-picker-count');
    if (countEl) countEl.textContent = _forceEnable
        ? `${eligible.length} ELIGIBLE · ${forced.length} FORCED`
        : `${eligible.length} ELIGIBLE · ${ineligible.length} INELIGIBLE · ${chosen.length} TAKEN`;

    container.innerHTML = _traitPickerList.map((t, i) => {
        const isElig = eligMap.get(t.name);
        const isForced = _forceEnable && !natMap.get(t.name);
        const cardCls = isElig ? 'ptrait-card' : 'ptrait-card ptrait-ineligible';
        const badge = isForced
            ? `<span class="ptrait-badge ptrait-forced-badge">⚡ FORCED</span>`
            : isElig
                ? `<span class="ptrait-badge ptrait-elig-badge">✓ ELIGIBLE</span>`
                : `<span class="ptrait-badge ptrait-inelig-badge">REQ NOT MET</span>`;
        const reqText = t.req ? `<div class="pperk-req">${t.req}</div>` : `<div class="pperk-req" style="opacity:0.3;">NO REQUIREMENTS</div>`;
        const btnLabel = isForced ? '⚡ FORCE TAKE' : isElig ? '◈ TAKE THIS TRAIT' : '⚠ REQ NOT MET';
        const cardTitle = isForced ? 'FORCE TAKE (REQ BYPASSED)' : isElig ? 'TAKE TRAIT' : 'REQUIREMENTS NOT MET';
        return `<div class="${cardCls}" onclick="selectTraitByIndex(${i})" title="${cardTitle}">
            <div class="pperk-card-top">
                <span class="ptrait-name">${t.name}</span>
                ${badge}
            </div>
            ${reqText}
            <div class="pperk-desc">${t.desc}</div>
            <button class="ptrait-take-btn">${btnLabel}</button>
        </div>`;
    }).join('') || '<div style="grid-column:1/-1;text-align:center;opacity:0.4;padding:24px;">NO TRAITS FOUND</div>';
    } finally { endBonusCache(); }
}

function selectTraitByIndex(i) {
    const t = _traitPickerList[i];
    if (!t) return;
    if (!_forceEnable && !checkTraitEligible(t)) return;
    selectTraitForSlot(t.name);
}

/* ===== LEVEL-UP TRAIT SLOT HELPERS =====
 * Level-up trait slots exist at LVL 5, 9, 13, ... 49 (12 possible levels) but only
 * a row is rendered once a trait has actually been taken at that level — the list
 * is never pre-populated with empty slots.
 */
const LEVEL_UP_TRAIT_LEVELS = Array.from({ length: 12 }, (_, i) => 5 + i * 4);

function nextOpenLevelUpSlot() {
    for (const lvl of LEVEL_UP_TRAIT_LEVELS) {
        const slotId = 'trait-slot-lvl-' + lvl;
        const row = document.getElementById(slotId);
        if (!row || !(row.getAttribute('data-chosen') || '').trim()) return slotId;
    }
    return null;
}

function ensureTraitSlotRow(slotId) {
    const list = document.getElementById('level-up-traits-list');
    if (!list || document.getElementById(slotId)) return;
    const lvlM = /^trait-slot-lvl-(\d+)$/.exec(slotId || '');
    if (!lvlM) return;
    const lvl = parseInt(lvlM[1]);
    const tmp = document.createElement('div');
    tmp.innerHTML = makeTraitRow(slotId, `LVL ${lvl} TRAIT`, '');
    const row = tmp.firstElementChild;
    // Insert in level order so the list stays chronological
    const existing = Array.from(list.querySelectorAll('.trait-slot-row'));
    let anchor = null;
    for (const r of existing) {
        const m = /^trait-slot-lvl-(\d+)$/.exec(r.id || '');
        if (m && parseInt(m[1]) > lvl) { anchor = r; break; }
    }
    if (anchor) list.insertBefore(row, anchor);
    else list.appendChild(row);
}

function selectTraitForSlot(traitName) {
    // Starting trait mode
    if (_traitSlotId === '__starting__') { addStartingTrait(traitName); return; }
    if (!_traitSlotId) {
        // Called from view-all mode — target the next un-taken level-up slot
        _traitSlotId = nextOpenLevelUpSlot();
        if (!_traitSlotId) { closeTraitModal(); return; }
    }
    ensureTraitSlotRow(_traitSlotId);
    const row = document.getElementById(_traitSlotId);
    if (!row) { closeTraitModal(); return; }
    row.setAttribute('data-chosen', traitName);
    // Rebuild the row in place so conditional traits get their ⚡ toggle rendered
    rerenderTraitSlot(_traitSlotId);
    closeTraitModal();
    updateAll();
    triggerAutosave();
    checkAndOfferTraitPerk(traitName);
}

function clearTraitSlot(slotId) {
    const row = document.getElementById(slotId);
    if (!row) return;
    pushUndoState();   // make clear undoable, consistent with selectTraitForSlot
    const name = (row.getAttribute('data-chosen') || '').trim();
    // Purge any conditional toggle state for the cleared trait
    if (name && conditionalToggles) delete conditionalToggles[name];
    // Rows are only shown for taken traits — clearing removes the row entirely
    row.remove();
    updateAll();       // re-render skills/SPECIAL so trait bonuses are immediately removed
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
    "Ascetic":           "IN COMBAT",
    "Vain":              "> 90% HP",
    "Patriot":           "INT ≤ 4",
    "Boiadero":          "HOLDING CIGS",
    "Clothes Make The Courier": "WEARING CLOTHES",
    "Headless Courier":    "NO HEADGEAR",
    "Gun Guru":          "AT RELOADING BENCH",
    "Hardy":             "HUNGRY",
    "Wolf In Sheep's Clothing": "DISGUISED",
    "Devil's Advocate":  "VERY EVIL",
    "Gallows Humor":     "POST-KILL 30S",
    "(Inexplicable) Feminist Agenda": "TALKING TO WOMEN",
    "Prohibition":       "UNDER ALCOHOL",
    "Atom Bomb Baby":    "ARMORED",
    "Non Ducor, Duco":   "GOOD KARMA",
    "Alertness":                   "CROUCHED & STILL",
    "Irradiated Beauty":           "≥250 RADS",
    "Thirsty":                     "DEHYDRATED",
    "Fight Hungry":                "STARVING",
    "Walker Instinct":             "OUTDOORS",
    "Wasteland Masquerade":        "DISGUISED",
    "My Own Master Now":           "FACTION HATED",
    "Collective Consciousness":    "FACTION LIKED",
    "Avant Apocalypse":            "RAIDER ARMOR",
};

/* ===== CONDITIONAL TOGGLE HTML HELPER =====
 * Generates the ⚡ toggle widget shared by makeTraitRow, renderStartingTraitsList,
 * and renderRewardPerksList. Centralising it means styling/accessibility changes
 * only need to happen in one place.
 *
 * @param {string}  name       - Trait/perk name; embedded in the onchange JS call
 * @param {string}  ctxLabel   - Short scenario label shown next to the toggle (e.g. "OUTDOORS")
 * @param {boolean} isActive   - Whether the toggle is currently checked
 * @param {string}  [extraClass] - Optional extra CSS class on the outer <span>
 *                                 (pass 'trait-row-toggle' from makeTraitRow only)
 */
function makeCondToggleHtml(name, ctxLabel, isActive, extraClass) {
    // Level-parity traits render a read-only live indicator instead of a checkbox.
    const bonus = CONDITIONAL_TOGGLE_BONUSES[name];
    const wrapClass = extraClass ? `cond-toggle-wrap ${extraClass}` : 'cond-toggle-wrap';
    const hintExtra = extraClass ? ` title="${ctxLabel}"` : '';
    if (bonus && bonus.parity) {
        const even = typeof charLevel === 'number' && charLevel % 2 === 0;
        const sideLabel = even ? 'EVEN · SOCIALS' : 'ODD · COMBAT';
        const state = even ? 'ON' : 'OFF';
        return `<span class="${wrapClass}" title="Level-locked (display only — never affects eligibility)">
            <label class="cond-toggle-lbl"><span class="cond-toggle-static">${sideLabel}</span></label>
            <span class="cond-toggle-state ${state === 'ON' ? 'on' : 'off'}">${state}</span>
            <span class="cond-toggle-hint"${hintExtra}>⚡</span>
            <span class="cond-toggle-ctx-label">${ctxLabel}</span>
        </span>`;
    }
    // Karma-driven traits/perks render a read-only indicator locked to the build's
    // karma — the effect auto-applies; there is no manual checkbox.
    if (bonus && bonus.karma) {
        const active = isKarmaActive(bonus.karma);
        const state = active ? 'ON' : 'OFF';
        return `<span class="${wrapClass}" title="Karma-locked (display only — never affects eligibility)">
            <label class="cond-toggle-lbl"><span class="cond-toggle-static">${ctxLabel}</span></label>
            <span class="cond-toggle-state ${state === 'ON' ? 'on' : 'off'}">${state}</span>
            <span class="cond-toggle-hint"${hintExtra}>⚡</span>
            <span class="cond-toggle-ctx-label">KARMA-LOCKED</span>
        </span>`;
    }
    const safeName  = name.replace(/'/g, "\\'");
    // Only the trait-row variant uses an extra title attribute on the hint icon
    return `<span class="${wrapClass}" title="Toggle: ${ctxLabel} (display only — never affects eligibility)">
            <label class="cond-toggle-lbl">
                <input type="checkbox" class="cond-toggle-input" ${isActive ? 'checked' : ''}
                    onchange="setConditionalToggle('${safeName}', this.checked)">
                <span class="cond-toggle-track"><span class="cond-toggle-thumb"></span></span>
            </label>
            <span class="cond-toggle-state ${isActive ? 'on' : 'off'}">${isActive ? 'ON' : 'OFF'}</span>
            <span class="cond-toggle-hint"${hintExtra}>⚡</span>
            <span class="cond-toggle-ctx-label">${ctxLabel}</span>
        </span>`;
}

/* ===== TRAIT ROW BUILDER ===== */
function makeTraitRow(slotId, levelLabel, chosenName) {
    const name = chosenName || '';
    const displayName = name || 'NONE SELECTED';
    const clearDisplay = name ? 'inline-block' : 'none';
    const btnLabel = name ? 'CHANGE' : 'SELECT';
    const isConditional = name && TRAIT_CONDITIONAL_NAMES.has(name);
    const isActive = isConditional && isConditionalActive(name);
    const ctxLabel = isConditional ? (COND_TOGGLE_LABELS[name] || 'ACTIVE') : '';

    const toggleHtml = isConditional ? makeCondToggleHtml(name, ctxLabel, isActive, 'trait-row-toggle') : '';

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

/* ===== LEVEL-UP TRAIT SLOT RE-RENDER =====
 * Rebuilds a single level-up trait slot row in place so a conditional trait's
 * ⚡ toggle appears immediately after it is chosen, cleared, or restored from
 * a saved build. Conditional bonuses are display-only and never affect
 * perk/trait eligibility (see effectiveSpecial / skillBaseForEligibility).
 */
function rerenderTraitSlot(slotId) {
    const row = document.getElementById(slotId);
    if (!row) return;
    const name = (row.getAttribute('data-chosen') || '').trim();
    const lvlM = /^trait-slot-lvl-(\d+)$/.exec(slotId || '');
    const lvlLabel = lvlM ? `LVL ${lvlM[1]} TRAIT` : '';
    row.outerHTML = makeTraitRow(slotId, lvlLabel, name);
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
    const srch = document.getElementById('implant-modal-search');
    if (srch) {
        srch.value = '';
        // Auto-focus for immediate typing
        setTimeout(() => srch.focus(), 50);
    }
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
                <div class="trait-card-desc">${imp.desc}</div>
                <div class="trait-req" style="color:#888;margin-top:4px;font-size:0.58rem;">${imp.how}</div>
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

    // Pre-compute row totals
    const totals = {};
    skills.forEach(s => { totals[s] = 0; });
    skillHistory.forEach(e => { skills.forEach(s => { totals[s] += (e.gains[s] || 0); }); });

    // Final skill values
    const finals = {};
    skills.forEach(s => { finals[s] = skillTotal(s); });

    // Tags as of most recent level
    const activeTags = new Set(skillHistory[skillHistory.length - 1]?.tagged || []);

    const totalPtsSpent = skillHistory.reduce((sum, e) =>
        sum + Object.values(e.allocation).reduce((a, b) => a + b, 0), 0);
    const ppl = skillHistory[0]?.pointsTotal ?? 0;

    // Summary bar
    let html = `<div class="skilllog-summary">
        <span>LEVELS: <b>${skillHistory.length}</b></span>
        <span>PTS SPENT: <b>${totalPtsSpent}</b></span>
        <span>PTS/LVL: <b>${ppl}</b></span>
        <span class="skilllog-legend"><span class="skilllog-legend-tagged">★</span> = tagged &nbsp; <span class="skilllog-legend-val">num</span> = final skill value</span>
    </div>`;

    // Table
    html += `<div class="skilllog-scroll"><table class="skilllog-table"><thead><tr>
        <th class="skilllog-th-skill">SKILL</th>
        ${skillHistory.map(e => `<th class="skilllog-th-lvl" title="Budget: ${e.pointsTotal} pts/lvl">LV${e.level}</th>`).join('')}
        <th class="skilllog-th-total">TOTAL</th>
        <th class="skilllog-th-final">FINAL</th>
    </tr></thead><tbody>`;

    // Rows — tagged first, then untagged (ALL skills shown, even with zero investment)
    const taggedSkills   = skills.filter(s =>  activeTags.has(s));
    const untaggedSkills = skills.filter(s => !activeTags.has(s));

    const renderRow = (s) => {
        const isTagged = activeTags.has(s);
        let rowTotal = 0;
        const cells = skillHistory.map(entry => {
            const gain = entry.gains[s] || 0;
            const wasTagged = entry.tagged && entry.tagged.includes(s);
            rowTotal += gain;
            if (gain === 0) return `<td class="skilllog-cell skilllog-zero">—</td>`;
            // Heat bar: intensity scales with share of that level's point budget spent
            const heat = Math.min(1, gain / Math.max(1, entry.pointsTotal || 1));
            return `<td class="skilllog-cell skilllog-gain${wasTagged ? ' skilllog-tagged' : ''}" style="--heat:${heat.toFixed(2)}" title="${wasTagged ? '★ Tagged — 2 pts gained per 1 spent' : `+${gain} pts`}">+${gain}${wasTagged ? '<span class="skilllog-star">★</span>' : ''}</td>`;
        }).join('');
        const tagMark = isTagged ? '<span class="skilllog-name-star">★</span>' : '';
        return `<tr class="skilllog-row${isTagged ? ' skilllog-row-tagged' : ''}">
            <td class="skilllog-skill-name">${tagMark}${s}</td>
            ${cells}
            <td class="skilllog-total-cell">${rowTotal > 0 ? '+'+rowTotal : '—'}</td>
            <td class="skilllog-final-cell">${finals[s]}</td>
        </tr>`;
    };

    if (taggedSkills.length) {
        html += `<tr class="skilllog-section-row"><td colspan="${skillHistory.length + 3}" class="skilllog-section-label">★ TAGGED SKILLS</td></tr>`;
        taggedSkills.forEach(s => { html += renderRow(s); });
    }
    if (untaggedSkills.length) {
        html += `<tr class="skilllog-section-row"><td colspan="${skillHistory.length + 3}" class="skilllog-section-label">UNTAGGED SKILLS</td></tr>`;
        untaggedSkills.forEach(s => { html += renderRow(s); });
    }

    // Budget footer row
    html += `<tr class="skilllog-pts-row">
        <td class="skilllog-skill-name skilllog-budget-label">PTS BUDGET</td>
        ${skillHistory.map(e => `<td class="skilllog-cell skilllog-budget-cell">${e.pointsTotal}</td>`).join('')}
        <td colspan="2" class="skilllog-budget-total">${totalPtsSpent} spent</td>
    </tr>`;

    html += `</tbody></table></div>`;
    html += `<div class="skilllog-footnote">★ = tagged skill (1 pt spent = 2 pts gained) &nbsp;·&nbsp; FINAL = current skill value including base + all bonuses</div>`;

    wrap.innerHTML = html;
}

/* ===== STARTING TRAITS ===== */
function renderStartingTraitsList() {
    const container = document.getElementById('starting-traits-list');
    if (!container) return;
    const locked = isTraitsLocked();
    const addBtn = document.querySelector('.cs-start-trait-btn');
    if (addBtn) {
        if (locked) {
            addBtn.style.opacity = '0.3';
            addBtn.style.pointerEvents = 'none';
            addBtn.title = 'LOCKED AFTER FIRST LEVEL-UP';
        } else {
            addBtn.style.opacity = '';
            addBtn.style.pointerEvents = '';
            addBtn.title = 'ADD STARTING TRAIT';
        }
    }
    const progAddBtn = document.querySelector('.psbtn-trait');
    if (progAddBtn) {
        if (locked) { progAddBtn.disabled = true; progAddBtn.style.opacity = '0.3'; progAddBtn.title = 'LOCKED AFTER FIRST LEVEL-UP'; }
        else { progAddBtn.disabled = false; progAddBtn.style.opacity = ''; progAddBtn.title = ''; }
    }
    if (startingTraits.length === 0) {
        container.innerHTML = '<div style="font-size:0.58rem; opacity:0.3; padding:6px 0; letter-spacing:1px;">NO STARTING TRAITS SELECTED</div>';
        return;
    }
    container.innerHTML = startingTraits.map((t, idx) => {
        const isConditional = TRAIT_CONDITIONAL_NAMES.has(t.name);
        const isActive = isConditional && isConditionalActive(t.name);
        const ctxLabel = isConditional ? (COND_TOGGLE_LABELS[t.name] || 'ACTIVE') : '';
        const toggleHtml = isConditional ? makeCondToggleHtml(t.name, ctxLabel, isActive) : '';
        return `
        <div class="st-tag-chip ${isActive ? 'cond-active' : ''} ${locked ? 'creation-locked' : ''}">
            <span class="st-tag-name" onclick="openTraitDetailModal('${t.name}', {type:'starting', idx:${idx}})" style="cursor:pointer;">${t.name}${isConditional ? ' <span class="cond-icon">⚡</span>' : ''}</span>
            ${toggleHtml}
            <button class="st-tag-detail-btn" onclick="openTraitDetailModal('${t.name}', {type:'starting', idx:${idx}})" title="View / Remove">?</button>
            ${locked ? '' : `<button class="st-tag-remove" onclick="removeStartingTrait(${idx})" title="Remove trait">✕</button>`}
        </div>`;
    }).join('');
}

function addStartingTrait(name) {
    if (isTraitsLocked()) { closeTraitModal(); showToast('STARTING TRAITS CANNOT CHANGE.', 3200); return; }
    if (startingTraits.some(t => t.name === name)) { closeTraitModal(); return; }
    startingTraits.push({ name });
    renderStartingTraitsList();
    updateAll();
    closeTraitModal();
    triggerAutosave();
    checkAndOfferTraitPerk(name);
}

function removeStartingTrait(idx) {
    if (isTraitsLocked()) { showToast('STARTING TRAITS CANNOT CHANGE.', 3200); return; }
    const name = startingTraits[idx] && startingTraits[idx].name;
    if (name) delete conditionalToggles[name];
    startingTraits.splice(idx, 1);
    renderStartingTraitsList();
    updateAll();
    triggerAutosave();
}

function openStartingTraitModal() {
    if (isTraitsLocked()) { showToast('STARTING TRAITS CANNOT CHANGE.', 3200); return; }
    _traitSlotId = '__starting__';
    syncForceButtons();
    document.getElementById('trait-modal').style.display = 'flex';
    const srch = document.getElementById('trait-modal-search');
    if (srch) {
        srch.value = '';
        // Auto-focus for immediate typing
        setTimeout(() => srch.focus(), 50);
    }
    renderTraitGrid('');
}

/* ===== REWARD PERKS ===== */
function renderRewardPerksList() {
    const container = document.getElementById('reward-perks-list');
    if (!container) return;
    container.innerHTML = rewardPerksList.map((rp, idx) => {
        const isCond = typeof REWARD_PERK_CONDITIONAL_NAMES !== 'undefined' && REWARD_PERK_CONDITIONAL_NAMES.has(rp.name);
        const isActive = isCond && isConditionalActive(rp.name);
        const ctxLabel = isCond ? (COND_TOGGLE_LABELS[rp.name] || 'ACTIVE') : '';

        const toggleHtml = isCond ? makeCondToggleHtml(rp.name, ctxLabel, isActive) : '';

        return `
        <div class="prog-row${isActive ? ' cond-active' : ''}">
            <div class="prog-card-header">
                <span class="lvl-tag" style="background:rgba(255,180,50,0.15);color:#ffd080;border-color:rgba(255,180,50,0.3);">REWARD</span>
                <span style="flex:1;padding:0 8px;font-size:0.8rem;color:#ffd080;white-space:normal;word-break:break-word;">${rp.name}</span>
                ${toggleHtml}
                <button onclick="removeRewardPerk(${idx})" style="color:rgba(255,80,80,0.8);background:none;border:1px solid rgba(255,0,0,0.3);font-size:0.6rem;padding:2px 7px;cursor:pointer;flex-shrink:0;">✕</button>
            </div>
            <input type="text" class="prog-notes-input" placeholder="NOTES..." value="${escHtml(rp.notes||'')}" oninput="rewardPerksList[${idx}].notes=this.value; triggerAutosave();">
        </div>`;
    }).join('');
}

function openRewardPerkSearch() {
    document.getElementById('reward-perk-modal').style.display = 'flex';
    const srch = document.getElementById('reward-perk-search');
    if (srch) {
        srch.value = '';
        // Auto-focus for immediate typing
        setTimeout(() => srch.focus(), 50);
    }
    renderRewardPerkGrid('');
}

function closeRewardPerkModal() {
    document.getElementById('reward-perk-modal').style.display = 'none';
}

function renderRewardPerkGrid(search) {
    const container = document.getElementById('reward-perk-modal-grid');
    const q = (search || '').toLowerCase();
    const filtered = REWARD_PERKS_DATA.filter(p =>
        !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q) || (p.how||'').toLowerCase().includes(q)
    );
    container.innerHTML = filtered.map(p => {
        const isAutumn = p.how === 'AUTUMN LEAVES';
        const sourceBadge = p.how
            ? `<span class="rp-source-badge">${isAutumn ? '🍂 AUTUMN LEAVES' : p.how}</span>`
            : '';
        const isCond = typeof REWARD_PERK_CONDITIONAL_NAMES !== 'undefined' && REWARD_PERK_CONDITIONAL_NAMES.has(p.name);
        const condBadge = isCond
            ? `<span class="rp-cond-badge">⚡ CONDITIONAL</span>`
            : '';
        return `<div class="ptrait-card ptrait-card-gold" onclick="addRewardPerk('${p.name.replace(/'/g,"\\'")}')">
            <div class="pperk-card-top">
                <span class="rp-name">${p.name}</span>
                ${condBadge}
            </div>
            ${sourceBadge ? `<div style="margin-bottom:4px;">${sourceBadge}</div>` : ''}
            <div class="pperk-desc">${p.desc}</div>
            <button class="rp-add-btn">+ ADD TO BUILD</button>
        </div>`;
    }).join('') || '<div style="text-align:center;opacity:0.4;padding:24px;font-size:0.7rem;">NO REWARD PERKS FOUND</div>';
}

function addRewardPerk(name) {
    rewardPerksList.push({ name, notes: '' });
    closeRewardPerkModal();
    renderRewardPerksList();
    triggerAutosave();
}

function removeRewardPerk(idx) {
    const name = rewardPerksList[idx] && rewardPerksList[idx].name;
    if (name) delete conditionalToggles[name];
    rewardPerksList.splice(idx, 1);
    renderRewardPerksList();
    updateAll();
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
            <input type="text" class="prog-notes-input" placeholder="NOTES..." value="${escHtml(it.notes||'')}" oninput="internalizedTraitsList[${idx}].notes=this.value; triggerAutosave();">
        </div>`).join('');
}

function openInternalizedModal() {
    document.getElementById('internalized-modal').style.display = 'flex';
    const srch = document.getElementById('internalized-search');
    if (srch) {
        srch.value = '';
        // Auto-focus for immediate typing
        setTimeout(() => srch.focus(), 50);
    }
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
        return `<div class="ptrait-card ptrait-card-purple" onclick="addInternalizedTrait('${t.name.replace(/'/g,"\\'")}')">
            <div class="pperk-card-top">
                <span class="it-name">${t.name}</span>
            </div>
            <div class="pperk-req">${t.req}</div>
            <div class="pperk-desc">${t.desc}</div>
            <button class="it-add-btn">+ ADD TO BUILD</button>
        </div>`;
    }).join('') || '<div style="text-align:center;opacity:0.4;padding:24px;font-size:0.7rem;">NO INTERNALIZED TRAITS FOUND</div>';
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

/**
 * HTML-encodes a string for safe injection into HTML attributes or text nodes.
 * Use this whenever a user-supplied value is interpolated into innerHTML
 * (especially inside attribute values like value="...").
 * sanitizeStr() strips scripts from imported data; escHtml() makes rendered
 * strings safe for attribute context at display time — they serve different purposes.
 */
function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeImport(d) {
    if (!d || typeof d !== 'object') return null;
    const clean = {};
    clean.name = sanitizeStr(d.name || '');
    clean.notes = sanitizeStr(d.notes || '');
    clean.mode = 'std';
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
    clean.gearEffectsList = Array.isArray(d.gearEffectsList) ? d.gearEffectsList.slice(0, 200).map(ge =>
        (ge && typeof ge === 'object')
            ? { name: sanitizeStr(ge.name || ''), effect: sanitizeStr(ge.effect || ''), notes: sanitizeStr(ge.notes || ''), toggled: ge.toggled !== false }
            : { name: '', effect: '', notes: '', toggled: true }
    ).filter(ge => ge.name && ge.effect) : [];
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
    if (d.skillBooksFound?.CW && typeof d.skillBooksFound.CW === 'object') {
        // New per-origin format (arrays of indices or legacy flat counts)
        clean.skillBooksFound.CW = {};
        clean.skillBooksFound.MW = {};
        skills.forEach(s => {
            const cw = d.skillBooksFound.CW[s];
            const mw = d.skillBooksFound.MW[s];
            if (Array.isArray(cw)) {
                clean.skillBooksFound.CW[s] = cw.filter(i => typeof i === 'number' && i >= 0);
            } else if (typeof cw === 'number' && cw >= 0) {
                clean.skillBooksFound.CW[s] = cw;
            } else {
                clean.skillBooksFound.CW[s] = 0;
            }
            if (Array.isArray(mw)) {
                clean.skillBooksFound.MW[s] = mw.filter(i => typeof i === 'number' && i >= 0);
            } else if (typeof mw === 'number' && mw >= 0) {
                clean.skillBooksFound.MW[s] = mw;
            } else {
                clean.skillBooksFound.MW[s] = 0;
            }
        });
    } else {
        // Old flat format — preserve for hydrate to migrate
        skills.forEach(s => {
            const v = parseInt(d.skillBooksFound?.[s]);
            clean.skillBooksFound[s] = (!isNaN(v) && v >= 0) ? v : 0;
        });
    }
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
        ? Object.fromEntries(Object.entries(d.conditionalToggles).filter(([k,v]) => typeof k === 'string' && typeof v === 'boolean' && !isKarmaDrivenConditional(k)))
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
    clean.companions = Array.isArray(d.companions)
        ? d.companions.slice(0, 18).map(c => ({
            name: sanitizeStr(c && typeof c === 'object' ? c.name : ''),
            butchBonus: (c && (c.butchBonus === 'improved' || c.butchBonus === 'worsened')) ? c.butchBonus : null
        })).filter(c => COMPANIONS_DATA.some(x => x.name === c.name))
        : [];
    return clean;
}

/* ===== TAB CONTROLLER ===== */
const MORE_TABS = ['coll', 'uni', 'books', 'skilllog'];

function showTab(t) {
    const tabEl = document.getElementById('tab-' + t);
    if (!tabEl) return;
    document.querySelectorAll('.tab-content').forEach(c => c.style.display='none');
    document.querySelectorAll('.tab-nav button').forEach(b => b.classList.remove('active'));
    tabEl.style.display='block';
    const tabBtn = document.getElementById('tab-btn-' + t);
    if (tabBtn) tabBtn.classList.add('active');
    // Close mobile MORE sheet if a tab was chosen from it
    const moreSheet = document.getElementById('mobile-more-sheet');
    if (moreSheet) moreSheet.style.display = 'none';
    // Sync mobile bottom nav
    document.querySelectorAll('.mobile-nav-btn').forEach(b => {
        b.classList.toggle('mobile-nav-active', b.dataset.tab === t);
    });
    // Tabs without a bottom-nav button are represented by the MORE button
    if (MORE_TABS.includes(t)) {
        const moreBtn = document.getElementById('mobile-more-btn');
        if (moreBtn) moreBtn.classList.add('mobile-nav-active');
    }
    
    // Defer heavy renders to next frame for smooth tab switching
    if (t === 'perks') {
        requestAnimationFrame(() => renderAllPerks());
    } else if (t === 'skilllog') {
        requestAnimationFrame(() => renderSkillLog());
    } else if (t === 'prog') {
        requestAnimationFrame(() => renderImplants());
    } else if (t === 'books') {
        requestAnimationFrame(() => renderBooksTab());
    } else if (t === 'uni') {
        requestAnimationFrame(() => applyUniquesVisibility());
    }
    
    nsAudio.click();
}

/* Mobile MORE sheet — exposes tabs that don't fit in the bottom nav */
function toggleMobileMore() {
    const sheet = document.getElementById('mobile-more-sheet');
    if (!sheet) return;
    sheet.style.display = sheet.style.display === 'none' ? 'flex' : 'none';
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

function toggleSkillBook(skill, index) {
    const arr = skillBooksFound[origin][skill];
    if (!arr) return;
    const pos = arr.indexOf(index);
    if (pos >= 0) {
        arr.splice(pos, 1);
    } else {
        arr.push(index);
    }
    renderBooksTab();
    updateAll();
    triggerAutosave();
}

const BOOK_EMOJIS = {
    BARTER: '💰', 'BIG GUNS': '💥', 'ENERGY WEAPONS': '⚡',
    EXPLOSIVES: '💣', GUNS: '🔫', LOCKPICK: '🔓',
    MEDICINE: '💊', 'MELEE WEAPONS': '⚔️', REPAIR: '🔧',
    SCIENCE: '🔬', SNEAK: '🥷', SPEECH: '💬',
    SURVIVAL: '🏕️', UNARMED: '👊'
};

function renderBooksTab() {
    const el = document.getElementById('tab-books');
    if (!el) return;
    const books = getSkillBooksForOrigin();
    const ideologue = hasIdeologue();
    const ptsEach = ideologue ? 3 : 2;
    const totalFound = skills.reduce((acc, s) => acc + (skillBooksFound[origin]?.[s]?.length || 0), 0);
    const totalMax = books.reduce((acc, b) => acc + b.count, 0);
    if (!books.length) {
        el.innerHTML = `<div class="books-empty">No skill book data available for this wasteland yet.</div>`;
        return;
    }
    // Preserve collapse state before re-render
    const collapseState = {};
    books.forEach(b => {
        const safe = b.skill.replace(/[\s&]+/g, '-').toLowerCase();
        const grid = document.querySelector(`.grid-tidy[data-category="book-${safe}"]`);
        if (grid) collapseState[safe] = grid.style.display === 'none';
    });
    el.innerHTML = `
    <div class="books-header">
        <div class="books-title">📚 SKILL BOOKS — ${origin === 'CW' ? 'CAPITAL WASTELAND' : 'MOJAVE WASTELAND'}</div>
        <div class="books-sub">EACH BOOK FOUND GRANTS <b>+2 PTS</b> TO ITS SKILL &nbsp;|&nbsp; <b>+3 PTS</b> WITH THE <b>IDEOLOGUE</b> TRAIT${ideologue ? ' <span class="books-ideologue-active">✦ IDEOLOGUE ACTIVE — +3 PER BOOK</span>' : ''}</div>
        <div class="books-count">${totalFound} / ${totalMax} BOOKS FOUND</div>
        <button class="uni-toggle-all-btn" onclick="toggleAllInContainer('books-checklist',this)">▼ COLLAPSE ALL</button>
    </div>
    <div class="books-checklist" id="books-checklist">
    ${books.map(b => {
        const arr = skillBooksFound[origin]?.[b.skill] || [];
        const safe = b.skill.replace(/[\s&]+/g, '-').toLowerCase();
        const total = b.copies.length;
        const foundCount = arr.length;
        return `<div class="book-section">
            <div class="header-row" id="h-book-${safe}" onclick="toggleCollapse('book-${safe}')">
                <h2>${BOOK_EMOJIS[b.skill] || '📖'} ${b.name} <span class="book-section-skill-inline">— ${b.skill}</span></h2>
                <span class="cat-pct" id="pct-book-${safe}">${foundCount} / ${total}</span>
            </div>
            <div class="grid-tidy" data-category="book-${safe}">
            ${b.copies.map((c, i) => {
                const found = arr.includes(i);
                return `<div class="book-copy-item ${found ? 'book-copy-found' : ''}" onclick="toggleSkillBook('${b.skill}',${i})">
                    <span class="tag-marker">${found ? '[X]' : '[ ]'}</span>
                    <span class="book-copy-location">${c.location}</span>
                    <span class="book-copy-detail">${c.detail}</span>
                </div>`;
            }).join('')}
            </div>
        </div>`;
    }).join('')}
    </div>`;
    // Restore collapse state
    Object.keys(collapseState).forEach(safe => {
        if (!collapseState[safe]) return;
        const grid = document.querySelector(`.grid-tidy[data-category="book-${safe}"]`);
        if (grid) grid.style.display = 'none';
    });
    // Update completion state for each book section
    books.forEach(b => {
        calcCatBook(b.skill);
    });
}


/* ===== MODE & ORIGIN TOGGLES ===== */
function setMode(m, skipSave=false) {
    const prevPerks = Array.from(document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)')).map(r => [
        r.querySelector('.prog-name-input')?.value || '',
        r.querySelector('.prog-notes-input')?.value || ''
    ]);
    mode = m;
    const addBtn = document.querySelector('.cs-start-trait-btn');
    if (addBtn) addBtn.style.opacity = '';
    renderStartingTraitsList();
    renderProgression();
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
    document.getElementById('btn-cw').classList.toggle('active', o==='CW');
    document.getElementById('btn-mw').classList.toggle('active', o==='MW');
    renderQuests();
    renderCollectibles();
    renderBooksTab();
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
    if (!grid) return;
    const showDisplay = id.startsWith('book-') ? 'flex' : 'grid';
    grid.style.display = (grid.style.display === 'none') ? showDisplay : 'none';
}

function toggleAllInContainer(cId,btn){
    const gs=document.querySelectorAll('#'+cId+' .grid-tidy');
    if(!gs.length)return;
    const vis=Array.from(gs).some(g=>g.style.display!=='none');
    gs.forEach(g=>{
        const showDisplay = g.dataset.category?.startsWith('book-') ? 'flex' : 'grid';
        g.style.display=vis?'none':showDisplay;
    });
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

/* --- UNIQUES FILTER --- */
let uniFilter = 'ALL';

function setUniquesFilter(tag) {
    uniFilter = tag;
    document.querySelectorAll('#uni-filter-bar .uni-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tag === tag);
    });
    applyUniquesVisibility();
}

function applyUniquesVisibility() {
    const wpnQuery = (document.getElementById('uni-search-bar').value || '').toUpperCase();
    const armQuery = (document.getElementById('uni-armor-search-bar').value || '').toUpperCase();
    const containers = ['unique-weapon-checklist', 'unique-armor-checklist'];
    containers.forEach(containerId => {
        const items = document.querySelectorAll(`#${containerId} .grid-item`);
        const isArmor = containerId === 'unique-armor-checklist';
        const query = isArmor ? armQuery : wpnQuery;
        items.forEach(item => {
            const text = item.innerText.toUpperCase();
            const hasTag = uniFilter === 'ALL' || text.includes(`[${uniFilter}]`);
            const matchesSearch = !query || text.includes(query);
            item.style.display = (hasTag && matchesSearch) ? 'flex' : 'none';
        });
        const activeFilter = uniFilter !== 'ALL';
        document.querySelectorAll(`#${containerId} .grid-tidy`).forEach(grid => {
            const visibleCount = Array.from(grid.querySelectorAll('.grid-item')).filter(i => i.style.display !== 'none').length;
            const categoryId = grid.getAttribute('data-category');
            const header = document.getElementById(`h-${categoryId}`);
            if (!activeFilter && query === '') {
                // No filter or search active - let collapse/expand state manage grids
                header.style.display = 'flex';
                return;
            }
            if (visibleCount > 0) { grid.style.display = 'grid'; header.style.display = 'flex'; }
            else { grid.style.display = 'none'; header.style.display = 'none'; }
        });
    });
}

function searchUniques() { applyUniquesVisibility(); }

/* ===== ALL PERKS TAB: SORT & RENDER ===== */
function getPerkLevel(perk) {
    const m = perk.req.match(/Level\s+(\d+)/i);
    return m ? parseInt(m[1]) : 0;
}

function getPerkSPECIAL(perk) {
    const order = ['STR','PER','END','CHA','INT','AGI','LCK'];
    const m = perk.req.match(/\b(STR|PER|END|CHR|INT|AGL|LCK)\b/);
    if (!m) return 99;
    const key = REQ_STAT_MAP[m[1].toUpperCase()];
    return key ? order.indexOf(key) : 99;
}

function setSort(s) {
    currentSort = s;
    document.querySelectorAll('.sort-btn').forEach(b => {
        if (b.id === 'force-main-perks') return;
        b.classList.remove('active');
    });
    document.getElementById('sort-'+s).classList.add('active');
    renderAllPerks();
}

function toggleEligibleFilter() {
    showEligibleOnly = !showEligibleOnly;
    document.getElementById('toggle-eligible').classList.toggle('active', showEligibleOnly);
    renderAllPerks();
}

let _perkSearchTimer = null;
function searchPerks() {
    clearTimeout(_perkSearchTimer);
    _perkSearchTimer = setTimeout(renderAllPerks, 150);
}

/* Debounced search wrappers for the modal pickers — grid rebuilds and eligibility
 * recomputation only run after typing settles (mirrors searchPerks' 150ms pattern). */
function debounceSearch(fn, ms) {
    let t = null;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms || 150);
    };
}
const searchTraits       = debounceSearch((v) => renderTraitGrid(v));
const searchPerkPicker   = debounceSearch(() => renderPerkPickerGrid());
const searchRewardPerks  = debounceSearch((v) => renderRewardPerkGrid(v));
const searchInternalized = debounceSearch((v) => renderInternalizedGrid(v));
const searchImplants     = debounceSearch((v) => renderImplantModalGrid(v));
const searchCompanions   = debounceSearch(() => renderCompanionModal());

function renderAllPerks() {
    beginBonusCache();
    try {
        const query = (document.getElementById('perk-search-bar')?.value || '').toUpperCase().trim();
        let perks = PERKS_DATA.filter(p =>
            !query || p.name.toUpperCase().includes(query) || p.req.toUpperCase().includes(query) || p.desc.toUpperCase().includes(query)
        );

        if (showEligibleOnly && !_forceEnable) perks = perks.filter(p => meetsRequirements(p));

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
    } finally { endBonusCache(); }
}

function buildPerkCard(p) {
    const eligible = _forceEnable || meetsRequirements(p);
    const forced = _forceEnable && !meetsRequirements(p);
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
            ${forced ? '<span class="perk-eligible-badge pperk-forced-tag">⚡ FORCED</span>' : (eligible ? '<span class="perk-eligible-badge">✓ ELIGIBLE</span>' : '')}
        </div>
        <div class="perk-req">REQ: ${p.req}</div>
        ${!forced && !eligible && missingLines.length ? `<div class="perk-missing">${missingLines.map(l=>`<span>${l}</span>`).join('')}</div>` : ''}
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
    if (_pd && !_forceEnable && !meetsRequirements(_pd)) { showPerkBlockedToast(name, 'REQUIREMENTS NOT MET'); return; }
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
        toast.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;background:var(--pip-bg-2);border:1px solid var(--pip-color);color:var(--pip-color);padding:10px 18px;font-size:0.7rem;font-family:var(--font-main);letter-spacing:1px;box-shadow:0 0 20px rgba(var(--pip-rgb),0.2);transition:opacity 0.4s;opacity:0;pointer-events:none;text-transform:uppercase;';
        document.body.appendChild(toast);
    }
    return toast;
}

function showPerkToastMsg(message) {
    const toast = _getPerkToast();
    toast.style.color = '';
    toast.style.borderColor = '';
    toast.textContent = '✓ ' + message;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2200);
}

function showPerkToast(name) {
    showPerkToastMsg('PERK ADDED: ' + name);
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
    if (getSpecialRemaining() > 0) {
        // Flash the SPECIAL section to guide user
        const spArea = document.getElementById('collapsible-special');
        if (spArea) {
            spArea.style.outline = '2px solid var(--danger-red)';
            setTimeout(() => spArea.style.outline = '', 1500);
        }
        const nb = document.getElementById('lvlup-not-ready');
        if (nb) nb.textContent = '⚠ ALLOCATE ALL S.P.E.C.I.A.L. POINTS BEFORE LEVELING UP';
        nb.style.display = 'block';
        return;
    }
    document.getElementById('lvlup-not-ready').style.display = 'none';
    document.getElementById('lvlup-not-ready').textContent = '⚠ SELECT 3 TAGS TO UNLOCK';
    _lvlupSession = {};
    _lvlupAttributeChoice = null; // Reset attribute choice
    skills.forEach(s => { _lvlupSession[s] = 0; });
    _lvlupPointsLeft = pointsPerLevel(charLevel + 1);
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
        showAlertDialog({ title: 'INVALID LEVEL', message: 'Invalid level selected. Choose a level below your current level to roll back to.' });
        return;
    }
    
    // Remove perks gained after target level
    const allProgRows = document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)');
    allProgRows.forEach(row => {
        const lvlTag = row.querySelector('.lvl-tag');
        if (lvlTag) {
            const rowLevel = parseInt(lvlTag.textContent.match(/\d+/)?.[0] || '0');
            if (rowLevel > targetLevel) {
                // Clear the row — clearProgRow reverts any Intense Training SPECIAL gains
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
    showPerkToastMsg(`ROLLED BACK TO LEVEL ${targetLevel}`);
}

function renderLevelUpGrid() {
    const tagged = getLevelUpTaggedSkills();
    const spent = Object.values(_lvlupSession).reduce((a,b)=>a+b,0);
    _lvlupPointsLeft = pointsPerLevel(charLevel + 1) - spent;

    document.getElementById('lvlup-level-from').textContent = charLevel;
    document.getElementById('lvlup-level-to').textContent = charLevel + 1;
    document.getElementById('lvlup-pts-left').textContent = _lvlupPointsLeft;
    document.getElementById('lvlup-pts-total').textContent = pointsPerLevel(charLevel + 1);

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
    const isTagged = getLevelUpTaggedSkills().has(skill);
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
    _lvlupPointsLeft = pointsPerLevel(charLevel + 1) - spent;
    renderLevelUpGrid();
}

function confirmLevelUp() {
    // Validate attribute choice
    if (!_lvlupAttributeChoice) {
        showAlertDialog({ title: 'ATTR BOOST REQUIRED', message: 'Please select an attribute boost (Health, Action Points, or Carry Weight) before confirming this level up.' });
        return;
    }
    
    const tagged = getLevelUpTaggedSkills();
    const gains = {};
    const _bonusForLevelUp = getCachedBonuses();
    const traitBonuses = _bonusForLevelUp.trait ? _bonusForLevelUp.trait.skillDelta : {};
    const perkBonuses = _bonusForLevelUp.perk ? _bonusForLevelUp.perk.perkSkillDelta : {};
    const condBonuses = _bonusForLevelUp.cond ? _bonusForLevelUp.cond.skillDelta : {};
    const condParityBonus = _bonusForLevelUp.cond ? _bonusForLevelUp.cond.paritySkillDelta : {};
    const gearBonuses = getGearEffectsDelta().skillDelta;
    skills.forEach(s => {
        const pts = _lvlupSession[s] || 0;
        const gain = tagged.has(s) ? pts * 2 : pts; // tagged: 1 spent = 2 gained
        // Hard cap: total skill must never exceed 100.
        // Account for ALL external modifiers (trait/perk/conditional/gear/book) so
        // spent points are never silently discarded and rollback stays accurate.
        // Level-parity swings (Polar Personality) are display-only and are kept OUT
        // of the cap so the ledger is identical on both sides of the split.
        const condNet = (condBonuses[s] || 0) - (condParityBonus[s] || 0);
        const totalDelta = (traitBonuses[s] || 0) + (perkBonuses[s] || 0) + condNet + (gearBonuses[s] || 0) + bookBonus(s);
        const maxPts = 100 - skillBase(s) - totalDelta;
        const prev = skillPoints[s] || 0;
        const allowed = Math.max(0, maxPts);
        skillPoints[s] = Math.min(prev + gain, allowed);
        // Record the ACTUAL gain applied (post-cap) for the Skill Log / rollback
        gains[s] = Math.max(0, skillPoints[s] - prev);
    });
    // Record this level's allocation for the Skill Log
    skillHistory.push({
        level: charLevel + 1,
        allocation: Object.assign({}, _lvlupSession),
        gains: gains,
        tagged: Array.from(tagged),
        pointsTotal: pointsPerLevel(charLevel + 1)
    });
    
    // Store the attribute choice for this level
    levelUpBonuses[charLevel - 1] = _lvlupAttributeChoice; // charLevel is still at current level (will increment next)
    
    charLevel++;
    closeLevelUpModal();
    updateAll();
    reCheckAllPerkRows();
    triggerAutosave();
    // Check if new level grants a perk and prompt
    const newLvl = charLevel;
    let isPerkLevel;
    if (hasBeenHumbled && humbledLevel > 0 && newLvl < humbledLevel) {
        isPerkLevel = newLvl % 4 === 0;
    } else {
        isPerkLevel = newLvl % 2 === 0;
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
    if (e.target === document.getElementById('gear-effect-modal')) closeGearEffectModal();
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

function searchUniqueArmor() { applyUniquesVisibility(); }

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
        updateWeaponBadge(card);
        triggerAutosave();
    }
    // Flash the loadout tab button briefly to guide the user
    _flashGearTabBtn();
}

/* ===== RENDER: COLLECTIBLES ===== */
function renderCollectibles() {
    const div = document.getElementById('coll-list'); div.innerHTML = '';
    if(origin === 'CW') {
        const bd = BOBBLEHEADS_DATA;
        div.innerHTML = `
            <div class="header-row" id="h-special-bobble" onclick="toggleCollapse('special-bobble')"><h2>BOBBLEHEADS: S.P.E.C.I.A.L.</h2></div>
            <div class="grid-tidy" data-category="special-bobble">${bd.special.map(s=>`<div class="grid-item" onclick="this.querySelector('input').click()"><input type="checkbox" style="display:none;" onchange="updateUniqueMarker(this); triggerAutosave()"><span class="tag-marker">[ ]</span><span class="bobble-name">${s.name}</span><span class="bobble-loc"> — ${s.loc}</span></div>`).join('')}</div>
            <div class="header-row" id="h-skill-bobble" onclick="toggleCollapse('skill-bobble')"><h2>BOBBLEHEADS: SKILLS</h2></div>
            <div class="grid-tidy" data-category="skill-bobble">${bd.skills.map(s=>`<div class="grid-item" onclick="this.querySelector('input').click()"><input type="checkbox" style="display:none;" onchange="updateUniqueMarker(this); triggerAutosave()"><span class="tag-marker">[ ]</span><span class="bobble-name">${s.skill}</span><span class="bobble-loc"> — ${s.loc}</span></div>`).join('')}</div>`;
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
    // Book sections use data-driven calcCatBook instead
    if (id.startsWith('book-')) return;
    const g = document.querySelector(`.grid-tidy[data-category="${id}"]`);
    if(!g) return;
    const checks = Array.from(g.querySelectorAll('input[type="checkbox"]'));
    const pct = Math.round((checks.filter(c => c.checked).length / checks.length) * 100);
    const pctEl = document.getElementById(`pct-${id}`);
    if(pctEl) pctEl.innerText = pct === 100 ? "DONE" : pct + "%";
    document.getElementById(`h-${id}`).classList.toggle('completed', pct === 100);
    renderBadges();
}

/* === BOOK CATEGORY COMPLETION (data-driven, no DOM checkboxes) === */
function calcCatBook(skill) {
    const books = getSkillBooksForOrigin();
    const book = books.find(b => b.skill === skill);
    if (!book) return;
    const safe = skill.replace(/[\s&]+/g, '-').toLowerCase();
    const arr = skillBooksFound[origin]?.[skill] || [];
    const total = book.copies.length;
    const found = arr.length;
    const pct = total > 0 ? Math.round((found / total) * 100) : 0;
    const pctEl = document.getElementById('pct-book-' + safe);
    if (pctEl) pctEl.innerText = pct === 100 ? 'DONE' : found + ' / ' + total;
    const h = document.getElementById('h-book-' + safe);
    if (h) h.classList.toggle('completed', pct === 100);
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
    // ── LIBRARIAN: per-origin book collection completion ─────────────
    const allOrigins = ['CW', 'MW'];
    allOrigins.forEach(orig => {
        const books = orig === 'CW' ? (typeof SKILL_BOOKS_CW !== 'undefined' ? SKILL_BOOKS_CW : []) : (typeof SKILL_BOOKS_MW !== 'undefined' ? SKILL_BOOKS_MW : []);
        books.forEach(book => {
            if (book.count > 0) {
                const arr = skillBooksFound[orig]?.[book.skill] || [];
                if (arr.length >= book.count) {
                    e.push({ group: 'LIBRARIAN', label: `${book.name} (${orig})`, icon: '📚' });
                }
            }
        });
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
                <span class="levelup-dist-count">${counts.hp}×</span>
            </div>
            <div class="levelup-dist-bar">
                <span class="levelup-dist-icon">⚡</span>
                <span class="levelup-dist-label">ACTION PTS</span>
                <div class="levelup-dist-track">
                    <div class="levelup-dist-fill ap-fill" style="width: ${apPct}%;"></div>
                </div>
                <span class="levelup-dist-pct">${apPct}%</span>
                <span class="levelup-dist-count">${counts.ap}×</span>
            </div>
            <div class="levelup-dist-bar">
                <span class="levelup-dist-icon">📦</span>
                <span class="levelup-dist-label">CARRY WT</span>
                <div class="levelup-dist-track">
                    <div class="levelup-dist-fill cw-fill" style="width: ${cwPct}%;"></div>
                </div>
                <span class="levelup-dist-pct">${cwPct}%</span>
                <span class="levelup-dist-count">${counts.cw}×</span>
            </div>
        </div>
    `;
    container.style.display = 'block';
}

function getSPECIALPool() {
    // Head trauma permanently removes 1 point from each chosen stat — shrink the pool to match
    const lost = Object.values(humbledReductions || {}).reduce((a, b) => a + (b ? 1 : 0), 0);
    return Math.max(0, 33 - lost);
}
function getSpecialRemaining() {
    const pool = getSPECIALPool();
    let ib = 0, itb = 0;
    IMPLANTS_DATA.forEach(i => { if (i.cat === 'special' && i.stat && implantsTaken[i.name]) ib++; });
    document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row), #extra-perk-list .prog-row').forEach(r => {
        if (/^Intense Training \(\+1 /i.test(r.querySelector('.prog-name-input')?.value || '')) itb++;
    });
    return Math.max(0, pool - (Object.values(special || {}).reduce((a, b) => a + b, 0) - 7 - ib - itb));
}

function getTraitForceIcon(name) {
    const td = TRAITS_DATA.find(x => x.name.trim().toLowerCase() === name.trim().toLowerCase())
            || INTERNALIZED_TRAITS_DATA.find(x => x.name.trim().toLowerCase() === name.trim().toLowerCase());
    if (!td || !td.req || td.req.trim() === '') return '';
    if (checkTraitEligible(td)) return '';
    return '<span class="ov-req-indicator ov-req-unmet" title="FORCED INTO BUILD — REQUIREMENTS NOT MET">⚡</span>';
}

/* ===== COMPANION RECRUITMENT ===== */
function companionCapacity() {
    const val = special.CHA;
    let slots = val >= 10 ? 3 : val >= 7 ? 2 : val >= 4 ? 1 : 0;
    return slots + (hasMagneticPersonalityPerk() ? 1 : 0);
}
function _companionEntry(c) { return COMPANIONS_DATA.find(x => x.name === c.name); }
function _selectedCompanionNames() { return companions.map(c => c.name); }
function _escQuote(s) { return s.replace(/'/g, "\\'"); }

function closeCompanionModal() {
    document.getElementById('companion-modal').style.display = 'none';
    nsAudio.click();
}

function addCompanion(name) {
    if (!COMPANIONS_DATA.some(x => x.name === name)) return;
    if (_selectedCompanionNames().includes(name)) { removeCompanion(name); return; }
    if (companions.length >= companionCapacity()) {
        showToast('NO COMPANION SLOTS AVAILABLE — raise permanent Charisma (CHA 4/7/10) or take Magnetic Personality.', 4200);
        return;
    }
    if (name === 'Butch') {
        _pendButchName = 'Butch';
        document.getElementById('butch-modal').style.display = 'flex';
        return;
    }
    companions.push({ name, butchBonus: null });
    showToast('RECRUITED: ' + name.toUpperCase());
    updateCompanionUI();
    triggerAutosave();
}
function removeCompanion(name) {
    const idx = companions.findIndex(c => c.name === name);
    if (idx === -1) return;
    companions.splice(idx, 1);
    showToast('DISMISSED: ' + name.toUpperCase());
    updateCompanionUI();
    triggerAutosave();
}

let _pendButchName = null;
let _companionOriginFilter = 'ALL';
function cancelButchChoice() { _pendButchName = null; document.getElementById('butch-modal').style.display = 'none'; nsAudio.click(); }
function syncCompanionFilterButtons() {
    document.querySelectorAll('#companion-origin-filter button').forEach(b => b.classList.toggle('active', b.dataset.origin === _companionOriginFilter));
}
function setCompanionOriginFilter(o) {
    _companionOriginFilter = o;
    syncCompanionFilterButtons();
    renderCompanionModal();
    nsAudio.click();
}
function openCompanionModal() {
    document.getElementById('companion-modal').style.display = 'flex';
    syncCompanionFilterButtons();
    renderCompanionModal();
    nsAudio.click();
}
function renderCompanionModal() {
    const cap = companionCapacity();
    document.getElementById('companion-capacity').innerHTML =
        `ACTIVE: <b>${companions.length}</b> / <b>${cap}</b> SLOTS &nbsp;·&nbsp; PERMANENT CHARISMA: CHA 4 → 1, CHA 7 → 2, CHA 10 → 3${hasMagneticPersonalityPerk() ? ' &nbsp;·&nbsp; <span style="color:var(--pip-color); letter-spacing:0.08em;">MAGNETIC PERSONALITY: +1 SLOT</span>' : ''}`;
    const q = (document.getElementById('companion-search').value || '').trim().toLowerCase();
    const cont = document.getElementById('companion-container');
    const list = COMPANIONS_DATA.filter(c => {
        if (_companionOriginFilter !== 'ALL' && c.origin !== _companionOriginFilter) return false;
        if (q && !c.name.toLowerCase().includes(q)) return false;
        return true;
    });
    cont.innerHTML = list.map(c => {
        const has = _selectedCompanionNames().includes(c.name);
        const atCap = !has && companions.length >= cap;
        return `<div class="companion-grid-entry ${has ? 'companion-added' : ''}${atCap ? ' companion-capped' : ''}" ${atCap ? '' : 'onclick="addCompanion(\'' + _escQuote(c.name) + '\')"'}${atCap ? 'title="NO COMPANION SLOTS AVAILABLE — raise Charisma to unlock more"' : ''}>
            <div class="companion-icon">${c.icon}</div>
            <div class="companion-body">
                <div class="companion-name-row"><span class="companion-name">${c.name}</span><span class="companion-origin-tag tag-${c.origin}">${c.origin}</span><span class="companion-state">${has ? '✔ IN PARTY' : ''}</span></div>
                <div class="companion-desc">${c.desc}</div>
            </div>
        </div>`;
    }).join('') || '<div style="opacity:0.4; font-size:0.75rem; padding:14px; text-align:center;">NO COMPANIONS MATCH YOUR SEARCH</div>';
}
function confirmButchBonus(b) {
    if (_pendButchName) {
        const existing = companions.find(c => c.name === _pendButchName);
        if (existing) existing.butchBonus = b;
        else companions.push({ name: _pendButchName, butchBonus: b });
        _pendButchName = null;
    }
    document.getElementById('butch-modal').style.display = 'none';
    showToast('BUTCH DISPOSITION: ' + (b === 'improved' ? 'IMPROVED — -75% ENEMY CRIT. CHANCE' : 'WORSENED — +50% CRIT. DAMAGE'));
    updateCompanionUI();
    triggerAutosave();
}
function reChooseButch() {
    _pendButchName = 'Butch';
    document.getElementById('butch-modal').style.display = 'flex';
    nsAudio.click();
}

function updateCompanionUI() {
    const badge = document.getElementById('companion-count');
    if (badge) badge.textContent = companions.length;
    const modal = document.getElementById('companion-modal');
    if (modal && modal.style.display === 'flex') openCompanionModal();
    renderCompanionsPanel();
}
function renderCompanionsPanel() {
    const el = document.getElementById('ov-companions');
    if (!el) return;
    const cap = companionCapacity();
    const card = document.getElementById('companions-card');
    if (card) card.classList.toggle('companions-off', cap <= 0 && !companions.length);
    if (!companions.length) {
        el.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="opacity:0.35;">NONE</span><button class="companion-mini-btn" onclick="openCompanionModal()">+ RECRUIT</button></div>`;
        return;
    }
    el.innerHTML = companions.map(c => {
        const d = _companionEntry(c);
        const butchTxt = c.name === 'Butch'
            ? `<div class="butch-row"><span class="butch-badge">${c.butchBonus === 'improved' ? '▶ IMPROVED: -75% ENEMY CRIT. CHANCE' : c.butchBonus === 'worsened' ? '▶ WORSENED: +50% CRIT. DAMAGE' : '⚑ DISPOSITION PENDING'}</span><button class="companion-mini-btn" onclick="event.stopPropagation(); reChooseButch()">SWITCH</button></div>`
            : '';
        return `<div class="companion-panel-row">
            <span class="companion-panel-icon">${d ? d.icon : '❓'}</span>
            <div class="companion-panel-body">
                <div class="companion-panel-name companion-name-btn" onclick="openCompanionZoom('${_escQuote(c.name)}')">${c.name}<span class="companion-origin-tag tag-${d ? d.origin : 'CW'}">${d ? d.origin : ''}</span></div>
                ${butchTxt}
            </div>
            <button class="companion-remove-btn" title="Dismiss" onclick="event.stopPropagation(); removeCompanion('${_escQuote(c.name)}')">✕</button>
        </div>`;
    }).join('') + `<div style="margin-top:6px; font-size:0.68rem; color:rgba(255,255,255,0.35);">${companions.length} / ${cap} SLOT${cap !== 1 ? 'S' : ''} USED${cap - companions.length > 0 ? ' — ' + (cap - companions.length) + ' OPEN' : ''}${hasMagneticPersonalityPerk() ? ' — MAGNETIC PERSONALITY: +1 SLOT' : ''}</div>`;
}

function openCompanionZoom(name) {
    const d = _companionEntry({ name });
    const modal = document.getElementById('companion-zoom-modal');
    const iconEl = document.getElementById('companion-zoom-icon');
    const nameEl = document.getElementById('companion-zoom-name');
    const reqEl = document.getElementById('companion-zoom-req');
    const descEl = document.getElementById('companion-zoom-desc');
    if (iconEl) iconEl.textContent = d ? d.icon : '❓';
    if (nameEl) nameEl.textContent = d ? d.name : name;
    if (reqEl) reqEl.textContent = d ? `ORIGIN: ${d.origin === 'MW' ? 'MOHAVE WASTELAND' : 'CAPITAL WASTELAND'}` : '';
    if (descEl) descEl.textContent = d ? d.desc : '';
    if (modal) modal.style.display = 'flex';
}

function updateAll() {
    beginBonusCache();
    try {
    const locked = isCreationLocked();
    // Toggle lock indicator notes on the SPECIAL / TAGS / TRAITS headers
    const specNote = document.getElementById('spec-lock-note');
    if (specNote) specNote.style.display = locked ? 'inline-block' : 'none';
    const tagsNote = document.getElementById('tags-lock-note');
    if (tagsNote) tagsNote.style.display = locked ? 'inline-block' : 'none';
    const traitsNote = document.getElementById('traits-lock-note');
    if (traitsNote) traitsNote.style.display = isTraitsLocked() ? 'inline-block' : 'none';
    const pool = getSPECIALPool();
    let _ib=0; IMPLANTS_DATA.forEach(i=>{if(i.cat==='special'&&i.stat&&implantsTaken[i.name])_ib++;});
    // Cache the prog-row query — used for IT tracking and perks overview
    const _progRows = document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row), #extra-perk-list .prog-row');
    let _itb=0;
    const itBonus = {STR:0,PER:0,END:0,CHA:0,INT:0,AGI:0,LCK:0};
    _progRows.forEach(r => {
        const v = r.querySelector('.prog-name-input')?.value||'';
        if (/^Intense Training \(\+1 \w+\)/i.test(v)) _itb++;
        const m = v.match(/^Intense Training \(\+1 (STR|PER|END|CHA|INT|AGI|LCK)\)/i);
        if (m) itBonus[m[1].toUpperCase()]++;
    });
    const rem = getSpecialRemaining();
    document.getElementById('pts-left').innerText = rem;
    const { specialDelta, skillDelta, hasConditional } = getCachedBonuses().trait;
    const { perkSpecialDelta, perkSkillDelta } = getCachedBonuses().perk;
    const { specDelta: ctDelta, skillDelta: condSkillDelta } = getCachedBonuses().cond;
    const { specDelta: gearSpecDelta, skillDelta: gearSkillDelta } = getGearEffectsDelta();
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
    // Build per-stat implant bonus lookup
    const implantBonus = {STR:0,PER:0,END:0,CHA:0,INT:0,AGI:0,LCK:0};
    IMPLANTS_DATA.forEach(i => { if (i.cat==='special' && i.stat && implantsTaken[i.name]) implantBonus[i.stat]++; });

    document.getElementById('special-list').innerHTML = sKeys.map(k => {
        const td  = specialDelta[k] || 0;
        const pd  = perkSpecialDelta[k] || 0;
        const cd  = ctDelta[k] || 0;
        const gd  = gearSpecDelta[k] || 0;
        const imp = implantBonus[k] || 0;
        const it  = itBonus[k] || 0;
        const rank = getSpecialRank(k);

        // special[k] already embeds IT increments (confirmIT) and implant increments (toggleImplant).
        // baseVal  = pure allocated points only — subtract both to get the number the player typed in
        const baseVal = special[k] - it - imp;
        // effectiveTotal = special[k] (base+IT+implants) + external modifiers (trait/perk/conditional)
        // NOTE: do NOT add imp again — it's already in special[k]
        const effectiveTotal = Math.max(1, special[k] + td + pd + cd + gd);
        // what the number shows in the UI
        const dispVal = _showBaseSpecial ? baseVal : special[k];
        // bar fills against the full effective total
        const _ds = Math.max(1, Math.min(10, _showBaseSpecial ? baseVal : effectiveTotal));

        // Show = badge when external modifiers (trait / perk / conditional) are active.
        // Intense Training and implants are permanent — already embedded in the shown
        // base number — so they are never listed as a separate modifier in the badges.
        const hasExternalBonus = !_showBaseSpecial && (td + pd + cd + gd) !== 0;
        const hasAnyModifier = (td + pd + cd + gd) !== 0;
        const hasAnyPermanent = (it || imp) !== 0;
        const hasBonus = !_showBaseSpecial && (_showDetailedSpecial ? hasAnyModifier : hasExternalBonus);
        
        const tooltipParts = [];
        if (it  !== 0) tooltipParts.push(`+${it} IT`);
        if (imp !== 0) tooltipParts.push(`+${imp} Impl`);
        if (td  !== 0) tooltipParts.push(`${td>0?'+':''}${td} Trait`);
        if (pd  !== 0) tooltipParts.push(`${pd>0?'+':''}${pd} Perk`);
        if (cd  !== 0) tooltipParts.push(`${cd>0?'+':''}${cd} Cond`);
        if (gd  !== 0) tooltipParts.push(`${gd>0?'+':''}${gd} Gear`);
        const bonusTooltip = tooltipParts.length
            ? `BASE ${baseVal}: ` + tooltipParts.join(' / ') + ` = ${effectiveTotal}`
            : rank;
        
        // Compact single delta badge (simplified mode)
        const totalDelta = (td||0) + (pd||0) + (cd||0) + (gd||0);
        let deltaBadge = '';
        if (!_showBaseSpecial && totalDelta !== 0 && !_showDetailedSpecial) {
            const sign = totalDelta > 0 ? '+' : '';
            const cls = totalDelta > 0 ? 'sdelta-pos' : 'sdelta-neg';
            deltaBadge = `<span class="spec-delta-badge ${cls}" title="${bonusTooltip}">${sign}${totalDelta}</span>`;
        }
        
        // Detailed breakdown badges (detailed mode)
        // Shows individual modifiers, even if they cancel out to zero.
        // IT / implants are permanent and embedded in the base number — excluded
        // so users don't misread them as still-missing SPECIAL.
        let detailedBadges = '';
        if (!_showBaseSpecial && _showDetailedSpecial) {
            const badges = [];
            if (td !== 0) badges.push(`<span class="spec-source-badge spec-badge-trait" title="Trait">T ${td>0?'+':''}${td}</span>`);
            if (pd !== 0) badges.push(`<span class="spec-source-badge spec-badge-perk" title="Perk">P ${pd>0?'+':''}${pd}</span>`);
            if (cd !== 0) badges.push(`<span class="spec-source-badge spec-badge-cond" title="Conditional">C ${cd>0?'+':''}${cd}</span>`);
            if (gd !== 0) badges.push(`<span class="spec-source-badge spec-badge-gear" title="Gear Effect">G ${gd>0?'+':''}${gd}</span>`);
            // Always show the container in detailed mode for consistent layout
            detailedBadges = `<div class="spec-detailed-sources">${badges.length > 0 ? badges.join('') : (hasAnyPermanent ? '<span class="spec-no-mods">NO EXTERNAL MODIFIERS (IT/IMPLANT IN BASE)</span>' : '<span class="spec-no-mods">NO MODIFIERS</span>')}</div>`;
        }


        // Glow tier based on effective display value (1–10)
        const glowTier = _ds >= 10 ? 'spec-glow-max' : _ds >= 8 ? 'spec-glow-high' : _ds >= 6 ? 'spec-glow-mid' : _ds >= 4 ? 'spec-glow-low' : 'spec-glow-dim';
        
        // Bar fill percentage (1-10 scale = 10% per point)
        const barPercent = Math.max(0, Math.min(100, _ds * 10));
        
        // Bar tier classes similar to skill system
        const barTier = _ds >= 10 ? 'spec-bar-max' : _ds >= 8 ? 'spec-bar-high' : _ds >= 6 ? 'spec-bar-mid' : _ds >= 4 ? 'spec-bar-low' : 'spec-bar-dim';

        return `<div class="special-row${_showBaseSpecial?' spec-base-mode':''}${_showDetailedSpecial?' spec-detailed-mode':''} ${glowTier}${isCreationLocked()?' creation-locked':''}" data-key="${k}">
            <div class="spec-card-top">
                <span class="spec-abbr-lg spec-info-btn" title="${bonusTooltip}" onclick="openSpecialInfoModal('${k}')">${k}</span>
                ${deltaBadge}
            </div>
            <div class="spec-card-mid">
                <button class="special-btn" onclick="mod('${k}',-1)" ${isCreationLocked()||special[k]<=1?'disabled':''}>−</button>
                <span class="spec-val special-val">${dispVal}</span>
                <button class="special-btn" onclick="mod('${k}',1)" ${isCreationLocked()||rem<=0 || special[k]>=10?'disabled':''}>+</button>
                ${hasBonus ? `<span class="spec-eq-badge" title="${bonusTooltip}">= ${effectiveTotal}</span>` : ''}
            </div>
            ${detailedBadges}
            <div class="spec-bar-container">
                <div class="spec-bar-bg">
                    <div class="spec-bar-fill ${barTier}" style="width: ${barPercent}%"></div>
                </div>
            </div>
            <div class="spec-card-bot">
                <span class="spec-rank-title">${rank}</span>
            </div>
        </div>`;
    }).join('');

    document.getElementById('ov-name').innerText = (document.getElementById('char-name').value || "NO_ID").toUpperCase();
    document.getElementById('ov-spec').innerHTML = sKeys.map(k => `<div class="char-banner-stat"><span class="char-banner-stat-key">${k}</span><span class="char-banner-stat-val">${special[k]}</span></div>`).join('');
    const ovTagsEl = document.getElementById('ov-tags');
    if (ovTagsEl) ovTagsEl.innerHTML = (() => {
        const entries = Array.from(document.querySelectorAll('#tag-area input:checked')).map(c => {
            const label = c.parentElement.querySelectorAll('span')[1];
            const skillName = label ? label.innerText : '';
            const isFourth = _fourthTagSkill && skillName === _fourthTagSkill;
            return `<div class="ov-entry"><span>${skillName}${isFourth ? '<span style="font-size:0.6rem;color:rgba(255,200,80,0.8);margin-left:5px;letter-spacing:0.5px;opacity:0.9;">TAG!</span>' : ''}</span></div>`;
        });
        // If Tag! perk taken but the 4th skill isn't already showing via checkbox, add it explicitly
        if (_fourthTagSkill && !Array.from(document.querySelectorAll('#tag-area input:checked')).some(c => { const l = c.parentElement.querySelectorAll('span')[1]; return l && l.innerText === _fourthTagSkill; })) {
            entries.push(`<div class="ov-entry"><span>${_fourthTagSkill}<span style="font-size:0.6rem;color:rgba(255,200,80,0.8);margin-left:5px;letter-spacing:0.5px;opacity:0.9;">TAG!</span></span></div>`);
        }
        return entries.join('') || 'NONE';
    })();
        const startingTraitHTML = startingTraits.map((t) => {
        const td = TRAITS_DATA.find(x => x.name.trim().toLowerCase() === t.name.trim().toLowerCase())
                 || INTERNALIZED_TRAITS_DATA.find(x => x.name.trim().toLowerCase() === t.name.trim().toLowerCase());
        const safeN = encodeURIComponent(t.name).replace(/'/g, '%27');
        // always clickable — ovPerkClick searches perks, traits, internalized, rewards
        return `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${safeN}')" title="${td ? 'CLICK FOR TRAIT DETAILS' : 'CLICK FOR DETAILS'}"><span>${getTraitForceIcon(t.name)}◈ ${t.name}</span></div>`;
    }).join('');
    const levelTraitHTML = Array.from(document.querySelectorAll('#level-up-traits-list .trait-slot-row')).map(r => {
        const n = r.getAttribute('data-chosen')||'';
        if (!n) return '';
        const td = TRAITS_DATA.find(x => x.name.trim().toLowerCase() === n.trim().toLowerCase())
                 || INTERNALIZED_TRAITS_DATA.find(x => x.name.trim().toLowerCase() === n.trim().toLowerCase());
        const safeN = encodeURIComponent(n).replace(/'/g, '%27');
        return `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${safeN}')" title="${td ? 'CLICK FOR TRAIT DETAILS' : 'CLICK FOR DETAILS'}"><span>${getTraitForceIcon(n)}▸ ${n}</span></div>`;
    }).join('');
    const traitHTML = startingTraitHTML + levelTraitHTML || 'NONE';
    const ovT = document.getElementById('ov-traits'); if(ovT) ovT.innerHTML = traitHTML;

    document.getElementById('ov-perks').innerHTML = (() => {
        // Strip annotations like [+AP REGEN] or (+1 STR) from perk names for lookup
        function baseName(v) { return v.replace(/\s*[\[(].*?[\])]$/, '').trim(); }
        // Helper: check if perk meets requirements
        function getReqIndicator(perkName) {
            const perk = PERKS_DATA.find(p => p.name.trim().toUpperCase() === perkName.trim().toUpperCase());
            if (!perk) return ''; // Not a standard perk
            const meets = meetsRequirements(perk);
            return meets 
                ? '<span class="ov-req-indicator ov-req-met" title="REQUIREMENTS CURRENTLY MET">✓</span>'
                : '<span class="ov-req-indicator ov-req-unmet" title="FORCED INTO BUILD — REQUIREMENTS NOT MET">⚡</span>';
        }
        // Map level-up trait -> granted bonus perk name (rows carry data-grant-trait)
        const bonusMap = new Map();
        Array.from(document.querySelectorAll('#extra-perk-list .prog-row')).forEach(r => {
            const t = r.getAttribute('data-grant-trait') || '';
            const v = r.querySelector('.prog-name-input')?.value || '';
            if (t && v && !bonusMap.has(t)) bonusMap.set(t, v);
        });
        // Names of level-up traits actually chosen (only these nest their bonus perk below them)
        const chosenLevelTraits = new Set(
            Array.from(document.querySelectorAll('#level-up-traits-list .trait-slot-row'))
                .map(r => (r.getAttribute('data-chosen') || '').trim())
                .filter(Boolean)
        );
        // Merged chronological list: perks + traits ordered by level, tail items at the end
        const entries = [];
        let seq = 0;
        function pushEntry(level, html, name) { entries.push({ level, seq: seq++, html, name: name || '' }); }
        Array.from(document.querySelectorAll('#prog-list .prog-row')).forEach(r => {
            const lvlTag = r.querySelector('.lvl-tag')?.innerText || '';
            const val = r.querySelector('.prog-name-input')?.value || '';
            if (!val) return;
            const lvlNum = parseInt((lvlTag.match(/\d+/) || [''])[0]) || 0;
            const reqIndicator = getReqIndicator(baseName(val));
            // Annotate Tag! perk with chosen 4th skill
            const isTagPerk = baseName(val).trim().toUpperCase() === 'TAG!';
            const tagAnnotation = (isTagPerk && _fourthTagSkill) ? `<span style="font-size:0.6rem;color:rgba(255,200,80,0.8);margin-left:5px;letter-spacing:0.5px;">- ${_fourthTagSkill}</span>` : '';
            // always set onclick — ovPerkClick will look up across all data sources
            pushEntry(lvlNum, `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${encodeURIComponent(baseName(val))}')" title="CLICK FOR DETAILS"><span>${reqIndicator}${val}${tagAnnotation}</span><span style="opacity:0.5;">${lvlTag}</span></div>`, baseName(val));
        });
        Array.from(document.querySelectorAll('#level-up-traits-list .trait-slot-row')).forEach(r => {
            const n = r.getAttribute('data-chosen') || '';
            if (!n) return;
            const lvlNum = parseInt(((r.querySelector('.lvl-tag')?.innerText || '').match(/\d+/) || [''])[0]) || 0;
            const td = TRAITS_DATA.find(x => x.name.trim().toLowerCase() === n.trim().toLowerCase());
            const lvlDisplay = lvlNum ? 'LVL ' + lvlNum + ' TRAIT' : '';
            pushEntry(lvlNum, `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${encodeURIComponent(n)}')" title="${td ? 'CLICK FOR TRAIT DETAILS' : 'CLICK FOR DETAILS'}"><span>▸ ${n}</span><span style="opacity:0.5; color:#a0cfff;">${lvlDisplay}</span></div>`);
            // Nest a perk-granting trait's bonus perk directly beneath it
            const bonusPerk = bonusMap.get(n);
            if (bonusPerk) {
                const reqBonus = getReqIndicator(baseName(bonusPerk));
                pushEntry(lvlNum, `<div class="ov-entry ov-entry-clickable" style="margin-left:14px;" onclick="ovPerkClick('${encodeURIComponent(baseName(bonusPerk))}')" title="CLICK FOR DETAILS"><span>└ ${reqBonus}${bonusPerk}</span><span style="opacity:0.5; color:#a0cfff;">BONUS</span></div>`, baseName(bonusPerk));
            }
        });
        // Standalone bonus perks (not nested under a chosen level-up trait)
        Array.from(document.querySelectorAll('#extra-perk-list .prog-row')).forEach(r => {
            const t = r.getAttribute('data-grant-trait') || '';
            const val = r.querySelector('.prog-name-input')?.value || '';
            if (!val) return;
            if (t && chosenLevelTraits.has(t)) return; // already emitted beneath the trait
            const reqIndicator = getReqIndicator(baseName(val));
            pushEntry(1e9, `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${encodeURIComponent(baseName(val))}')" title="CLICK FOR DETAILS"><span>${reqIndicator}${val}</span><span style="opacity:0.5; color:#a0cfff;">BONUS</span></div>`, baseName(val));
        });
        rewardPerksList.forEach(rp => {
            const reqIndicator = getReqIndicator(rp.name);
            pushEntry(1e9, `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${encodeURIComponent(rp.name)}')" title="CLICK FOR DETAILS"><span>${reqIndicator}${rp.name}</span><span style="opacity:0.5; color:#ffd080;">REWARD</span></div>`, rp.name);
        });
        internalizedTraitsList.forEach(it => {
            pushEntry(1e9, `<div class="ov-entry ov-entry-clickable" onclick="ovPerkClick('${encodeURIComponent(it.name)}')" title="CLICK FOR DETAILS"><span>${it.name}</span><span style="opacity:0.5; color:#c8a0ff;">INT.</span></div>`);
        });
        entries.sort((a, b) => (a.level - b.level) || (a.seq - b.seq));
        // Rank numerals: annotate every instance of a repeated perk (I, II, III...)
        const rankTotals = {};
        entries.forEach(e => { if (e.name) rankTotals[e.name] = (rankTotals[e.name] || 0) + 1; });
        const rankSeen = {};
        const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
        // Insertion point for the numeral: immediately AFTER the perk name on the
        // NAME side (first span), hopping any req-indicator span in front of it —
        // NOT after the LVL tag, where it juts out.
        function nameSideInsert(html, name) {
            const s1 = html.indexOf('<span');
            const gt = html.indexOf('>', s1 + 5);
            let end = gt + 1;
            while (html.indexOf('<span', end) === end) {
                const c = html.indexOf('</span>', end);
                if (c < 0) break;
                end = c + '</span>'.length;
            }
            const k = html.indexOf(name, end);
            if (k >= 0) return k + name.length;
            return gt + 1;
        }
        return entries.map(e => {
            if (e.name && rankTotals[e.name] >= 2) {
                const n = (rankSeen[e.name] = (rankSeen[e.name] || 0) + 1) - 1;
                const badge = `<span class="ov-rank">${ROMAN[Math.min(n, ROMAN.length - 1)]}</span>`;
                const at = nameSideInsert(e.html, e.name);
                return e.html.slice(0, at) + badge + e.html.slice(at);
            }
            return e.html;
        }).join('') || '<span style="opacity:0.3; font-size:0.65rem;">NONE YET</span>';
    })();

    let gearHTML = Array.from(document.querySelectorAll('#weapon-list .gear-card')).map(c => {
        const ins = c.querySelectorAll('.gear-field-input');
        const n = ins[0]?.value||''; const a = ins[2]?.value||''; const str = ins[3]?.value||''; const sel = c.querySelector('.gear-skill-type-select'); const st = sel?.value||''; const sr = ins[4]?.value||'';
        const wcls = gearWeaponClass(c); const wicon = GEAR_WEAPON_ICONS[wcls] || '⚔';
        return n ? `<div class="ov-entry"><span>${wicon} ${n}</span><div style="display:flex;gap:6px;align-items:center;">${st?`<span style="font-size:0.68rem;color:rgba(255,220,80,0.7);border:1px solid rgba(255,220,80,0.25);padding:0 4px;">${st}${sr?' '+sr:''}</span>`:''}${str?`<span style="font-size:0.68rem;color:rgba(100,180,255,0.7);border:1px solid rgba(100,180,255,0.2);padding:0 4px;">STR ${str}</span>`:''}${a?`<span style="opacity:0.55;">${a}</span>`:''}</div></div>` : '';
    }).join('');
    gearHTML += Array.from(document.querySelectorAll('#armor-list .gear-card')).map(c => {
        const ins = c.querySelectorAll('.gear-field-input');
        const n = ins[0]?.value||''; const sel = c.querySelector('.gear-field-select'); const w = sel?.value||'';
        const aicon = ({ LIGHT: '🧥', MEDIUM: '🪖', HEAVY: '⛓', 'POWER ARMOR': '🤖' })[w] || '🛡';
        return n ? `<div class="ov-entry"><span>${aicon} ${n}</span><span style="opacity:0.6;">${w}</span></div>` : '';
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

    // Companions overview
    renderCompanionsPanel();

    // Update ov-traits-inline visibility
    const ovTI = document.getElementById('ov-traits-inline');
    const ovTEmpty = document.getElementById('ov-traits-empty');
    const startingTraitHTML2 = startingTraits.map(t => {
        const safeN2 = encodeURIComponent(t.name).replace(/'/g, '%27');
        const td2 = TRAITS_DATA.find(x => x.name.trim().toLowerCase() === t.name.trim().toLowerCase())
                 || INTERNALIZED_TRAITS_DATA.find(x => x.name.trim().toLowerCase() === t.name.trim().toLowerCase());
        return `<div class="ov-trait-entry ov-trait-clickable" onclick="ovPerkClick('${safeN2}')" title="${td2 ? 'CLICK FOR TRAIT DETAILS' : 'CLICK FOR DETAILS'}"><span class="ov-trait-dot" style="color:#c8ffd4;">◈</span>${getTraitForceIcon(t.name)}<span>${t.name}</span></div>`;
    }).join('');
    const levelTraitHTML2 = Array.from(document.querySelectorAll('#level-up-traits-list .trait-slot-row')).map(r => { const n = r.getAttribute('data-chosen')||''; if (!n) return ''; const safeN2 = encodeURIComponent(n).replace(/'/g, '%27'); const td2 = TRAITS_DATA.find(x => x.name.trim().toLowerCase() === n.trim().toLowerCase()) || INTERNALIZED_TRAITS_DATA.find(x => x.name.trim().toLowerCase() === n.trim().toLowerCase()); return `<div class="ov-trait-entry ov-trait-clickable" onclick="ovPerkClick('${safeN2}')" title="${td2 ? 'CLICK FOR TRAIT DETAILS' : 'CLICK FOR DETAILS'}"><span class="ov-trait-dot">▸</span>${getTraitForceIcon(n)}<span>${n}</span></div>`; }).join('');
    const traitHTML2 = startingTraitHTML2 + levelTraitHTML2;
    if (ovTI) ovTI.innerHTML = traitHTML2;
    if (ovTEmpty) ovTEmpty.style.display = traitHTML2 ? 'none' : 'block';

    syncTagLimit();
    renderStartingTraitsList();
    const tagged = getTaggedSkills();
    const ptsLvl = pointsPerLevel(charLevel + 1);
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
            if (bDelta !== 0) deltaBadges += `<span class="skill-delta-badge sdelta-pos sdelta-book" title="FROM SKILL BOOKS (×${(skillBooksFound.CW?.[s]?.length||0)+(skillBooksFound.MW?.[s]?.length||0)}${hasIdeologue()?', IDEOLOGUE':''})">+${bDelta}<span class="delta-src-tag">B</span></span>`;
            const breakdown = ('BASE:'+base+(isTagged?' TAG:x2'+(isFourthTag?' [TAG!]':''):'')+(spent?' LVL:+'+spent:'')+(tDelta?' TRAIT:'+(tDelta>0?'+':'')+tDelta:'')+(pDelta?' PERK:'+(pDelta>0?'+':'')+pDelta:'')+(cDelta?' COND:'+(cDelta>0?'+':'')+cDelta:'')+(bDelta?' BOOK:+'+bDelta:'')).trim();
            const tagClass = isFourthTag ? ' skill-row-tagged skill-row-tag4' : (isTagged ? ' skill-row-tagged' : '');
            const tagIcon = isFourthTag ? '✦ ' : (isTagged ? '★ ' : '');
            return `<div class="skill-row${tagClass}" title="${breakdown}">
                <span class="skill-row-name">${tagIcon}${s}</span>
                <div class="skill-row-bar ${isTagged || isFourthTag ? '' : val >= 100 ? 'bar-tier-max' : val >= 70 ? 'bar-tier-high' : val >= 50 ? 'bar-tier-mid' : val >= 30 ? 'bar-tier-low' : 'bar-tier-dim'}"><div class="skill-row-fill" style="width:${val}%"></div></div>
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
    } finally { endBonusCache(); }
}

function mod(k, v) {
    if (!SPECIAL_STATS.includes(k)) return;
    if (isCreationLocked()) return; // creation choices are locked after first level-up
    const val = special[k] || 1;
    if (v > 0) {
        if (val >= 10) return;
        // Enforce the point pool here (not just via rendered button state) so rapid
        // clicks between renders can't overshoot allocations. IT rows and implants
        // live inside special[] already, so subtract them from the "allocated" count.
        let ib = 0, itb = 0;
        IMPLANTS_DATA.forEach(i => { if (i.cat === 'special' && i.stat && implantsTaken[i.name]) ib++; });
        document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row), #extra-perk-list .prog-row').forEach(r => {
            if (/^Intense Training \(\+1 /i.test(r.querySelector('.prog-name-input')?.value || '')) itb++;
        });
        const baseAlloc = Object.values(special || {}).reduce((a, b) => a + b, 0) - 7 - ib - itb;
        if (baseAlloc >= getSPECIALPool()) return;
    } else {
        if (val <= 1) return;
    }
    special[k] = val + v; 
    
    // Immediate visual feedback - just update SPECIAL display (lightweight, fast)
    refreshSPECIALDisplay();
    
    // Debounce expensive operations (full UI re-render, perk checks, autosave)
    clearTimeout(_specialModDebounce);
    _specialModDebounce = setTimeout(() => {
        updateAll(); 
        reCheckAllPerkRows();
        
        // Autosave without duplicate updateAll call
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
        }, 100);
    }, 50); // Small delay for responsiveness while batching rapid clicks
}

function toggleBaseSpecial() {
    _showBaseSpecial = !_showBaseSpecial;
    const btn = document.getElementById('spec-base-toggle');
    if (btn) {
        btn.classList.toggle('spec-base-toggle-active', _showBaseSpecial);
        btn.title = _showBaseSpecial
            ? 'Showing BASE allocated only — click to show full with all bonuses'
            : 'Showing FULL SPECIAL with all bonuses — click to show base only';
    }
    updateAll();
}

function toggleDetailedSpecial() {
    _showDetailedSpecial = !_showDetailedSpecial;
    const btn = document.getElementById('spec-detail-toggle');
    if (btn) {
        btn.classList.toggle('spec-detail-toggle-active', _showDetailedSpecial);
        btn.title = _showDetailedSpecial
            ? 'Showing DETAILED breakdown — click for simplified view'
            : 'Showing SIMPLIFIED view — click for detailed breakdown';
    }
    updateAll();
}

function addTrait() {
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
                    <input type="text" class="gear-field-input" oninput="updateWeaponBadge(this.closest('.gear-card'));triggerAutosave()" placeholder="E.G. LUCKY, THIS MACHINE...">
                </div>
                <div class="gear-field-row">
                    <div class="gear-field-group">
                        <label class="gear-field-label">FOUND / LOCATION</label>
                        <input type="text" class="gear-field-input" oninput="triggerAutosave()" placeholder="LOCATION...">
                    </div>
                    <div class="gear-field-group">
                        <label class="gear-field-label">AMMO TYPE</label>
                        <input type="text" class="gear-field-input" oninput="updateWeaponBadge(this.closest('.gear-card'));triggerAutosave()" placeholder=".357 MAG, 5MM...">
                    </div>
                </div>
                <div class="gear-field-row gear-weapon-req-row">
                    <div class="gear-field-group gear-str-req-group">
                        <label class="gear-field-label">STR REQ</label>
                        <input type="text" class="gear-field-input gear-stat-input gear-str-req-input" oninput="triggerAutosave()" placeholder="—">
                    </div>
                    <div class="gear-field-group gear-skill-type-group">
                        <label class="gear-field-label">SKILL TYPE</label>
                        <select class="gear-field-select gear-skill-type-select" onchange="updateWeaponBadge(this.closest('.gear-card'));triggerAutosave()">
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
    const sel = document.getElementById('armor-list').querySelector(':scope > .gear-card:last-child .gear-field-select');
    if (sel) updateArmorBadge(sel);
    updateGearCounts();
}

function updateArmorBadge(sel) {
    const card = sel.closest('.gear-card');
    const badge = card.querySelector('.gear-card-type-badge');
    const icons = { LIGHT: '🧥', MEDIUM: '🪖', HEAVY: '⛓', 'POWER ARMOR': '🤖' };
    badge.textContent = (icons[sel.value] || '🛡') + ' ' + sel.value;
}

const GEAR_WEAPON_ICONS = {
    'PISTOLS & REVOLVERS': '🔫',
    'SMGS & RIFLES': '🎯',
    'SHOTGUNS': '🧨',
    'BIG GUNS': '💣',
    'ENERGY WEAPONS': '⚡',
    'EXPLOSIVES': '💥',
    'MELEE WEAPONS': '⚔️',
    'UNARMED': '👊',
};
const GEAR_PISTOL_CALIBERS = /\.(357|44|45|38|32|22|25)(?:\s|$)|9MM|10MM|\bBB\b/;
const GEAR_SHOTGUN_HINTS = /GAUGE|SHOTGUN|SHOTTY/;

function gearWeaponClass(card) {
    const sel = card.querySelector('.gear-skill-type-select');
    const skill = sel ? sel.value : '';
    if (skill !== 'GUNS' && skill !== '' && GEAR_WEAPON_ICONS[skill]) return skill;
    const ins = card.querySelectorAll('.gear-field-input');
    const name = (ins[0] && ins[0].value || '').toUpperCase();
    const ammo = (ins[2] && ins[2].value || '').toUpperCase();
    if (!name && !ammo) return '';
    if (GEAR_SHOTGUN_HINTS.test(name) || GEAR_SHOTGUN_HINTS.test(ammo)) return 'SHOTGUNS';
    if (GEAR_PISTOL_CALIBERS.test(ammo)) return 'PISTOLS & REVOLVERS';
    return 'SMGS & RIFLES';
}

function updateWeaponBadge(card) {
    const badge = card.querySelector('.gear-card-type-badge');
    if (!badge) return;
    const cls = gearWeaponClass(card);
    badge.textContent = (GEAR_WEAPON_ICONS[cls] || '⚔') + ' ' + (cls || 'WEAPON');
    badge.classList.toggle('weapon-class-badge', !!cls);
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

// Cache for trait/perk/conditional bonus lookups — active only during updateAll()
let _bonusCache = null;
let _bonusCacheActive = false;
function beginBonusCache() {
    _bonusCache = { trait: getActiveTraitBonuses(), perk: getActivePerkBonuses(), cond: getConditionalToggleDelta() };
    _bonusCacheActive = true;
}
function endBonusCache() { _bonusCacheActive = false; _bonusCache = null; }
function getCachedBonuses() {
    return _bonusCacheActive ? _bonusCache : { trait: getActiveTraitBonuses(), perk: getActivePerkBonuses(), cond: getConditionalToggleDelta() };
}

/**
 * Returns the BASE value of a SPECIAL stat for PERK ELIGIBILITY purposes.
 * Base = allocated points + permanent trait bonuses + permanent perk bonuses.
 * Conditional toggle bonuses are EXCLUDED — they must never count toward requirements.
 */
function effectiveSpecial(key) {
    const base = special[key] ?? 0;
    const c = getCachedBonuses();
    const td = c.trait.specialDelta[key] ?? 0;
    const pd = c.perk.perkSpecialDelta[key] ?? 0;
    return Math.max(1, base + td + pd);
}

/**
 * Returns the MODIFIED (display) value of a SPECIAL stat.
 * Includes all conditional toggle bonuses on top of the base.
 * Used only for rendering — NEVER for eligibility checks.
 */
function modifiedSpecial(key) {
    const base = effectiveSpecial(key);
    const { specDelta } = getCachedBonuses().cond;
    const { specDelta: gearDelta } = getGearEffectsDelta();
    return Math.max(1, base + (specDelta[key] ?? 0) + (gearDelta[key] ?? 0));
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
        
        // Update bar fill and tier class
        const barFill = row.querySelector('.spec-bar-fill');
        if (barFill) {
            const displayValue = Math.max(1, Math.min(10, modVal));
            const barPercent = Math.max(0, Math.min(100, displayValue * 10));
            barFill.style.width = barPercent + '%';
            
            // Update bar tier class
            const barTier = displayValue >= 10 ? 'spec-bar-max' : displayValue >= 8 ? 'spec-bar-high' : displayValue >= 6 ? 'spec-bar-mid' : displayValue >= 4 ? 'spec-bar-low' : 'spec-bar-dim';
            barFill.className = 'spec-bar-fill ' + barTier;
        }
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

// Cache pre-parsed perk requirements (re-parsing 200+ perk strings on every render is wasteful)
const _reqCache = new WeakMap();
function meetsRequirements(perk) {
    let parsed = _reqCache.get(perk);
    if (!parsed) {
        const req = perk.req;
        const lvlM = req.match(/Level\s+(\d+)/i);
        parsed = {
            level: lvlM ? parseInt(lvlM[1]) : 0,
            partsArrays: req.split(',').map(s => s.trim()).filter(c => !/^Level\s/i.test(c)).map(c => c.split(/\s+or\s+/i))
        };
        _reqCache.set(perk, parsed);
    }
    if (parsed.level && charLevel < parsed.level) return false;
    for (const parts of parsed.partsArrays) {
        if (!parts.some(part => parsePartMet(part))) return false;
    }
    return true;
}

function checkPerkRequirements(row, perk) {
    const warningEl = row.querySelector('.prog-req-warning');
    if (!warningEl) return;
    const failures = [];
    let parsed = _reqCache.get(perk);
    if (!parsed) {
        const req = perk.req;
        const lvlM = req.match(/Level\s+(\d+)/i);
        parsed = {
            level: lvlM ? parseInt(lvlM[1]) : 0,
            partsArrays: req.split(',').map(s => s.trim()).filter(c => !/^Level\s/i.test(c)).map(c => c.split(/\s+or\s+/i))
        };
        _reqCache.set(perk, parsed);
    }

    // Level check
    if (parsed.level) {
        const rowLvl = parseInt((row.querySelector('.lvl-tag')?.textContent || '').match(/\d+/)?.[0] || '0');
        if (rowLvl > 0 && rowLvl < parsed.level)
            failures.push(`Level: slot is Lvl ${rowLvl}, perk needs Lvl ${parsed.level}`);
    }

    // AND-grouped requirement chunks
    for (const parts of parsed.partsArrays) {
        const anyMet = parts.some(part => parsePartMet(part));
        if (!anyMet) {
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
    const nameInput = row.querySelector('.prog-name-input');
    const oldName = (nameInput.value || '').trim();
    // Revert Intense Training's SPECIAL +1 when its row is cleared
    const it = oldName.match(/^Intense Training \(\+1 (STR|PER|END|CHA|INT|AGI|LCK)\)/i);
    if (it && (special[it[1]] || 5) > 1) special[it[1]] -= 1;
    // Clear the 4th-skill designation when the Tag! row is cleared
    const baseName = oldName.replace(/\s*[\[(].*?[\])]$/, '').trim().toUpperCase();
    if (baseName === 'TAG!' && _fourthTagSkill) _fourthTagSkill = null;
    // Purge conditional toggle state + widget when a conditional perk row is cleared
    const condBase = oldName.replace(/\s*[\[(].*?[\])]$/, '').trim();
    if (CONDITIONAL_PERK_NAMES && CONDITIONAL_PERK_NAMES.has(condBase)) {
        delete conditionalToggles[condBase];
    }
    const toggleRow = row.querySelector('.cond-toggle-row');
    if (toggleRow) toggleRow.remove();
    nameInput.value = '';
    row.querySelector('.prog-notes-input').value = '';
    row.querySelector('.prog-perk-info').style.display = 'none';
    row.querySelector('.prog-rank-badge').style.display = 'none';
    row.querySelector('.prog-clear-btn').style.display = 'none';
    row.classList.remove('has-perk', 'req-fail');
    const warn = row.querySelector('.prog-req-warning');
    if (warn) { warn.style.display = 'none'; warn.innerHTML = ''; }
    updateAll();
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
    const traitDiv = document.getElementById('level-up-traits-list');
    // Save current trait slot choices before wiping
    const savedTraits = {};
    (traitDiv || div).querySelectorAll('.trait-slot-row').forEach(r => {
        const id = r.id, chosen = r.getAttribute('data-chosen') || '';
        if (id && chosen) savedTraits[id] = chosen;
    });
    div.innerHTML = '';
    if (traitDiv) traitDiv.innerHTML = '';
    // Level progression rows (starting traits are managed separately).
    // Level-up trait slots (every 4 levels from 5) live in the visible
    // TRAITS & IMPLANTS tab, not the hidden ghost perk store.
    for(let i=2; i<=50; i++) {
        const isP = i % 2 === 0;
        const isT = (i>=5 && (i-5)%4===0);
        if(isP) div.insertAdjacentHTML('beforeend', makeProgRow(`LVL ${i} PERK`, false, false));
        if(isT) {
            const slotId = `trait-slot-lvl-${i}`;
            // Only render rows for traits that have actually been taken — no
            // pre-populated empty slots (rows appear when a trait is taken via level-up)
            if (savedTraits[slotId]) {
                (traitDiv || div).insertAdjacentHTML('beforeend', makeTraitRow(slotId, `LVL ${i} TRAIT`, savedTraits[slotId]));
            }
        }
    }
}

function syncTagLimit() {
    const cbs = Array.from(document.querySelectorAll('#tag-area input'));
    const count = cbs.filter(c => c.checked).length;
    const locked = isCreationLocked();
    cbs.forEach(c => {
        const item = c.parentElement;
        const marker = item.querySelector('.tag-marker');
        if (locked) {
            // Creation choices are locked after the first level-up — all tag toggles frozen
            c.disabled = true;
            item.classList.add('locked');
            item.classList.add('creation-locked');
            if (marker) marker.textContent = c.checked ? '[X]' : '[ ]';
        } else if(!c.checked && count >= 3) {
            c.disabled = true;
            item.classList.add('locked');
            if (marker) marker.textContent = '[ ]';
        } else {
            c.disabled = false;
            item.classList.remove('locked');
            item.classList.remove('creation-locked');
            if (marker) marker.textContent = c.checked ? '[X]' : '[ ]';
        }
    });
}

function toggleTag(itemEl) {
    const cb = itemEl.querySelector('input[type="checkbox"]');
    if (!cb || cb.disabled) return;
    if (!cb.checked) {
        // Enforce the 3-tag limit even when rapid clicks outpace the re-render
        const count = Array.from(document.querySelectorAll('#tag-area input:checked')).length;
        if (count >= 3) {
            showToast('MAX 3 TAGGED SKILLS — clear one first to tag another.', 3000);
            return;
        }
    }
    cb.checked = !cb.checked;
    syncTagLimit();
    const marker = itemEl.querySelector('.tag-marker');
    if (marker) marker.textContent = cb.checked ? '[X]' : '[ ]';
    triggerAutosave();
}

/* ===== AUTOSAVE & PERSISTENCE ===== */
let _autosaveDebounce = null;
let _undoPushTimer = null;
function triggerAutosave() {
    // Debounce undo snapshots: typing bursts collapse to one push instead of
    // serializing the whole build on every keystroke.
    clearTimeout(_undoPushTimer);
    _undoPushTimer = setTimeout(pushUndoState, 400);
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
    const questChecks = Array.from(document.querySelectorAll('#quest-list-container input')).map(i => i.checked);
    const collChecks = Array.from(document.querySelectorAll('#coll-list input')).map(i => i.checked);
    regionalStorage[origin].quests = questChecks;
    regionalStorage[origin].colls = collChecks;
    return {
        name: document.getElementById('char-name').value, special, mode, origin,
        regionalStorage,
        notes: document.getElementById('user-notes').value,
        tags: Array.from(document.querySelectorAll('#tag-area input')).map(i => i.checked),
        traits: LEVEL_UP_TRAIT_LEVELS.map(lvl => {
            const row = document.getElementById('trait-slot-lvl-' + lvl);
            return row ? (row.getAttribute('data-chosen') || '') : '';
        }),
        // Note: startingTraits is serialized separately
        perks: Array.from(document.querySelectorAll('#prog-list .prog-row:not(.trait-slot-row)')).map(r => [
            r.querySelector('.prog-name-input')?.value || '',
            r.querySelector('.prog-notes-input')?.value || ''
        ]),
        extraPerks: Array.from(document.querySelectorAll('#extra-perk-list .prog-row')).map(r => [
            r.querySelector('.prog-name-input')?.value || '',
            r.querySelector('.prog-notes-input')?.value || '',
            r.getAttribute('data-grant-trait') || ''
        ]),
        weapons: Array.from(document.querySelectorAll('#weapon-list .gear-card')).map(c => { const ins = c.querySelectorAll('.gear-field-input'); const sel = c.querySelector('.gear-skill-type-select'); return [ins[0]?.value||'', ins[1]?.value||'', ins[2]?.value||'', ins[3]?.value||'', sel?.value||'', ins[4]?.value||'']; }),
        armor: Array.from(document.querySelectorAll('#armor-list .gear-card')).map(c => { const ins = c.querySelectorAll('.gear-field-input'); const sel = c.querySelector('.gear-field-select'); return [ins[0]?.value||'', ins[1]?.value||'', sel?.value||'LIGHT', ins[2]?.value||'', ins[3]?.value||'', ins[4]?.value||'']; }),
        quests: questChecks,
        colls: collChecks,
        uniWpns: Array.from(document.querySelectorAll('.u-wpn-check')).map(i => i.checked),
        uniArmor: Array.from(document.querySelectorAll('.u-armor-check')).map(i => i.checked),
        skillPoints, charLevel, buildKarma,
        skillBooksFound: { CW: Object.fromEntries(skills.map(s => [s, [...(skillBooksFound.CW?.[s]||[])]])), MW: Object.fromEntries(skills.map(s => [s, [...(skillBooksFound.MW?.[s]||[])]])) },
        humbledLevel, humbledReductions, hasBeenHumbled,
        implantsTaken, rewardPerksList, internalizedTraitsList, gearEffectsList,
        fourthTagSkill: _fourthTagSkill || null,
        startingTraits: startingTraits,
        skillHistory: skillHistory,
        conditionalToggles: conditionalToggles,
        perkWishlist: perkWishlist || [],
        currentBuildName: currentBuildName || 'Current Build',
        levelUpBonuses: levelUpBonuses || [],
        forceEnable: _forceEnable,
        companions: companions.map(c => ({ name: c.name, butchBonus: c.butchBonus || null }))
    };
}


function exportBuild() {
    const data = collectData();
    const name = (data.name || 'dweller').replace(/[^a-zA-Z0-9_-]/g, '_');
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.nsbuild`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Build exported!', 'success');
}

function importBuildFromFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const raw = JSON.parse(ev.target.result);
            const safe = sanitizeImport(raw);
            if (!safe) {
                showToast('Import failed: Invalid file format', 'error');
                return;
            }
            hydrate(safe);
            showToast('Build loaded successfully!', 'success');
        } catch(err) {
            showToast('Import failed: Could not parse JSON file', 'error');
        }
    };
    reader.readAsText(file);
}

let _importInput = null;
function importBuild() {
    if (!_importInput) {
        _importInput = document.createElement('input');
        _importInput.type = 'file';
        _importInput.accept = '.nsbuild,.json';
        _importInput.style.display = 'none';
        _importInput.addEventListener('change', () => {
            if (_importInput.files[0]) importBuildFromFile(_importInput.files[0]);
            _importInput.value = '';
        });
        document.body.appendChild(_importInput);
    }
    _importInput.click();
}

// Drag-and-drop import on the planner
let _dropOverlay = null;
function _initDragDrop() {
    if (_dropOverlay) return;
    _dropOverlay = document.createElement('div');
    _dropOverlay.id = 'drop-overlay';
    _dropOverlay.innerHTML = '<div class="drop-msg">DROP .nsbuild FILE TO LOAD BUILD</div>';
    _dropOverlay.style.cssText = 'display:none;position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.75);align-items:center;justify-content:center;pointer-events:none;';
    document.body.appendChild(_dropOverlay);

    let dragCount = 0;
    document.addEventListener('dragenter', e => {
        e.preventDefault();
        dragCount++;
        if (dragCount === 1) _dropOverlay.style.display = 'flex';
    });
    document.addEventListener('dragleave', e => {
        e.preventDefault();
        dragCount--;
        if (dragCount <= 0) { dragCount = 0; _dropOverlay.style.display = 'none'; }
    });
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
        e.preventDefault();
        dragCount = 0;
        _dropOverlay.style.display = 'none';
        const file = e.dataTransfer?.files?.[0];
        if (file && (file.name.endsWith('.nsbuild') || file.name.endsWith('.json'))) {
            importBuildFromFile(file);
        } else {
            showToast('Drop a .nsbuild or .json file', 'error');
        }
    });
}
// Initialize on first interaction
document.addEventListener('DOMContentLoaded', () => setTimeout(_initDragDrop, 100));

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
    // Detect format: new per-origin { CW: { BARTER: [0,2] } } vs old flat { BARTER: N }
    if (d.skillBooksFound && typeof d.skillBooksFound === 'object') {
        if ('CW' in d.skillBooksFound && typeof d.skillBooksFound.CW === 'object') {
            // New per-origin format (arrays of indices or legacy flat counts)
            skills.forEach(s => {
                const cw = d.skillBooksFound.CW[s];
                const mw = d.skillBooksFound.MW[s];
                if (Array.isArray(cw)) {
                    skillBooksFound.CW[s] = cw.filter(i => typeof i === 'number' && i >= 0);
                } else if (typeof cw === 'number' && cw > 0) {
                    // Migration: old per-origin flat count → array of first N indices
                    skillBooksFound.CW[s] = Array.from({length: cw}, (_, i) => i);
                } else {
                    skillBooksFound.CW[s] = [];
                }
                if (Array.isArray(mw)) {
                    skillBooksFound.MW[s] = mw.filter(i => typeof i === 'number' && i >= 0);
                } else if (typeof mw === 'number' && mw > 0) {
                    skillBooksFound.MW[s] = Array.from({length: mw}, (_, i) => i);
                } else {
                    skillBooksFound.MW[s] = [];
                }
            });
        } else {
            // Old flat format — migrate: assign combined total to the origin of the loaded data
            const targetOrigin = d.origin || origin;
            skills.forEach(s => {
                const v = parseInt(d.skillBooksFound[s]);
                const val = (!isNaN(v) && v >= 0) ? v : 0;
                skillBooksFound[targetOrigin][s] = Array.from({length: val}, (_, i) => i);
                skillBooksFound[targetOrigin === 'CW' ? 'MW' : 'CW'][s] = [];
            });
        }
    } else {
        resetSkillBooksFound();
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
    gearEffectsList = Array.isArray(d.gearEffectsList) ? d.gearEffectsList : [];
    _fourthTagSkill = d.fourthTagSkill || null;
    // If we have a 4th tag skill, ensure its checkbox is checked in the tag area
    if (_fourthTagSkill) {
        const skills_list = ['BARTER','BIG GUNS','ENERGY WEAPONS','EXPLOSIVES','GUNS','LOCKPICK','MEDICINE','MELEE WEAPONS','REPAIR','SCIENCE','SNEAK','SPEECH','SURVIVAL','UNARMED'];
        const skillIdx = skills_list.indexOf(_fourthTagSkill);
        const tagCbs = document.querySelectorAll('#tag-area input');
        if (skillIdx >= 0 && tagCbs[skillIdx]) {
            tagCbs[skillIdx].checked = true;
            const marker = tagCbs[skillIdx].parentElement.querySelector('.tag-marker');
            if (marker) marker.textContent = '[X]';
        }
    }
    startingTraits = Array.isArray(d.startingTraits) ? d.startingTraits : [];
    skillHistory = Array.isArray(d.skillHistory) ? d.skillHistory : [];
    companions = Array.isArray(d.companions)
        ? d.companions.map(c => ({
            name: c && c.name,
            butchBonus: (c && (c.butchBonus === 'improved' || c.butchBonus === 'worsened')) ? c.butchBonus : null
        })).filter(c => COMPANIONS_DATA.some(x => x.name === c.name))
        : [];
    conditionalToggles = (d.conditionalToggles && typeof d.conditionalToggles === 'object')
        ? Object.fromEntries(Object.entries(d.conditionalToggles).filter(([k,v]) => typeof k === 'string' && typeof v === 'boolean' && !isKarmaDrivenConditional(k)))
        : {};
    perkWishlist = Array.isArray(d.perkWishlist) ? d.perkWishlist : [];
    currentBuildName = d.currentBuildName || 'Current Build';
    levelUpBonuses = Array.isArray(d.levelUpBonuses) ? d.levelUpBonuses : [];
    setMode(d.mode, true);
    setOrigin(d.origin, true);
    _forceEnable = !!d.forceEnable;
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
    d.weapons.forEach(v => { addWeapon(); const c = document.querySelector('#weapon-list .gear-card:last-child'); const ins = c.querySelectorAll('.gear-field-input'); const sel = c.querySelector('.gear-skill-type-select'); if(ins[0]) ins[0].value = v[0]||''; if(ins[1]) ins[1].value = v[1]||''; if(ins[2]) ins[2].value = v[2]||''; if(ins[3]) ins[3].value = v[3]||''; if(sel && v[4]) sel.value = v[4]; if(ins[4]) ins[4].value = v[5]||''; updateWeaponBadge(c); });
    document.getElementById('armor-list').innerHTML = '';
    d.armor.forEach(v => { addArmor(); const c = document.querySelector('#armor-list .gear-card:last-child'); const ins = c.querySelectorAll('.gear-field-input'); const sel = c.querySelector('.gear-field-select'); if(ins[0]) ins[0].value = v[0]||''; if(ins[1]) ins[1].value = v[1]||''; if(sel && v[2]) { sel.value = v[2]; updateArmorBadge(sel); } if(ins[2]) ins[2].value = v[3]||''; if(ins[3]) ins[3].value = v[4]||''; if(ins[4]) ins[4].value = v[5]||''; });
    // Restore trait slots from saved traits array (level-indexed: index i -> LVL 5+i*4).
    // Rows are only shown for taken traits, so wipe any stale rows then create per trait.
    const traitList = document.getElementById('level-up-traits-list');
    if (traitList) traitList.innerHTML = '';
    if (d.traits && Array.isArray(d.traits)) {
        d.traits.forEach((traitName, i) => {
            if (!traitName) return;
            const slotId = 'trait-slot-lvl-' + (5 + i * 4);
            ensureTraitSlotRow(slotId);
            const row = document.getElementById(slotId);
            if (row) {
                row.setAttribute('data-chosen', traitName);
                // Rebuild the row so conditional traits get their ⚡ toggle rendered
                rerenderTraitSlot(slotId);
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
            if (v[2]) ep.setAttribute('data-grant-trait', v[2]);
        }
    });
    const uC = document.querySelectorAll('.u-wpn-check');
    if(d.uniWpns) d.uniWpns.forEach((c, i) => { if(uC[i]) { uC[i].checked = c; updateUniqueMarker(uC[i]); } });
    const uA = document.querySelectorAll('.u-armor-check');
    if(d.uniArmor) d.uniArmor.forEach((c, i) => { if(uA[i]) { uA[i].checked = c; updateUniqueMarker(uA[i]); } });
    _hydrating = false;
    syncForceButtons();
    updateAll();
    reCheckAllPerkRows();
    renderImplants();
    renderRewardPerksList();
    renderInternalizedTraitsList();
    renderGearEffectsList();
    renderStartingTraitsList();
    if (document.getElementById('tab-skilllog')?.style.display !== 'none') {
        renderSkillLog();
    }
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

    const detail = document.getElementById('archetype-detail');
    if (!detail) return;

    // Archetype builds are stored directly in ARCHETYPES_DATA (no share codes)
    const bd = a.build || a;

    const skillNames = ['BARTER','BIG GUNS','ENERGY WEAPONS','EXPLOSIVES','GUNS','LOCKPICK','MEDICINE','MELEE WEAPONS','REPAIR','SCIENCE','SNEAK','SPEECH','SURVIVAL','UNARMED'];
    const taggedSkills = skillNames.filter((_,i) => bd.tags && bd.tags[i]);

    const perkLvls = [];
    for (let i = 2; i <= (bd.charLevel || 30); i++) {
        if (i % 2 === 0) perkLvls.push(i);
    }

    const specHtml = ['STR','PER','END','CHA','INT','AGI','LCK'].map(k => {
        const v = (bd.special && bd.special[k]) || 0;
        const bars = Array.from({length:10},(_,i)=>`<span class="aspec-pip${i<v?' aspec-pip-on':''}"></span>`).join('');
        return `<div class="aspec-row"><span class="aspec-key">${k}</span>${bars}<span class="aspec-num">${v}</span></div>`;
    }).join('');

    const allPerks = (bd.perks || []).filter(p => p && p[0]);
    const perksPreview = allPerks.slice(0, 8).map((p, i) =>
        `<div class="arch-perk-row"><span class="arch-perk-lvl">LVL ${perkLvls[i] || '?'}</span><span class="arch-perk-name">${p[0]}</span></div>`
    ).join('');
    const remaining = allPerks.length - 8;

    const traitNames = (bd.startingTraits || []).map(t => t.name).join(', ') || 'None';

    // Description: archetype meta description first; otherwise only the PLAY
    // STYLE half of the notes (never the raw headers), trimmed to fit the card.
    const noteStyle = (bd.notes || '')
        .replace(/^\s*PLAY STYLE\s*/i, '')
        .split(/\n\s*RP\s*\n/)[0]
        .trim();
    const descText = a.description || (noteStyle ? noteStyle.substring(0, 280) : '');

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
            ${descText ? `<p style="font-size:0.68rem;opacity:0.7;line-height:1.7;margin:0;overflow-wrap:break-word;white-space:pre-line;">${descText}</p>` : ''}
        </div>
        <div class="arch-detail-cols">
            <div class="arch-detail-col">
                <div class="arch-section-label">S.P.E.C.I.A.L.</div>
                <div class="aspec-grid">${specHtml}</div>
                <div class="arch-section-label" style="margin-top:12px;">TAGGED SKILLS</div>
                <div style="font-size:0.72rem;color:var(--pip-color);letter-spacing:0.5px;">${taggedSkills.join(' · ') || 'None'}</div>
                <div class="arch-section-label" style="margin-top:12px;">STARTING TRAITS</div>
                <div style="font-size:0.72rem;color:#c8a0ff;letter-spacing:0.5px;">${traitNames}</div>
            </div>
            <div class="arch-detail-col">
                <div class="arch-section-label">SUGGESTED PERK PATH (LVL 2–${perkLvls[Math.min(7, allPerks.length - 1)] || '?'})</div>
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

async function loadArchetype(id) {
    const a = ARCHETYPES_DATA.find(x => x.id === id);
    if (!a) return;
    const confirmed = await showConfirmDialog({
        title: 'LOAD ARCHETYPE',
        message: 'Load "' + escHtml(a.name).toUpperCase() + '"?<br><span style="opacity:0.6; font-size:0.85em;">This will overwrite your current build. Export first if you want to keep it.</span>',
        confirmText: 'LOAD',
        cancelText: 'CANCEL',
        isDanger: true
    });
    if (!confirmed) return;
    // Embedded full build data (modern) — hydrate directly
    if (a.build) {
        const safe = sanitizeImport(a.build);
        if (!safe) { showAlertDialog({ title: 'ARCHETYPE DATA VALIDATION FAILED', message: 'This archetype could not be loaded from its embedded data.' }); return; }
        closeArchetypesModal();
        _selectedArchetypeId = null;
        hydrate(safe);
        nsAudio.diceRoll();
        showPerkToastMsg('ARCHETYPE LOADED: ' + a.name.toUpperCase());
        triggerAutosave();
        const btn = document.getElementById('tab-btn-prog');
        if (btn) {
            btn.style.boxShadow = '0 0 12px var(--pip-color)';
            btn.style.background = 'var(--pip-color)';
            btn.style.color = 'black';
            setTimeout(() => { if (!btn.classList.contains('active')) { btn.style.boxShadow=''; btn.style.background=''; btn.style.color=''; } }, 1200);
        }
        return;
    }
    // Legacy full-data archetype (no embedded build)
    const buildData = {
        name: a.name,
        notes: a.notes || ('Archetype: ' + a.name + ' — ' + a.tagline),
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
        uniWpns: a.uniWpns ? a.uniWpns.slice() : [],
        uniArmor: a.uniArmor ? a.uniArmor.slice() : [],
        skillPoints: a.skillPoints ? Object.assign({}, a.skillPoints) : Object.fromEntries(skills.map(s => [s, 0])),
        skillBooksFound: { CW: Object.fromEntries(skills.map(s => [s, []])), MW: Object.fromEntries(skills.map(s => [s, []])) },
        charLevel: a.charLevel || 1,
        skillHistory: a.skillHistory ? a.skillHistory.slice() : [],
        conditionalToggles: {},
        implantsTaken: a.implantsTaken ? Object.assign({}, a.implantsTaken) : {},
        rewardPerksList: [],
        internalizedTraitsList: [],
        fourthTagSkill: (() => {
            // Detect 4th tag skill if build has Tag! perk in its perks list
            const hasTagPerk = a.perks.some(p => p && p[0] && p[0].trim().toUpperCase() === 'TAG!');
            if (!hasTagPerk) return null;
            // Starting tags come from a.tags boolean array
            const skillNames = ['BARTER','BIG GUNS','ENERGY WEAPONS','EXPLOSIVES','GUNS','LOCKPICK','MEDICINE','MELEE WEAPONS','REPAIR','SCIENCE','SNEAK','SPEECH','SURVIVAL','UNARMED'];
            const startingTagged = new Set(skillNames.filter((_, i) => a.tags[i]));
            // Find any skill in the last skillHistory entry's tagged array that isn't a starting tag
            const lastEntry = a.skillHistory && a.skillHistory[a.skillHistory.length - 1];
            if (lastEntry && Array.isArray(lastEntry.tagged)) {
                const fourth = lastEntry.tagged.find(s => !startingTagged.has(s));
                if (fourth) return fourth;
            }
            return null;
        })(),
        perkWishlist: [],
        currentBuildName: a.name,
        levelUpBonuses: a.levelUpBonuses ? a.levelUpBonuses.slice() : [],
        humbledLevel: 0,
        humbledReductions: {},
        hasBeenHumbled: false,
        regionalStorage: { CW:{quests:[],colls:[]}, MW:{quests:[],colls:[]} },
    };
    const safe = sanitizeImport(buildData);
    if (!safe) { showAlertDialog({ title: 'ARCHETYPE LOAD ERROR', message: 'This archetype could not be loaded.' }); return; }
    closeArchetypesModal();
    _selectedArchetypeId = null;
    hydrate(safe);
    nsAudio.diceRoll();
    showPerkToastMsg('ARCHETYPE LOADED: ' + a.name.toUpperCase());
    triggerAutosave();
    const btn = document.getElementById('tab-btn-prog');
    if (btn) {
        btn.style.boxShadow = '0 0 12px var(--pip-color)';
        btn.style.background = 'var(--pip-color)';
        btn.style.color = 'black';
        setTimeout(() => { if (!btn.classList.contains('active')) { btn.style.boxShadow=''; btn.style.background=''; btn.style.color=''; } }, 1200);
    }
}

async function purgeMemory() {
    const confirmed = await showConfirmDialog({
        title: '⚛ TOTAL ATOMIC ANNIHILATION',
        message: 'This will reset your current build to defaults. Your saved builds in Build Manager will be preserved. Continue?',
        confirmText: 'ANNIHILATE',
        cancelText: 'Cancel',
        isDanger: true
    });
    
    if (!confirmed) return;

    // Nuclear countdown — centered display
    const countdownEl = document.createElement('div');
    countdownEl.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);font-size:5rem;font-weight:bold;color:#ff2020;text-shadow:0 0 40px rgba(255,0,0,0.6),0 0 80px rgba(255,0,0,0.3);font-family:monospace;letter-spacing:0.1em;pointer-events:none;';
    document.body.appendChild(countdownEl);
    const countSteps = ['☢ 3', '☢ 2', '☢ 1', '☢ ANNIHILATING'];
    for (let i = 0; i < countSteps.length; i++) {
        countdownEl.textContent = countSteps[i];
        await new Promise(r => setTimeout(r, 1000));
    }
    countdownEl.remove();

    try {
        // Preserve saved builds and collapsed sections before nuking
        const savedBuildsBackup = localStorage.getItem('NS_SavedBuilds');
        const collapsedSectionsBackup = localStorage.getItem('collapsed_sections');
        const themeBackup = localStorage.getItem('ns_custom_theme');
        
        // Clear everything
        localStorage.clear();
        
        // Restore preserved data
        if (savedBuildsBackup) {
            localStorage.setItem('NS_SavedBuilds', savedBuildsBackup);
        }
        if (collapsedSectionsBackup) {
            localStorage.setItem('collapsed_sections', collapsedSectionsBackup);
        }
        if (themeBackup) {
            localStorage.setItem('ns_custom_theme', themeBackup);
        }
        
        // CRT shutdown effect
        const shroud = document.createElement('div');
        shroud.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#000;opacity:0;transition:opacity 0.4s;pointer-events:none;';
        document.body.appendChild(shroud);
        // Quick flicker then fade to black
        setTimeout(() => { shroud.style.opacity = '0.15'; }, 30);
        setTimeout(() => { shroud.style.opacity = '0'; }, 80);
        setTimeout(() => { shroud.style.opacity = '0.25'; }, 110);
        setTimeout(() => { shroud.style.opacity = '0'; }, 140);
        setTimeout(() => { shroud.style.transition = 'opacity 0.6s'; shroud.style.opacity = '1'; }, 180);
        await new Promise(r => setTimeout(r, 900));

        location.reload();
    } catch(e) {
        console.error('Purge failed:', e);
        showToast('Reset failed - check console for details', 'error');
    }
}
/* ═══════════════════════════════════════════════════════════════════════
   SHARE-CODE (NSB3/NSB5) SYSTEM REMOVED
   Legacy relic: archetype builds now embed their full data in data.js.
   No share-code encoding/decoding exists in the planner anymore.
═══════════════════════════════════════════════════════════════════════ */
/* ===== BUILD MANAGEMENT SYSTEM ===== */

// Load saved builds from localStorage
function loadSavedBuildsList() {
    let stored = null;
    try { stored = localStorage.getItem('NS_SavedBuilds'); } catch(e) {}
    let parsed = [];
    if (stored) {
        try { parsed = JSON.parse(stored); } catch(e) { parsed = []; }
    }
    savedBuilds = Array.isArray(parsed) ? parsed : [];
    return savedBuilds;
}

// Save builds list to localStorage
function saveBuildsList() {
    try { localStorage.setItem('NS_SavedBuilds', JSON.stringify(savedBuilds)); } catch(e) {}
}

// Save current build to the builds list
async function saveCurrentBuild() {
    const name = await showPromptDialog({
        title: 'ENTER BUILD NAME',
        initial: currentBuildName || 'My Build',
        confirmText: 'SAVE'
    });
    if (!name) return;
    
    const buildData = collectData();
    buildData.currentBuildName = name;
    
    // Check if build with this name exists
    const existingIndex = savedBuilds.findIndex(b => b.name === name);
    
    if (existingIndex >= 0) {
        const confirmed = await showConfirmDialog({
            title: 'OVERWRITE BUILD',
            message: 'A saved build named "' + escHtml(name) + '" already exists. Overwrite it?',
            confirmText: 'OVERWRITE',
            cancelText: 'Cancel',
            isDanger: true
        });
        if (!confirmed) return;
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
    showPerkToastMsg(`BUILD SAVED: ${name}`);
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
        showPerkToastMsg(`BUILD LOADED: ${build.name}`);
        closeBuildManager();
    }
}

// Delete a build
async function deleteBuild(index) {
    if (index < 0 || index >= savedBuilds.length) return;
    
    const build = savedBuilds[index];
    const confirmed = await showConfirmDialog({
        title: 'DELETE BUILD',
        message: 'Delete saved build "' + escHtml(build.name) + '"?',
        confirmText: 'DELETE',
        cancelText: 'Cancel',
        isDanger: true
    });
    if (!confirmed) return;
    
    savedBuilds.splice(index, 1);
    saveBuildsList();
    showPerkToastMsg(`BUILD DELETED`);
    renderBuildsManager();
}

// Duplicate a build
async function duplicateBuild(index) {
    if (index < 0 || index >= savedBuilds.length) return;
    
    const original = savedBuilds[index];
    const copy = JSON.parse(JSON.stringify(original));
    copy.name = await showPromptDialog({
        title: 'ENTER NAME FOR COPY',
        initial: original.name + ' (Copy)',
        confirmText: 'DUPLICATE'
    });
    if (!copy.name) return;
    
    copy.timestamp = Date.now();
    savedBuilds.push(copy);
    saveBuildsList();
    showPerkToastMsg(`BUILD DUPLICATED`);
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

// Clear all saved builds
async function clearAllSavedBuilds() {
    if (savedBuilds.length === 0) {
        showToast('No saved builds to clear', 'info');
        return;
    }
    
    const confirmed = await showConfirmDialog({
        title: 'Clear All Saved Builds',
        message: `This will permanently delete all ${savedBuilds.length} saved build${savedBuilds.length !== 1 ? 's' : ''}. This cannot be undone. Continue?`,
        confirmText: 'Delete All',
        cancelText: 'Cancel',
        isDanger: true
    });
    
    if (!confirmed) return;
    
    savedBuilds = [];
    try {
        localStorage.setItem('NS_SavedBuilds', JSON.stringify(savedBuilds));
        showToast('All saved builds cleared', 'success');
        renderBuildsManager();
    } catch(e) {
        showToast('Failed to clear builds', 'error');
    }
}

// Render builds list
function renderBuildsManager() {
    const list = document.getElementById('builds-list');
    const countDisplay = document.getElementById('builds-count-display');
    
    if (!list) return;
    
    // Update count display
    if (countDisplay) {
        const count = savedBuilds.length;
        countDisplay.textContent = `${count} saved build${count !== 1 ? 's' : ''}`;
    }
    
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
/* Vegas-style dice roll: a leather cup rattles, then tips and the dice roll out onto the
   table. On each roll one of several routines is picked at random (shake, tip, and arc). */
const DICE_ROLL_VARIANTS = [
    { shake: 'cupShakeA', toss: 'cupTossA', d1: 'tossA1', d2: 'tossA2', shakeMs: 700, tossMs: 640 },
    { shake: 'cupShakeB', toss: 'cupTossB', d1: 'tossB1', d2: 'tossB2', shakeMs: 760, tossMs: 720 },
    { shake: 'cupShakeC', toss: 'cupTossC', d1: 'tossC1', d2: 'tossC2', shakeMs: 840, tossMs: 800 }
];
function rollDiceAnimation() {
    return new Promise((resolve) => {
        const faces = ['⚀','⚁','⚂','⚃','⚄','⚅'];
        const pick = () => faces[Math.floor(Math.random() * faces.length)];
        const v = DICE_ROLL_VARIANTS[Math.floor(Math.random() * DICE_ROLL_VARIANTS.length)];
        const overlay = document.createElement('div');
        overlay.className = 'dice-roll-overlay';
        overlay.innerHTML = `
            <div class="dice-roll-box">
                <div class="dice-vault">
                    <div class="dice-table"></div>
                    <div class="dice-cup">
                        <div class="dice-vault-die d1">${pick()}</div>
                        <div class="dice-vault-die d2">${pick()}</div>
                    </div>
                </div>
                <div class="dice-roll-label">ROLLING THE BONES...</div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cup = overlay.querySelector('.dice-cup');
        const d1 = overlay.querySelector('.d1');
        const d2 = overlay.querySelector('.d2');
        const finish = () => {
            overlay.classList.add('dice-roll-fade');
            setTimeout(() => { overlay.remove(); resolve(); }, 300);
        };

        // Respect reduced-motion: roll instantly, no show
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            setTimeout(finish, 60);
            return;
        }

        const shakeMs = v.shakeMs + Math.floor(Math.random() * 140);
        cup.style.animation = `${v.shake} 0.1s linear infinite alternate`;
        d1.style.animation = 'cupRattle1 0.13s linear infinite alternate';
        d2.style.animation = 'cupRattle2 0.17s linear infinite alternate';
        setTimeout(() => {
            // Tip the cup and release the dice over the rim — they only become visible as they leave
            cup.style.animation = `${v.toss} ${v.tossMs}ms ease-out forwards`;
            d1.style.opacity = '1';
            d2.style.opacity = '1';
            d1.style.animation = `${v.d1} ${v.tossMs}ms cubic-bezier(.3,.7,.5,1) forwards`;
            d2.style.animation = `${v.d2} ${v.tossMs}ms cubic-bezier(.3,.7,.5,1) forwards`;
        }, shakeMs);
        setTimeout(() => {
            // Dice stop here — snap their landed values and cue a table clack
            d1.textContent = pick();
            d2.textContent = pick();
            overlay.querySelector('.dice-vault').classList.add('landed');
            if (nsAudio && typeof nsAudio.clack === 'function') nsAudio.clack();
            setTimeout(finish, 300);
        }, shakeMs + v.tossMs + 40);
    });
}

async function randomizeBuild() {
    const confirmed = await showConfirmDialog({
        title: '🎲 WASTELAND FORTUNA',
        message: 'Let the dice decide your new destiny?<br><span style="opacity:0.6; font-size:0.85em;">Randomize wasteland, karma, S.P.E.C.I.A.L., tags, and starting traits — this will overwrite your current selections and reset you to LEVEL 1.</span>',
        confirmText: 'SPIN THE DICE',
        cancelText: 'BACK OUT'
    });
    if (!confirmed) return;
    nsAudio.diceRoll();
    await rollDiceAnimation();

    // ── Clear slate: reset progress so the reroll reads as fresh char creation.
    // This lifts the first-level-up lock (SPECIAL/tags/starting traits unlocked).
    charLevel = 1;
    if (typeof skillHistory !== 'undefined') skillHistory = [];
    if (typeof levelUpBonuses !== 'undefined') levelUpBonuses = [];
    if (typeof skillPoints !== 'undefined') { Object.keys(skillPoints).forEach(k => { skillPoints[k] = 0; }); }

    // ── Step 0: Random wasteland (origin)
    setOrigin(Math.random() < 0.5 ? 'CW' : 'MW', true);

    // ── Step 1: Random karma
    buildKarma = KARMA_TIERS[Math.floor(Math.random() * KARMA_TIERS.length)].id;

    // ── Step 2: Random name
    const nameInput = document.getElementById('char-name');
    if (nameInput) nameInput.value = getRandomWastelandName();

    // ── Step 3: Randomize SPECIAL — distribute the FULL pool so all points are used
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

    // ── Step 4: Randomize 3 Tags
    const shuffledSkills = [...skills].sort(() => Math.random() - 0.5);
    const chosenTags = shuffledSkills.slice(0, 3);
    const cbs = Array.from(document.querySelectorAll('#tag-area input'));
    cbs.forEach((cb, i) => {
        cb.checked = chosenTags.includes(skills[i]);
        cb.disabled = false;
        const marker = cb.parentElement.querySelector('.tag-marker');
        if (marker) marker.textContent = cb.checked ? '[X]' : '[ ]';
    });

    // ── Step 5: Randomize starting traits — SPECIAL is set first so eligibility checks work
    startingTraits = []; // clear so checkTraitEligible sees a clean slate
    // Evaluate requirements against the freshly rolled SPECIAL only (no stale perk/IT/implant deltas),
    // and NOT conflicts against traits picked within this roll
    const chosenNamesSoFar = [];
    const traitEligible = (t) => checkTraitEligible(t, {
        stat: (k) => (special[k] ?? 0),
        chosen: chosenNamesSoFar
    });
    const eligibleTraits = TRAITS_DATA.filter(traitEligible);
    const shuffledTraits = [...eligibleTraits].sort(() => Math.random() - 0.5);
    // Pick up to 5 eligible traits, excluding conflicting NOT pairs
    const chosenTraits = [];
    for (const t of shuffledTraits) {
        if (chosenTraits.length >= 5) break;
        if (traitEligible(t)) {
            chosenTraits.push(t);
            chosenNamesSoFar.push(t.name.toUpperCase());
        }
    }
    startingTraits = chosenTraits.map(t => ({ name: t.name }));
    renderStartingTraitsList();

    updateAll();
    reCheckAllPerkRows();
    triggerAutosave();

    // Flash confirmation
    const banner = document.getElementById('perk-lvlup-banner');
    if (banner) {
        banner.innerHTML = `<span style="font-size:0.75rem; letter-spacing:1px;">🎲 BUILD RANDOMIZED — REVIEW YOUR WASTELAND, KARMA, S.P.E.C.I.A.L., TAGS &amp; TRAITS</span><button onclick="this.parentElement.style.display='none'" style="margin-left:12px; padding:3px 8px; font-size:0.6rem; background:none; border:1px solid var(--pip-color); color:var(--pip-color); cursor:pointer;">DISMISS</button>`;
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
    if (srchEl) {
        srchEl.value = '';
        // Auto-focus for immediate typing
        setTimeout(() => srchEl.focus(), 50);
    }
    // Reset sort
    _perkPickerSort = 'az';
    const azP = document.getElementById('ppick-sort-az');
    const lvlP = document.getElementById('ppick-sort-lvl');
    if (azP) azP.classList.add('active');
    if (lvlP) lvlP.classList.remove('active');
    // Sync force button state to the global override
    syncForceButtons();
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
    if (srchEl) {
        srchEl.value = '';
        // Auto-focus for immediate typing
        setTimeout(() => srchEl.focus(), 50);
    }
    // Reset sort to A-Z on each open
    _perkPickerSort = 'az';
    const azP = document.getElementById('ppick-sort-az');
    const lvlP = document.getElementById('ppick-sort-lvl');
    if (azP) azP.classList.add('active');
    if (lvlP) lvlP.classList.remove('active');
    // Sync force button state to the global override
    syncForceButtons();
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
    beginBonusCache();
    try {
    const modal = document.getElementById('perk-picker-modal');
    const isTraitMode = modal && modal.getAttribute('data-mode') === 'trait';
    const forceOn = _forceEnable;
    const search = ((document.getElementById('perk-picker-search')||{}).value || '').toLowerCase().trim();

    const grid = document.getElementById('perk-picker-grid');
    if (!grid) return;

    // How many times is this perk already in the build?
    const takenCounts = getTakenPerkCounts();
    function takenCount(p) { return takenCounts.get(p.name.toUpperCase()) || 0; }
    // Is every rank of this perk already filled?
    function isFullyTaken(p) { return takenCount(p) >= p.ranks; }

    // Requirements evaluated once per perk per render (meetsRequirements cascades into
    // full bonus-tree recomputes on every call, so cache the per-render result)
    const reqOk = new Map();
    function meets(p) {
        if (!reqOk.has(p)) reqOk.set(p, meetsRequirements(p));
        return reqOk.get(p);
    }

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
            .filter(p => forceOn ? true : meets(p))
            .filter(p => !search || fuzzyMatch(p.name, search) || p.desc.toLowerCase().includes(search))
            .sort(sortPerks);
        const ineligible = available
            .filter(p => !(forceOn ? true : meets(p)))
            .filter(p => !search || fuzzyMatch(p.name, search) || p.desc.toLowerCase().includes(search))
            .sort(sortPerks);

        _perkPickerList = [...eligible, ...ineligible];
        const countEl = document.getElementById('perk-picker-count');
        if (countEl) countEl.textContent = `${eligible.length} ELIGIBLE · ${ineligible.length} INELIGIBLE`;

        grid.innerHTML = _perkPickerList.map((p, i) => {
            const isElig = i < eligible.length;
            const isForced = forceOn && !meets(p);
            const taken = takenCount(p);
            const lvlNum = perkLevel(p);
            const lvlBadge = lvlNum > 0 ? `<span class="pperk-lvl-badge">LVL ${lvlNum}</span>` : '';
            const rankBadge = p.ranks > 1
                ? `<span class="pperk-rank-badge pperk-rank-multi">★ ${taken}/${p.ranks} RANKS</span>`
                : `<span class="pperk-rank-badge">1 RANK</span>`;
            const isWishlisted = isPerkWishlisted(p.name);
            const wishlistBtn = `<button class="pperk-wishlist-btn ${isWishlisted ? 'wishlisted' : ''}" onclick="event.stopPropagation(); togglePerkWishlist('${p.name}')" title="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}">★</button>`;
            return `<div class="pperk-card pperk-trait-card ${isElig ? '' : 'pperk-ineligible'}" onclick="takePerkFromModal(${i})" title="${isForced ? 'FORCE TAKE (REQ BYPASSED)' : isElig ? 'TAKE THIS PERK' : 'REQUIREMENTS NOT MET'}">
                ${wishlistBtn}
                <div class="pperk-card-top">
                    <span class="pperk-name">${p.name}</span>
                    ${lvlBadge}
                    ${rankBadge}
                    ${isForced ? '<span class="pperk-inelig-tag pperk-forced-tag">⚡ FORCED</span>' : (!isElig ? '<span class="pperk-inelig-tag">REQ NOT MET</span>' : '')}
                </div>
                <div class="pperk-req">${p.req}</div>
                <div class="pperk-desc">${p.desc}</div>
                <button class="pperk-take-btn">${isForced ? '⚡ FORCE TAKE' : isElig ? '✓ TAKE THIS PERK' : '⚠ REQ NOT MET'}</button>
            </div>`;
        }).join('') || '<div style="grid-column:1/-1;text-align:center;opacity:0.4;padding:24px;">NO PERKS FOUND</div>';
    } else {
        // Level-up mode: show eligible and optionally ineligible perks with filters
        const available = PERKS_DATA.filter(p => !isFullyTaken(p));
        const eligible = available.filter(p => meets(p));
        
        let list, ineligibleList = [];
        
        if (_perkPickerShowIneligible || forceOn) {
            // Get ineligible perks and filter by block type
            const allIneligible = available.filter(p => !meets(p));
            ineligibleList = allIneligible.filter(p => {
                if (forceOn) return true; // force mode ignores block-type filters
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
            const natElig = meets(p);
            const isElig = forceOn ? true : natElig;
            const taken = takenCount(p);
            const lvlNum = perkLevel(p);
            const lvlBadge = lvlNum > 0 ? `<span class="pperk-lvl-badge">LVL ${lvlNum}</span>` : '';
            const rankBadge = p.ranks > 1
                ? `<span class="pperk-rank-badge pperk-rank-multi">★ ${taken}/${p.ranks} RANKS</span>`
                : `<span class="pperk-rank-badge">1 RANK</span>`;
            
            // Show what's blocking if ineligible
            let blockInfo = '';
            if (forceOn && !natElig) {
                blockInfo = `<span class="pperk-inelig-tag pperk-forced-tag">⚡ FORCED</span>`;
            } else if (!natElig && _perkPickerShowIneligible) {
                const blockType = getBlockType(p);
                const blockLabels = { level: '⏱ LEVEL', stats: '⚡ STATS', skills: '📖 SKILLS' };
                blockInfo = `<span class="pperk-inelig-tag">${blockLabels[blockType] || 'REQ NOT MET'}</span>`;
            }
            
            const isWishlisted = isPerkWishlisted(p.name);
            const wishlistBtn = `<button class="pperk-wishlist-btn ${isWishlisted ? 'wishlisted' : ''}" onclick="event.stopPropagation(); togglePerkWishlist('${p.name}')" title="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}">★</button>`;
            
            return `<div class="pperk-card ${isElig ? '' : 'pperk-ineligible'}" onclick="takePerkFromModal(${i})" title="${forceOn && !natElig ? 'FORCE TAKE (REQ BYPASSED)' : ''}">
                ${wishlistBtn}
                <div class="pperk-card-top">
                    <span class="pperk-name">${p.name}</span>
                    ${lvlBadge}
                    ${rankBadge}
                    ${blockInfo}
                </div>
                <div class="pperk-req">${p.req}</div>
                <div class="pperk-desc">${p.desc}</div>
                <button class="pperk-take-btn">${forceOn && !natElig ? '⚡ FORCE TAKE' : isElig ? '✓ TAKE THIS PERK' : '⚠ REQ NOT MET'}</button>
            </div>`;
        }).join('') || '<div style="grid-column:1/-1;text-align:center;opacity:0.4;padding:24px;">NO PERKS FOUND</div>';
    }
    } finally { endBonusCache(); }
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

function togglePerkPickerForce() {
    toggleForceEnable();
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

function toggleTraitPickerForce() {
    toggleForceEnable();
}

/* Global FORCE ENABLE override — applies to the perk picker, trait picker, and the
 * main ALL PERKS / TRAITS tabs. Stays on until toggled off, so force-taken perks
 * and traits survive reloads. */
function syncForceButtons() {
    ['tpick-force', 'ppick-force', 'force-main-perks', 'force-main-traits'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.classList.toggle('active', _forceEnable);
    });
}

function toggleForceEnable() {
    setForceEnable(!_forceEnable);
}

function setForceEnable(on) {
    _forceEnable = on;
    syncForceButtons();
    showToast(on ? '⚡ FORCE ENABLE ON — trait/perk requirements are ignored' : 'FORCE ENABLE OFF', 'info', 2600);
    const search = (document.getElementById('trait-modal-search') || {}).value || '';
    renderTraitGrid(search);
    renderPerkPickerGrid();
    renderAllPerks();
}

function takePerkFromModal(idx) {
    const perk = _perkPickerList[idx];
    if (!perk) return;
    if (!_forceEnable && !meetsRequirements(perk)) return;

    const modal = document.getElementById('perk-picker-modal');
    const isTraitMode = modal && modal.getAttribute('data-mode') === 'trait';

    if (isTraitMode) {
        // Add as a bonus perk in extra-perk-list
        addExtraPerk();
        const extras = document.querySelectorAll('#extra-perk-list .prog-row');
        const last = extras[extras.length - 1];
        if (last) selectPerkInRow(last, perk.name);
        // Remember which trait granted this bonus perk so the PERK & TRAIT
        // LOG can interleave it directly under the granting trait
        if (last && modal) {
            const trait = modal.getAttribute('data-trait');
            if (trait) last.setAttribute('data-grant-trait', trait);
        }
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
    const originClass = (origin === 'MW') ? 'theme-mw' : 'theme-cw';
    document.body.className = originClass;
    if (_activeCustomTheme) document.body.classList.add('theme-' + _activeCustomTheme);
    if (!skipSave) {
        try { localStorage.setItem('NS_CustomTheme', _activeCustomTheme); } catch(e) {}
    }
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
    updateAll();            // karma-driven trait/perk bonuses auto-follow the selected karma
    syncProgToggleStates(); // sync the read-only karma indicators on prog/extra rows
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
    if (hasBeenHumbled) { showAlertDialog({ title: 'HEAD TRAUMA', message: 'Transit already applied. Your SPECIAL has already been humbled.' }); return; }
    _humbledPickedStats = [];
    renderHumbledPicker();
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
    const stats = ['STR','PER','END','CHA','INT','AGI','LCK'];
    grid.innerHTML = stats.map(s => {
        const picked = _humbledPickedStats.includes(s);
        const cur = special[s] || 5;
        const canDrop = cur > 1;
        return `<button class="humbled-stat-btn${picked ? ' humbled-stat-picked' : ''}${canDrop ? '' : ' humbled-stat-disabled'}"
            ${canDrop ? `onclick="toggleHumbledStat('${s}')"` : 'disabled'}
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
    _humbledPickedStats.forEach(s => {
        humbledReductions[s] = 1;
        // Apply the permanent -1 to the chosen SPECIAL stats (floor 1)
        if ((special[s] || 5) > 1) special[s] -= 1;
    });
    // Reset level and skills
    charLevel = 1;
    Object.keys(skillPoints).forEach(k => { skillPoints[k] = 0; });
    // Clear skill history too
    if (typeof skillHistory !== 'undefined') skillHistory = [];
    // Clear attribute-boost history — a humbled restart starts from scratch
    if (typeof levelUpBonuses !== 'undefined') levelUpBonuses = [];
    // Close modal
    document.getElementById('humbled-modal').style.display = 'none';
    _humbledPickedStats = [];
    // Switch wasteland — transit completes only here, after stats confirmed
    const newOrigin = (origin === 'CW') ? 'MW' : 'CW';
    setOrigin(newOrigin, true);
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
    const perkRule = reachedOld
        ? 'PERK PENALTY LIFTED — NORMAL RATES RESTORED'
        : `PERKS EVERY 4 LEVELS UNTIL LVL ${humbledLevel} (CURRENTLY LVL ${charLevel})`;
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
    let ctx = null, muted = false, crtNode = null;

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
        isMuted() { return muted; },
        toggleMute() {
            muted = !muted;
            if (muted) { this.stopCRT(); }
            else { this.startCRT(); }
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
                if (t.closest('#mobile-more-sheet')) return; // showTab() calls click() itself
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

/* ═══════════════════════════════════════════════
   TOAST NOTIFICATION SYSTEM
═══════════════════════════════════════════════ */
let _lastToastMessage = '';
let _lastToastTime = 0;

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('Toast container not found');
        return;
    }
    
    // Prevent duplicate toasts within 500ms
    const now = Date.now();
    if (message === _lastToastMessage && (now - _lastToastTime) < 500) {
        return;
    }
    _lastToastMessage = message;
    _lastToastTime = now;
    
    // Limit to max 5 toasts
    const existingToasts = container.querySelectorAll('.toast:not(.toast-exit)');
    if (existingToasts.length >= 5) {
        // Remove oldest toast
        const oldest = existingToasts[0];
        if (oldest) {
            dismissToast(oldest);
        }
    }
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
    `;
    
    // Click to dismiss
    toast.style.cursor = 'pointer';
    toast.addEventListener('click', () => {
        dismissToast(toast);
    });
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissToast(toast);
    });
    toast.appendChild(closeBtn);
    
    container.appendChild(toast);
    
    // Sound feedback only for success/error
    if (type === 'success' || type === 'error') {
        try {
            nsAudio.click();
        } catch(e) {
            // Ignore audio errors
        }
    }
    
    // Auto-dismiss after duration
    const timeoutId = setTimeout(() => {
        try {
            dismissToast(toast);
        } catch(e) {
            console.error('Toast auto-dismiss failed:', e);
            if (toast && toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }
    }, duration);
    
    toast._timeoutId = timeoutId;
}

function dismissToast(toast) {
    if (!toast) {
        console.warn('dismissToast called with null/undefined toast');
        return;
    }
    
    if (toast.classList.contains('toast-exit')) {
        return;
    }
    
    if (toast._timeoutId) {
        clearTimeout(toast._timeoutId);
        delete toast._timeoutId;
    }
    
    toast.classList.add('toast-exit');
    
    setTimeout(() => {
        try {
            if (toast && toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        } catch(e) {
            console.error('Toast removal failed:', e);
        }
    }, 300);
}

function clearAllToasts() {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const allToasts = container.querySelectorAll('.toast');
    allToasts.forEach(toast => {
        dismissToast(toast);
    });
}

window.onload = () => {
    document.getElementById('tag-area').innerHTML = skills.map(s => `<div class="grid-item" onclick="toggleTag(this)"><input type="checkbox"><span class="tag-marker">[ ]</span><span>${s}</span></div>`).join('');
    renderUniques();
    renderUniqueArmor();
    applyUniquesVisibility();
    // Re-apply filter button highlight after render
    document.querySelectorAll('#uni-filter-bar .uni-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tag === uniFilter);
    });
    
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
    loadCollapsedSections(); // Load collapsed section states
    loadNotesCollapsed(); // Load notes log hidden state
    
    // Clear any stale toasts from previous session
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
        toastContainer.innerHTML = '';
    }
    
    showTab('ov');
};

/* ═══════════════════════════════════════════════
   DWELLER NOTES LOG HIDE / SHOW
═══════════════════════════════════════════════ */
let _notesCollapsed = false;

function toggleNotesLog() {
    _notesCollapsed = !_notesCollapsed;
    document.body.classList.toggle('notes-collapsed', _notesCollapsed);
    const toggleBtn = document.getElementById('notes-toggle-btn');
    const restoreBtn = document.getElementById('notes-restore-btn');
    if (toggleBtn) toggleBtn.textContent = _notesCollapsed ? '☰ NOTES' : '▸ HIDE';
    if (restoreBtn) restoreBtn.style.display = _notesCollapsed ? 'block' : 'none';
    try {
        localStorage.setItem('ns_notes_collapsed', _notesCollapsed ? '1' : '0');
    } catch(e) {}
}

function loadNotesCollapsed() {
    try {
        const saved = localStorage.getItem('ns_notes_collapsed');
        if (saved === '1') toggleNotesLog();
    } catch(e) {}
}

/* ═══════════════════════════════════════════════
   COLLAPSIBLE SECTIONS
═══════════════════════════════════════════════ */
let _collapsedSections = new Set();

function toggleSectionCollapse(sectionId) {
    const content = document.getElementById(`collapsible-${sectionId}`);
    const icon = document.getElementById(`collapse-icon-${sectionId}`);
    const btn = icon?.closest('.section-collapse-btn');
    
    if (!content) return;
    
    const isCollapsed = _collapsedSections.has(sectionId);
    
    if (isCollapsed) {
        // Expand
        content.classList.remove('collapsed');
        if (btn) btn.classList.remove('collapsed');
        if (icon) icon.textContent = '▼';
        _collapsedSections.delete(sectionId);
    } else {
        // Collapse
        content.classList.add('collapsed');
        if (btn) btn.classList.add('collapsed');
        if (icon) icon.textContent = '▶';
        _collapsedSections.add(sectionId);
    }
    
    // Save state to localStorage
    try {
        localStorage.setItem('collapsed_sections', JSON.stringify(Array.from(_collapsedSections)));
    } catch(e) {
        console.warn('Failed to save collapsed state');
    }
}

function loadCollapsedSections() {
    try {
        const saved = localStorage.getItem('collapsed_sections');
        if (saved) {
            _collapsedSections = new Set(JSON.parse(saved));
            
            // Apply collapsed state on load
            _collapsedSections.forEach(sectionId => {
                const content = document.getElementById(`collapsible-${sectionId}`);
                const icon = document.getElementById(`collapse-icon-${sectionId}`);
                const btn = icon?.closest('.section-collapse-btn');
                
                if (content) content.classList.add('collapsed');
                if (btn) btn.classList.add('collapsed');
                if (icon) icon.textContent = '▶';
            });
        }
    } catch(e) {
        console.warn('Failed to load collapsed state');
    }
}

/* ═══════════════════════════════════════════════
   KEYBOARD SHORTCUTS SYSTEM
═══════════════════════════════════════════════ */
document.addEventListener('keydown', function(e) {
    // The in-planner confirm/alert overlay owns the keyboard while it is open
    if (document.querySelector('.confirm-dialog-overlay')) return;
    // Don't trigger shortcuts when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Allow ESC to blur/close even from inputs
        if (e.key === 'Escape') {
            e.target.blur();
            closeAnyOpenModal();
            return;
        }
        return;
    }
    
    // ESC - Close any open modal (or clear toasts if nothing is open)
    if (e.key === 'Escape') {
        e.preventDefault();
        if (hasAnyModalOpen()) {
            closeAnyOpenModal();
        } else {
            clearAllToasts();
        }
        return;
    }
    
    // Ctrl/Cmd + S - Export build
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        exportBuild();
        return;
    }
    
    // Ctrl/Cmd + Z - Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (_undoStack.length >= 2) {
            undoLastAction();
            showToast('Undid last action', 'info');
        }
        return;
    }
    
    // ? - Show keyboard shortcuts help (future implementation)
    if (e.key === '?' && !e.shiftKey) {
        // Could show a help modal in the future
        showToast('Shortcuts: ESC=Close, Ctrl+S=Export, Ctrl+Z=Undo', 'info', 5000);
        return;
    }
});

/* All openable modals — used by closeAnyOpenModal() and hasAnyModalOpen().
   Element IDs match the real markup (build-manager-modal, tag-pick-modal, ...). */
const OPENABLE_MODALS = [
    'trait-modal', 'implant-modal', 'archetypes-modal', 'lvlup-modal', 'perk-picker-modal',
    'reward-perk-modal', 'internalized-modal', 'it-modal', 'perk-zoom-modal', 'trait-detail-modal',
    'special-info-modal', 'humbled-modal', 'build-manager-modal', 'tag-pick-modal', 'gear-effect-modal',
    'rollback-modal', 'action-star-modal', 'wishlist-modal', 'companion-modal', 'butch-modal',
    'companion-zoom-modal'
];

function _modalOpen(el) {
    if (!el) return false;
    return el.classList.contains('active')
        || (el.style.display !== '' && el.style.display !== 'none');
}

function hasAnyModalOpen() {
    return OPENABLE_MODALS.some(id => _modalOpen(document.getElementById(id)));
}

function closeAnyOpenModal() {
    OPENABLE_MODALS.forEach(id => {
        const modal = document.getElementById(id);
        if (!_modalOpen(modal)) return;
        // Route modals that keep state through their real close handlers
        if (id === 'it-modal') { closeITModal(); return; }
        if (id === 'lvlup-modal') { closeLevelUpModal(); return; }
        // Handle both open mechanisms: inline display (flex/block) and .active class
        modal.classList.remove('active');
        modal.style.display = '';
        if (id === 'perk-zoom-modal') {
            const box = document.querySelector('.perk-zoom-box');
            if (box) box.dataset.type = '';
        }
    });
}



/* ═══════════════════════════════════════════════
   CONFIRMATION DIALOG SYSTEM
═══════════════════════════════════════════════ */
function showConfirmDialog(options) {
    return new Promise((resolve) => {
        const {
            title = 'Confirm Action',
            message = 'Are you sure?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            isDanger = false
        } = options;
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        
        const icon = isDanger ? '⚠' : 'ℹ';
        
        dialog.innerHTML = `
            <div class="confirm-dialog-title">
                <span>${icon}</span>
                <span>${title}</span>
            </div>
            <div class="confirm-dialog-message">${message}</div>
            <div class="confirm-dialog-actions">
                <button class="confirm-btn confirm-btn-cancel" data-action="cancel">${cancelText}</button>
                <button class="confirm-btn ${isDanger ? 'confirm-btn-danger' : 'confirm-btn-primary'}" data-action="confirm">${confirmText}</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(dialog);
        
        const handleEsc = (e) => { if (e.key === 'Escape') cleanup(false); };
        const cleanup = (result) => {
            document.removeEventListener('keydown', handleEsc);
            overlay.remove();
            dialog.remove();
            resolve(result);
        };
        
        // Handle button clicks
        dialog.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                cleanup(btn.getAttribute('data-action') === 'confirm');
            });
        });
        
        // Handle overlay click to cancel
        overlay.addEventListener('click', () => cleanup(false));
        
        // Handle ESC key
        document.addEventListener('keydown', handleEsc);
        
        // Focus confirm button
        setTimeout(() => {
            const confirmBtn = dialog.querySelector('[data-action="confirm"]');
            if (confirmBtn) confirmBtn.focus();
        }, 100);
    });
}

/* ═══════════════════════════════════════════════
   IN-PLANNER ALERT DIALOG
═══════════════════════════════════════════════ */
function showAlertDialog(options) {
    const title = options.title || 'NOTICE';
    const message = options.message || '';
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        
        dialog.innerHTML = `
            <div class="confirm-dialog-title">
                <span>⚠</span>
                <span>${escHtml(title)}</span>
            </div>
            <div class="confirm-dialog-message">${message}</div>
            <div class="confirm-dialog-actions">
                <button class="confirm-btn confirm-btn-primary" data-action="ok">OK</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(dialog);
        
        const handleEsc = (e) => { if (e.key === 'Escape') cleanup(); };
        const cleanup = () => {
            document.removeEventListener('keydown', handleEsc);
            overlay.remove();
            dialog.remove();
            resolve(true);
        };
        
        const okBtn = dialog.querySelector('[data-action="ok"]');
        okBtn.addEventListener('click', cleanup);
        overlay.addEventListener('click', cleanup);
        document.addEventListener('keydown', handleEsc);
        setTimeout(() => okBtn.focus(), 10);
    });
}

/* ═══════════════════════════════════════════════
   IN-PLANNER PROMPT DIALOG
═══════════════════════════════════════════════ */
function showPromptDialog(options) {
    const title = options.title || 'ENTER VALUE';
    const message = options.message || '';
    const placeholder = options.placeholder || '';
    const initial = options.initial || '';
    const confirmText = options.confirmText || 'OK';
    const cancelText = options.cancelText || 'Cancel';
    const maxlength = options.maxlength || 40;
    return new Promise((resolve) => {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirm-dialog-overlay';
        
        // Create dialog
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        
        dialog.innerHTML = `
            <div class="confirm-dialog-title">
                <span>✎</span>
                <span>${escHtml(title)}</span>
            </div>
            <div class="confirm-dialog-message">${message}</div>
            <input type="text" class="confirm-dialog-input" value="${escHtml(initial)}" placeholder="${escHtml(placeholder)}" maxlength="${maxlength}" autocomplete="off">
            <div class="confirm-dialog-actions">
                <button class="confirm-btn confirm-btn-cancel" data-action="cancel">${escHtml(cancelText)}</button>
                <button class="confirm-btn confirm-btn-primary" data-action="ok">${escHtml(confirmText)}</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(dialog);
        
        const inputEl = dialog.querySelector('.confirm-dialog-input');
        const finish = (result) => {
            document.removeEventListener('keydown', onKey);
            inputEl.removeEventListener('keydown', onInputKey);
            overlay.remove();
            dialog.remove();
            resolve(result);
        };
        const submit = () => {
            const v = inputEl.value.trim();
            finish(v ? v : null);
        };
        const onInputKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submit();
                return;
            }
            e.stopPropagation();
        };
        const onKey = (e) => { if (e.key === 'Escape') finish(null); };
        
        dialog.querySelector('[data-action="ok"]').addEventListener('click', submit);
        dialog.querySelector('[data-action="cancel"]').addEventListener('click', () => finish(null));
        overlay.addEventListener('click', () => finish(null));
        inputEl.addEventListener('keydown', onInputKey);
        document.addEventListener('keydown', onKey);
        setTimeout(() => { inputEl.focus(); inputEl.select(); }, 10);
    });
}

/* ═══════════════════════════════════════════════
   ENHANCED SEARCH WITH FUZZY MATCHING
═══════════════════════════════════════════════ */
function fuzzyMatch(text, search) {
    const textLower = text.toLowerCase();
    const searchLower = search.toLowerCase();
    
    // Exact match or substring match gets highest priority
    if (textLower.includes(searchLower)) return true;
    
    // Fuzzy match: all characters in search appear in order in text
    let searchIndex = 0;
    for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
        if (textLower[i] === searchLower[searchIndex]) {
            searchIndex++;
        }
    }
    return searchIndex === searchLower.length;
}

function searchByEffect(items, query, getEffectText) {
    // Search in effect descriptions, requirements, and names
    const q = query.toLowerCase();
    return items.filter(item => {
        const name = item.name?.toLowerCase() || '';
        const desc = item.desc?.toLowerCase() || '';
        const req = item.req?.toLowerCase() || '';
        const effect = getEffectText ? getEffectText(item)?.toLowerCase() : '';
        
        return fuzzyMatch(name, q) || 
               desc.includes(q) || 
               req.includes(q) || 
               effect.includes(q);
    });
}










