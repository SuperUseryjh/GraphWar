// ==================== DOM 元素获取（UI 相关） ====================
const levelDisplay = document.getElementById('level-display');
const scoreDisplay = document.getElementById('score-display');
const levelGoalText = document.getElementById('level-goal-text');
const playerCoordText = document.getElementById('player-coord-text');
const ammoDisplay = document.getElementById('ammo-display');
const formulaInput = document.getElementById('formula-input');
const clearInputBtn = document.getElementById('clear-input-btn');
const fireForm = document.getElementById('fire-form');
const fireBtn = document.getElementById('fire-btn');
const errorBox = document.getElementById('error-box');
const errorMessage = document.getElementById('error-message');
const radarList = document.getElementById('radar-list');
const levelGridContainer = document.getElementById('level-grid-container');
const endlessModeBtn = document.getElementById('endless-mode-btn');
const toggleSoundBtn = document.getElementById('toggle-sound-btn');
const soundIcon = document.getElementById('sound-icon');
const autocompleteGhost = document.getElementById('autocomplete-ghost');
const autocompleteBadge = document.getElementById('autocomplete-badge');
const gameModal = document.getElementById('game-modal');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalActionBtn = document.getElementById('modal-action-btn');
const modalRestartBtn = document.getElementById('modal-restart-btn');

// ==================== 智能补全与提示系统 ====================
function getRecommendedFormula() {
  if (isEndlessMode) {
    return "2 * sin(x)";
  }
  if (!levelData || !levelData.hint) return "";
  const parts = levelData.hint.split("试试：");
  return parts[1] ? parts[1].trim() : "";
}

function updateAutocomplete() {
  const rec = getRecommendedFormula();
  const val = formulaInput.value;

  if (!rec) {
    autocompleteGhost.innerHTML = '';
    autocompleteBadge.classList.add('hidden');
    return;
  }

  if (!val) {
    autocompleteGhost.innerHTML = `<span class="opacity-30">${rec}</span>`;
    autocompleteBadge.classList.remove('hidden');
  } else if (rec.toLowerCase().startsWith(val.toLowerCase())) {
    const typedPart = val;
    const remainingPart = rec.slice(typedPart.length);
    autocompleteGhost.innerHTML = `<span class="opacity-0">${typedPart}</span><span class="opacity-40">${remainingPart}</span>`;
    autocompleteBadge.classList.remove('hidden');
  } else {
    autocompleteGhost.innerHTML = '';
    autocompleteBadge.classList.add('hidden');
  }
}

// Tab 键补全
formulaInput.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    const rec = getRecommendedFormula();
    const val = formulaInput.value;
    if (rec) {
      if (!val || rec.toLowerCase().startsWith(val.toLowerCase())) {
        e.preventDefault();
        formulaInput.value = rec;
        updateAutocomplete();
        showFeedback("💡 已自动装填推荐公式！", "cyan");
      }
    }
  }
});

formulaInput.addEventListener('input', updateAutocomplete);

// ==================== 关卡加载与生成器 ====================
function loadLevel(idx, resetAmmoAndScore = false) {
  isEndlessMode = false;
  currentLevelIndex = idx;
  
  const original = LEVELS[idx];
  levelData = JSON.parse(JSON.stringify(original));
  
  if (resetAmmoAndScore) {
    score = 0;
    scoreDisplay.textContent = score;
  }

  lastBulletPath = null;
  firedPathsHistory = [];
  bulletAnim.active = false;
  particles = [];

  updateUI();
  updateAutocomplete();
  draw();
  showFeedback(`已装载关卡: ${levelData.name}`);
}

