# Zorb Clash – Umsetzung und Prüfstand

Die Korrekturen setzen die vom Nutzer freigegebene Mechanik und die Abnahmekriterien aus `zorb-clash-audit-2026-09-20.md` um. Sie sind im lokalen Projekt integriert; es wurde kein Produktionsdeployment ausgeführt.

## Änderungen

- Separate rollende Kugelhülle und unabhängig ausgerichteter Mensch. Laufphase folgt der zurückgelegten Bewegung; angepasste Fußhöhe hält die Figur innerhalb der Kugel. Namensschild und Bodenschatten erben keine Hüllenrotation mehr.
- Eigene Zustände für aufrecht, instabil, gestürzt und aufstehend. Treffer und abrupte Richtungswechsel können die Balance brechen. Die Orientierung der Hülle löst keinen Sturz aus. Während Sturz/Aufstehen kein Laufantrieb oder Sprint; Rückgewinnung der Kontrolle erfordert Bodenkontakt und ausreichendes Abbremsen.
- Kräfte am Massenschwerpunkt, einmalige Kontaktverarbeitung, keine zusätzlichen explosiven Paarimpulse, begrenzte Geschwindigkeiten und konstante Körpermasse beim Stemmen.
- Durchgehende Seitenpolster, Auffangzäune, geschlossener Torraum und zusätzliche Rückholung außerhalb der Arena. Kollisionsfreie Neustartpositionen und freie Positionen für neu beitretende Peer-Spieler.
- Tore ausschließlich durch den separaten Spielball: vollständige gerichtete Linienüberquerung innerhalb der Toröffnung. Menschen, bloße Anwesenheit im Tor und ungültige Ballpositionen zählen nicht. Turtle-Goal-KI, -Auszeichnungen und -Audio entfernt.
- Ballberührung auch bei sanften Kontakten; Bereinigung beim Anstoß; Eigentore erhöhen nicht die individuelle Torzahl des Verursachers.
- Begrenzte Kamera, zur Bildschirmbreite passender Abstand und kompaktes Radar auch auf schmalen Ansichten.
- Bewusster Spielstart, Hilfe mit Spielziel und Regeln, Pause während der Hilfe und bei Fenster-/Tab-Fokusverlust, Fortsetzen über einen Dialog.
- Gerätegerechte deutsche/englische Anleitung; Touchsteuerung mit Pointer-Zuordnung, Pointer-Capture, Deadzone, normalisiertem Richtungsvektor, beweglichem Stick-Daumen und Abbruchbehandlung.
- Tastatur-Listener werden entfernt, Fokusverluste neutralisieren Eingaben, Dialog-/Formularfokus wird respektiert. Nach Schließen der Hilfe kehrt der Fokus zur Spielfläche zurück.
- Peer-Zeit in konsistenten Millisekunden; Physik mit festem 60-Hz-Schritt unabhängig von der Renderfrequenz. Neustart setzt Statistiken, Ladung, Zuordnung und Positionen zurück.

## Validierung

- `node scripts/test.mjs games/zorb-clash`: **32 Tests bestanden**, einschließlich einer Simulation über 180 Sekunden, 30/60/120-Hz-Vergleich, Tor-Grenzfällen, Fall-/Aufstehlogik, Koordinatenunabhängigkeit der Bewegung, einzelner Kollisionsverarbeitung, Grenzen und Neustart.
- `node node_modules/oxlint/bin/oxlint games/zorb-clash`: erfolgreich.
- `node node_modules/typescript/bin/tsc --noEmit --pretty false`: ein vollständiger Zwischenlauf war erfolgreich. Der abschließende Lauf meldet keine Zorb-Clash-Fehler, aber zwischenzeitlich entstandene Fehler in `games/bungee-doubles/audio.ts:203`, `games/bungee-doubles/simulation.ts:576` und doppelte `moveLabel`-Deklarationen in `shared/input/TouchControls.tsx`. Diese parallel bearbeiteten Dateien wurden nicht verändert; die globale Typprüfung ist deshalb aktuell nicht grün.
- `node scripts/check-architecture.mjs`: erfolgreich.
- Formatierung des Spielverzeichnisses mit dem Projektformatter.

## Grenzen der Prüfung

Die lokale interaktive Sichtprüfung ließ sich in dieser Sitzung nicht abschließen. Der zuvor laufende Entwicklungsserver war nicht mehr erreichbar; der anschließend gemeldete Server auf Port 5181 antwortete bei der Browsernavigation nicht rechtzeitig. Andere laufende Arbeiten und Server wurden nicht beendet. Automatisierte Physik-/Darstellungstests und statische Prüfungen ersetzen keinen abschließenden realen Smartphone-/Mehrfingertest oder eine subjektive Bewertung des Spielgefühls.

Keine fremden Projektänderungen zurückgesetzt. Die bereits vorhandene Ressourcenfreigabe in `scene.ts` bleibt erhalten. Kein Commit, Push oder Deployment aus dem gemeinsam bearbeiteten Arbeitsverzeichnis vorgenommen.
