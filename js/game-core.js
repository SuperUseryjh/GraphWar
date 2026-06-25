// ==================== DOM 元素获取（画布相关） ====================
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ==================== 屏幕与数学坐标系映射 ====================
let canvasW, canvasH;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.width * (3 / 4);
  canvasW = canvas.width;
  canvasH = canvas.height;
  draw();
}
window.addEventListener('resize', resizeCanvas);

function mathToPixel(mx, my) {
  const px = ((mx - GAME_CONFIG.MATH_X_MIN) / (GAME_CONFIG.MATH_X_MAX - GAME_CONFIG.MATH_X_MIN)) * canvasW;
  const py = ((GAME_CONFIG.MATH_Y_MAX - my) / (GAME_CONFIG.MATH_Y_MAX - GAME_CONFIG.MATH_Y_MIN)) * canvasH;
  return { x: px, y: py };
}

function pixelToMath(px, py) {
  const mx = GAME_CONFIG.MATH_X_MIN + (px / canvasW) * (GAME_CONFIG.MATH_X_MAX - GAME_CONFIG.MATH_X_MIN);
  const my = GAME_CONFIG.MATH_Y_MAX - (py / canvasH) * (GAME_CONFIG.MATH_Y_MAX - GAME_CONFIG.MATH_Y_MIN);
  return { x: mx, y: my };
}