function generateEndlessLevel() {
  isEndlessMode = true;
  levelData = {
    id: "INF",
    name: `无尽维度 (随机生成)`,
    player: { x: -8, y: (Math.random() * 4 - 2) },
    enemies: [],
    obstacles: [],
    ammo: 4,
    hint: "无尽模式：利用你所学，算准小怪坐标。每一击都更显重要！试试：2 * sin(x)"
  };

  const enemyCount = Math.floor(Math.random() * 2) + 2;
  for (let i = 0; i < enemyCount; i++) {
    levelData.enemies.push({
      name: `异次元怪 ${String.fromCharCode(65 + i)}`,
      x: (Math.random() * 5 + 3),
      y: (Math.random() * 10 - 5),
      radius: 0.4 + Math.random() * 0.4,
      hp: 100,
      maxHp: 100
    });
  }

  const obstacleCount = Math.floor(Math.random() * 2) + 1;
  for (let i = 0; i < obstacleCount; i++) {
    levelData.obstacles.push({
      type: 'circle',
      x: (Math.random() * 4 - 2),
      y: (Math.random() * 6 - 3),
      radius: 1.5 + Math.random() * 1.5,
      label: `电场力 ${i+1}`
    });
  }

  lastBulletPath = null;
  firedPathsHistory = [];
  bulletAnim.active = false;
  particles = [];

  updateUI();
  updateAutocomplete();
  draw();
  showFeedback(`无尽关卡随机生成完毕！`);
}

function updateUI() {
  levelDisplay.textContent = isEndlessMode ? "ENDLESS" : `LEVEL ${levelData.id}`;
  levelGoalText.textContent = levelData.name;
  playerCoordText.textContent = `(${levelData.player.x.toFixed(2)}, ${levelData.player.y.toFixed(2)})`;
  
  ammoDisplay.textContent = `${levelData.ammo} / ${isEndlessMode ? '4' : LEVELS[currentLevelIndex].ammo}`;
  if (levelData.ammo <= 0) {
    ammoDisplay.className = "font-bold text-red-500 font-mono text-sm";
  } else if (levelData.ammo === 1) {
    ammoDisplay.className = "font-bold text-yellow-500 font-mono text-sm animate-pulse";
  } else {
    ammoDisplay.className = "font-bold text-emerald-400 font-mono text-sm";
  }

  radarList.innerHTML = '';
  
  levelData.enemies.forEach(enemy => {
    const isDead = enemy.hp <= 0;
    const row = document.createElement('div');
    row.className = `flex justify-between items-center p-2 rounded text-xs border ${isDead ? 'bg-slate-950/20 border-slate-900/40 opacity-40' : 'bg-slate-950 border-slate-800'}`;
    row.innerHTML = `
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full ${isDead ? 'bg-slate-700' : 'bg-rose-500'}"></span>
        <span class="font-semibold ${isDead ? 'text-slate-600 line-through' : 'text-slate-300'}">${enemy.name}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="font-mono text-[10px] text-cyan-400 font-semibold bg-cyan-950/30 px-1 rounded">(${enemy.x.toFixed(2)}, ${enemy.y.toFixed(2)})</span>
        <div class="w-16 bg-slate-800 h-2 rounded overflow-hidden">
          <div class="bg-gradient-to-r from-red-500 to-rose-400 h-full" style="width: ${Math.max(0, (enemy.hp / enemy.maxHp) * 100)}%"></div>
        </div>
      </div>
    `;
    radarList.appendChild(row);
  });

  levelData.obstacles.forEach(obs => {
    const row = document.createElement('div');
    row.className = "flex justify-between items-center p-2 rounded text-xs border bg-slate-950 border-slate-800 border-dashed";
    row.innerHTML = `
      <div class="flex items-center gap-1.5 text-slate-400">
        <i class="fa-solid fa-ban text-amber-500"></i>
        <span>${obs.label || '防护罩'}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="font-mono text-[10px] text-amber-400 font-semibold">中心: (${obs.x.toFixed(1)}, ${obs.y.toFixed(1)})</span>
        <span class="font-mono text-[10px] text-slate-500">半径: ${obs.radius.toFixed(1)}</span>
      </div>
    `;
    radarList.appendChild(row);
  });

  levelGridContainer.innerHTML = '';
  LEVELS.forEach((level, index) => {
    const btn = document.createElement('button');
    btn.className = `p-2 font-bold text-sm rounded border transition ${index === currentLevelIndex && !isEndlessMode ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20' : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'}`;
    btn.textContent = level.id;
    btn.addEventListener('click', () => {
      loadLevel(index, false);
    });
    levelGridContainer.appendChild(btn);
  });

  if (!isEndlessMode) {
    formulaInput.placeholder = LEVELS[currentLevelIndex].hint.split("试试：")[1] || "输入函数...";
  } else {
    formulaInput.placeholder = "2 * sin(x)";
  }
}

