// app.js
// The Complete Engine for Thousand Year Old Vampire Companion

let maxMemories = 5;
let maxDiary = 4;
let currentPrompt = 0;
let promptVisits = {};
let futureTriggers = [];
let namesHistory = [];
let turnCount = 0;
let rollHistory = [];
let previousState = null; 
let journalHistory = []; 
let isGameLoaded = false; // iOS Safari Lock

// ==========================================
// AUDIO CUES & THEMES
// ==========================================

function playSound(type) {
    if (document.getElementById('optMuteSound').checked) return;
    try {
        const sfx = document.getElementById(type === 'dice' ? 'sfxDice' : 'sfxPage');
        if (sfx) { 
            sfx.currentTime = 0; 
            sfx.play().catch(e => { console.log("Audio prevented by browser"); }); 
        }
    } catch(e) {}
}

function toggleTheme() {
    const isLight = document.body.classList.toggle('light-mode');
    document.getElementById('btnTheme').innerText = isLight ? "Toggle Dark Mode" : "Toggle Light Mode";
    saveGame();
}

function changeFontSize(delta) {
    let currentSize = parseInt(getComputedStyle(document.body).getPropertyValue('--base-font-size')) || 16;
    let newSize = Math.max(12, Math.min(24, currentSize + delta));
    document.body.style.setProperty('--base-font-size', `${newSize}px`);
    saveGame();
}

function toggleGraveyard() {
    const isHidden = document.getElementById('hideGraveyardToggle').checked;
    const container = document.getElementById('traitsContainer');
    if (isHidden) {
        container.classList.add('hide-graveyard');
    } else {
        container.classList.remove('hide-graveyard');
    }
    saveGame();
}

// ==========================================
// SETUP WIZARD
// ==========================================

function nextStep(stepNum) {
    document.querySelectorAll('.wizard-step').forEach(el => el.style.display = 'none');
    document.getElementById('step' + stepNum).style.display = 'block';
}

function finishSetup() {
    document.getElementById('currentName').value = document.getElementById('setupName').value;
    
    ['setupSkill1', 'setupSkill2', 'setupSkill3'].forEach(id => { 
        let val = document.getElementById(id).value;
        if(val) addSkill(val); 
    });

    ['setupRes1', 'setupRes2', 'setupRes3'].forEach(id => { 
        let val = document.getElementById(id).value;
        if(val) addResource(val); 
    });

    ['setupChar1', 'setupChar2', 'setupChar3'].forEach(id => { 
        let val = document.getElementById(id).value;
        if(val) addCharacter(val, 'Mortal'); 
    });

    let markVal = document.getElementById('setupMark').value;
    if(markVal) addMark(markVal);

    let theme = document.getElementById('setupMemTheme').value;
    let exp = document.getElementById('setupMemExp').value;
    addMemoryBlock('memoriesContainer', true, theme, exp);
    
    for(let i=1; i<5; i++) {
        addMemoryBlock('memoriesContainer', true);
    }

    document.getElementById('setupWizard').style.display = 'none';
    isGameLoaded = true;
    saveGame();
}

// ==========================================
// SAVE, LOAD & UNDO
// ==========================================

function syncInputsToAttributes() {
    document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(el => { 
        el.setAttribute('value', el.value); 
        if(el.tagName === 'TEXTAREA') el.innerHTML = el.value; 
    });
    document.querySelectorAll('input[type="checkbox"]').forEach(el => {
        el.checked ? el.setAttribute('checked', 'checked') : el.removeAttribute('checked');
    });
    document.querySelectorAll('select').forEach(el => { 
        el.querySelectorAll('option').forEach(opt => {
            opt.value === el.value ? opt.setAttribute('selected', 'selected') : opt.removeAttribute('selected');
        }); 
    });
}