// ==================== 自研 2D 粒子爆炸系统 ====================
function createExplosion(x, y, color) {
  const count = 30;
  const pixel = mathToPixel(x, y);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 2;
    particles.push({
      x: pixel.x,
      y: pixel.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 3 + 1,
      alpha: 1,
      decay: Math.random() * 0.02 + 0.01,
      color: color
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05;
    p.alpha -= p.decay;
    if (p.alpha <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ==================== 物理与模拟系统 (步长与碰撞检测) ====================
let currentTrace = [];

function startTrajectorySimulation(rpn, formula) {
  sound.playLaser();
  
  bulletAnim.active = true;
  bulletAnim.currentX = levelData.player.x;
  bulletAnim.rpn = rpn;
  bulletAnim.formula = formula;
  
  // [FIX] 以玩家炮塔像素位置作为弹道绘制起点
  // 确保即使函数在玩家位置的求值超出canvas边界，起始锚点依然可见
  const startPix = mathToPixel(levelData.player.x, levelData.player.y);
  bulletAnim.points = [startPix];
  
  // 数学轨迹也以玩家发射点开始
  currentTrace = [{ x: levelData.player.x, y: levelData.player.y }];

  levelData.ammo--;
  updateUI();
  updateAutocomplete();

  fireBtn.disabled = true;
  fireBtn.classList.add('opacity-50', 'cursor-not-allowed');

  animateBullet();
}

function animateBullet() {
  if (!bulletAnim.active) return;

  const speed = 0.12;
  const stepsPerFrame = 5;
  let hitDetected = false;
  let outOfBounds = false;

  for (let s = 0; s < stepsPerFrame; s++) {
    const xNext = bulletAnim.currentX + speed / stepsPerFrame;
    let yNext;

    try {
      yNext = MathParser.evaluate(bulletAnim.rpn, xNext);
    } catch (e) {
      // 求值异常：用当前玩家高度作为后备y，使路径不至于断裂
      yNext = levelData.player.y;
    }

    if (isNaN(yNext) || !isFinite(yNext)) {
      // 无效值：使用玩家y作为后备继续推进
      yNext = levelData.player.y;
    }

    bulletAnim.currentX = xNext;
    const currentMathPoint = { x: xNext, y: yNext };
    currentTrace.push(currentMathPoint);

    const pix = mathToPixel(xNext, yNext);
    bulletAnim.points.push(pix);

    // 障碍物碰撞检测
    for (const obs of levelData.obstacles) {
      const dx = xNext - obs.x;
      const dy = yNext - obs.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= obs.radius) {
        hitDetected = true;
        createExplosion(xNext, yNext, '#f59e0b');
        showFeedback(`💥 撞击障碍物 [${obs.label}]！弹道终止`);
        sound.playExplosion();
        break;
      }
    }
    if (hitDetected) break;

    // 怪物碰撞检测
    for (const enemy of levelData.enemies) {
      if (enemy.hp <= 0) continue;
      const dx = xNext - enemy.x;
      const dy = yNext - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= enemy.radius) {
        hitDetected = true;
        enemy.hp -= 100;
        createExplosion(xNext, yNext, '#f43f5e');
        
        score += isEndlessMode ? 250 : 100;
        scoreDisplay.textContent = score;

        showFeedback(`💥 成功消灭怪物: [${enemy.name}]！`, 'pink');
        sound.playExplosion();
        break;
      }
    }
    if (hitDetected) break;

    // 越界判定
    if (xNext > GAME_CONFIG.MATH_X_MAX || yNext < GAME_CONFIG.MATH_Y_MIN || yNext > GAME_CONFIG.MATH_Y_MAX) {
      outOfBounds = true;
      break;
    }
  }

  draw();

  if (hitDetected || outOfBounds) {
    if (currentTrace.length > 0) {
      firedPathsHistory.push(currentTrace);
    }
    
    bulletAnim.active = false;
    fireBtn.disabled = false;
    fireBtn.classList.remove('opacity-50', 'cursor-not-allowed');

    checkGameResult();
    return;
  }

  requestAnimationFrame(animateBullet);
}

// ==================== 胜负及规则条件判定 ====================
function checkGameResult() {
  const allDead = levelData.enemies.every(e => e.hp <= 0);
  if (allDead) {
    sound.playSuccess();
    setTimeout(() => {
      showModal(true);
    }, 800);
    return;
  }

  if (levelData.ammo <= 0) {
    sound.playGameOver();
    setTimeout(() => {
      showModal(false);
    }, 800);
  }
}

// ==================== 呼出大状态模态框 ====================
function showModal(isVictory) {
  gameModal.classList.remove('hidden');
  if (isVictory) {
    modalTitle.textContent = "🏆 维度战役大捷！";
    modalTitle.className = "text-4xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-green-400 tracking-wide";
    
    if (isEndlessMode) {
      modalDesc.textContent = `你战术分析完美，在无尽生成关卡中成功消灭了全部入侵实体！获取分数：+250！`;
      modalActionBtn.textContent = "生成下一关";
    } else {
      modalDesc.textContent = `成功运用数学公式打穿了《${levelData.name}》。这简直是一场微积分的艺术。`;
      modalActionBtn.textContent = (currentLevelIndex < LEVELS.length - 1) ? "下一关" : "重开大满贯";
    }
    modalActionBtn.className = "px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 font-bold rounded-lg transition transform hover:scale-105 shadow-lg shadow-emerald-500/20";
  } else {
    modalTitle.textContent = "❌ 弹药枯竭，战败！";
    modalTitle.className = "text-4xl font-bold mb-2 text-rose-500 tracking-wide";
    modalDesc.textContent = `你射空了所有维度函数弹，但依然有小怪在右侧游荡。不要气馁，根据刚才的淡紫色历史弹道曲线微调参数再试一次！`;
    modalActionBtn.textContent = "重新开始此关";
    modalActionBtn.className = "px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-bold rounded-lg transition text-slate-300";
  }
}

// ==================== 飘字浮层通知 ====================
function showFeedback(msg, style = 'cyan') {
  const container = document.getElementById('canvas-overlay-msg');
  const text = document.getElementById('overlay-text');
  text.textContent = msg;
  
  const dot = container.querySelector('span');
  if (style === 'pink') {
    text.className = "text-pink-400 font-mono";
    dot.className = "w-2 h-2 rounded-full bg-pink-500 animate-ping";
  } else {
    text.className = "text-cyan-400 font-mono";
    dot.className = "w-2 h-2 rounded-full bg-cyan-500 animate-ping";
  }

  container.classList.remove('opacity-0');
  container.classList.add('opacity-100');
  
  setTimeout(() => {
    container.classList.remove('opacity-100');
    container.classList.add('opacity-0');
  }, 3500);
}

// ==================== 绘制主画布 (Grid, Stars, Player, Enemies, Traces) ====================
function draw() {
  // 安全守护：防止在数据加载前发生初始化绘制崩溃
  if (!levelData || !levelData.player || !levelData.obstacles || !levelData.enemies) {
    return;
  }

  ctx.clearRect(0, 0, canvasW, canvasH);

  // 1. 绘制暗星空虚化背景
  ctx.fillStyle = '#070a13';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 绘制星星背景点缀
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  for (let i = 0; i < 30; i++) {
    const x = (Math.sin(i * 12345) * 0.5 + 0.5) * canvasW;
    const y = (Math.cos(i * 54321) * 0.5 + 0.5) * canvasH;
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  // 2. 绘制网格线 (Grid)
  ctx.lineWidth = 1;
  for (let x = GAME_CONFIG.MATH_X_MIN; x <= GAME_CONFIG.MATH_X_MAX; x += 1) {
    if (x === 0) continue;
    const p1 = mathToPixel(x, GAME_CONFIG.MATH_Y_MIN);
    const p2 = mathToPixel(x, GAME_CONFIG.MATH_Y_MAX);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.15)';
    ctx.beginPath();
    ctx.moveTo(p1.x, 0);
    ctx.lineTo(p1.x, canvasH);
    ctx.stroke();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.font = '10px Fira Code';
    ctx.textAlign = 'center';
    ctx.fillText(x.toString(), p1.x, mathToPixel(0, 0).y + 14);
  }
  for (let y = GAME_CONFIG.MATH_Y_MIN; y <= GAME_CONFIG.MATH_Y_MAX; y += 1) {
    if (y === 0) continue;
    const p1 = mathToPixel(GAME_CONFIG.MATH_X_MIN, y);
    const p2 = mathToPixel(GAME_CONFIG.MATH_X_MAX, y);
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, p1.y);
    ctx.lineTo(canvasW, p1.y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.font = '10px Fira Code';
    ctx.textAlign = 'right';
    ctx.fillText(y.toString(), mathToPixel(0, 0).x - 6, p1.y + 4);
  }

  // 3. 绘制主轴线 (X轴 和 Y轴)
  const origin = mathToPixel(0, 0);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  ctx.beginPath();
  ctx.moveTo(0, origin.y);
  ctx.lineTo(canvasW, origin.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(origin.x, 0);
  ctx.lineTo(origin.x, canvasH);
  ctx.stroke();

  ctx.fillStyle = 'rgba(148, 163, 184, 0.5)';
  ctx.font = '10px Fira Code';
  ctx.textAlign = 'right';
  ctx.fillText("0", origin.x - 4, origin.y + 12);

  // 4. 绘制历史炮弹轨迹线
  firedPathsHistory.forEach((path, idx) => {
    if (path.length < 2) return;
    ctx.beginPath();
    ctx.lineWidth = 2;
    const opacity = Math.max(0.05, 0.35 - (firedPathsHistory.length - idx - 1) * 0.15);
    ctx.strokeStyle = `rgba(168, 85, 247, ${opacity})`;
    
    const firstPix = mathToPixel(path[0].x, path[0].y);
    ctx.moveTo(firstPix.x, firstPix.y);
    for (let i = 1; i < path.length; i++) {
      const pix = mathToPixel(path[i].x, path[i].y);
      ctx.lineTo(pix.x, pix.y);
    }
    ctx.stroke();
  });

  // 5. 绘制当前正在发射的弹道路径
  if (bulletAnim.active && bulletAnim.points.length > 1) {
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ec4899';
    ctx.beginPath();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ec4899';

    const pStart = bulletAnim.points[0];
    ctx.moveTo(pStart.x, pStart.y);
    for (let i = 1; i < bulletAnim.points.length; i++) {
      ctx.lineTo(bulletAnim.points[i].x, bulletAnim.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
  // 子弹头单独绘制：即使只有起始点也确保可见
  if (bulletAnim.active && bulletAnim.points.length >= 1) {
    const head = bulletAnim.points[bulletAnim.points.length - 1];
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#38bdf8';
    ctx.beginPath();
    ctx.arc(head.x, head.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 6. 绘制障碍物 (Obstacles)
  levelData.obstacles.forEach(obs => {
    const pix = mathToPixel(obs.x, obs.y);
    const radiusPix = (obs.radius / (GAME_CONFIG.MATH_X_MAX - GAME_CONFIG.MATH_X_MIN)) * canvasW;

    ctx.save();
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
    ctx.fillStyle = 'rgba(245, 158, 11, 0.08)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pix.x, pix.y, radiusPix, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(pix.x, pix.y, radiusPix - 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
    ctx.font = 'bold 11px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText(obs.label || "电场屏蔽", pix.x, pix.y + 3);
  });

  // 7. 绘制玩家炮塔 (Player Base)
  const pPix = mathToPixel(levelData.player.x, levelData.player.y);
  ctx.save();
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(pPix.x, pPix.y, 25, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#0e172c';
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(pPix.x, pPix.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.arc(pPix.x, pPix.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 8. 绘制敌方目标 (Enemies)
  levelData.enemies.forEach(enemy => {
    if (enemy.hp <= 0) return;
    
    const ePix = mathToPixel(enemy.x, enemy.y);
    const eRadPix = (enemy.radius / (GAME_CONFIG.MATH_X_MAX - GAME_CONFIG.MATH_X_MIN)) * canvasW;

    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#f43f5e';
    ctx.fillStyle = 'rgba(244, 63, 94, 0.12)';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ePix.x, ePix.y, eRadPix, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const time = Date.now() * 0.003;
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 1.5;
    ctx.translate(ePix.x, ePix.y);
    ctx.rotate(time);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const ang = (i * Math.PI * 2) / 3;
      const rx = Math.cos(ang) * (eRadPix * 0.6);
      const ry = Math.sin(ang) * (eRadPix * 0.6);
      if (i === 0) ctx.moveTo(rx, ry);
      else ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // 血条
    const barW = Math.max(30, eRadPix * 2);
    const barH = 4;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(ePix.x - barW / 2, ePix.y - eRadPix - 12, barW, barH);
    
    ctx.fillStyle = '#f43f5e';
    const currentBarW = (enemy.hp / enemy.maxHp) * barW;
    ctx.fillRect(ePix.x - barW / 2, ePix.y - eRadPix - 12, currentBarW, barH);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px Rajdhani';
    ctx.textAlign = 'center';
    ctx.fillText(enemy.name, ePix.x, ePix.y - eRadPix - 16);
  });

  // 9. 绘制粒子
  updateParticles();
  drawParticles();
}

// ==================== 粒子循环渲染定时器 ====================
function globalGameLoop() {
  if (!bulletAnim.active) {
    draw();
  }
  requestAnimationFrame(globalGameLoop);
}

// ==================== 页面启动初始化 ====================
window.onload = function() {
  loadLevel(0, true);
  resizeCanvas();
  requestAnimationFrame(globalGameLoop);
};