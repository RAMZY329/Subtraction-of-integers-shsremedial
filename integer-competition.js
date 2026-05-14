let competitionTimer;
let hiddenDuringPlay = [];
let compTimeLeft = 60;
let playerScore = 0;
let solvedProblems = [];
let currentProblem = null;

const optionKeys = ["1", "2", "3", "4"];
const alternateOptionKeys = ["a", "s", "d", "f"];

function playAnswerSound(isCorrect) {
  const audio = document.getElementById(isCorrect ? "correctSfx" : "wrongSfx");
  if (!audio) return;
  audio.currentTime = 0;
  audio.volume = isCorrect ? 0.8 : 0.75;
  audio.play().catch(() => {});
}

function formatNumber(n) {
  const num = Number(n);
  if (!isFinite(num)) return String(n);
  let s = num.toPrecision(8);
  if (!s.includes("e")) s = parseFloat(s).toString();
  return s;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function signName(n) {
  const value = Number(n);
  if (value < 0) return "negative";
  if (value > 0) return "positive";
  return "zero";
}

function titleCase(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getPatternInfo(problem) {
  const left = signName(problem.a);
  const right = signName(problem.b);
  const key = `${left}-${right}`;
  const label = `${titleCase(left)} minus ${titleCase(right)}`;
  let hint = "Use keep-change-change, then add the opposite.";

  if (right === "negative") {
    hint = "Subtracting a negative becomes addition.";
  } else if (left === "negative" && right === "positive") {
    hint = "A negative minus a positive moves farther below zero.";
  } else if (left === "positive" && right === "positive") {
    hint = "Compare the values to decide whether the answer stays positive or turns negative.";
  } else if (left === "zero" || right === "zero") {
    hint = "Zero changes the size of the expression less, but the sign rule still matters.";
  }

  return { key, label, hint };
}

function shuffle(values) {
  const arr = [...values];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateDistractors(answer, question, count) {
  const distractors = new Set();
  const base = Number(answer);

  for (let d = 1; distractors.size < count && d <= 6; d++) {
    distractors.add(base + d);
    distractors.add(base - d);
  }

  const m = (question || "").match(/\(?(-?\d+)\)?\s*([+\-])\s*\(?(-?\d+)\)?/);
  if (m && distractors.size < count) {
    const a = Number(m[1]);
    const op = m[2];
    const b = Number(m[3]);
    if (op === "+") {
      distractors.add(a - b);
      distractors.add(b - a);
    } else {
      distractors.add(a + b);
      distractors.add(b - a);
    }
    distractors.add(-base);
    distractors.add(Math.abs(a) - Math.abs(b));
  }

  while (distractors.size < count) {
    const jitter = Math.floor(Math.random() * 9) + 1;
    const cand = base + (Math.random() < 0.5 ? -jitter : jitter);
    if (cand !== base) distractors.add(cand);
  }

  return Array.from(distractors)
    .filter(n => Number.isFinite(n) && n !== base)
    .slice(0, count);
}

function buildOptions(problem) {
  const options = new Set([problem.answer, ...generateDistractors(problem.answer, problem.question, 3)]);
  let nudge = 1;
  while (options.size < 4) {
    options.add(Number(problem.answer) + nudge);
    nudge++;
  }
  return shuffle(Array.from(options)).slice(0, 4);
}

function initCompetition() {
  const section = document.getElementById("competition-section");
  section.innerHTML = `
    <h2>Integer Operations Solo Challenge</h2>
    <div class="solo-intro">
      <p>Answer as many integer subtraction problems as you can before time runs out. The analyzer will show which sign patterns are your strongest and weakest.</p>
    </div>

    <div class="setup-row">
      <label for="player-name">Name</label>
      <input id="player-name" type="text" placeholder="Optional">
    </div>

    <div class="setup-row">
      <label for="comp-time-select">Challenge Time</label>
      <input type="number" id="comp-time-select" value="60" min="10" max="600">
      <span>seconds</span>
    </div>

    <div class="setup-actions">
      <button id="comp-start-btn">Start Solo Challenge</button>
      <button id="view-scores-btn" type="button" class="secondary-btn">View Scores</button>
    </div>

    <div class="solo-help">
      <strong>Shortcuts:</strong> press 1-4 or A/S/D/F to choose an answer.
    </div>

    <div class="score-strip">
      <span>Timer: <strong id="comp-timer">0</strong> seconds</span>
      <span>Score: <strong id="score-1">0</strong></span>
      <span>Answered: <strong id="answered-count">0</strong></span>
    </div>

    <div id="players" class="competition-grid solo-grid"></div>
    <div id="scores-view" class="scores-view hidden"></div>
    <div id="comp-summary"></div>
  `;

  document.getElementById("comp-start-btn").addEventListener("click", startCompetition);
  document.getElementById("view-scores-btn").addEventListener("click", toggleScoresView);
}

function showScoresView() {
  const scoresView = document.getElementById("scores-view");
  if (!scoresView) return;
  scoresView.classList.remove("hidden");
  if (typeof loadScoresView === "function") {
    loadScoresView("scores-view");
  } else {
    scoresView.innerHTML = '<p class="leaderboard-note">Score viewer is not available.</p>';
  }
  scoresView.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function toggleScoresView() {
  const scoresView = document.getElementById("scores-view");
  if (!scoresView) return;
  if (scoresView.classList.contains("hidden")) {
    showScoresView();
  } else {
    scoresView.classList.add("hidden");
  }
}

function startCompetition() {
  const compSection = document.getElementById("competition-section");
  hiddenDuringPlay = [];

  Array.from(compSection.children).forEach(el => {
    if (el.id !== "players") {
      hiddenDuringPlay.push(el);
      el.style.display = "none";
    }
  });

  const inputTime = parseInt(document.getElementById("comp-time-select").value, 10);
  compTimeLeft = isNaN(inputTime) ? 60 : Math.max(10, inputTime);
  playerScore = 0;
  solvedProblems = [];
  currentProblem = null;

  const scoresView = document.getElementById("scores-view");
  if (scoresView) {
    scoresView.classList.add("hidden");
    scoresView.innerHTML = "";
  }

  const summaryEl = document.getElementById("comp-summary");
  if (summaryEl) summaryEl.innerHTML = "";

  const playersDiv = document.getElementById("players");
  playersDiv.className = "competition-grid solo-grid";
  playersDiv.innerHTML = `
    <div class="player-panel solo-panel">
      <h3>Solo Player</h3>
      <div class="solo-stats">
        <span>Time: <strong id="active-timer">${compTimeLeft}</strong>s</span>
        <span>Score: <strong id="active-score">0</strong></span>
        <span>Answered: <strong id="active-answered">0</strong></span>
      </div>
      <div id="problem-1" class="solo-problem"></div>
    </div>
  `;

  updateCompetitionDisplay();
  generateCompetitionProblem();

  clearInterval(competitionTimer);
  competitionTimer = setInterval(() => {
    compTimeLeft--;
    updateCompetitionDisplay();
    if (compTimeLeft <= 0) {
      clearInterval(competitionTimer);
      endCompetition();
    }
  }, 1000);

  document.addEventListener("keydown", handleKeyPress);
}

function generateCompetitionProblem() {
  const problemEl = document.getElementById("problem-1");
  if (!problemEl) return;

  const problem = getProblem();
  const pattern = getPatternInfo(problem);
  const options = buildOptions(problem);
  currentProblem = { ...problem, pattern, options };

  problemEl.innerHTML = `
    <p class="pattern-pill">${escapeHtml(pattern.label)}</p>
    <p class="challenge-question">${escapeHtml(problem.question)}</p>
    <div class="options-container">
      ${options
        .map(
          (opt, idx) =>
            `<button class="option-btn" data-option-index="${idx}">${optionKeys[idx]}) ${formatNumber(opt)}</button>`
        )
        .join("")}
    </div>
  `;

  problemEl.querySelectorAll(".option-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      checkCompetitionAnswer(Number(btn.getAttribute("data-option-index")));
    });
  });
}

