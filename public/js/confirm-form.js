/* oConfirmForm(event, message, confirmLabel): themed replacement for a native confirm on a form.
 * Always blocks the native submit, asks, then submits the form itself only on a yes, so nothing is
 * sent before the user answers. Needs oDialog (octopus-kit ui/dialog.js) loaded first. */
(function () {
  window.oConfirmForm = function (e, message, confirmLabel) {
    e.preventDefault();
    var form = e.target && e.target.closest ? e.target.closest('form') : e.target;
    oDialog.confirm({ title: 'Are you sure?', body: message, confirmLabel: confirmLabel || 'OK', danger: true }).then(function (ok) {
      if (ok && form) HTMLFormElement.prototype.submit.call(form);
    });
    return false;
  };
})();
