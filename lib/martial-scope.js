'use strict';
/*
 * Scope line for martial arts content. Joint locks and chokes stay loggable as ordinary exercises
 * (a person drilling BJJ wants to record the session), but they are partner techniques that are unsafe
 * to attempt alone, so they are never offered by a generated or client-facing plan path: the session
 * builder's library and its suggestions, the plan maker, the body-map exercise lists, or the seeded
 * templates and plans. test/martial-scope.test.js pins every one of those paths.
 *
 * Matching is by the seed name (the name logs join on), plus the technique type of the martial-arts
 * snapshot (lib/mma-moves.json).
 */

const TECHNIQUE_NOTE = 'Martial technique: drill with a trained partner under a coach.';

const PARTNER_SUBMISSIONS = [
  'Armbar from Guard', 'Triangle Choke Setup', 'Rear Naked Choke Finish', 'Guillotine Choke',
  'Kimura from Half Guard', 'Americana from Mount', 'Omoplata', 'Bow and Arrow Choke',
  "D'Arce Choke", 'Heel Hook (Outside)', 'Straight Ankle Lock', 'Cross Collar Choke from Mount',
  'Clock Choke from Turtle',
];
const SET = new Set(PARTNER_SUBMISSIONS.map(n => n.toLowerCase()));

const isPartnerSubmission = name => SET.has(String(name || '').toLowerCase().trim());
/** A martial-arts snapshot entry (lib/mma-moves.json) that is a submission. */
const isSubmissionMove = m => !!m && /submission/i.test(m.techniqueType || '');
/** True for anything a plan, template or recommendation must not offer. */
const excludedFromPlans = e => !!e && (isPartnerSubmission(e.name || e.title) || isSubmissionMove(e));

module.exports = { TECHNIQUE_NOTE, PARTNER_SUBMISSIONS, isPartnerSubmission, isSubmissionMove, excludedFromPlans };