function handleKeyPress(e) {
  const key = e.key.toLowerCase();
  let idx = optionKeys.indexOf(key);
  if (idx === -1) idx = alternateOptionKeys.indexOf(key);
  if (idx !== -1 && currentProblem) {
    checkCompetitionAnswer(idx);
  }
}

function checkCompetitionAnswer(idx) {
  if (!currentProblem || idx < 0 || idx >= currentProblem.options.length) return;

  const chosen = currentProblem.options[idx];
  const isCorrect = Number(chosen) === Number(currentProblem.answer);

  playerScore = isCorrect ? playerScore + 1 : Math.max(0, playerScore - 1);
  solvedProblems.push({
    question: currentProblem.question,
    correct: currentProblem.answer,
    chosen,
    isCorrect,
    patternKey: currentProblem.pattern.key,
    patternLabel: currentProblem.pattern.label,
    hint: currentProblem.pattern.hint,
  });

  playAnswerSound(isCorrect);
  updateCompetitionDisplay();
  generateCompetitionProblem();
}

function updateCompetitionDisplay() {
  const setupTimer = document.getElementById("comp-timer");
  const setupScore = document.getElementById("score-1");
  const setupAnswered = document.getElementById("answered-count");
  const activeTimer = document.getElementById("active-timer");
  const activeScore = document.getElementById("active-score");
  const activeAnswered = document.getElementById("active-answered");

  if (setupTimer) setupTimer.textContent = compTimeLeft;
  if (setupScore) setupScore.textContent = playerScore;
  if (setupAnswered) setupAnswered.textContent = solvedProblems.length;
  if (activeTimer) activeTimer.textContent = compTimeLeft;
  if (activeScore) activeScore.textContent = playerScore;
  if (activeAnswered) activeAnswered.textContent = solvedProblems.length;
}