// ==================== 交互与表单事件监听 ====================
fireForm.addEventListener('submit', (e) => {
  e.preventDefault();
  errorBox.classList.add('hidden');

  const rawFormula = formulaInput.value.trim();
  if (!rawFormula) {
    showError("输入框空空如也，请写个数学表达式！例如：0.5*x");
    return;
  }

  try {
    const rpn = MathParser.compile(rawFormula);
    MathParser.evaluate(rpn, levelData.player.x);
    
    startTrajectorySimulation(rpn, rawFormula);
  } catch (err) {
    showError(err.message || "公式语法有误，请仔细检查。");
  }
});

function showError(msg) {
  errorBox.classList.remove('hidden');
  errorMessage.textContent = msg;
}

// 一键清空
clearInputBtn.addEventListener('click', () => {
  formulaInput.value = '';
  formulaInput.focus();
  updateAutocomplete();
});

// 快捷数学按键
document.querySelectorAll('.math-shortcut-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const val = btn.getAttribute('data-val');
    const pos = formulaInput.selectionStart;
    const currentVal = formulaInput.value;
    
    formulaInput.value = currentVal.slice(0, pos) + val + currentVal.slice(pos);
    formulaInput.focus();
    
    const newCursorPos = pos + val.length;
    formulaInput.setSelectionRange(newCursorPos, newCursorPos);
    updateAutocomplete();
  });
});

// 预设公式库
document.querySelectorAll('.preset-card').forEach(card => {
  card.addEventListener('click', () => {
    const formula = card.getAttribute('data-formula');
    formulaInput.value = formula;
    formulaInput.focus();
    updateAutocomplete();
    showFeedback(`🎯 已加载战术公式: ${formula}`);
  });
});

// 音效开关
toggleSoundBtn.addEventListener('click', () => {
  sound.enabled = !sound.enabled;
  if (sound.enabled) {
    soundIcon.className = "fa-solid fa-volume-high text-cyan-400";
    showFeedback("🔊 声音合成反馈器已就绪");
  } else {
    soundIcon.className = "fa-solid fa-volume-xmark text-slate-500";
    showFeedback("🔇 声音反馈已静音");
  }
});

// 弹层事件
modalActionBtn.addEventListener('click', () => {
  gameModal.classList.add('hidden');
  if (levelData.enemies.every(e => e.hp <= 0)) {
    if (isEndlessMode) {
      generateEndlessLevel();
    } else {
      if (currentLevelIndex < LEVELS.length - 1) {
        loadLevel(currentLevelIndex + 1);
      } else {
        loadLevel(0, true);
      }
    }
  } else {
    if (isEndlessMode) {
      generateEndlessLevel();
    } else {
      loadLevel(currentLevelIndex);
    }
  }
});

modalRestartBtn.addEventListener('click', () => {
  gameModal.classList.add('hidden');
  if (isEndlessMode) {
    generateEndlessLevel();
  } else {
    loadLevel(currentLevelIndex);
  }
});

endlessModeBtn.addEventListener('click', () => {
  generateEndlessLevel();
});

// 画布点击坐标探测
canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const mathPos = pixelToMath(px, py);
  showFeedback(`🎯 探测雷达点：(${mathPos.x.toFixed(2)}, ${mathPos.y.toFixed(2)})`);
});