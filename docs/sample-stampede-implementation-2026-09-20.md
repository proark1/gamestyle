# Sample Stampede – Umsetzung der UX-Prüfung

Die Änderungen aus dem Audit sind im lokalen Projekt eingebaut. Es wurde nichts veröffentlicht.

## Umsetzung

- Startdialog mit Ziel, Teamrolle, Tastatur- und Touch-Anleitung. Die drei Minuten beginnen erst beim Start.
- Eigene Zustände für Spiel, Pause, Hilfe, Einstellungen und Neustartbestätigung. Hilfe, Einkaufsliste und Einstellungen halten die Simulation an. Fensterwechsel und Hintergrundbetrieb pausieren die Runde.
- Zugängliche Dialoge mit Base UI, Fokusführung, Escape-Verhalten und Fokus-Rückgabe. Einstellungen bündeln die bisherigen sekundären Werkzeuge.
- Gemeinsame Anordnung von Punktestand, Liste, Radar und Eingaben für Desktop, Portrait und kurzes Querformat. Kleine Displays zeigen die Einkaufsliste als Fortschrittsknopf; die vollständige Liste öffnet sich in der Pause.
- Dynamische Bildschirmhöhe, Safe-Area-Abstände, lesbare Listen, sichtbarer Fokus und eine auf diese Route begrenzte Freigabe des Browserzooms.
- Kamera innerhalb der Hallengrenzen, höhere Perspektive auf schmalen Geräten, zeitbasierte Kamerabewegung und transparente Hindernisse in der Sichtlinie zum Wagen. Kamerazustand und Effekte werden beim Neustart zurückgesetzt.
- Getrennte Tastatur- und Touch-Zustände; Zurücksetzen bei Pause/Fokusverlust; keine Spieleingaben in Textfeldern oder Dialogen. Drift verwendet Pointer Capture und behandelt Abbruch, Fokusverlust und Tastaturbedienung.
- Neustart leert alte Eingaben/Feedback-Timer, setzt Audio/Effekte zurück und aktiviert die Steuerung auch nach einem beendeten Match ausdrücklich wieder.
- Deutsche HUD-, Gegenstands-, Hinweis-, Dialog- und Hallenschildtexte. km/h wird tatsächlich umgerechnet. Der Stick hat optionale deutsche Beschriftung; bestehende Nutzer der gemeinsamen Komponente behalten ihre Standardtexte.
- Gleiche Punktzahlen ergeben ein Unentschieden, konsistent zum Party-Ergebnis.
- Ausrüstungsänderungen aktualisieren die Spielfigur ohne Seitenneuladen.
- Reduced Motion reduziert Kameraeffekte/CSS-Animationen. WebGL-Fehler bieten eine verständliche Meldung mit Neuladen-Aktion.

Vorhandene parallele Änderungen an Grafik-Ressourcen und gemeinsam genutzten Komponenten wurden erhalten.

## Prüfung

- **31 Tests bestanden:** bestehende Simulations-/Audiofälle plus neue Regressionstests für kombinierte Eingaben, Reset nach Unterbrechung, Geschwindigkeitsumrechnung, Kamera-Hallengrenzen und Unentschieden.
- **Projektweiter Typecheck zwischenzeitlich erfolgreich.** Der spätere Abschlusslauf meldet zwei neue Fehler in `games/bungee-doubles/audio.ts:203` und `games/bungee-doubles/simulation.ts:576` aus parallel bearbeitetem Code; kein Fehler in Sample Stampede.
- **Gezielter Lint erfolgreich** für Spiel und zugehörige Komponenten; Formatierung durchgeführt.
- Lokal im Browser bestätigt: Startdialog mit fokussierter Startaktion; Start bei 3:00; kompakte Darstellung bei 390 × 844; übersichtliches Querformat bei 844 × 390; Öffnen der Hilfe und Schließen über Escape. Desktop-Startansicht ebenfalls visuell kontrolliert.

Die abschließende vollständige Browser-Testmatrix wurde durch wiederholte Abbrüche der Browser-Verbindung sowie einen zwischenzeitlich beendeten gemeinsamen Entwicklungsserver unterbrochen. Deshalb sind insbesondere der abschließende 320-px-Durchlauf, die vollständige deutsche UI-Runde, Ausrüstungswechsel und ein kompletter manueller Checkout-/Replay-Durchlauf nicht als bestanden ausgewiesen. Die Regeln für Checkout/Replay wurden im Code überprüft; Checkout und Wertung werden zusätzlich durch die Simulationstests abgedeckt.

Echte iOS-/Android-Geräte, gleichzeitige Zwei-Finger-Gesten, thermisches Verhalten und Langzeit-FPS wurden nicht gemessen. Diese Hardware-Freigabe bleibt vor einer Aussage wie „auf allen Geräten perfekt“ erforderlich.

## Reproduzierbare Befehle

```text
node --import tsx --test games/sample-stampede/controls.test.ts games/sample-stampede/sample-stampede.test.ts games/sample-stampede/sample-stampede-audio.test.ts
node node_modules/typescript/bin/tsc --noEmit --pretty false
node node_modules/oxlint/bin/oxlint games/sample-stampede app/sample-stampede shared/ui/GameToolbar.tsx shared/input/TouchControls.tsx
```
