// Choosy — lightweight feedback widget.
// Opens from the persistent FAB or the winner screen, asks 3 quick questions,
// and sends an anonymous Mixpanel event via the global track() (app.js).
(function () {
  var modal = document.getElementById('feedback-modal');
  if (!modal) return;
  var form = document.getElementById('fb-form');
  var thanks = document.getElementById('fb-thanks');
  var comment = document.getElementById('fb-comment');
  var state = { ease: null, buy: null };

  function clearSel(sel) {
    var btns = modal.querySelectorAll(sel + ' button');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('selected');
  }
  function open() {
    state = { ease: null, buy: null };
    clearSel('#fb-ease'); clearSel('#fb-buy');
    comment.value = '';
    form.classList.remove('hidden');
    thanks.classList.add('hidden');
    modal.classList.remove('hidden');
    if (typeof track === 'function') track('feedback_opened', {});
  }
  function close() { modal.classList.add('hidden'); }

  function bindGroup(sel, key) {
    var btns = modal.querySelectorAll(sel + ' button');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        b.addEventListener('click', function () {
          clearSel(sel); b.classList.add('selected'); state[key] = b.getAttribute('data-val');
        });
      })(btns[i]);
    }
  }
  bindGroup('#fb-ease', 'ease');
  bindGroup('#fb-buy', 'buy');

  document.getElementById('fb-submit').addEventListener('click', function () {
    var text = (comment.value || '').trim();
    if (!state.ease && !state.buy && !text) { close(); return; } // nothing to send
    if (typeof track === 'function') track('feedback_submitted', {
      ease: state.ease ? parseInt(state.ease, 10) : null,
      would_buy: state.buy,
      comment: text.slice(0, 500),
      has_comment: !!text
    });
    form.classList.add('hidden');
    thanks.classList.remove('hidden');
    setTimeout(close, 2200);
  });

  document.getElementById('fb-close').addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });

  var fab = document.getElementById('feedback-fab');
  if (fab) fab.addEventListener('click', open);
  var wf = document.getElementById('winner-feedback');
  if (wf) wf.addEventListener('click', open);
})();
