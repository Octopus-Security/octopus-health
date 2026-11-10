// The repo's banned-claim words: copy a trainer-scope app must not use (treatment, cure, release,
// "reduces ...", decompression, and so on). One copy, shared by test/variety.test.js (new copy) and
// test/exercise-guards.test.js (every exercise, cue, routine and description).
const BANNED = /\b(treat(s|ed|ing|ment)?|fix(es|ed|ing)?|prevent(s|ed|ing|ion)?|correct(s|ed|ing|ion)?|heal(s|ed|ing)?|cure[sd]?|releas(e|es|ed|ing)|fascia|fascial|adhesions?|knots?|scar tissue|toxins?|flush(es|ed)?|detox|rehab|rehabilitat\w*|therap\w*|inflammation|studies|research|proven|clinically|scientific\w*|nervous system|parasympathetic|cortisol|stress hormones?|reduces?|relieves?|relief|lengthens?|realign\w*|decompress\w*|break(s)? up|lubricat\w*|alleviat\w*|diagnos\w*)\b/i;
// A disclaimer that says the content is NOT treatment is the opposite of a claim, so it is not scanned.
const stripDisclaimers = t => String(t).replace(/\bnot medical (treatment|advice)\b/gi, '');
module.exports = { BANNED, stripDisclaimers };