function saveGame() {
    if (!isGameLoaded) return; // Wait until file is fully loaded

    syncInputsToAttributes();
    const saveData = {
        maxMemories, maxDiary, currentPrompt, promptVisits, futureTriggers, namesHistory, turnCount, rollHistory, journalHistory,
        currentName: document.getElementById('currentName').value, 
        boxedExp: document.getElementById('boxedExpText').value,
        currentJournal: document.getElementById('promptJournal').value,
        settings: { 
            isLightMode: document.body.classList.contains('light-mode'), 
            fontSize: getComputedStyle(document.body).getPropertyValue('--base-font-size'), 
            hideGraveyard: document.getElementById('hideGraveyardToggle').checked, 
            muteSound: document.getElementById('optMuteSound').checked 
        },
        htmlData: { 
            skills: document.getElementById('skillsList').innerHTML, 
            resources: document.getElementById('resourcesList').innerHTML, 
            characters: document.getElementById('charactersList').innerHTML, 
            marks: document.getElementById('marksList').innerHTML, 
            memories: document.getElementById('memoriesContainer').innerHTML, 
            diary: document.getElementById('diaryContainer').innerHTML, 
            promptDisplay: document.getElementById('promptTextDisplay').innerHTML, 
            promptResult: document.getElementById('promptResult').innerText, 
            rollDetails: document.getElementById('rollResultDetails').innerText, 
            rollLog: document.getElementById('rollHistoryLog').innerHTML 
        }
    };
    localStorage.setItem('tyov_save', JSON.stringify(saveData));
}

function loadGame() {
    const saved = localStorage.getItem('tyov_save');
    if (saved) {
        const data = JSON.parse(saved);
        maxMemories = data.maxMemories || 5; 
        maxDiary = data.maxDiary || 4; 
        currentPrompt = data.currentPrompt || 0; 
        promptVisits = data.promptVisits || {}; 
        futureTriggers = data.futureTriggers || []; 
        namesHistory = data.namesHistory || []; 
        turnCount = data.turnCount || 0; 
        rollHistory = data.rollHistory || [];
        journalHistory = data.journalHistory || [];

        document.getElementById('currentName').value = data.currentName || ""; 
        document.getElementById('boxedExpText').value = data.boxedExp || ""; 
        document.getElementById('promptJournal').value = data.currentJournal || "";
        document.getElementById('nameHistory').innerText = "Forgotten Names: " + (namesHistory.length ? namesHistory.join(" ➔ ") : "None yet.");
        
        if (data.settings) { 
            if (data.settings.isLightMode) { document.body.classList.add('light-mode'); document.getElementById('btnTheme').innerText = "Toggle Dark Mode"; }
            if (data.settings.fontSize) document.body.style.setProperty('--base-font-size', data.settings.fontSize); 
            if (data.settings.hideGraveyard) { document.getElementById('hideGraveyardToggle').checked = true; document.getElementById('traitsContainer').classList.add('hide-graveyard'); } 
            if (data.settings.muteSound) document.getElementById('optMuteSound').checked = true; 
        }
        
        document.getElementById('skillsList').innerHTML = data.htmlData.skills || ""; 
        document.getElementById('resourcesList').innerHTML = data.htmlData.resources || ""; 
        document.getElementById('charactersList').innerHTML = data.htmlData.characters || ""; 
        document.getElementById('marksList').innerHTML = data.htmlData.marks || ""; 
        document.getElementById('memoriesContainer').innerHTML = data.htmlData.memories || ""; 
        document.getElementById('diaryContainer').innerHTML = data.htmlData.diary || ""; 
        document.getElementById('promptTextDisplay').innerHTML = data.htmlData.promptDisplay || ""; 
        document.getElementById('promptResult').innerText = data.htmlData.promptResult || "Awaiting First Roll..."; 
        document.getElementById('rollResultDetails').innerText = data.htmlData.rollDetails || ""; 
        document.getElementById('rollHistoryLog').innerHTML = data.htmlData.rollLog || "<b>Chronicle History:</b><br>";
        
        renderTriggers(); 
        updateMemoryCount(); 
        updateDiaryCount(); 
        checkSurvivalState(); 
        checkGameOver();
        
        isGameLoaded = true; 
    } else { 
        document.getElementById('setupWizard').style.display = 'flex'; 
        nextStep(1); 
    }
}

function resetGame() { 
    if(confirm("Are you sure you want to wipe this chronicle? This cannot be undone.")) { 
        localStorage.removeItem('tyov_save'); 
        location.reload(); 
    } 
}

