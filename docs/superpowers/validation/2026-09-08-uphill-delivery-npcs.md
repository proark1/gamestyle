# Uphill Delivery NPCs — Validierung

Stand: 2026-09-08, lokale Windows-Entwicklungsumgebung. Anschließend auf ausdrücklichen Nutzerwunsch veröffentlicht; siehe [Live-Prüfbericht](2026-09-08-uphill-delivery-npcs-live.md).

## Ergebnis und Grenzen

Lobby, Netzwerk und kooperative NPC-Steuerung sind implementiert. Die autonome Crew hat in der Abschlussserie **5 von 5 vollständigen Lieferungen** geschafft: ein untätiger menschlicher Host, drei NPCs, normaler Depotstart, geschlossene Türen, bewegliche Brücke, Ziegen, Kollisionen und normale Siegbedingung. Es gab kein Versetzen während der Simulation, keine zusätzlichen NPC-Kräfte und keinen künstlichen Sieg. Der vorher dokumentierte Stand mit 0/5 ist damit überholt.

Das ist ein Nachweis für diese fünf Startaufstellungen, keine Garantie für beliebige Spielsituationen. In der letzten vollständigen Serie mit synthetisch gesteuerten menschlichen Plätzen wurden **9 von 30 gemischten Lieferungen** innerhalb von 900 Simulationssekunden abgeschlossen, gegenüber 7/30 vor der Routen-Korrektur. Die vollständige gemischte Abnahme ist damit **nicht bestanden**. Die NPCs können weiterhin stürzen oder menschliche Hilfe benötigen. Nach dieser Matrix wurden noch wiederholtes Umgreifen und veraltete Sprungaufträge korrigiert und gezielt nachgeprüft; der Umfang ist unten gesondert ausgewiesen. Die spätere Veröffentlichung ändert diese Abnahmegrenzen nicht.

## Vollständige autonome Läufe

    node --import tsx games/uphill-delivery/scripts/npc-delivery-check.mjs 900 --variant=0 --interval=900

Varianten 1–4 verändern nur vor dem ersten Physikschritt die Startpositionen um höchstens 12 cm und die Sofaausrichtung um höchstens etwa 7 Grad. Variante 0 ist unverändert. Exitcode 0 erfordert die reguläre Phase delivered; ein Zeitüberschreiten ergibt Exitcode 1.

| Variante | Ergebnis | Simulationszeit |
| --- | --- | ---: |
| 0 | geliefert | 278,58 s |
| 1 | geliefert | 588,00 s |
| 2 | geliefert | 199,58 s |
| 3 | geliefert | 345,45 s |
| 4 | geliefert | 326,28 s |

Die maschinenlesbaren Ergebnisse liegen in [uphill-delivery-npcs](uphill-delivery-npcs/). Jede Datei autonomous-0.json bis autonomous-4.json enthält Ergebnis, Zeitlimit, aktivierte Ziegen, Startvariante, Endpositionen und einen SHA-256-Wert der neun maßgeblichen Simulationsdateien. Alle fünf müssen denselben Wert tragen. Die Option --report schreibt einen solchen Bericht; --resume und --no-goats sind ausdrücklich nur Diagnoseoptionen und wurden für die Abschlussserie nicht benutzt. Ein aus einem Checkpoint fortgesetzter Lauf ist kein vollständiger Depotstart.

## Steuerung und Erholung

