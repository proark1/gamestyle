# Reel Problems swimming and bite audio — 2026-09-22

The requested normal mode is Classic tournament, confirmed by the user. Reel Problems 1 already starts the five-minute tournament in solo and multiplayer; its menu and captain start button now explicitly identify Classic tournament. Reel Problems 2 retains its existing Classic selection.

Both games receive the same presentation changes: continuous alternating crawl strokes on a 1.5-second cycle, smaller flutter kicks, calmer idle sculling, a more horizontal body at the surface, and interpolated turns. YXZ rotation order aligns the prone body with the direction of travel.

Wildlife wounds now capture their world-space position in the event. The audio director plays the existing shark crunch at that location with full cue strength, instead of placing it at the boat, where distance attenuation could make it silent to a faraway swimmer. Fatal bites and jellyfish stings also retain impact position. Existing procedural audio fallback and mute controls are preserved.

Validation: all 183 tests across both game directories pass. New regressions exercise real shark attacks far from the boat, normal and fatal bites, one-shot audio, and immutable impact coordinates. Targeted lint passes. Full TypeScript checking reports only two unresolved progressPresence references in platform/party/coordinator.ts (lines 139 and 165), outside these changes. Browser visual and listening review has not been performed.