function getAccuracy(stat) {
  return stat.attempts ? stat.correct / stat.attempts : 0;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function buildPatternAnalysis() {
  if (!solvedProblems.length) {
    return `
      <div class="analysis-panel">
        <h4>Pattern Analyzer</h4>
        <p>No answers were submitted. Start another solo challenge to collect pattern data.</p>
      </div>
    `;
  }

  const statsByPattern = {};
  solvedProblems.forEach(item => {
    if (!statsByPattern[item.patternKey]) {
      statsByPattern[item.patternKey] = {
        label: item.patternLabel,
        hint: item.hint,
        attempts: 0,
        correct: 0,
      };
    }
    statsByPattern[item.patternKey].attempts++;
    if (item.isCorrect) statsByPattern[item.patternKey].correct++;
  });

  const stats = Object.values(statsByPattern);
  const strongest = [...stats].sort((a, b) => getAccuracy(b) - getAccuracy(a) || b.attempts - a.attempts)[0];
  const weakest = [...stats].sort((a, b) => getAccuracy(a) - getAccuracy(b) || b.attempts - a.attempts)[0];
  const totalCorrect = solvedProblems.filter(item => item.isCorrect).length;
  const overallAccuracy = totalCorrect / solvedProblems.length;

  const rows = stats
    .sort((a, b) => getAccuracy(b) - getAccuracy(a) || a.label.localeCompare(b.label))
    .map(
      stat => `
        <tr>
          <td>${escapeHtml(stat.label)}</td>
          <td>${stat.correct}/${stat.attempts}</td>
          <td>${formatPercent(getAccuracy(stat))}</td>
          <td>${escapeHtml(stat.hint)}</td>
        </tr>
      `
    )
    .join("");

  const review = solvedProblems
    .slice(-12)
    .reverse()
    .map(
      item => `
        <li class="${item.isCorrect ? "correct" : "wrong"}">
          <span>${escapeHtml(item.question)}</span>
          <strong>${item.isCorrect ? "Correct" : "Wrong"}</strong>
          <small>Your answer: ${formatNumber(item.chosen)} | Correct: ${formatNumber(item.correct)} | ${escapeHtml(item.patternLabel)}</small>
        </li>
      `
    )
    .join("");

  const comparisonNote =
    stats.length === 1
      ? '<p class="leaderboard-note">Answer more than one pattern to compare strengths and weaknesses more clearly.</p>'
      : "";

  return `
    <div class="analysis-panel">
      <h4>Pattern Analyzer</h4>
      <div class="summary-metrics">
        <span>Overall accuracy <strong>${formatPercent(overallAccuracy)}</strong></span>
        <span>Total correct <strong>${totalCorrect}/${solvedProblems.length}</strong></span>
        <span>Final score <strong>${playerScore}</strong></span>
      </div>
      <div class="analysis-grid">
        <div class="analysis-card strong">
          <span>Most accurate pattern</span>
          <strong>${escapeHtml(strongest.label)}</strong>
          <small>${strongest.correct}/${strongest.attempts} correct (${formatPercent(getAccuracy(strongest))})</small>
        </div>
        <div class="analysis-card weak">
          <span>Least accurate pattern</span>
          <strong>${escapeHtml(weakest.label)}</strong>
          <small>${weakest.correct}/${weakest.attempts} correct (${formatPercent(getAccuracy(weakest))})</small>
        </div>
      </div>
      ${comparisonNote}
      <div class="table-wrap">
        <table class="pattern-table">
          <thead>
            <tr>
              <th>Pattern</th>
              <th>Correct</th>
              <th>Accuracy</th>
              <th>Practice note</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <h4>Recent Answers</h4>
      <ul class="problem-review">${review}</ul>
    </div>
  `;
}

function buildSubmissionDetails() {
  const total = solvedProblems.length;
  const correct = solvedProblems.filter(item => item.isCorrect).length;
  const accuracy = total ? formatPercent(correct / total) : "0%";
  const statsByPattern = {};

  solvedProblems.forEach(item => {
    if (!statsByPattern[item.patternKey]) {
      statsByPattern[item.patternKey] = {
        label: item.patternLabel,
        attempts: 0,
        correct: 0,
      };
    }
    statsByPattern[item.patternKey].attempts++;
    if (item.isCorrect) statsByPattern[item.patternKey].correct++;
  });

  const stats = Object.values(statsByPattern);
  const strongest = stats.length
    ? [...stats].sort((a, b) => getAccuracy(b) - getAccuracy(a) || b.attempts - a.attempts)[0]
    : null;
  const weakest = stats.length
    ? [...stats].sort((a, b) => getAccuracy(a) - getAccuracy(b) || b.attempts - a.attempts)[0]
    : null;

  return {
    mode: "Integer Solo Analyzer",
    total,
    correct,
    accuracy,
    strongest: strongest ? `${strongest.label} (${formatPercent(getAccuracy(strongest))})` : "",
    weakest: weakest ? `${weakest.label} (${formatPercent(getAccuracy(weakest))})` : "",
    details: solvedProblems
      .map(item => `${item.question} | answer ${formatNumber(item.chosen)} | correct ${formatNumber(item.correct)} | ${item.isCorrect ? "correct" : "wrong"} | ${item.patternLabel}`)
      .join("\n"),
  };
}

function endCompetition() {
  hiddenDuringPlay.forEach(el => (el.style.display = ""));
  hiddenDuringPlay = [];
  document.getElementById("players").innerHTML = "";
  document.removeEventListener("keydown", handleKeyPress);

  const name = (document.getElementById("player-name") || {}).value || "Anonymous";
  const submissionDetails = buildSubmissionDetails();
  if (typeof saveLocalScore === "function") {
    saveLocalScore({
      name,
      score: playerScore,
      timestamp: new Date().toISOString(),
      ...submissionDetails,
    });
  }

  const summaryEl = document.getElementById("comp-summary");
  summaryEl.innerHTML = `
    <h3>Solo Challenge Complete</h3>
    ${buildPatternAnalysis()}
    <p id="submission-status" class="leaderboard-note">Saving score to Google Forms...</p>
    <div class="summary-actions">
      <button id="summary-view-scores-btn" type="button" class="secondary-btn">View Scores</button>
    </div>
  `;

  const summaryScoresBtn = document.getElementById("summary-view-scores-btn");
  if (summaryScoresBtn) summaryScoresBtn.addEventListener("click", showScoresView);

  const statusEl = document.getElementById("submission-status");
  try {
    if (typeof isGFormConfigured === "function" && isGFormConfigured()) {
      if (typeof sendScoreToGoogleForm === "function") {
        sendScoreToGoogleForm(name, playerScore, submissionDetails)
          .then(result => {
            if (statusEl) {
              statusEl.textContent = result && result.success
                ? "Score sent to Google Forms."
                : "Score could not be confirmed. Check your Google Form settings.";
            }
          })
          .catch(() => {
            if (statusEl) statusEl.textContent = "Score was not sent. Check your Google Form settings.";
          });
      }
    } else if (statusEl) {
      statusEl.textContent = "Google Forms is not configured yet.";
    }
  } catch (e) {
    console.warn("gforms submission skipped or failed", e);
    if (statusEl) statusEl.textContent = "Score was not sent. Check your Google Form settings.";
  }
}