- Gemeinsamer Routenplan und eine aus der tatsächlichen Sofaachse berechnete Trageformation. Eine Ausrichtungskorrektur mitten auf der Strecke zieht die Crew nicht zum vorherigen Eckpunkt zurück.
- Höhenabhängige Wege prüfen erreichbare Bodenschichten, Treppen, Rückwege und sichere Landungen. Figuren können vom Depot auf den unteren Auffangboden und wieder zurück gelangen. Seitliches Ausweichen ist auch im rechten Winkel möglich, damit sie sich an Wandenden nicht festlaufen.
- An der Lücke richtet sich die Crew aus. Ein NPC lässt vor seinem normalen Sprung los; der nächste wartet auf einen gesicherten Griff. Ein NPC auf dem höheren Ufer behält seinen erreichbaren Griff. Wer auf dem Sofa landet, kann mit dem vorhandenen Sprung über die Rückenlehne gelangen. Ein verbleibender NPC unterstützt auch einen menschlichen Partner, der bereits auf der Gegenseite wartet. Fällt das Sofa auf einen früheren Streckenabschnitt, wird ein noch gespeicherter Lückensprung verworfen und der Rückweg zur tatsächlichen Last geplant.
- Ein gemeinsames Hebemanöver nutzt normale Sprungeingaben. NPCs reagieren im selben Physikschritt auf einen frischen Sprung eines mittragenden Menschen, auch beim Anheben aus dem Stand. Bereits verbrauchte oder veraltete Sprungeingaben werden nicht wiederholt. Geplante Sprünge werden von versehentlichen Abstürzen unterschieden. Erreichbare Griffe bleiben bei der Bergung erhalten, wenn das andere Sofaende außerhalb des Wegs hängt. Ein einzelner NPC kann die blockierte Last anheben, wenn sein menschlicher Partner schon auf dem höheren Ufer wartet.
- Nach anhaltender Blockade werden tatsächlich andere Griffe reserviert und für den Umweg kurz beibehalten. Vier neue Verteilungen werden ausprobiert, bevor die Crew sichtbar menschliche Hilfe verlangt. Über der Lücke wird nicht ungesichert abgesetzt.
- NPCs prüfen Wände und Türflügel zwischen Figur und Griff. Der Türhelfer nähert sich auf der freien Seite, öffnet einmal und wartet die Bewegung ab. Ist sein bevorzugter Standpunkt blockiert, kann er nach 1,5 Sekunden Stillstand einen bereits erreichbaren Griff auf der sicheren Seite nutzen.
- Menschen können das Sofa an jeder vollständig gültigen Position im Kundenhaus abstellen. NPCs lösen dort ihre eigenen Griffe und warten auf das menschliche Loslassen. Rutscht die Last beim Absetzen aus dem Zielbereich, wird sie nach einer kurzen Ruhefrist wieder aufgenommen. Die Lieferung endet ausschließlich über die vollständige Innenraum- und Ruheprüfung der bestehenden Physik.
- Mittragende Menschen geben Richtung und Halt vor. Ihre Kreisbewegung beim Drehen wird bereits beim angeforderten Drehbeginn von der gemeinsamen Fortbewegung getrennt. NPCs halten beim Gehen sowohl den seitlichen als auch den Abstand vor und hinter ihrer Sofaecke ein. Ein Mensch, der während der Vorbereitung an der Lücke zugreift, übernimmt sofort die Führung. Ein menschlicher Halt verhindert einen neuen Lückensprung; ein bereits fliegender NPC steuert noch bis zur sicheren Landung. Widersprüchliche oder veraltete menschliche Eingaben bremsen die Crew.

Die NPCs nutzen normale Eingaben und validierte Aktionen. Positionen, Geschwindigkeiten und Türwinkel werden durch die Planung nicht direkt verändert. Ein vorübergehend untersuchtes stärkeres Stabilisierungsmodell sowie zusätzliche Ausweich- und Tragevarianten wurden wegen schlechterer vollständiger Läufe wieder verworfen.

## Lobby und Netzwerk

- Vier feste Plätze. Nur der Host kann gezielt NPCs hinzufügen, entfernen oder alle freien Plätze atomar auffüllen. Menschen werden nicht ersetzt; Gäste sehen die Belegung ohne Verwaltungsrechte. Die Karten bleiben nach der Lieferung im Abschlussdialog verfügbar.
- HTTP- und Peer-Räume reservieren menschliche und NPC-Plätze gemeinsam. Hostberechtigung, NPC-Identität, Wiederholungsschutz, Belegungsrevision und Startsperre schützen die Verwaltung. Alte Checkpoints können eine neuere Sperre nicht aufheben.
- NPCs sind keine authentifizierten Netzwerkmitglieder, erhalten keine Mitgliedstoken und werden weder Host noch Sprachchatteilnehmer. Neustart erhält die Crew; Hostwechsel überträgt den privaten serialisierbaren Steuerzustand. Öffentliche Snapshots enthalten Figuren und Aufgaben, keine Steuerpläne.
- Tests prüfen Rechte, konkurrierenden Beitritt und Auffüllen, Vierergrenze, Farben, wiederholte und verspätete Requests, NPC-Timeoutausnahme, menschliche Hostnachfolge, Checkpointrevision und gefälschte NPC-Eingaben.

## Gemeinsame Physik

Die bereits zur NPC-Implementierung gehörenden Anpassungen gelten für menschliche und NPC-Träger gleichermaßen: Ab zwei Trägern stabilisiert der vorhandene Drehmechanismus die Sofaachse; Roll-/Nickgegenkraft und Dämpfung wurden gegenüber dem ursprünglichen Spiel erhöht. Die Solounterstützung bleibt unverändert. Gewicht, Kollisionen, Griffverlust und begrenzte Tragekräfte werden weiterhin simuliert.

