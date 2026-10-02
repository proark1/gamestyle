# Zorb Clash – Fehlerbericht zu Spielmechanik, Physik und UI/UX

**Stand:** 20. September 2026 · **Seite:** https://www.jumbleyard.com/zorb-clash · **lokaler Commit:** `33261d8`

## Ergebnis

**Die drei gemeldeten Probleme sind im aktuellen lokalen Code nachvollziehbar.** Die falsche Wertung eines Menschen im Tor ist zusätzlich live sichtbar: Das Spiel zeigte ausdrücklich „TURTLE GOAL! BONUS STYLE POINTS!“. Das Hauptproblem ist nicht nur die Animation. Rotationsmodell, Kollisionskräfte, Feldbegrenzung und Torregeln müssen zusammen korrigiert werden.

Die gewünschte Mechanik ist als verbindliches Soll verstanden: Der Mensch läuft aufrecht innerhalb der Kugel; die Hülle rollt unabhängig. Bei einem ausreichend starken Treffer oder tatsächlichem Gleichgewichtsverlust fällt der Mensch. Währenddessen gibt es keinen normalen Laufantrieb; die Kugel bewegt sich durch Restgeschwindigkeit, Schwerkraft und Kontakte weiter. Erst nach dem Aufstehen ist normales Laufen wieder möglich. **Nur der separate Spielball erzielt Tore.**

Das ist ein konsistentes Spielmodell mit physikalisch nachvollziehbarem Verhalten. Es verlangt keine vollständig naturgetreue Simulation, aber klare Regeln und kontrollierbare Bewegungen.

## Prüfgrundlage und Grenzen

- Live-Seite im Browser angesehen: automatischer Spielstart, Tore, Hilfe, Kamera und HUD. Zusätzlich mobile Ansicht mit 390 × 844 Pixeln geprüft.
- Lokale Dateien in `games/zorb-clash/` einschließlich Physik, Darstellung, Eingaben, Bots und Peer-Adapter untersucht.
- Bestehende Tests ausgeführt: `node scripts/test.mjs games/zorb-clash` → **11 bestanden, 0 fehlgeschlagen**.
- Kontrollierte lokale Diagnosefälle ausgeführt: `node --import tsx .tmp/zorb-audit.ts`. Zahlen unten stammen aus diesen Fällen, nicht aus Messungen im Live-Browser.
- Eine exakte Übereinstimmung des ausgelieferten Builds mit dem lokalen Commit wurde nicht nachgewiesen. Deshalb sind Live-Beobachtungen und lokale Befunde ausdrücklich getrennt.
- Kein vollständiger Mehrspieler-, Langzeit-, Leistungs- oder realer Smartphone-Touchtest. Dazu gibt es unten offene Abnahmepunkte.
- Dieser Auftrag wurde als Audit mit Report behandelt. **Keine Spielimplementierung verändert und nichts deployt.**

**Prioritäten:** P1 = vor einer Freigabe der korrigierten Mechanik beheben; P2 = relevante Bedienungs-, Darstellungs- oder Robustheitsfehler. Innerhalb von P1 zuerst die physikalischen Ursachen angehen.

## Bestätigte Hauptbefunde

### 1. P1 – Mensch und Kugel besitzen dieselbe Rollrotation

**Beleg:** `scene.ts:549–550` setzt Position und Quaternion der gesamten Avatar-Wurzel aus dem Kugelkörper. `avatar.ts:168` hängt den Menschen unter diese Wurzel. Die aufrechte Pose setzt lediglich die lokale Rotation zurück (`avatar.ts:333`); dadurch bleibt die Rotation des Elternobjekts wirksam.

**Folge:** Die Figur dreht sich mit der Hülle. Eine zusätzliche Beinanimation kann diesen Modellfehler nicht korrigieren. Außerdem richtet sich der Mensch nicht unabhängig zur tatsächlichen Laufrichtung aus. Die Laufanimation richtet sich nach Geschwindigkeit, also auch nach passivem Schieben.

