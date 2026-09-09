# Narrator workshop validation — 2026-09-06

- Typecheck and focused lint pass. Full suite: 98 tests pass.
- Production build passes. Existing Vinext route-classification / JSON import and Three.js chunk warnings remain.
- Service tests exercise provider design fields, three persisted auditions, source-account selection from the other game, reuse of created voice IDs, preservation of each game's volume mix, shared-key fallback, gameplay TTS and standalone spoken text.
- Error tests cover invalid scripts, unknown auditions, provider failure with prior auditions preserved, and the cross-game lease. No provider calls occur for invalid inputs.
- Initial live release `9a03d466-f663-487b-ba73-e9e0ecee5b00` succeeded. Both public admin pages, shared prompt save/read, input validation and foreign-origin rejection passed.
- Browser checked at 390 × 844: no horizontal document overflow; prompt uses 16px type, stacked columns and accessible labeled controls.
- One real Voice Design request with the already-saved Blend Business key produced three MP3 auditions for The Chaos Commentator. No voice was selected and no gameplay speech was regenerated; the user chooses the audition.
- Live inspection caught and corrected two UI cases: choosing from a workshop without its own API key, and undefined preview IDs incorrectly showing every unsaved audition as selected.
- Final deployment: `aa70a3dd-90a5-4660-97e0-04ade7adbbc5` SUCCESS. Stack or Sink shows all three saved auditions as unselected, with all three selection buttons enabled despite its key being stored in Blend Business.

Voice quality and the preferred audition are for the user to assess by listening. Real creation of the selected voice and its gameplay speech remain intentionally pending the user's audition choice; the flow is covered by mocked-provider service tests.