Die bestehende Eisstufenhilfe prüft in normierter Bewegungsrichtung vor den Füßen. Dadurch kommen auch schwache analoge Eingaben über die sichtbaren kleinen Stufen. Nach dem Schritt gilt wieder normale Eistraktion. Ein Test mit einem realen Körper durchläuft den gesamten Eisabschnitt.

## Geprüfte Zusammenarbeit und offene Abnahme

37 Verhaltenstests prüfen unter anderem menschlichen Halt, Richtungswechsel, widersprüchliche Eingaben, Rotation, Türaktionen, Sprünge, Rückwege, Griffwechsel und normale Ablage. Alle sechs gemischten Crewgrößen 1+1, 1+2, 1+3, 2+1, 2+2 und 3+1 (Menschen+NPCs) tragen in einem kurzen realen Physiklauf gemeinsam vorwärts und beachten anschließend den menschlichen Halt. Zusätzlich vollenden 1+1, 1+3 und 2+2 eine menschlich ausgelöste Vierteldrehung mit echten Körpern. Gemeinsames Anheben, Loslassen an einer abweichenden gültigen Zimmerposition und Wiederaufnahme nach dem Herausrutschen sind gegen Regressionen abgesichert.

Eine Zweiercrew wählt auf freier Strecke diagonal gegenüberliegende Griffe. Wird die Ecke innerhalb von sechs Sekunden nicht erreicht, gibt der NPC die feste Reservierung auf und darf eine erreichbare Alternative behalten. Greift der Mensch an einer anderen Ecke, beginnt ein neuer kurzer Versuch. Kurzes Loslassen und erneutes Greifen derselben Ecke löscht die Erinnerung an den Fehlversuch nicht mehr: Der NPC behält seine bereits brauchbare Alternative. Der Regressionstest reproduzierte vorher das unnötige erneute Loslassen und besteht mit der Korrektur. Bei stark gekipptem Sofa, Bergung und über der Lücke haben erreichbare Griffe Vorrang; ein NPC kann auf dem höheren Ufer zunächst die erreichbare vordere Ecke sichern. Sowohl menschliches Zurücktragen als auch das Weitertragen an einem Wegpunkt vorbei korrigieren den gespeicherten Routenfortschritt. Damit kennen die NPCs die Brückenlücke auch dann, wenn die Last einen früheren Eckpunkt verfehlt hat. Die Korrektur verlangt eine passende Entfernung und Höhe zur tatsächlichen Straße; ein schwebendes Sofa wird keiner tieferen Straße zugeordnet. Reine Drehkorrekturen der NPC-Formation gleichen sich untereinander aus, damit daraus keine zusätzliche gemeinsame Verschiebung entsteht.

Das Werkzeug npc-mixed-check.mjs verwendet jetzt einen eigenen **synthetischen Eingabentreiber** für menschliche Plätze. Der vorherige Schattenplan wurde entfernt: Er hatte auch Befehle für die echten NPCs vorausgesetzt und konnte deshalb selbst eine gegenseitige Warteschleife erzeugen. Der neue Pilot liest die tatsächliche Szene und nutzt gemeinsame lesende Geometrie- und Wegehilfen. Er setzt ausschließlich normale menschliche Eingaben und validierte Aktionen; die laufende Simulation steuert weiterhin alle NPCs. Es werden keine Körperzustände zurückgeschrieben. Das bleibt ein programmierter Testspieler und ersetzt keinen menschlichen Spieltest.

    node games/uphill-delivery/scripts/npc-mixed-matrix.mjs 900 docs/superpowers/validation/uphill-delivery-npcs/mixed 4

Das Matrixwerkzeug führt alle sechs Besetzungen mit fünf Varianten aus. Varianten 1–4 verschieben den Beginn der Hindernisbewegung und unterbrechen den Piloten für drei Sekunden. Der Pilot trägt mit einer analogen Grundbewegung von 0,55, zuzüglich Kreisbewegung beim Drehen. Jeder Bericht enthält Quellcode-, Treiber- und Eingabe-Hashes, tatsächlich gemeinsam getragene Zeit, Haltezeit mit menschlichem Griff und etwaige missachtete Halteframes. Eine Haltezeit von null bedeutet, dass der Pilot im geplanten Unterbrechungsfenster keinen Griff hatte. matrix.json prüft zusätzlich, ob alle Läufe denselben Quellcode und Treiber verwendet haben. Ein Zeitüberschreiten oder ein nicht beachteter Halt ergibt einen fehlschlagenden Gesamtstatus.