document.addEventListener('input', saveGame); 
document.addEventListener('change', saveGame);

function saveStateForUndo() {
    previousState = JSON.stringify({ 
        currentPrompt, 
        promptVisits: {...promptVisits}, 
        turnCount, 
        rollHistory: [...rollHistory], 
        journalHistory: [...journalHistory],
        displayHTML: document.getElementById('promptTextDisplay').innerHTML, 
        resultText: document.getElementById('promptResult').innerText, 
        detailText: document.getElementById('rollResultDetails').innerText, 
        logHTML: document.getElementById('rollHistoryLog').innerHTML,
        currentJournal: document.getElementById('promptJournal').value
    });
    document.getElementById('btnUndo').disabled = false;
}

function undoLastRoll() {
    if (!previousState) return;
    const s = JSON.parse(previousState);
    currentPrompt = s.currentPrompt; 
    promptVisits = s.promptVisits; 
    turnCount = s.turnCount; 
    rollHistory = s.rollHistory;
    journalHistory = s.journalHistory;
    
    document.getElementById('promptTextDisplay').innerHTML = s.displayHTML; 
    document.getElementById('promptResult').innerText = s.resultText; 
    document.getElementById('rollResultDetails').innerText = s.detailText; 
    document.getElementById('rollHistoryLog').innerHTML = s.logHTML;
    document.getElementById('promptJournal').value = s.currentJournal;
    
    previousState = null; 
    document.getElementById('btnUndo').disabled = true; 
    saveGame();
}

function addToHistoryLog(text) {
    turnCount++; 
    const logStr = `[Turn ${turnCount}] ${text}`;
    rollHistory.push(logStr);
    
    const logDiv = document.getElementById('rollHistoryLog');
    const newEntry = document.createElement('div'); 
    newEntry.innerText = logStr;
    logDiv.insertBefore(newEntry, logDiv.childNodes[2]); 
}

// ==========================================
// IMPORT & EXPORT
// ==========================================

function exportSaveData() { 
    saveGame(); 
    const blob = new Blob([localStorage.getItem('tyov_save')], { type: "application/json" }); 
    const a = document.createElement("a"); 
    a.href = URL.createObjectURL(blob); 
    a.download = "Vampire_Save.json"; 
    a.click(); 
}

function importSaveData(e) { 
    const f = e.target.files[0]; 
    if(!f) return;
    const r = new FileReader(); 
    r.onload = (event) => { 
        localStorage.setItem('tyov_save', event.target.result); 
        location.reload(); 
    }; 
    r.readAsText(f); 
}

