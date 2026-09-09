# Permit Pending: Bodenplatten von unten bauen

Am 8. September 2026 auf ausdrücklichen Wunsch des Nutzers auf dem bestehenden Railway-Dienst `stack-or-sink`, Umgebung `production`, veröffentlicht.

URL: https://jumbleyard.up.railway.app/chaos

Deployment: `c4da22a6-f7cb-457c-a1d1-0e59c95c3492`, Status `SUCCESS`.

## Änderung

Bodenplatten für die nächste Etage lassen sich innerhalb der Baureichweite von unten einsetzen, einschließlich Zwischenhöhen auf Treppen. Die Wegsuche verwendet dieselbe Reichweitenprüfung und setzt die noch nicht gebaute Platte nicht als begehbare Fläche voraus. Hindernisse und die Reichweitenregeln für andere Gegenstände bleiben wirksam.

## Veröffentlichter Stand

Die Veröffentlichung basiert auf dem erfolgreich veröffentlichten Stack-or-Sink-Fix `8ea857f8-6498-4090-8290-2532bf4877aa` aus `work/stack-platform-release-20260908`. Dessen 555 Quelldateien wurden anhand des vorhandenen SHA-256-Manifests geprüft. Nur diese vier Dateien wurden für den Bodenplatten-Fix geändert:

- `games/chaos/colliders.ts`
- `games/chaos/scene.ts`
- `games/chaos/levels.test.ts`
- `games/chaos/scene.test.ts`

Der geprüfte Upload liegt in `.tmp/permit-overhead-release-20260908`, sein Manifest in `.tmp/permit-overhead-release-manifest.json`. Datenbanken, Umgebungsdateien, Zugangsdaten und lokale Arbeitsverzeichnisse sind nicht im Upload. Die breiteren, noch unveröffentlichten Änderungen im Arbeitsverzeichnis wurden nicht mit veröffentlicht.

## Prüfung

- Alle 543 Tests des vorbereiteten Veröffentlichungsstands erfolgreich, einschließlich der neuen Regressionstests und eines Bauwegs mit der echten Spielphysik.
- Typcheck und Railway-Produktionsbuild erfolgreich.
- Alle 555 Quelldateien nach der Validierung erneut anhand ihrer Prüfsummen bestätigt.
- Railway meldet `SUCCESS`; öffentliche Spielseite und Datenbank-Healthcheck liefern HTTP 200.
- Die von der Live-Seite referenzierten Dateien `scene-RV1p-G5l.js` und `saved-build-CFWnWwUF.js` enthalten den Fix und stimmen mit den lokal geprüften Dateien überein.
- Live-API-Test in einer eigenen temporären Partie: Treppe und Unterstützung bauen, Bodenplatte aus halber Treppenhöhe einsetzen, Treppenpodest von unten einsetzen. Alle Bauaktionen erfolgreich.
- Möbel auf der oberen Etage bleiben vom Boden aus außerhalb der Reichweite.
- Der Testspieler hat seine Partie anschließend verlassen.

Prüfskript: `.tmp/verify-permit-overhead-live.mjs`; Ergebnis: `.tmp/permit-overhead-live-verification.json`.
