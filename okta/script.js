// Preload sounds
  const correctSound = new Audio('../assets/sounds/correct.mp3');
  const incorrectSound = new Audio('../assets/sounds/incorrect.mp3');
  //correctSound.volume = 0.7;
  incorrectSound.volume = 0.3;  

  // State
  let questions = [];
  let qOrder = [];
  let currentQ = 0;
  let currentOptionOrder = [];
  let currentOptionIndex = 0;
  let results = []; // {questionId, correct:boolean, selectedOptionId|null, presentedOptions:[]}
  let questionActive = false;

  // DOM Elements
  const qIndexEl = document.getElementById('qIndex');
  const qTotalEl = document.getElementById('qTotal');
  const stemEl = document.getElementById('stem');
  const optionTextEl = document.getElementById('optionText');
  const selectBtn = document.getElementById('selectBtn');
  const rejectBtn = document.getElementById('rejectBtn');
  const nextQBtn = document.getElementById('nextQBtn');
  const continueBtn = document.getElementById('continueBtn');
  const bar = document.getElementById('progressBar');
  const feedback = document.getElementById('feedback');
  const resultsEl = document.getElementById('results');

  const allowSkip = true;

  // Load questions from JSON
  async function loadQuestions() {
    const page = window.location.pathname;

    let jsonFile;

    if (page.includes('admin')) {
    jsonFile = './questions-admin.json';
    } else {
    jsonFile = './questions-professional.json';
    }

    const response = await fetch(jsonFile);
    const data = await response.json();

    questions = data.map((q, index) => ({
      id: `q${index + 1}`,
      stem: q.stem,
      options: q.options.map((opt, idx) => ({
        id: String.fromCharCode(97 + idx),
        text: opt.text,
        correct: opt.correct,
        explanation: opt.explanation || null 
      }))
    }));

    // Generate randomized question order after questions exist
    qOrder = shuffle(Array.from({ length: questions.length }, (_, i) => i));

    // Update total in UI
    qTotalEl.textContent = questions.length;

    // Show setup screen
    document.getElementById('startBtn').addEventListener('click', () => {
      const limit = parseInt(document.getElementById('qLimit').value);
      if (limit > 0) {
        qOrder = qOrder.slice(0, limit);
      }
      document.getElementById('setup').style.display = 'none';
      document.getElementById('quizMain').style.display = 'block';
      qTotalEl.textContent = qOrder.length;
      start();
    });
  }

  // Start exam
  function start() {
    attachHandlers();
    updateNextButton();
    showQuestionAt(currentQ);
    updateProgress();
  }

  function showQuestionAt(index) {
    if (index >= qOrder.length) {
      showSummary();
      return;
    }

    questionActive = true;

    const q = questions[qOrder[index]];
    qIndexEl.textContent = index + 1;
    stemEl.innerHTML = q.stem;

    currentOptionOrder = shuffle(q.options.map((_, i) => i));
    currentOptionIndex = 0;
    results.push({ questionId: q.id, correct: false, selectedOptionId: null, presentedOptions: [] });

    feedback.textContent = '';
    renderCurrentOption();
  }

  function renderCurrentOption() {
    const q = questions[qOrder[currentQ]];

    if (currentOptionIndex >= currentOptionOrder.length) {
      finalizeQuestion(false, null);
      return;
    }

    const opt = q.options[currentOptionOrder[currentOptionIndex]];
    optionTextEl.innerHTML = opt.text;
    optionTextEl.setAttribute('aria-label', 'Option: ' + opt.text);
    feedback.innerHTML = `<em>Option ${currentOptionIndex + 1} of ${currentOptionOrder.length}</em>`;
    selectBtn.focus();
  }

  function handleSelect() {
    const q = questions[qOrder[currentQ]];
    const opt = q.options[currentOptionOrder[currentOptionIndex]];
    const r = results[results.length - 1];

    r.presentedOptions.push(opt.id);

    if (!r.selectedOptionIds) r.selectedOptionIds = [];
    r.selectedOptionIds.push(opt.id);

    if (opt.correct) {
      // Option is correct, continue to next option
      currentOptionIndex++;
      renderCurrentOption();
    } else {
      // Selected an incorrect option: question immediately incorrect
      finalizeQuestion(false);
    }
  }

  function handleReject() {
    const q = questions[qOrder[currentQ]];
    const opt = q.options[currentOptionOrder[currentOptionIndex]];
    const r = results[results.length - 1];

    r.presentedOptions.push(opt.id);

    // move to next option
    currentOptionIndex++;
    renderCurrentOption();
  }

  // Finalize question for multiple correct answers
  function finalizeQuestion(correct) {
    questionActive = false; 
    const r = results[results.length - 1];
    r.correct = correct !== undefined ? correct : true; // default true if no wrong option selected

    // Determine if the question is fully correct
    const q = questions[qOrder[currentQ]];
    const correctIds = q.options.filter(o => o.correct).map(o => o.id);
    const selectedIds = r.selectedOptionIds || [];

    // Question is correct if all correct options were selected and no incorrect ones were selected
    const allCorrectSelected = correctIds.every(id => selectedIds.includes(id));
    const anyIncorrectSelected = selectedIds.some(id => !correctIds.includes(id));
    r.correct = allCorrectSelected && !anyIncorrectSelected;

    // Show feedback
    const correctOptions = q.options.filter(o => o.correct);
    const selectedOptions = (r.selectedOptionIds || [])
      .map(id => q.options.find(o => o.id === id))
      .filter(Boolean);

    let feedbackHtml = '';

    feedbackHtml += r.correct
      ? `<strong style="color:#6ee7b7;">Correct!</strong><br>`
      : `<strong style="color:#f87171;">Incorrect.</strong><br>`;

    // 🔹 Build list of options to explain
    const explainedOptions = [...selectedOptions];

    // Also include missed correct answers
    correctOptions.forEach(opt => {
      if (!selectedOptions.includes(opt)) {
        explainedOptions.push(opt);
      }
    });

    // Remove duplicates
    const uniqueExplained = [...new Set(explainedOptions)];

    if (uniqueExplained.length > 0) {
      feedbackHtml += `<div style="margin-top:12px;">`;

      uniqueExplained.forEach(opt => {
        if (opt.explanation) {

          const color = opt.correct ? "#6ee7b7" : "#f87171";
          const bg = opt.correct ? "#064e3b" : "#7f1d1d";

          feedbackHtml += `
            <div style="
              margin-top:8px;
              padding:10px;
              background:${bg};
              border-radius:8px;
              border-left:4px solid ${color};
            ">
              <strong style="color:${color};">${opt.text}</strong><br>
              <span>${opt.explanation}</span>
            </div>
          `;
        }
      });

      feedbackHtml += `</div>`;
    }

    feedbackHtml += `<div style="margin-top:12px;"><i>Press any key to continue.</i></div>`;

    feedback.innerHTML = feedbackHtml;

    // 🔊 Play sound depending on correctness
    if (r.correct) {
      correctSound.currentTime = 0;
      correctSound.play();
    } else {
      incorrectSound.currentTime = 0;
      incorrectSound.play();
    }

    // Disable buttons
    selectBtn.disabled = true;
    rejectBtn.disabled = true;
    nextQBtn.disabled = true;

    // Show Continue button
    continueBtn.style.display = "inline-block";
    continueBtn.disabled = false;

    // Unified continuation function
    function continueToNext() {
      window.removeEventListener('keydown', handleContinue);
      continueBtn.removeEventListener('click', continueToNext);

      // Hide Continue button for next question
      continueBtn.style.display = "none";

      // Re-enable controls
      selectBtn.disabled = false;
      rejectBtn.disabled = false;
      nextQBtn.disabled = false;

      // Next question
      currentQ++;
      updateProgress();
      showQuestionAt(currentQ);
      updateNextButton();
    }

    // Key handler
    function handleContinue() {
      continueToNext();
    }

    // Allow: key press OR clicking Continue
    window.addEventListener('keydown', handleContinue);
    continueBtn.addEventListener('click', continueToNext);

  }
  

  function updateProgress() {
    const pct = Math.round((currentQ / questions.length) * 100);
    bar.style.width = pct + '%';
  }

  function showSummary() {
    const total = results.length;
    const correctCount = results.filter(r => r.correct).length;

    resultsEl.innerHTML = `<strong>${correctCount}</strong> / ${total} correct`;
    const list = document.createElement('ol');

    results.forEach((r, idx) => {
      const q = questions[qOrder[idx]];
      const li = document.createElement('li');

      // Build lists
      const correctOpts = q.options.filter(o => o.correct);
      const correctTexts = correctOpts.map(o => o.text);

      const selectedOpts = (r.selectedOptionIds || [])
        .map(id => q.options.find(o => o.id === id))
        .filter(Boolean);
      const selectedTexts = selectedOpts.map(o => o.text);

      // Which correct answers were missed?
      const missedTexts = correctTexts.filter(text => !selectedTexts.includes(text));

      // Which incorrect answers were selected?
      const incorrectSelectedTexts = selectedOpts
        .filter(o => !o.correct)
        .map(o => o.text);

      // HTML output
      li.innerHTML = `
        ${q.stem}<br>

        <div><strong>Correct options:</strong> ${
          correctTexts.length ? correctTexts.join(', ') : 'None'
        }</div>

        <div><strong>You selected:</strong> ${
          selectedTexts.length ? selectedTexts.join(', ') : '—'
        }</div>

        ${
          missedTexts.length
            ? `<div style="color:#fbbf24;"><strong>Missing:</strong> ${missedTexts.join(', ')}</div>`
            : ''
        }

        ${
          incorrectSelectedTexts.length
            ? `<div style="color:#f87171;"><strong>Incorrect selections:</strong> ${incorrectSelectedTexts.join(', ')}</div>`
            : ''
        }

        <div style="margin-top:4px;">
          ${
            r.correct
              ? '<span style="color:#6ee7b7; font-weight:bold;">Correct</span>'
              : '<span style="color:#fda4af; font-weight:bold;">Incorrect</span>'
          }
        </div>
      `;

      list.appendChild(li);
    });

    resultsEl.appendChild(list);

    stemEl.textContent = 'Exam complete — thank you.';
    optionTextEl.textContent = '';
    selectBtn.style.display = 'none';
    rejectBtn.style.display = 'none';
    nextQBtn.style.display = 'none';
    feedback.innerHTML = '';
    bar.style.width = '100%';
  }

  function updateNextButton() {
    nextQBtn.style.display = allowSkip ? 'inline-block' : 'none';
  }

  function attachHandlers() {
    selectBtn.addEventListener('click', handleSelect);
    rejectBtn.addEventListener('click', handleReject);
    nextQBtn.addEventListener('click', () => finalizeQuestion(false, null));

    window.addEventListener('keydown', (e) => {
      if (!questionActive) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSelect();
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleReject();
      }
    });
  }

  function shuffle(arr) {
    const res = arr.slice();
    for (let i = res.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [res[i], res[j]] = [res[j], res[i]];
    }
    return res;
  }

  // Start by loading questions
  loadQuestions();