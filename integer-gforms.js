// Google Forms score submission.
//
// To connect your own Google Form:
// 1. Create short-answer fields such as Name, Score, Mode, Total Answered,
//    Correct Count, Accuracy, Strongest Pattern, Weakest Pattern, and Details.
// 2. Get a prefilled link from Google Forms.
// 3. Copy each entry.XXXX id into FIELD_ENTRY below.
// 4. Leave optional fields as empty strings if your form does not have them.

const FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLScjzcZjfIBO4zH4jxqTIT_lwlbZcLO1i5rYXIQjOWrAVomURA/formResponse';

const FIELD_ENTRY = {
  name: 'entry.1427609618',
  score: 'entry.247865597',
  mode: '',
  total: '',
  correct: '',
  accuracy: '',
  strongest: '',
  weakest: '',
  details: '',
};

function isGFormConfigured() {
  return Boolean(FORM_ACTION && FIELD_ENTRY.name && FIELD_ENTRY.score);
}

function sendScoreToGoogleForm(name, score, extra = {}) {
  if (!isGFormConfigured()) {
    return Promise.reject(new Error('Google Form not configured'));
  }

  return new Promise(resolve => {
    try {
      const form = document.createElement('form');
      const iframeName = 'gforms_iframe_' + Date.now();
      const iframe = document.createElement('iframe');

      form.method = 'POST';
      form.action = FORM_ACTION;
      form.target = iframeName;
      form.style.display = 'none';

      iframe.name = iframeName;
      iframe.style.display = 'none';

      function appendHidden(entryId, value) {
        if (!entryId) return;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = entryId;
        input.value = value == null ? '' : String(value);
        form.appendChild(input);
      }

      appendHidden(FIELD_ENTRY.name, name || 'Anonymous');
      appendHidden(FIELD_ENTRY.score, score);
      appendHidden(FIELD_ENTRY.mode, extra.mode);
      appendHidden(FIELD_ENTRY.total, extra.total);
      appendHidden(FIELD_ENTRY.correct, extra.correct);
      appendHidden(FIELD_ENTRY.accuracy, extra.accuracy);
      appendHidden(FIELD_ENTRY.strongest, extra.strongest);
      appendHidden(FIELD_ENTRY.weakest, extra.weakest);
      appendHidden(FIELD_ENTRY.details, extra.details);

      if (extra.entries) {
        Object.keys(extra.entries).forEach(entryId => {
          appendHidden(entryId, extra.entries[entryId]);
        });
      }

      document.body.appendChild(iframe);
      document.body.appendChild(form);
      form.submit();

      setTimeout(() => {
        try { document.body.removeChild(form); } catch (e) {}
        try { document.body.removeChild(iframe); } catch (e) {}
        resolve({ success: true });
      }, 800);
    } catch (error) {
      console.error('Failed sending score to Google Form', error);
      resolve({ success: false, error });
    }
  });
}