Der Pilot greift nach einem Sturz nicht sofort von einer tieferen Straße wieder zu, wenn seine eigene nächste Entscheidung diesen Griff ohnehin lösen würde. Nach einer längeren Blockade mit mehreren Trägern versucht er eine neue Standposition. Wenn die gesamte Unterstützung an der Lücke verloren geht, wartet er nicht unbegrenzt auf der anderen Seite. Diese Korrekturen betreffen das Prüfwerkzeug und geben den NPCs keine zusätzlichen Fähigkeiten.

| Menschen + NPCs | Variante 0 | Variante 1 | Variante 2 | Variante 3 | Variante 4 | Geliefert |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 + 1 | — | — | — | — | — | 0/5 |
| 1 + 2 | — | — | 419,52 s | — | 524,85 s | 2/5 |
| 1 + 3 | 439,92 s | 668,70 s | — | — | 236,32 s | 3/5 |
| 2 + 1 | — | — | — | 385,63 s | — | 1/5 |
| 2 + 2 | 248,12 s | — | — | — | — | 1/5 |
| 3 + 1 | — | 332,73 s | — | — | 195,80 s | 2/5 |

Ein Strich bedeutet: beim Zeitlimit von 900 Sekunden noch in der Spielphase. Alle 30 Läufe benutzten denselben Spielcode und denselben Treiber. In 17 Unterbrechungen hielt mindestens ein menschlicher Platz einen Griff; über zusammen 51 Sekunden gab es **keinen missachteten Halteframe**. Rohdaten einschließlich Fehlschlägen: [matrix.json](uphill-delivery-npcs/mixed/matrix.json). Diese vollständige Matrix gehört zum Prüfstand `da9c1bba822be84cf8e8ac502df3923919790699b28e77220ce12b9b20747d1a`.

Nach der Matrix wurden zwei beobachtete Schleifen korrigiert: Die Erinnerung an einen fehlgeschlagenen Griffanlauf bleibt bei kurzem menschlichem Umgreifen erhalten; ein gespeicherter Lückensprung endet, sobald die Last den betreffenden Streckenabschnitt verlässt. Der aktuelle Spielcode trägt `2bb80f92c4cd704adbd239aa0bbba52134ff0fc5152e48273b04ebe713d1819a`. Alle fünf autonomen Depotstarts wurden mit dieser Version erneut erfolgreich ausgeführt und zeigen die unveränderten Zeiten aus der obigen Tabelle. Hinzu kommen die beiden Regressionstests und gezielte Zweiercrew-Nachprüfungen in [mixed-pair](uphill-delivery-npcs/mixed-pair/). Die vollständige 30er-Matrix wurde nach diesen letzten Änderungen nicht erneut ausgeführt; ihr Ergebnis wird nicht als Prüfung derselben Dateiversion ausgegeben.

Die fünf Zweiercrew-Nachprüfungen endeten jeweils nach 900 Sekunden noch in der Spielphase: **0/5 vollständige Lieferungen**. Alle verwenden den aktuellen Quellcode und denselben Eingabentreiber. In Variante 2 hielt der Pilot während seiner dreisekündigen Unterbrechung einen Griff; kein Halteframe wurde missachtet. In den übrigen geplanten Unterbrechungen trug der Pilot gerade nicht. Die lokalen Korrekturen lösen die verbleibenden Griff- und Bergungsprobleme des durchgehenden Zweierlaufs nicht vollständig.

Die verbleibenden Probleme betreffen insbesondere kleine Crews, erneutes Greifen nach Stürzen, blockierte Griffpositionen und die Weglücke. Der synthetische Pilot bleibt selbst eine Fehlerquelle. Die Ergebnisse beweisen deshalb weder, dass diese Besetzungen für Menschen unspielbar sind, noch dass die NPC-Zusammenarbeit bereits zuverlässig genug ist. Eine untersuchte strengere Prüfung der Standflächen wurde nach ausbleibender Verbesserung verworfen; die experimentellen Quellcodedateien wurden entfernt.

Die im Entwurf geforderten fünf vollständigen Varianten je gemischter Besetzung mit belastbaren menschlichen Steuerverläufen und Unterbrechungen sind **noch nicht bestanden**. Die fünf autonomen Läufe und kurzen Kooperationstests dürfen nicht als Ersatz dafür gezählt werden.

## Browser- und Netzwerkprüfung