**Korrektur:** Gemeinsame Position, aber getrennte Orientierung für Hülle und Mensch. Der aufrechte Mensch erhält Blickrichtung, kontrollierte Körperneigung und eine zur aktiven Fortbewegung passende Schrittphase. Die Kugelhülle folgt ihrer physikalischen Rotation. Umfallen und Aufstehen benötigen eigene Übergänge.

**Abnahme:** Vorwärts, rückwärts, seitwärts und diagonal laufen: Hülle rollt, Kopf bleibt im normalen Lauf oben, Füße laufen plausibel. Passives Rollen eines gestürzten Spielers darf keine normale Laufanimation auslösen.

### 2. P1 – Normale Kugeldrehung wird als menschlicher Gleichgewichtsverlust interpretiert

**Beleg:** `physics.ts:466–475` prüft den Up-Vektor der Kugel (`up.y < 0.15`). Das ist keine unabhängige Körperbalance des Menschen. Die Turtle-Pose dreht den Menschen zusätzlich lokal um etwa 180 Grad (`avatar.ts:283`), obwohl die Wurzel bereits gedreht sein kann.

**Folge:** Rollwinkel und Sturzursache sind vermischt; die sichtbare Orientierung kann dem logischen Sturzzustand widersprechen. Ein normal rollender Ball darf keinen Sturz allein deshalb auslösen, weil seine Oberfläche eine andere Orientierung hat.

**Korrektur:** Zustände „aufrecht“, „instabil“, „gestürzt“ und „aufstehend“ mit nachvollziehbaren Übergängen. Balance aus Beschleunigung, Richtungswechsel, Kontaktimpuls und Körperneigung ableiten. Der Rollwinkel der Hülle ist kein Balancewert.

**Abnahme:** Kontrolliertes Rollen über mehrere vollständige Umdrehungen verursacht allein keinen Sturz. Ein starker seitlicher Treffer kann einen Sturz auslösen; geringe Berührungen nicht automatisch.

### 3. P1 – Kräfte greifen am falschen Bezugspunkt an

**Beleg:** `physics.ts:313`, `317`, `452`, `511`, `545` übergeben `body.position` an `applyImpulse` beziehungsweise `applyForce`. Die installierte Cannon-ES-Implementierung erwartet dort einen **Abstand zum Massenschwerpunkt**, keine absolute Weltposition. Sie berechnet das Drehmoment als Kreuzprodukt dieses Abstands mit der Kraft.

**Kontrollierter Nachweis:** Gleicher Vorwärtsinput erzeugte bei X=0 das Drehmoment `[930, 0, 0]`, bei X=10 jedoch `[930, -6200, 0]`. Allein die Position auf dem Feld erzeugt also zusätzliche Drehung.

**Korrektur:** Für zentrische Kräfte den Nullvektor verwenden beziehungsweise den Parameter weglassen. Bei beabsichtigten Kontaktkräften den tatsächlichen relativen Kontaktpunkt verwenden. Danach das zusätzliche künstliche Rollmoment neu abstimmen.

**Abnahme:** Derselbe Input verhält sich an verschiedenen freien Feldpositionen gleich. Dash und Aufstehen erzeugen keine vom Abstand zum Weltursprung abhängige Rotation.

### 4. P1 – Ein Zusammenstoß wird doppelt und mit überhöhter Zusatzenergie verarbeitet

**Beleg:** Jeder Spieler registriert einen Kollisionslistener. Beide Listener bearbeiten dasselbe Paar, und jeder wendet Impulse auf **beide** Körper an. Zusätzlich zur Kollisionsantwort des Physiksystems wird ein großer Zusatzimpuls vergeben (`physics.ts:298–348`). Ein Schutz gegen doppelte Paarverarbeitung fehlt.

**Kontrollierter Nachweis:** Zwei leicht überlappende Kugeln mit jeweils 5 Einheiten/s aufeinander zu erzeugten in einem Simulationsschritt **zwei** `zorb_zorb`-Ereignisse. Danach betrugen die X-Geschwindigkeiten ungefähr −90,50 und +90,50 Einheiten/s. Der Test isoliert die Kontaktreaktion; er ist keine Messung einer typischen Live-Kollision.

