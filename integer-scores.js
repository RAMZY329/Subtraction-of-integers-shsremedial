const CLASS_SCORES_URL = "https://script.google.com/macros/s/AKfycbw51dk3x_enz9pGvBFx1VC0tbWfGb66_CLrQxWYZxe0h8zDWVc606yXcefm6S-s_ngK/exec";
const LOCAL_SCORE_KEY = "integerSoloAnalyzerScores";

function scoresEscapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function cleanScoreName(name) {
  const value = String(name || "Anonymous").trim();
  return value || "Anonymous";
}

function normalizeScoreRow(row) {
  if (Array.isArray(row)) {
    return {
      name: cleanScoreName(row[0]),
      score: Number(row[1]) || 0,
      timestamp: row[2] || "",
    };
  }

  if (!row || typeof row !== "object") {
    return { name: "Anonymous", score: 0, timestamp: "" };
  }

  return {
    name: cleanScoreName(row.name || row.player || row.student || row["Name"]),
    score: Number(row.score || row.Score || row.points || row.Points) || 0,
    timestamp: row.timestamp || row.time || row.Timestamp || row.submittedAt || "",
    accuracy: row.accuracy || row.Accuracy || "",
    total: row.total || row["Total Answered"] || "",
  };
}

function getLocalScores() {
  try {
    const rows = JSON.parse(localStorage.getItem(LOCAL_SCORE_KEY) || "[]");
    return Array.isArray(rows) ? rows.map(normalizeScoreRow) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalScore(row) {
  const rows = getLocalScores();
  rows.unshift(normalizeScoreRow(row));
  localStorage.setItem(LOCAL_SCORE_KEY, JSON.stringify(rows.slice(0, 50)));
}

function aggregateBestScores(rows) {
  const bestByName = {};
  rows.map(normalizeScoreRow).forEach(row => {
    if (!bestByName[row.name] || row.score > bestByName[row.name].score) {
      bestByName[row.name] = row;
    }
  });

  return Object.values(bestByName)
    .sort((a, b) => b.score - a.score || String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 20);
}

async function fetchClassScores() {
  if (!CLASS_SCORES_URL) throw new Error("Class scores URL is not configured");

  try {
    const response = await fetch(CLASS_SCORES_URL, { cache: "no-cache" });
    if (!response.ok) throw new Error("Class scores request failed");
    return response.json();
  } catch (error) {
    return fetchClassScoresJsonp();
  }
}

function fetchClassScoresJsonp(timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const callbackName = "__scores_cb_" + Date.now();
    const separator = CLASS_SCORES_URL.includes("?") ? "&" : "?";
    const script = document.createElement("script");

    window[callbackName] = data => {
      resolve(data);
      cleanup();
    };

    function cleanup() {
      try { delete window[callbackName]; } catch (e) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    script.src = `${CLASS_SCORES_URL}${separator}callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("Class scores JSONP request failed"));
    };

    document.body.appendChild(script);
    setTimeout(() => {
      if (window[callbackName]) {
        cleanup();
        reject(new Error("Class scores request timed out"));
      }
    }, timeoutMs);
  });
}

function renderScoreList(rows) {
  if (!rows.length) {
    return '<p class="leaderboard-note">No scores yet.</p>';
  }

  return `
    <ol class="leaderboard-list">
      ${rows.map((row, index) => `
        <li class="leaderboard-item">
          <div class="leaderboard-rank">${index + 1}</div>
          <div class="leaderboard-entry">
            <div>
              <div class="leaderboard-name">${scoresEscapeHtml(row.name)}</div>
              <small>${scoresEscapeHtml(row.accuracy ? `Accuracy: ${row.accuracy}` : formatScoreDate(row.timestamp))}</small>
            </div>
            <div class="leaderboard-score">${scoresEscapeHtml(row.score)}</div>
          </div>
        </li>
      `).join("")}
    </ol>
  `;
}

function formatScoreDate(value) {
  if (!value) return "Recent score";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function loadScoresView(targetId = "scores-view") {
  const el = document.getElementById(targetId);
  if (!el) return;

  const localScores = getLocalScores();
  el.innerHTML = `
    <div class="scores-panel">
      <div class="scores-heading">
        <h3>Scores</h3>
        <button id="refresh-scores-btn" type="button" class="secondary-btn">Refresh</button>
      </div>
      <div class="scores-grid">
        <div class="scores-card">
          <h4>Class Scores</h4>
          <div id="class-scores-body"><p class="leaderboard-note">Loading class scores...</p></div>
        </div>
        <div class="scores-card">
          <h4>Your Recent Scores</h4>
          ${renderScoreList(localScores.slice(0, 10))}
          <p class="leaderboard-note">These are saved on this device.</p>
        </div>
      </div>
    </div>
  `;

  const refreshBtn = document.getElementById("refresh-scores-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadScoresView(targetId));
  }

  const classBody = document.getElementById("class-scores-body");
  try {
    const data = await fetchClassScores();
    const rows = Array.isArray(data) ? aggregateBestScores(data) : aggregateBestScores(data && data.rows ? data.rows : []);
    classBody.innerHTML = renderScoreList(rows);
  } catch (error) {
    classBody.innerHTML = `
      <p class="leaderboard-note">Class scores are not available yet.</p>
      <p class="leaderboard-note">Connect a Google Apps Script /exec URL in <code>integer-scores.js</code> to show classmates' scores here.</p>
    `;
  }
}