function parseMarkdown(text) { 
    if(!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
               .replace(/\*(.*?)\*/g, '<i>$1</i>')
               .replace(/\n/g, '<br>'); 
}

function previewChronicle() {
    syncInputsToAttributes();
    const name = document.getElementById('currentName').value || "Unnamed Vampire";
    document.getElementById('previewTitle').innerText = `The Chronicle of ${name}`;

    let html = ``;
    
    const boxed = document.getElementById('boxedExpText').value;
    if(boxed.trim()) {
        html += `<div style="background:rgba(76,175,80,0.1);padding:15px;border-left:4px solid #4CAF50;margin-bottom:20px;">
                    <i>"A serendipitous moment that never fades..."</i><br><br>${parseMarkdown(boxed)}
                 </div>`;
    }

    if (journalHistory.length > 0) {
        html += `<h3>Narrative Journal</h3><div style="margin-bottom: 30px; padding: 15px; background: rgba(0,0,0,0.05); border: 1px solid var(--border-color);">`;
        journalHistory.forEach(entry => {
            html += `<div style="margin-bottom: 15px;"><b>[Prompt ${entry.prompt}]</b><br>${parseMarkdown(entry.text)}</div>`;
        });
        html += `</div>`;
    }

    html += `<h3>Active Memories</h3>`;
    document.querySelectorAll('#memoriesContainer .memory-block').forEach(block => {
        let theme = block.querySelector('input[type="text"]').value;
        if(!theme) return;
        html += `<div style="margin-bottom: 15px;"><b>Theme: ${theme}</b><ul>`;
        block.querySelectorAll('.experience-input').forEach(exp => {
            if(exp.value.trim() !== '') html += `<li>${parseMarkdown(exp.value)}</li>`;
        });
        html += `</ul></div>`;
    });

    html += `<hr style="border-color: var(--border-color); margin: 30px 0;">`;
    html += `<h3>The Diary / Lost Storage</h3>`;
    document.querySelectorAll('#diaryContainer .memory-block').forEach(block => {
        let theme = block.querySelector('input[type="text"]').value;
        if(!theme) return;
        html += `<div style="margin-bottom: 15px; color: #888;"><b>Theme: ${theme}</b><ul>`;
        block.querySelectorAll('.experience-input').forEach(exp => {
            if(exp.value.trim() !== '') html += `<li>${parseMarkdown(exp.value)}</li>`;
        });
        html += `</ul></div>`;
    });

    document.getElementById('previewContent').innerHTML = html;
    document.getElementById('previewModal').style.display = 'flex';
}

function exportJournal() {
    syncInputsToAttributes();
    let txt = `CHRONICLE OF ${document.getElementById('currentName').value}\n=======================================\n\n`;
    
    let boxed = document.getElementById('boxedExpText').value;
    if (boxed) {
        txt += `--- BOXED EXPERIENCE ---\n${boxed}\n\n`;
    }

    if (journalHistory.length > 0) {
        txt += `--- NARRATIVE JOURNAL ---\n`;
        journalHistory.forEach(entry => { 
            txt += `[Prompt ${entry.prompt}]\n${entry.text}\n\n`; 
        });
    }

    txt += `--- ACTIVE MEMORIES ---\n`;
    document.querySelectorAll('#memoriesContainer .memory-block').forEach(block => { 
        txt += `[${block.querySelector('input').value}]\n`; 
        block.querySelectorAll('.experience-input').forEach(exp => { 
            if(exp.value.trim() !== '') txt += `- ${exp.value}\n`; 
        }); 
        txt += `\n`;
    });

    txt += `--- DIARY / STORAGE ---\n`;
    document.querySelectorAll('#diaryContainer .memory-block').forEach(block => { 
        txt += `[${block.querySelector('input').value}]\n`; 
        block.querySelectorAll('.experience-input').forEach(exp => { 
            if(exp.value.trim() !== '') txt += `- ${exp.value}\n`; 
        }); 
        txt += `\n`;
    });

    const blob = new Blob([txt], { type: "text/plain" }); 
    const a = document.createElement("a"); 
    a.href = URL.createObjectURL(blob); 
    a.download = "Chronicle.txt"; 
    a.click();
}

// ==========================================
// GAMEPLAY MECHANICS (DICE & PROMPTS)
// ==========================================

function archiveJournal() {
    const jText = document.getElementById('promptJournal').value.trim();
    if (jText !== "" && currentPrompt !== 0) {
        let visits = promptVisits[currentPrompt] || 1;
        let tier = visits === 1 ? 'a' : (visits === 2 ? 'b' : 'c');
        journalHistory.push({ prompt: `${currentPrompt}${tier}`, text: jText });
        document.getElementById('promptJournal').value = ''; 
    }
}

function changeName() {
    const input = document.getElementById('currentName');
    if(input.value.trim() !== "") {
        namesHistory.push(input.value);
        document.getElementById('nameHistory').innerText = "Forgotten Names: " + namesHistory.join(" ➔ ");
        input.value = "";
        saveGame();
    }
}

function calculateMove() {
    const isMulti = document.getElementById('optMultiplayer').checked;
    const isRev = document.getElementById('optReverseTime').checked;
    
    const d10_1 = Math.floor(Math.random() * 10) + 1;
    const d10_2 = isMulti ? Math.floor(Math.random() * 10) + 1 : 0;
    const d6 = Math.floor(Math.random() * 6) + 1;
    
    const totalD10 = d10_1 + d10_2;
    const diff = isRev ? (d6 - totalD10) : (totalD10 - d6);
    
    return { diff, d10_1, d10_2, d6, isMulti, isRev };
}

function updatePromptDisplay(promptNum, tier) {
    let narrativeText = "Prompt text not found. Ensure data.js is loaded.";
    if (promptDB[promptNum]) {
        if (promptDB[promptNum][tier]) {
            narrativeText = promptDB[promptNum][tier];
        } else if (promptVisits[promptNum] > Object.keys(promptDB[promptNum]).length) {
            narrativeText = "You have completed all entries for this prompt. You must roll again or move forward.";
        }
    }
    document.getElementById('promptTextDisplay').innerText = narrativeText;
}

function checkGameOver() { 
    if (currentPrompt >= 72 && currentPrompt <= 80) { 
        document.getElementById('btnRoll').disabled = true; 
        document.getElementById('promptResult').innerText += " [GAME OVER]"; 
    } 
}

function rollAndMove() {
    archiveJournal();
    playSound('dice'); 
    saveStateForUndo(); 
    
    if(currentPrompt === 0) currentPrompt = 1;
    
    let moveData = calculateMove(); 
    currentPrompt = Math.max(1, currentPrompt + moveData.diff);
    
    promptVisits[currentPrompt] = (promptVisits[currentPrompt] || 0) + 1;
    let tier = promptVisits[currentPrompt] === 1 ? 'a' : (promptVisits[currentPrompt] === 2 ? 'b' : 'c');
    
    let d10Str = moveData.isMulti ? `${moveData.d10_1} + ${moveData.d10_2}` : `${moveData.d10_1}`;
    let detailStr = `Rolled ${moveData.isRev ? `d6(${moveData.d6}) - d10(${d10Str})` : `d10(${d10Str}) - d6(${moveData.d6})`}. Moved by ${moveData.diff}.`;
    
    document.getElementById('rollResultDetails').innerText = detailStr;
    document.getElementById('promptResult').innerText = `Proceed to Prompt ${currentPrompt}${tier}`;
    
    addToHistoryLog(`Prompt ${currentPrompt}${tier} (${detailStr})`);
    
    updatePromptDisplay(currentPrompt, tier); 
    checkTriggers();
    checkGameOver(); 
    saveGame();
}

function jumpToPrompt() {
    let target = parseInt(document.getElementById('jumpPromptNum').value);
    if (target >= 1 && target <= 80) { 
        archiveJournal();
        playSound('page'); 
        saveStateForUndo(); 
        currentPrompt = target; 
        
        promptVisits[target] = (promptVisits[target] || 0) + 1; 
        let tier = promptVisits[target] === 1 ? 'a' : (promptVisits[target] === 2 ? 'b' : 'c'); 
        
        document.getElementById('rollResultDetails').innerText = `Manually jumped to Prompt ${target}.`; 
        document.getElementById('promptResult').innerText = `Proceed to Prompt ${target}${tier}`; 
        addToHistoryLog(`Jumped to Prompt ${target}${tier}`); 
        
        updatePromptDisplay(target, tier); 
        checkTriggers();
        checkGameOver(); 
        saveGame(); 
        
        document.getElementById('jumpPromptNum').value = '';
    } else { 
        alert("Please enter a valid prompt number between 1 and 80."); 
    }
}

function useAccursedStrings() {
    if(currentPrompt > 1) {
        archiveJournal();
        saveStateForUndo();
        currentPrompt -= 1;
        document.getElementById('promptResult').innerText = `Stepped back to Prompt ${currentPrompt}`;
        document.getElementById('promptTextDisplay').innerText = "You have stepped backward using the Accursed Strings.";
        addToHistoryLog(`Used Accursed Strings: Back to Prompt ${currentPrompt}`);
        checkTriggers();
        saveGame();
    }
}

// ==========================================
// TRIGGERS
// ==========================================

function addTrigger() {
    const num = parseInt(document.getElementById('triggerPromptNum').value);
    const desc = document.getElementById('triggerDesc').value;
    if(!num || !desc) return;
    
    futureTriggers.push({ prompt: num, text: desc });
    renderTriggers();
    document.getElementById('triggerPromptNum').value = '';
    document.getElementById('triggerDesc').value = '';
    saveGame();
}

function renderTriggers() {
    const container = document.getElementById('triggersList');
    container.innerHTML = '';
    futureTriggers.forEach((t, index) => {
        container.innerHTML += `<div class="trigger-item"><span><b>Prompt ${t.prompt}:</b> ${t.text}</span> <button class="btn-small btn-strike" onclick="futureTriggers.splice(${index}, 1); renderTriggers(); saveGame();">X</button></div>`;
    });
}

function checkTriggers() {
    const alertBox = document.getElementById('triggerAlert');
    const alertText = document.getElementById('triggerAlertText');
    let found = futureTriggers.filter(t => t.prompt === currentPrompt);
    if(found.length > 0) { 
        alertBox.style.display = 'block'; 
        alertText.innerText = found.map(t => t.text).join(" | "); 
    } else { 
        alertBox.style.display = 'none'; 
    }
}

// ==========================================
// TRAITS MANAGEMENT
// ==========================================

function checkSurvivalState() { 
    const activeSkills = document.querySelectorAll('#skillsList li:not(.strikethrough)').length;
    const activeRes = document.querySelectorAll('#resourcesList li:not(.strikethrough)').length;
    document.getElementById('gameWarning').style.display = (activeSkills === 0 && activeRes === 0) ? 'block' : 'none'; 
}

function toggleLose(btn) { 
    btn.parentElement.classList.toggle('strikethrough'); 
    btn.innerText = btn.parentElement.classList.contains('strikethrough') ? 'Restore' : 'Lose'; 
    checkSurvivalState(); 
    saveGame(); 
}

function addSkill(v='') { 
    document.getElementById('skillsList').insertAdjacentHTML('beforeend', `<li><input type="checkbox" onchange="this.nextElementSibling.classList.toggle('checked-skill', this.checked); saveGame();"><input type="text" value="${v}"><button class="btn-small btn-strike" onclick="toggleLose(this)">Lose</button></li>`); 
    checkSurvivalState(); 
}

function addResource(v='') { 
    document.getElementById('resourcesList').insertAdjacentHTML('beforeend', `<li><input type="text" value="${v}"><button class="btn-small btn-strike" onclick="toggleLose(this)">Lose</button></li>`); 
    checkSurvivalState(); 
}

function addCharacter(v='', type='Mortal') { 
    const id = 'c' + Math.random().toString(36).substr(2,5); 
    const mSel = type === 'Mortal' ? 'selected' : '';
    const iSel = type === 'Immortal' ? 'selected' : '';

    document.getElementById('charactersList').insertAdjacentHTML('beforeend', `
        <li id="${id}">
            <select onchange="this.parentElement.querySelector('.doom-btn').style.display = this.value === 'Mortal' ? 'inline-block' : 'none'; saveGame();">
                <option value="Mortal" ${mSel}>Mortal</option>
                <option value="Immortal" ${iSel}>Immortal</option>
            </select>
            <input type="text" value="${v}">
            <span class="doom-dots"></span>
            <button class="btn-small doom-btn" style="display: ${type === 'Mortal' ? 'inline-block' : 'none'}" onclick="this.previousSibling.innerText+='•'; saveGame()">+•</button>
            <button class="btn-small btn-strike" onclick="toggleLose(this)">Lose</button>
        </li>`); 
}

function addMark(v='') { 
    document.getElementById('marksList').insertAdjacentHTML('beforeend', `<li><input type="text" value="${v}"><button class="btn-small btn-strike" onclick="toggleLose(this)">Lose</button></li>`); 
}

function killAllMortals() { 
    document.querySelectorAll('#charactersList li').forEach(li => { 
        if(li.querySelector('select').value === 'Mortal' && !li.classList.contains('strikethrough')) { 
            li.classList.add('strikethrough'); 
            li.querySelector('.btn-strike').innerText = 'Restore'; 
        } 
    }); 
    saveGame(); 
}

// ==========================================
// MEMORIES & DIARY
// ==========================================

let memIdCounter = 0;

function addMemoryBlock(containerId, bypassLimit = false, theme = '', exp1 = '') {
    if(!bypassLimit && containerId === 'memoriesContainer' && document.querySelectorAll('#memoriesContainer .memory-block').length >= maxMemories) { 
        alert(`Memory Limit Reached (${maxMemories}). Delete a memory or move it to a Diary.`); 
        return; 
    }
    if(!bypassLimit && containerId === 'diaryContainer' && document.querySelectorAll('#diaryContainer .memory-block').length >= maxDiary) { 
        alert(`Diary Limit Reached (${maxDiary}). Expand your limit if a Prompt allows it.`); 
        return; 
    }

    const id = 'mem_' + memIdCounter++;
    const migrateBtn = containerId === 'memoriesContainer' ? `<button class="btn-small migrate-btn" style="background:#2196F3; margin-right:5px;" onclick="migrateToDiary('${id}')">Move to Diary</button>` : '';
    
    document.getElementById(containerId).insertAdjacentHTML('beforeend', `
        <div class="memory-block" id="${id}">
            <input type="text" placeholder="Memory Theme" value="${theme}">
            <div class="exp-container">
                <input type="text" class="experience-input" placeholder="- Experience 1" value="${exp1}">
                <input type="text" class="experience-input" placeholder="- Experience 2">
                <input type="text" class="experience-input" placeholder="- Experience 3">
            </div>
            <div class="mem-controls">
                <select onchange="changeMemoryState('${id}', this.value)">
                    <option value="normal">Normal</option>
                    <option value="starred">⭐ Starred</option>
                    <option value="hazy">🌫️ Hazy</option>
                    <option value="vast">🌌 Vast</option>
                    <option value="primal">🐾 Primal</option>
                </select>
                <div>
                    ${migrateBtn}
                    <button class="btn-small btn-strike" onclick="this.parentElement.parentElement.parentElement.remove(); updateMemoryCount(); updateDiaryCount(); saveGame();">Delete</button>
                </div>
            </div>
        </div>`);
    
    updateMemoryCount(); 
    updateDiaryCount(); 
    saveGame();
}

function migrateToDiary(blockId) { 
    if(document.querySelectorAll('#diaryContainer .memory-block').length >= maxDiary) { 
        alert(`Your Diary is full! (${maxDiary} slots). Expand your limit or delete an entry.`); 
        return; 
    } 
    playSound('page'); 
    const block = document.getElementById(blockId); 
    const btn = block.querySelector('.migrate-btn');
    if (btn) btn.remove(); // Remove migrate button once in diary
    document.getElementById('diaryContainer').appendChild(block); 
    updateMemoryCount(); 
    updateDiaryCount(); 
    saveGame(); 
}

function changeMemoryState(blockId, state) { 
    const block = document.getElementById(blockId); 
    const expContainer = block.querySelector('.exp-container');
    
    block.className = 'memory-block'; 
    if (state !== 'normal') block.classList.add('mem-' + state);
    
    // Reset to 3 inputs initially
    while(expContainer.children.length > 3) expContainer.lastChild.remove();
    
    // If Vast, add 2 more
    if(state === 'vast') {
        expContainer.insertAdjacentHTML('beforeend', `<input type="text" class="experience-input" placeholder="- Experience 4"><input type="text" class="experience-input" placeholder="- Experience 5">`);
    }
    
    updateMemoryCount(); 
    saveGame(); 
}

function updateMemoryCount() { 
    let count = 0;
    document.querySelectorAll('#memoriesContainer .memory-block').forEach(b => {
        if(!b.classList.contains('mem-starred')) count++;
    });
    document.getElementById('memoryCount').innerText = `(${count}/${maxMemories} Active Slots)`; 
}

function updateDiaryCount() { 
    const count = document.querySelectorAll('#diaryContainer .memory-block').length; 
    document.getElementById('diaryCount').innerText = `(${count}/${maxDiary} Slots)`; 
}

function loseMemorySlot() { 
    maxMemories = Math.max(1, maxMemories - 1); 
    updateMemoryCount(); 
    alert(`You have permanently lost a memory slot. Max is now ${maxMemories}.`);
    saveGame(); 
}

function expandDiary() { 
    maxDiary += 2; 
    updateDiaryCount(); 
    alert(`Diary storage expanded! Max is now ${maxDiary}.`);
    saveGame(); 
}

function unlockSecondSeason() { 
    maxMemories = 8; 
    updateMemoryCount(); 
    alert("Second Season unlocked! Max Memories is now 8.");
    saveGame(); 
}

// Boot up
window.onload = loadGame;