**Folge:** Unkontrollierbares Wegschleudern, doppelte Bonk-Ereignisse und starke Belastung der Feldbegrenzung. Initiale Überlappungen sind praktisch relevant: `newZorbPlayer` weist allen Spielern eines Teams dieselbe Startposition zu; beim lokalen Erststart werden diese nicht zuvor verteilt.

**Korrektur:** Kollisionspaar je Kontaktbeginn einmal verarbeiten, normale Kontaktgeschwindigkeit statt bloßem Betrag der Relativgeschwindigkeit bewerten und die Zusatzenergie begrenzen. Startplätze müssen kollisionsfrei sein. Ein kleiner Arcade-Bonus darf nicht wiederholt Energie vervielfachen.

**Abnahme:** Frontal- und Streifkontakte sowie Kontakte mehrerer Spieler testen. Ein Paar erzeugt nur ein logisches Aufprallereignis. Kein anfängliches Ineinanderstehen; keine explosionsartige Beschleunigung aus einem gewöhnlichen Kontakt.

### 5. P1 – Spielfeldbegrenzung und Rückholung sind unvollständig

**Beleg:** Die seitlichen Polster in `simulation.ts:25–74` lassen in der Mitte eine Lücke von 2,7 Welteinheiten und an den Enden jeweils 1,35 Einheiten. Die Mittellücke ist breiter als Kugel- und Spielballdurchmesser. Die Polsteroberkante liegt bei Y=1,9. Es gibt keine geschlossene höhere Auffangbegrenzung. Die Rückholung in `physics.ts:523–535` prüft ausschließlich Y < −5.

**Besonders relevant:** Der Boden ist eine unendliche Ebene. Ein außerhalb gelandetes Objekt kann darauf liegen bleiben und erreicht den Y-Reset nie.

**Kontrollierter Nachweis:** Eine Spielerkugel bei X=35 blieb nach fünf simulierten Sekunden bei X=35, Y≈1,20. Das erlaubte Feld endet bei X=±17. Dieser Test bestätigt die fehlende Rückholung; er simuliert nicht den Weg durch die Bande.

**Korrektur:** Geschlossene, zum sichtbaren Stadion passende Kollisionen, nur beabsichtigte Toröffnungen. Torraum einschließlich Dach beziehungsweise geeigneter Auffanggeometrie berücksichtigen. Zusätzlich eine X/Z-Ausregel und eine sichere Rücksetzung für Spieler und Spielball; Reset muss Geschwindigkeiten und Zustände bereinigen.

**Abnahme:** Beide Seiten, alle Ecken, Mittellücken, Rampen und hohe Dash-Treffer testen. Kein Objekt bleibt in der Tribüne oder dauerhaft außerhalb. Legale Torbewegungen bleiben möglich.

### 6. P1 – Umgefallene Menschen zählen ausdrücklich als Tore

**Status:** **Live und lokal bestätigt.** Live erschien die Turtle-Goal-Auszeichnung. `physics.ts:650` prüft zusätzlich zum Spielball alle umgefallenen Spieler im Torraum. Ein vorhandener Test verlangt dieses Verhalten sogar ausdrücklich. Die Bots suchen ebenfalls nach umgefallenen Gegnern als Ziel (`bots.ts`).

**Kontrollierter Nachweis:** Spielball in der Feldmitte; umgefallener Spieler bei Z=28,5 → `scored: true`, `team: red`, `isTurtleGoal: true`.

**Korrektur:** Nur der eigenständige Spielball darf die Torwertung auslösen. Turtle-Goal-Regel, Anzeige, Audio-/Event-Verwendungen, darauf ausgerichtete KI und den bisherigen Test konsistent anpassen. Gegner wegzuschieben kann weiterhin eine Taktik sein, darf aber kein Tor ersetzen.

**Abnahme:** Stehende, fallende, liegende und aufstehende Menschen im eigenen und gegnerischen Tor verändern den Spielstand niemals.

### 7. P1 – Auch die Spielball-Torprüfung ist geometrisch falsch

