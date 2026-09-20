# Wrong Floor — Umsetzung und Validierung, 20.09.2026

Die Audit-Empfehlungen sind im Spielcode umgesetzt:

- Keine automatischen Siege ohne menschliche Abstimmung; eindeutiges Timeout-Ergebnis und passende Analytics.
- Erste Übungsetappe ohne Entscheidungsfrist, vorgeschaltete Anleitung, kontextueller nächster Schritt und Normalzustand direkt am Objekt.
- Dialoge und Einstellungen pausieren die lokale Simulation. Online weist das Spiel auf die weiterlaufende Zeit hin.
- DE/EN-Texte für den Spielablauf einschließlich Hinweisen, Ergebnissen, Fehlern und Schildern; strukturierte geteilte Hinweise mit Kompatibilität für alte Textberichte.
- Dunkles kompaktes HUD, aufklappbare Teamberichte und Einstellungen, Abstimmungen erst in Panelnähe, erreichbare Verlassen-Aktion.
- Zwei Anomalievarianten pro Station: umgekehrte Fußspurfolge, schaukelndes Porträt, fünf Klopfzeichen und schnelle vorwärtslaufende Uhr zusätzlich zu den bisherigen Varianten.
- Variable Begegnungsabstände und zurückgenommene Musik während der Untersuchung; Verfolger für alle Gäste sichtbar und hörbar.
- Mittigere Startpositionen; sehr nahe Mitspieler werden in erster Person ausgeblendet, damit deren Geometrie nicht durch die Kamera ragt.

## Validierung

- `node scripts/test.mjs games/wrong-floor`: **37/37 bestanden**.
- `npm run typecheck`: **bestanden**.
- `npx oxlint games/wrong-floor`: **bestanden**.
- `npx oxfmt games/wrong-floor`: angewandt.
- 100 untätige reguläre Durchläufe: **0 Siege, 0 abgeschlossene Etagen**, ausschließlich Timeout. Als Regressionstest enthalten.
- Simulierter vollständiger Fünf-Etagen-Durchlauf, Mehrheitsentscheidung, Gleichstand, Rettung, Wiederaufnahme aus Checkpoint, Anomalievarianten und Dialogpause getestet.
- Lokaler Desktop-Browser: neue Startseite, Übungsanleitung und unbefristeter Spielstart tatsächlich geöffnet und visuell geprüft. Dabei gefundene Sichtversperrung durch nahe Avatare anschließend korrigiert.

## Verbleibende Grenzen

Die abschließende Browserprüfung nach der letzten Sichtkorrektur sowie Deutsch-/Mobil- und Live-Lobby-Checks konnten nicht zuverlässig abgeschlossen werden. Der zunächst laufende gemeinsame Devserver wurde beendet; anschließend scheiterte die Worker-Vorschau am Optimizer-Cache. Eine separate Node-Vorschau startete auf Port 5181, wurde aber wiederholt durch parallele Änderungen an tsconfig-Dateien unter `.tmp` und gemeinsame HMR-Ereignisse neu geladen. Zusätzlich traten CDP-/Browser-Timeouts bis zum Neustart des Browserwerkzeugs auf. Auch der freigegebene Live-Lobby-Versuch konnte deshalb nicht verifiziert werden.

Echte Touch-Geräte, Audio mit Kopfhörern, vier menschliche Spieler und Voice wurden nicht als getestet behauptet. Die gemeinsamen Konten-/Voice-Einstellungsdialoge sind bestehende Plattformkomponenten; ihre eigene vollständige Lokalisierung ist nicht Bestandteil der lokalen Spieltext-Übersetzung.

Die Änderungen wurden im vorhandenen Repository integriert. Kein Deployment wurde ausgeführt; insbesondere wurde kein Release aus dem gleichzeitig von mehreren Arbeiten veränderten Arbeitsbaum erzwungen.