Bereits im selben Implementierungsauftrag geprüft; die Lobby-/Netzwerkdateien wurden bei den anschließenden Steuerungskorrekturen nicht verändert:

- Zwei echte Browserseiten mit zwei Menschen und zwei NPCs: einzelner Slot, Auffüllen, Entfernen, menschlicher Beitritt, gemeinsame Sichtbarkeit, Start, Verlassen des Hosts, Fortsetzung beim Gast und Neustart bestanden. Keine Konsolenfehler im geprüften Ablauf.
- Layout und Tastatur bei 1280×720, 390×844 und 844×390 geprüft. Slotbuttons mindestens 44 px hoch, NPC-Kennzeichen mobil sichtbar. Viewports zurückgesetzt und Testseiten geschlossen. Kein Test auf physischer Touchhardware.
- Peer-Integration mit vier echten WebRTC-Clients und generierter Sprachübertragung: abrupter Hostausfall und geordneter Wechsel bestanden, Wechsel 715 ms. Dieser Integrationslauf hatte vier Menschen; der gemischte NPC-Fall wurde separat im Browser geprüft.

## Leistung

    node --import tsx games/uphill-delivery/scripts/npc-performance.mjs
    node --import tsx games/uphill-delivery/scripts/npc-performance.mjs --mixed

Windows x64, AMD Ryzen 7 5800H, Node 24.14.0. Beide abschließenden Messungen liefen nacheinander, nachdem die hier gestarteten Langläufe und Builds beendet waren. Je Szenario wurden in 120 simulierten Sekunden 7.200 aktive NPC-Planungsframes vor dem normalen Physikschritt gemessen. Beide Berichte tragen die aktuelle Spielcode-Kennung.

| Szenario | Median | 95. Perzentil | Maximum |
| --- | ---: | ---: | ---: |
| Untätiger Mensch + drei NPCs | 0,377 ms | **0,802 ms** | 23,983 ms |
| Synthetischer Testpilot + drei NPCs | 0,427 ms | **0,968 ms** | 22,638 ms |

Beide Messungen erreichen das Ziel von weniger als 2 ms im 95. Perzentil. Der Testpilot hielt in 5.149 Frames einen Griff; seine eigene Rechenzeit ist nicht in der NPC-Messung enthalten. Rohdaten: [performance.json](uphill-delivery-npcs/performance.json) und [performance-mixed.json](uphill-delivery-npcs/performance-mixed.json).

Eine Messung an einem früheren Implementierungsstand unmittelbar nach einer Testserie verfehlte das Ziel mit **2,970 ms** im 95. Perzentil und **159,849 ms** Maximum. Sie bleibt als [performance-after-matrix.json](uphill-delivery-npcs/performance-after-matrix.json) mit ihrer damaligen Quellcode-Kennung erhalten. Die Ursache der Abweichung wurde nicht nachgewiesen. Die Rechenzeit schwankt; einzelne Frames überschreiten auch im aktuellen Stand weiterhin ein 60-Hz-Framebudget.

Das misst die NPC-Planung, nicht die gesamte Browser-Framerate oder Mobilhardware. Die Graph-Erstellung erfolgt bei der Crewbelegung vor Spielbeginn. Wege werden bei Bedarf etwa alle 650–785 ms neu geplant; Bewegung wird in jedem 60-Hz-Physikschritt geregelt. Entscheidungen sind deterministisch, der serialisierte Teamzustand trägt Version 1.

## Repository und Builds

| Prüfung | Ergebnis |
| --- | --- |
| npm test | **650/650 bestanden**, einschließlich Architekturprüfung |
| npm run typecheck | bestanden |
| Betroffener Uphill-/Peer-Lint | bestanden |
| Projektweite Formatprüfung | bestanden, 542 Dateien |
| Worker-Build | bestanden |
| Node-/Railway-Build | bestanden |
| Projektweites npm run check | **bestanden**, einschließlich Formatierung, Typprüfung, Lint und Tests |

Die zuvor außerhalb von Uphill Delivery beobachteten Lint-, Typ- und Formatfehler waren in der abschließenden Gesamtprüfung behoben. Die Gesamtzahl enthält auch parallel hinzugekommene Tests anderer Module.

Die Builds melden bestehende Hinweise zu JSON-Importattributen, großen Chunks und noch nicht klassifizierten Routen, aber keine Buildfehler. Die vorhandene private Sites-Instanz wurde nur gelesen. Später wurde der geprüfte Stand auf ausdrücklichen Wunsch auf dem bestehenden öffentlichen Railway-Dienst veröffentlicht; Zugriffsregeln wurden dabei nicht geändert.