**Beleg:** `physics.ts:625–648` prüft die aktuelle Mittelpunktposition, ohne vollständiges Überqueren der Torlinie, Ballradius, gültigen unteren Rand oder Überquerungsrichtung zu berücksichtigen. Oben gilt sogar `GOAL_HEIGHT + 0.5`.

**Kontrollierte Grenzfälle, sämtlich als Tor akzeptiert:**

| Mittelpunkt des Spielballs | Warum unzulässig |
|---|---|
| `[0, 1.15, 27.01]` | Mittelpunkt nur 0,01 hinter der Linie; Radius 1,15, Ball noch deutlich im Feld |
| `[0, 3.6, 28.5]` | Mittelpunkt bereits oberhalb der 3,2 hohen Latte |
| `[3.9, 1.15, 28.5]` | Ball schneidet seitlich die Toröffnung bei halber Breite 4 |
| `[0, -2, 28.5]` | Position unter dem Boden |

Das sind direkte Prüfungen der Torfunktion. Sie belegen deren fehlende Absicherung, nicht, dass jeder Fall im gewöhnlichen Spiel automatisch entsteht.

**Korrektur:** Gerichtete Überquerung der Torlinie durch den vollständigen Spielball auswerten, einschließlich Radius und Toröffnung. Bei hohen Geschwindigkeiten die Bewegung zwischen vorheriger und aktueller Position berücksichtigen. Reine Anwesenheit hinter dem Tor oder Eintritt von außen darf nicht genügen.

**Abnahme:** Torlinie berührt/teilweise/vollständig überschritten, Pfosten, Latte, Seitennetz, Rückseite, hohe Geschwindigkeit und doppelte Auslösung gezielt testen.

### 8. P1 – Kamera kann das gesamte Spiel verlieren

**Status:** **Live beobachtet:** Nach dem Schließen der Hilfe zeigte der Browser nur noch einfarbigen Hintergrund, HUD und Radar; das Spielfeld war vollständig verschwunden.

**Passende lokale Ursache:** `scene.ts:575–591` folgt unbeschränkt einer Mischung aus Spieler- und Ballposition. Verlassen diese das Feld, zieht die Kamera mit. Das Radar begrenzt Positionen dagegen auf seinen Rand (`Game.tsx:70 ff.`), wodurch nicht erkennbar ist, wie weit ein Objekt außerhalb liegt. Die genaue Live-Position konnte nicht ausgelesen werden; die Zuordnung der Ursache ist deshalb eine durch den Code gestützte Erklärung.

**Korrektur:** Kamera auf den spielbaren Raum begrenzen, sichere Übersicht bei ungültigen Positionen, klare Richtungshinweise für Ziele außerhalb des Bildes. Die Physikprobleme aus 3–5 ebenfalls beheben.

**Abnahme:** Spieler und Ball einzeln weit außerhalb platzieren: Kamera zeigt weiterhin eine sinnvolle Spielansicht; nach Rücksetzung folgt sie ohne großen Sprung.

### 9. P2 – Aufstehen ist ein Timer beziehungsweise Sprung, kein verlässlicher Übergang

**Beleg:** Eine dauerhaft gehaltene Richtung zählt bereits als „Wiggle“. Im kontrollierten Test war die Figur nach etwa **1,12 Sekunden** wieder freigegeben, ohne Richtungswechsel. `rightPlayerUp` setzt die Quaternion sofort zurück und gibt einen Aufwärtsimpuls. Ein mittlerer Treffer setzt den Turtle-Zustand sogar zurück, ohne dieselbe Aufrichtungsfunktion aufzurufen. Ein Bodenkontakt wird für die automatische Freigabe nicht verlangt.

**Korrektur:** Eine eindeutige Aufstehaktion mit sichtbarem Fortschritt und einer kurzen Animation. Freigabe an geeignete Boden-/Geschwindigkeitsbedingungen knüpfen. Soll Halten genügen, muss die Hilfe das so erklären; soll Wackeln nötig sein, tatsächliche Richtungswechsel erkennen. Kleine Hilfstreffer dürfen keinen inkonsistenten Sofortwechsel erzeugen.

