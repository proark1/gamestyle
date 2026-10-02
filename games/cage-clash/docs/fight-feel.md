# Cage Clash fight feel and controls — 2026-09-22

The requested focus is fight feel and controls. This pass keeps the existing
five action buttons and fighting styles, adding a short input buffer and clearer
combat presentation.

- One pending strike lasts up to 220 ms, resolved by the authoritative simulation.
  A quick punch released during late recovery can become the next cross. Kick and
  grapple presses use the same window. Early inputs expire; held kick does not
  repeat. Guard, dodge, cancellation, stun, knockdown and peer-idle handling clear
  queued actions. Stamina is charged only when the strike actually starts.
- Articulated arms trace distinct straight jab/cross and sweeping hook paths.
  Glove extension peaks on the simulation contact frame; kick extension uses the
  same windup/recovery curve. Movement and damage rules retain their existing
  values. Ground poses and reduced-motion preferences remain supported.
- The HUD distinguishes ready, guard and recovery states; shows a charged-hook
  meter and queued-strike feedback; highlights active actions; and gives separate
  attacker/defender submission instructions with explicit gold-window cues.
  Unavailable ground actions are disabled. English and German copy is included.
- Cage Clash peer rules increment to 2 because checkpoints now contain the input
  buffer. Prior revision checkpoints fail compatibility checks cleanly.

Validation: 56 focused game and shared-adapter tests passed; TypeScript, scoped
lint and architecture checks passed. Two real local WebRTC clients passed private
style selection, strikes, guest takedown, voice audio and host recovery. The
production build passed. Browser checks at desktop and 390 × 844 phone sizes
confirmed the rendered fighters, HUD, rematch flow and touch controls; no browser
console errors were recorded. This pass is available in the local production
preview and has not been deployed.
