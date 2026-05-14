let currentTopic = "integers_subtraction";

const ProblemGenerator = {
  integers_subtraction: () => {
    function randInt(min, max) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    const MIN = -20;
    const MAX = 20;

    let a = randInt(MIN, MAX);
    let b = randInt(MIN, MAX);

    if (a === 0 && b === 0) {
      a = 1;
    }

    const op = "-";
    const answer = a - b;

    function fmt(n) {
      return n < 0 ? `(${n})` : `${n}`;
    }

    const questionPhrases = [
      `${fmt(a)} ${op} ${fmt(b)} = ?`,
      `Compute: ${fmt(a)} ${op} ${fmt(b)}`,
      `What is ${fmt(a)} ${op} ${fmt(b)}?`,
    ];

    const question = questionPhrases[Math.floor(Math.random() * questionPhrases.length)];

    return { question, answer, a, b, op };
  },
};

function loadTopic() {
  const section = document.getElementById("topic-section");
  currentTopic = "integers_subtraction";

  section.innerHTML = `
    <h2>Integers: Subtraction</h2>

    <div style="background: linear-gradient(135deg, #e8f5ff, #e0f7fa); padding: 1.5rem; border-radius: 12px; margin: 1rem 0; border-left: 5px solid #0288d1;">
      <h3 style="color: #0277bd; margin-bottom: 1rem;">What You'll Learn</h3>
      <p style="margin-bottom: 0.5rem;">Practice subtracting integers, including negative numbers. Problems are generated randomly so you get lots of varied practice.</p>
    </div>

    <h3 style="color: #2c3e50; margin: 1rem 0 0.5rem;">Quick Rules</h3>
    <div style="background: #f1f8e9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #7cb342;">
      <ul>
        <li><strong>Keep-change-change:</strong> Keep the first integer, change subtraction to addition, then change the sign of the second integer.</li>
        <li><strong>Subtracting:</strong> <code>a - b</code> is the same as <code>a + (-b)</code>. Flip the second integer's sign and add.</li>
        <li>Negative numbers are shown as <code>(-3)</code> in problems to avoid confusion.</li>
      </ul>
    </div>

    <h3 style="color: #2c3e50; margin: 1rem 0 0.5rem;">Examples</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
      <div style="background: #fff3e0; padding: 1rem; border-radius: 8px; border-left: 4px solid #fb8c00;">
        <h4 style="color: #ef6c00; margin-bottom: 0.5rem;">Example 1</h4>
        <p><strong>5 - (-3) = 8</strong></p>
        <p><em>Explanation: subtracting -3 is the same as adding 3: 5 + 3 = 8.</em></p>
      </div>
      <div style="background: #e8f5e9; padding: 1rem; border-radius: 8px; border-left: 4px solid #43a047;">
        <h4 style="color: #2e7d32; margin-bottom: 0.5rem;">Example 2</h4>
        <p><strong>(-4) - 6 = -10</strong></p>
        <p><em>Explanation: subtracting 6 is the same as adding -6: -4 + (-6) = -10.</em></p>
      </div>
      <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; border-left: 4px solid #1e88e5;">
        <h4 style="color: #1565c0; margin-bottom: 0.5rem;">Example 3</h4>
        <p><strong>(-7) - (-3) = -4</strong></p>
        <p><em>Explanation: subtracting -3 is the same as adding 3: -7 + 3 = -4.</em></p>
      </div>
    </div>

    <div style="background: #f3e5f5; padding: 1rem; border-radius: 12px; margin-top: 1rem; border-left: 5px solid #8e24aa;">
      <h3 style="color: #6a1b9a; margin-bottom: 0.5rem;">Ready to Practice?</h3>
      <p>The app will generate problems like <code>(-3) - 8 = ?</code> or <code>7 - (-2) = ?</code> with multiple choice answers.</p>
      <p style="margin-top: 0.5rem;">Solo Challenge: timed individual practice with score</p>
      <p>Analyzer: reviews which sign patterns are most accurate and least accurate for the learner.</p>
    </div>
  `;
}

function getProblem() {
  if (!currentTopic) {
    currentTopic = "integers_subtraction";
  }
  return ProblemGenerator[currentTopic]();
}