**Abnahme:** Während des Sturzes kein Laufantrieb oder Dash; nach abgeschlossenem Aufstehen zuverlässige Kontrolle. Neue Treffer während des Aufstehens ergeben einen definierten Zustand.

### 10. P2 – Spiel läuft ohne Bereitschaft und hinter der Hilfe weiter

**Status:** **Live bestätigt.** Vor einer eigenen Bewegung wurden bereits Tore erzielt. Während die Hilfe offen war, veränderten sich Spielstand und Uhr; von der Aufnahme vor der Hilfe mit 1:1 und 2:47 bis zum Schließen auf 1:2 und 2:28.

**Beleg:** `freshZorbWorld` startet direkt in `playing`; der Loop in `Game.tsx:243–285` berücksichtigt `helpOpen` nicht. Die Anleitung erklärt weder das Spielziel und die Siegbedingung noch ausdrücklich „Sprint halten und loslassen“.

**Korrektur:** Klarer Einstieg mit Ziel, eigener Mannschaft, Laufrichtung und Startbereitschaft. Im lokalen Solo-Spiel die Simulation während der Hilfe pausieren und Eingaben neutralisieren. Für echten Mehrspielerbetrieb stattdessen eine ausdrücklich kommunizierte, separate Regel wählen.

**Abnahme:** Anleitung in Ruhe lesen können, ohne im lokalen Spiel Tore oder Zeit zu verlieren. Nach Schließen kein unbeabsichtigter Dash.

### 11. P2 – Mobile Anleitung und Touchsteuerung sind nicht ausreichend abgestimmt

**Live bestätigt:** In der mobilen Ansicht erklärt die Hilfe weiterhin nur WASD, Space und Shift. Auch die Rückgewinnung der Kontrolle wird ausschließlich mit WASD beschrieben. Das Radar entfällt auf schmalen Ansichten, obwohl die Kamera nur einen Ausschnitt zeigt.

**Zusätzlich im Code bestätigt:**

- `Game.tsx:327–342` verwendet `touches[0]`, ohne den Joystick-Finger über eine Kennung zu verfolgen. Mehrfingereingaben mit den Aktionsknöpfen sind dadurch nicht robust zugeordnet.
- X und Z werden separat auf ±1 begrenzt, aber der resultierende Vektor nicht normalisiert. Maximal diagonal beträgt seine Länge √2 statt 1; Tastatureingaben werden dagegen normalisiert.
- Joystick und Aktionsknöpfe haben keine `onTouchCancel`-Bereinigung. Ein unterbrochener Kontakt kann einen aktiven Input zurücklassen.
- Der Joystick-Daumen erhält keinen positionsabhängigen Versatz als direkte Rückmeldung.

**Korrektur:** Gerätegerechte Anleitung; Finger/Pointer fest zuordnen, kreisförmige Normalisierung und Deadzone, sichtbarer Daumenversatz, Abbruchbehandlung. Eine kompakte Orientierungshilfe oder Zielmarkierung auch mobil erhalten.

**Abnahme:** Auf echtem Smartphone gleichzeitig laufen, Sprint halten/loslassen und stemmen; Finger außerhalb loslassen, Kontakt abbrechen und App wechseln. Keine klebende Eingabe und kein Diagonalvorteil.

## Weitere lokale Befunde

