(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('p1Score');
  const probEl = document.getElementById('problemText');
  const timerEl = document.getElementById('timer');
  const startScreen = document.getElementById('startScreen');
  const endScreen = document.getElementById('endScreen');
  const resultTitle = document.getElementById('resultTitle');
  const resultAnalysis = document.getElementById('resultAnalysis');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const bgm = document.getElementById('bgm');
  const victorySfx = document.getElementById('victorySfx');

  const ROUND_MS = 180000;
  let W = 0;
  let H = 0;
  let TILE = 22;
  let gridW = 0;
  let gridH = 0;
  let lastTs = 0;
  let acc = 0;
  let moveInterval = 120;
  let state = 'menu';
  let timer = ROUND_MS;
  let score = 0;
  let patternStats = {};
  let attemptHistory = [];

  const game = {
    snake: null,
    answers: [],
    problem: null,
  };

  function resize() {
    canvas.width = Math.floor(window.innerWidth);
    canvas.height = Math.floor(window.innerHeight - document.getElementById('hud').offsetHeight);
    W = canvas.width;
    H = canvas.height;
    gridW = Math.max(8, Math.floor(W / TILE));
    gridH = Math.max(8, Math.floor(H / TILE));
  }

  window.addEventListener('resize', resize);
  resize();

  function rInt(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  function choice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function signWrap(n) {
    return n < 0 ? `(${n})` : String(n);
  }

  function signName(n) {
    if (n < 0) return 'negative';
    if (n > 0) return 'positive';
    return 'zero';
  }

  function titleCase(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function getPattern(a, b) {
    return `${titleCase(signName(a))} - ${titleCase(signName(b))}`;
  }

  function genProblem() {
    const a = rInt(-20, 20);
    const b = rInt(-20, 20);
    const correct = a - b;
    const offsets = [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6];
    const wrongs = new Set();
    let tries = 0;

    while (wrongs.size < 3 && tries < 200) {
      tries++;
      const cand = correct + choice(offsets);
      if (cand !== correct && cand >= -45 && cand <= 45) {
        wrongs.add(cand);
      }
    }

    while (wrongs.size < 3) {
      const cand = correct + wrongs.size + 1;
      if (cand !== correct) wrongs.add(cand);
    }

    const all = [...wrongs, correct].map(value => ({
      value,
      isCorrect: value === correct,
      x: 0,
      y: 0,
    }));

    for (let i = all.length - 1; i > 0; i--) {
      const j = rInt(0, i);
      [all[i], all[j]] = [all[j], all[i]];
    }

    const text = `${signWrap(a)} - ${signWrap(b)} = ?`;
    return {
      a,
      b,
      op: '-',
      correct,
      choices: all,
      text,
      pattern: getPattern(a, b),
    };
  }

  function occupyMap() {
    const occ = new Set();
    if (!game.snake) return occ;
    for (const seg of game.snake.segs) {
      occ.add(`${seg.x},${seg.y}`);
    }
    return occ;
  }

  function placeAnswers() {
    const occ = occupyMap();
    const placed = [];
    const minDist = 3;
    const maxX = Math.max(1, gridW - 2);
    const maxY = Math.max(1, gridH - 2);

    function isFarEnough(x, y) {
      for (const p of placed) {
        if (Math.abs(p.x - x) + Math.abs(p.y - y) < minDist) return false;
      }
      return true;
    }

    for (const ch of game.problem.choices) {
      let tries = 0;
      let x;
      let y;
      do {
        x = rInt(1, maxX);
        y = rInt(1, maxY);
        tries++;
      } while ((occ.has(`${x},${y}`) || !isFarEnough(x, y)) && tries < 200);
      ch.x = x;
      ch.y = y;
      placed.push({ x, y });
    }
    game.answers = game.problem.choices;
  }

  class Snake {
    constructor(x, y, color) {
      this.color = color;
      this.dir = { x: 1, y: 0 };
      this.nextDir = { x: 1, y: 0 };
      this.segs = [];
      for (let i = 0; i < 5; i++) {
        this.segs.push({ x: x - i, y });
      }
      this.grow = 0;
    }

    setDir(dx, dy) {
      if (dx === -this.dir.x && dy === -this.dir.y) return;
      this.nextDir = { x: dx, y: dy };
    }

    step() {
      this.dir = this.nextDir;
      const head = this.segs[0];
      let nx = head.x + this.dir.x;
      let ny = head.y + this.dir.y;

      if (nx < 0) nx = gridW - 1;
      else if (nx >= gridW) nx = 0;
      if (ny < 0) ny = gridH - 1;
      else if (ny >= gridH) ny = 0;

      this.segs.unshift({ x: nx, y: ny });
      if (this.grow > 0) {
        this.grow--;
      } else {
        this.segs.pop();
      }

      for (let i = 1; i < this.segs.length; i++) {
        if (this.segs[i].x === nx && this.segs[i].y === ny) {
          this.segs.pop();
          this.grow = 0;
          score = Math.max(0, score - 1);
          break;
        }
      }
    }
  }

  function resetSnake() {
    const startX = Math.max(5, Math.floor(gridW / 4));
    const startY = Math.max(3, Math.floor(gridH / 2));
    game.snake = new Snake(startX, startY, '#56f1ff');
  }

  function setDirection(dir) {
    if (!game.snake || state !== 'playing') return;
    const map = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };
    const vector = map[dir];
    if (!vector) return;
    game.snake.setDir(vector[0], vector[1]);
  }

  window.addEventListener('keydown', e => {
    if (state !== 'playing') return;
    switch (e.key) {
      case 'w':
      case 'W':
      case 'ArrowUp':
        setDirection('up');
        break;
      case 'a':
      case 'A':
      case 'ArrowLeft':
        setDirection('left');
        break;
      case 's':
      case 'S':
      case 'ArrowDown':
        setDirection('down');
        break;
      case 'd':
      case 'D':
      case 'ArrowRight':
        setDirection('right');
        break;
    }
  });

  document.getElementById('mobileControls').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || state !== 'playing') return;
    setDirection(b.getAttribute('data-dir'));
  });

  function drawGrid() {
    ctx.fillStyle = '#0a0d1a';
    ctx.fillRect(0, 0, W, H);
  }

  function drawWatermark() {
    ctx.save();
    ctx.rotate(-Math.PI / 6);
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    const size = Math.min(24, Math.max(16, Math.floor(W * 0.02)));
    ctx.font = `900 ${size}px system-ui`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const text = 'SUMIMAO NATIONAL HIGH SCHOOL';
    const w = ctx.measureText(text).width;
    const stepX = w + 60;
    const stepY = size + 50;
    for (let y = -H; y < H * 2; y += stepY) {
      for (let x = -W; x < W * 2; x += stepX) {
        ctx.fillText(text, x, y);
      }
    }
    ctx.restore();
  }

  function drawSnake(s) {
    ctx.fillStyle = s.color;
    ctx.strokeStyle = '#00000040';
    for (let i = 0; i < s.segs.length; i++) {
      const seg = s.segs[i];
      const x = seg.x * TILE;
      const y = seg.y * TILE;
      ctx.beginPath();
      ctx.rect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  function drawAnswers() {
    ctx.fillStyle = '#3b4aa8';
    ctx.strokeStyle = '#202a6a';
    for (const a of game.answers) {
      const x = a.x * TILE;
      const y = a.y * TILE;
      ctx.beginPath();
      ctx.rect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#e9ecf1';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(a.value), x + TILE / 2, y + TILE / 2);
      ctx.fillStyle = '#3b4aa8';
    }
  }

  function updateHUD() {
    scoreEl.textContent = `Score: ${score}`;
    probEl.textContent = game.problem ? game.problem.text : 'Press Start to play!';
    const t = Math.max(0, Math.floor(timer / 1000));
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(t % 60).padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }

  function recordAttempt(chosen, isCorrect) {
    const problem = game.problem;
    const key = problem.pattern;
    if (!patternStats[key]) {
      patternStats[key] = {
        label: key,
        attempts: 0,
        correct: 0,
      };
    }

    patternStats[key].attempts++;
    if (isCorrect) patternStats[key].correct++;
    attemptHistory.push({
      question: problem.text,
      correct: problem.correct,
      chosen,
      isCorrect,
      pattern: key,
    });
  }

  function checkEats() {
    const s = game.snake;
    if (!s) return;
    const head = s.segs[0];
    for (const a of game.answers) {
      if (head.x === a.x && head.y === a.y) {
        s.grow += 1;
        recordAttempt(a.value, a.isCorrect);
        if (a.isCorrect) {
          score++;
          game.problem = genProblem();
          placeAnswers();
        } else {
          score = Math.max(0, score - 1);
          a.x = -999;
          a.y = -999;
        }
      }
    }

    game.answers = game.answers.filter(a => a.x >= 0);
  }

  function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
  }

  function statAccuracy(stat) {
    return stat.attempts ? stat.correct / stat.attempts : 0;
  }

  function renderAnalysis() {
    const entries = Object.values(patternStats);
    if (!entries.length) {
      resultAnalysis.innerHTML = '<p>No answer attempts yet. Play another round to build an analyzer report.</p>';
      return;
    }

    const strongest = [...entries].sort((a, b) => statAccuracy(b) - statAccuracy(a) || b.attempts - a.attempts)[0];
    const weakest = [...entries].sort((a, b) => statAccuracy(a) - statAccuracy(b) || b.attempts - a.attempts)[0];
    const rows = entries
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(stat => `
        <tr>
          <td>${stat.label}</td>
          <td>${stat.correct}/${stat.attempts}</td>
          <td>${formatPercent(statAccuracy(stat))}</td>
        </tr>
      `)
      .join('');

    const recent = attemptHistory
      .slice(-8)
      .reverse()
      .map(item => `
        <li>
          <span>${item.question}</span>
          <strong>${item.isCorrect ? 'Correct' : 'Wrong'}</strong>
          <small>${item.pattern}</small>
        </li>
      `)
      .join('');

    resultAnalysis.innerHTML = `
      <h3>Pattern Analyzer</h3>
      <div class="analysis-grid">
        <div>
          <span>Most accurate</span>
          <strong>${strongest.label}</strong>
          <small>${strongest.correct}/${strongest.attempts} correct (${formatPercent(statAccuracy(strongest))})</small>
        </div>
        <div>
          <span>Needs practice</span>
          <strong>${weakest.label}</strong>
          <small>${weakest.correct}/${weakest.attempts} correct (${formatPercent(statAccuracy(weakest))})</small>
        </div>
      </div>
      <table>
        <thead>
          <tr><th>Pattern</th><th>Correct</th><th>Accuracy</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <ul class="recent-list">${recent}</ul>
    `;
  }

  function loop(ts) {
    const dt = ts - (lastTs || ts);
    lastTs = ts;
    if (state !== 'playing') {
      requestAnimationFrame(loop);
      return;
    }

    acc += dt;
    timer -= dt;
    if (timer <= 0) {
      timer = 0;
      endMatch();
      updateHUD();
      requestAnimationFrame(loop);
      return;
    }

    while (acc >= moveInterval) {
      game.snake.step();
      checkEats();
      acc -= moveInterval;
    }

    drawGrid();
    drawWatermark();
    drawAnswers();
    drawSnake(game.snake);
    updateHUD();
    requestAnimationFrame(loop);
  }

  function startMatch() {
    resize();
    state = 'playing';
    score = 0;
    timer = ROUND_MS;
    acc = 0;
    lastTs = 0;
    patternStats = {};
    attemptHistory = [];
    resetSnake();
    game.problem = genProblem();
    placeAnswers();
    updateHUD();
    resultAnalysis.innerHTML = '';
    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    if (bgm) {
      bgm.currentTime = 0;
      bgm.volume = 0.6;
      bgm.play().catch(() => {});
    }
    if (victorySfx) {
      victorySfx.pause();
      victorySfx.currentTime = 0;
    }
  }

  function endMatch() {
    if (state === 'ended') return;
    state = 'ended';
    startScreen.classList.add('hidden');
    endScreen.classList.remove('hidden');
    resultTitle.textContent = `Game Over - Score: ${score}`;
    renderAnalysis();
    if (bgm) {
      bgm.pause();
      bgm.currentTime = 0;
    }
    if (victorySfx) {
      victorySfx.volume = 0.85;
      victorySfx.currentTime = 0;
      victorySfx.play().catch(() => {});
    }
  }

  startBtn.addEventListener('click', startMatch);
  restartBtn.addEventListener('click', startMatch);

  updateHUD();
  requestAnimationFrame(loop);
})();
