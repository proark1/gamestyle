# Wrong Floor: freigegebene Audit-Umsetzung

Der Nutzer hat am 20.09.2026 die Umsetzung aller Empfehlungen des Audits freigegeben. Grundlage ist `docs/wrong-floor-audit-2026-09-20.md`; keine erneute Designfreigabe erforderlich.

## Design

Die gemeinsame Wahrnehmungsmechanik bleibt erhalten. Ein fehlender menschlicher Vote beendet die Runde ausdrücklich als Timeout statt automatisch Fortschritt zu erzeugen. Eine geführte erste Übung erlaubt Bewegung und Untersuchungen ohne Entscheidungsfrist. Dialoge pausieren die lokale Simulation, Online-Dialoge warnen vor der weiterlaufenden Uhr. Alle Spieltexte und strukturierten Beobachtungen werden auf dem Client lokalisiert. Die Verfolgung ist für alle sichtbar; private Erscheinungen bleiben während der Untersuchung privat. Je Station kommt eine zweite visuell passende Anomalievariante hinzu.

Das HUD orientiert sich an Hoteltürschildern: dunkles Petrol #16272d, gealtertes Messing #d6b476, Elfenbein #f4e6cd, gedämpftes Grün #91bcb1 und Alarmrot #df8374. DM Sans für Bedienung, Georgia sparsam für Hotelüberschriften, Monospace für Timer. Kennzeichnend sind eine kleine Messing-Zielmarke und ein kompakter Auftrag; der Flur bleibt im Mittelpunkt. Einstellungen werden aufklappbar, Crewberichte zeigen eine Meldungszahl, Abstimmung erscheint am Panel. Mobile Anordnung trennt Bewegung, Hinweise und Aktionen.

## Umsetzung und Prüfung

1. Simulation: Timeout, Übungszeit, strukturierte Hinweise; Regressionen für untätige Durchläufe, Mehrspielerentscheidungen, Pause und Varianten.
2. Szene: mittigerer Kamerastart, variierende Horrorereignisse, gemeinsame Verfolgung, lokalisierte Schilder.
3. React: vollständige DE/EN-Texte, Einführung, kontextuelle Aktionen, kompakte Einstellungen und Crewberichte.
4. CSS: dunkles HUD mit lesbarem Kontrast, Hoch-/Querformat und reduced motion.
5. Formatierung, gezielte Tests, Typecheck, Lint und lokaler Browsertest. Online-Raumerstellung ist freigegeben. Hardware-/Mikrofontests nur als nachgewiesen melden, wenn tatsächlich ausgeführt.

Der referenzierte writing-plans-Skill ist im verfügbaren Skillbestand nicht vorhanden. Dieser konkrete Plan erfüllt dessen Zweck für die bereits freigegebene Umsetzung. Fremde laufende Änderungen werden weder gestaged noch überschrieben. Deployment wird nicht aus einem fremd veränderten Arbeitsbaum erzwungen.