| Prio | Befund und Beleg | Auswirkung / Korrektur |
|---|---|---|
| P2 | Namensschild und Schatten hängen an der rollenden Wurzel (`avatar.ts:186,224`). Die Kamera-Quaternion wird nur lokal gesetzt (`scene.ts:554`). | Schildposition und Bodenschatten rollen mit; Schildorientierung ist nicht zuverlässig weltfest. Als unabhängige Elemente positionieren oder Elternrotation korrekt kompensieren. |
| P2 | Globale Tastaturhandler ohne Blur-/Visibility-Reset und ohne Entfernung in `destroy()` (`scene.ts:594–613,728–733`). | Risiko klebender Tasten beim Fokuswechsel und mehrfacher Listener nach erneutem Mounten. Eingaben bei Fokusverlust neutralisieren, Dialog-/Textfokus respektieren und Listener abbauen. |
| P2 | `resetBall()` löscht `lastTouchPlayerId` nicht; Diagnose bestätigte den alten Wert nach Reset. Kontakte ≤2 Einheiten/s aktualisieren den letzten Spieler nicht. Torvergabe erhöht dessen Torzahl ohne Eigentorprüfung (`simulation.ts:293–328`). | Veraltete oder falsche Torschützen. Ballkontakt unabhängig vom Sound-Schwellwert erfassen, nach Anstoß zurücksetzen und Eigentore getrennt behandeln. |
| P1, nur Peer-Pfad | `advanceZorbClashWorld` vergleicht absolute Zeit mit relativer Spielzeit (`simulation.ts:235–238`). 60 Aufrufe im Abstand von 1/60 s ergaben 5,9167 s Fortschritt statt ungefähr 1 s. | Falscher Spielablauf im Peer-Adapter. Einen konsistenten Zeitbezug verwenden. **Nicht als Fehler der aktuellen Solo-Live-Uhr nachgewiesen**, da `Game.tsx` direkt `advanceZorbClash` verwendet. |

## Reihenfolge der Überarbeitung

1. **Physik stabilisieren:** Kraftbezugspunkt, einmalige Kollisionsverarbeitung, kollisionsfreie Starts, begrenzte Energie und geschlossene Feldbegrenzung mit Rückholung.
2. **Laufen und Stürzen sauber modellieren:** Mensch und Hülle getrennt orientieren, echte Balance-/Sturzzustände, kontrollierter Wiederanlauf.
3. **Torregeln bereinigen:** ausschließlich Spielball, gültige vollständige Linienüberquerung, korrekte Torschützen, Turtle-Goal-Verweise in KI/Anzeige/Tests entfernen.
4. **Bedienung absichern:** Kamera, Einstieg, Hilfe-Pause, mobile Anleitung, Touch- und Fokusbehandlung.
5. **Peer-Pfad separat prüfen**, bevor daraus ein Mehrspielerangebot abgeleitet wird.

## Verbindliche Abnahmetests

| Bereich | Erfolgskriterium |
|---|---|
| Laufbewegung | Mensch bleibt beim normalen Rollen aufrecht und orientiert sich plausibel; keine vom Feldort abhängige Drehung |
| Sturz | Starker Treffer kann Gleichgewicht brechen; während Sturz kein normaler Antrieb; Kontrolle erst nach abgeschlossenem Aufstehen |
| Kollisionen | Einzelkontakt erzeugt ein Ereignis; kontrollierte Geschwindigkeiten; identisches Verhalten an verschiedenen Feldstellen |
| Feld | Seiten, Ecken, Rampen und hohe Impulse können keine dauerhaft verlorenen Objekte erzeugen |
| Tore | Menschen erzielen nie Tore; nur vollständige und gültige Ballüberquerung zählt genau einmal |
| Kamera | Spielfeld bleibt in problematischen Situationen sichtbar; klare Orientierung zum Ball und gegnerischen Tor |
| Einstieg/Hilfe | Solo-Zeit und Gegner warten während der Hilfe; Sprint-Aufladen und Loslassen werden verständlich erklärt |
| Touch/Fokus | Zwei-Finger-Bedienung, Abbruch, Fokusverlust und Wiederkehr hinterlassen keine aktiven Eingaben; keine schnellere Diagonale |
| Wiederholung | Wiederanstoß und neues Match setzen erforderliche Zustände zurück; keine wachsende Listenerzahl |
| Geräte/Zeitschritte | 30/60/120-Hz-Ausführung sowie reale Touchgeräte prüfen; besonders Kräfte bei mehreren Physik-Substeps vergleichen |

**Testlücke:** Die vorhandenen Tests prüfen grundlegende Bewegung und positiv erwartete Ereignisse, aber kaum unzulässige Situationen. Der bestehende Turtle-Goal-Test konserviert ausdrücklich die falsche Anforderung. „Alle Tests grün“ ist deshalb derzeit kein Nachweis für die gewünschte Spielqualität.
