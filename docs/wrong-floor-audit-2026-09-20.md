# Wrong Floor — Spiel-, UX- und Funktionsaudit

Datum: 20.09.2026 · Live-Seite: https://www.jumbleyard.com/wrong-floor
Lokaler Prüfstand: HEAD `33261d8`, bestehender Arbeitsstand. Die Gleichheit mit dem produktiven Build wurde nicht verifiziert.

## Urteil

Die Grundidee ist stark: Vier Gäste erleben denselben Flur unterschiedlich und müssen ihre Beobachtungen zusammenbringen. Der aktuelle Einstieg vermittelt diese Idee besser als den tatsächlichen Ablauf. Das Spiel verlangt schon unter Zeitdruck Orientierung, Bedienung und Regelverständnis. Die freundlich wirkenden Bedienflächen konkurrieren außerdem mit der Horroratmosphäre.

Die größten Hebel sind eine geführte erste Untersuchung, ein deutlich reduziertes Spiel-HUD und eine verlässlich inszenierte Konsequenz falscher Entscheidungen. Vor atmosphärischem Ausbau sollten die folgenden funktionalen Schwächen behoben werden. Eine Freigabe „alles funktioniert“ ist auf Basis dieser Prüfung nicht gerechtfertigt.

## Prüfumfang und Grenzen

- Live geprüft: Startseite, Anleitung, Übungsstart mit drei NPCs, automatische NPC-Berichte, Fehlerhinweis bei Untersuchung aus zu großer Entfernung, deutsche Sprachwahl, Hilfe während einer laufenden Runde und Timeout im Aufzug.
- Layouts: breite Desktopansicht bei 1440 × 900 und schmale Ansicht bei 390 × 844 sowie die ursprüngliche schmale Browseransicht. Dies ist kein Test auf echter Touch-Hardware.
- Lokal geprüft: Simulation, Kamera, Horrorereignisse, UI, Sprachintegration und vorhandene Tests. `node scripts/test.mjs games/wrong-floor`: **30 Tests bestanden, 0 fehlgeschlagen**.
- Zusatzprüfung: 100 deterministische lokale Simulationsläufe ohne weitere Spieleraktionen nach dem Start.
- Keine Warnungen oder Fehler in den zum Prüfzeitpunkt ausgelesenen Browserlogs. Dies ist keine Langzeit- oder Performancegarantie.
- Nicht vollständig live geprüft: ein aktiv durchgespielter Fünf-Etagen-Durchlauf, Flucht mit laufender manueller Bewegung, mehrere menschliche Spieler, Voice-Chat, Reconnect/Hostwechsel, echte Mobilgeräte und hörbare Audioqualität. Audio- und Bewegungslogik sind teilweise durch die vorhandenen Tests abgedeckt.
- Der Versuch, eine Online-Lobby anzulegen, wurde von der automatischen Freigabeprüfung vor Ausführung blockiert: Eine Lobby erzeugt externen Zustand auf der Live-Seite. Dafür ist eine gesonderte Freigabe nötig.

## Priorisierte Befunde

### 1. P1 — Gewinnen ohne Spielen ist möglich

**Nachweis: lokale Simulation; Teilverhalten auch live beobachtet.**

Nach dem Start wurden weder Bewegungs-, Untersuchungs-, Berichts- noch Abstimmungsaktionen gesendet. Trotzdem endeten **32 von 100 Läufen mit einem Sieg**, 68 mit einer Niederlage. Beispiel: Startwert 5, fünf Etagen abgeschlossen, zwei Fehler, rund 650 simulierte Sekunden.

Die Ursachen greifen ineinander:

1. Nach 90 Sekunden wird automatisch entschieden.
2. Keine Stimme zählt als Rückzug. Auf einer Anomalie-Etage ist das richtig und erzeugt Fortschritt.
3. Bei einem falschen Rückzug bleibt der untätige Spieler bereits in der Rettungszone des Aufzugs und wird sofort als gerettet gewertet.
4. Die Etage wird neu ausgewürfelt. So kann ein vollständig untätiger Durchlauf erfolgreich werden.

Live blieb der Spieler am Start stehen. Nach Ablauf des Timers erschien erneut Etage 1 mit einer Chance weniger, ohne dass eine Fluchtbewegung nötig war.

**Empfehlung:** Fehlende Beteiligung als eigenen Zustand behandeln. Ohne explizite menschliche Entscheidung keinen erfolgreichen Etagenabschluss auslösen. Für den Übungsmodus bieten sich Stillstand und Orientierungshilfe an; für Online-Spiele braucht es eine klar kommunizierte Timeout-/AFK-Regel. Rettung im Aufzug und Nichtteilnahme müssen getrennt bewertet werden.

**Abnahme:** Ein Durchlauf ohne Aktionen kann nicht gewinnen; gültige Abstimmungen, Gleichstand und das Retten von Mitspielern funktionieren weiter.

Code: `simulation.ts`, insbesondere `resolve()` ab Zeile 204, Timeout Zeile 323 und Rettungszone Zeile 328.

### 2. P1 — „Deutsch“ übersetzt den eigentlichen Spielablauf nicht

**Nachweis: live und Code.**

Nach Auswahl von Deutsch ändern sich beispielsweise „Dein Look“, „Anmelden“ und auf der Startseite „Aufzug rufen“. Spielziel, Anleitung, Hinweise, Beobachtungen, Abstimmung und Ergebnisse bleiben weitgehend Englisch. In `Game.tsx` wird aus den spielbezogenen Übersetzungen nur `strings.createParty` verwendet; auch die Beobachtungstexte sind fest auf Englisch hinterlegt.

**Auswirkung:** Gerade die Regeln, deren Verständlichkeit hier entscheidend ist, folgen nicht der gewählten Sprache.

**Empfehlung:** Den gesamten Spielablauf einschließlich Beobachtungen, Fehlermeldungen, NPC-Berichten, Tastaturhilfen und Endzuständen lokalisieren. Berichte langfristig als strukturierte Daten übertragen und auf dem jeweiligen Client übersetzen.

**Abnahme:** Eine deutsche Sitzung kann vom Start bis zum Ergebnis ohne englische Pflichtinformation gespielt werden.

### 3. P1 — Die Hilfe kostet im Übungsmodus Spielzeit

**Nachweis: live und Code.**

Die Hilfe wurde bei etwa 0:47 geöffnet und bei etwa 0:29 geschlossen. Die Bewegung ist während des Dialogs blockiert, die lokale Simulation läuft weiter. Gerade neue Spieler verlieren dadurch Zeit, während sie die umfangreichen Regeln lesen. Im Code blockiert der Dialog die Eingabe, aber nicht `advanceHotel()` im lokalen Tick.

**Empfehlung:** Übungsmodus beim Öffnen der Hilfe pausieren. Online den Timer nicht für alle durch einen einzelnen Dialog anhalten; stattdessen Regeln vor Rundenbeginn zeigen und während der Runde ausdrücklich auf die weiterlaufende Zeit hinweisen.

**Abnahme:** Im Übungsmodus bleiben Timer und Bedrohung während der Hilfe stehen; im Multiplayer ist das Verhalten unmissverständlich.

### 4. P1 — Der Einstieg erklärt die Aufgabe nicht in der richtigen Reihenfolge

**Nachweis: live; UX-Bewertung.**

Der Übungsstart führt direkt in eine laufende 90-Sekunden-Runde. Gleichzeitig erscheinen eigener Hinweis, zwei zunächst deaktivierte Untersuchungs-/Teilen-Aktionen, zwei deaktivierte Abstimmungen, Teamberichte, Timer, Fortschritt und Kamerawahl. Der goldene Ring hilft, erklärt aber weder den Normalzustand noch den gesamten Handlungsablauf.

Die Regeln zum trockenen Teppich, unbewegten Porträt, stillen Zimmer 309 und zur Uhr bei 12:00 stehen in der separaten Anleitung. In der schmalen Startansicht stehen die kurzen Entscheidungsregeln zudem unterhalb des zunächst sichtbaren Bereichs.

**Empfehlung:** Die erste Runde führt nacheinander durch „Hinweis finden → untersuchen → teilen → Teamberichte vergleichen → entscheiden“. Normalzustand am ersten relevanten Objekt erklären. Erst danach regulären Zeitdruck starten. Die jeweils nächste Aktion erhält Vorrang im HUD.

Die Kurzregel sollte vor dem Start sichtbar sein: „Untersucht eure Hinweise. Sobald jemand etwas Ungewöhnliches entdeckt: Rückzug. Ist alles normal: weiterfahren. Erreicht gemeinsam fünf Etappen.“

**Abnahme:** Mindestens vier von fünf neuen Testpersonen können nach dem Einstieg das Ziel erklären und den ersten Hinweis ohne mündliche Hilfe untersuchen. Das ist ein vorgeschlagenes Testziel, kein bereits erhobenes Nutzerergebnis.

### 5. P2 — Zu viel helles HUD schwächt Übersicht und Grusel

**Nachweis: Desktop- und schmale Liveansicht; gestalterische Bewertung.**

Große cremefarbene Karten, runde Buttons und die umfangreiche Toolbar ziehen den Blick aus dem dunklen Flur heraus. Auf dem Desktop bleiben ausführliche Teamberichte ständig sichtbar. Auf 390 Pixel Breite nehmen Kopfbereich und untere Aktionskarten viel Sichtfläche ein; ein Fehlerhinweis liegt zusätzlich über der Szene. Die Umgebung ist dunkel, die Bedienoberfläche wirkt dagegen wie eine freundliche Spielesammlung.

**Empfehlung:** Während des Spiels Fortschritt, aktuelles Ziel und relevante Interaktion kompakt halten. Teamberichte bei neuen Meldungen ankündigen und bei Bedarf öffnen. Abstimmungen erst am Panel prominent darstellen. Profil-/Kosmetikfunktionen in ein sekundäres Menü verschieben. Lesbare Schrift und ausreichenden Kontrast erhalten; Grusel darf nicht durch unlesbare Bedienung entstehen.

**Abnahme:** Auf 390 × 844 und 1440 × 900 bleiben Zielobjekt und Weg sichtbar. Hinweise und Buttons überdecken sich auch bei langen deutschen Texten nicht. Echte Touch-Geräte separat prüfen.

### 6. P2 — Die Spannung wird schnell berechenbar

**Nachweis: Code; Einschätzung des Wiederholungswerts.**

Es gibt vier feste Untersuchungsstationen mit jeweils einem normalen und einem abweichenden Text. NPCs berichten wahrheitsgemäß, und die Aussage benennt die Abweichung eindeutig. Visuelle Horrorereignisse kehren in einem Rhythmus von ungefähr 13–18 Sekunden wieder. Ein Lauf beginnt mit drei Anomalie- und zwei normalen Etagen in gemischter Reihenfolge.

Das ist eine nachvollziehbare Basis, kann nach wenigen Runden jedoch zu „Text lesen und passende Taste wählen“ werden. Eine höhere Lautstärke oder mehr Dunkelheit allein behebt das nicht.

**Empfehlung:** Zunächst die bestehende Atmosphäre schärfen: gezielte Ruhe vor einer Störung, klar räumlich verortete Geräusche, deutlich inszenierter Entscheidungswechsel und eine sichtbare Entwicklung über die fünf Etappen. Anschließend mehrere verständliche Varianten pro Objekt ergänzen. Eindeutige Regelsignale sollten verlässlich bleiben; harmlose Atmosphäre und entscheidungsrelevante Anomalien benötigen eine erkennbare Trennung.

**Abnahme:** Testspieler beschreiben konkrete unheimliche Momente und können gleichzeitig erklären, welches beobachtete Ereignis ihre Entscheidung begründet hat. Audioqualität dazu tatsächlich mit Kopfhörern testen.

### 7. P2 — Die Verfolgung ist für Mitspieler visuell unterschiedlich nachvollziehbar

**Nachweis: Code, noch kein Multiplayer-Livetest.**

`hotelSnapshot()` setzt `apparition` nur für den ausgewählten Zeugen. `hotelHorror()` bindet die sichtbare Gestalt auch während der Flucht an dieses Flag. Die Fanglogik gilt dagegen für alle Gäste. Dadurch können andere menschliche Spieler von einer für sie nicht sichtbaren Gestalt gefangen werden.

Das kann zum Konzept unterschiedlicher Wahrnehmung passen. Die Gefahr und die Ursache einer Niederlage müssen trotzdem für jeden verständlich sein.

**Empfehlung:** Private Erscheinungen während der Untersuchung beibehalten, während der gemeinsamen Flucht aber allen ein klares Bedrohungssignal geben. Die Flucht sollte mit eindeutigem Richtungswechsel, Ausgangsziel und nachvollziehbarem Fang-/Rettungsfeedback beginnen.

**Abnahme:** Vier menschliche Testspieler verstehen unabhängig von ihrer Zeugenrolle, warum sie fliehen und warum sie gegebenenfalls gefangen wurden.

### 8. P2 — Kamerastart und Steuerung brauchen einen gezielten Praxistest

**Nachweis: Livebild und Code; kein bestätigter Kollisionsfehler.**

In der breiten Startansicht nimmt ein naher Wand-/Aufzugsteil einen erheblichen Teil der linken Sicht ein. Der Einstieg zeigt außerdem viele deaktivierte Aktionen, bevor man die Bewegungssteuerung gelernt hat. Blicksteuerung erfolgt durch Ziehen, nicht allein durch Mausbewegung.

**Empfehlung:** Startposition und Blickachse so prüfen, dass der erste Weg und der goldene Marker deutlich sichtbar sind. Bewegung und Ziehen einmal direkt im Spiel vermitteln. Eine eingeblendete Nähe-Anforderung ist hilfreicher als nur ein deaktivierter Button.

**Abnahme:** Mit allen vier Startplätzen sowohl erste Person als auch Folgekamera testen; keine verdeckten Ziele, keine Kameradurchdringungen. Zusätzlich Bewegung und gleichzeitiges Umschauen auf echten Smartphones prüfen. Die vorhandenen Kameratests sind positiv, decken diesen Gesamteindruck aber nicht vollständig ab.

## Was bereits funktioniert bzw. erhalten bleiben sollte

- Der zentrale Gedanke unterschiedlicher Wahrnehmungen bietet eine gute Grundlage für gemeinsame Spannung.
- Goldener Zielring, eigener Hinweis und vorhandene Nähe-Fehlermeldung geben bereits Orientierung.
- Drei NPCs ermöglichen einen unmittelbaren Einstieg ohne Organisation einer Gruppe.
- Die beobachteten NPC-Berichte erscheinen automatisch; deren Wahrheit und unterschiedliche Stationen sind lokal getestet.
- Tastaturaktionen und sichtbare Buttons sind parallel vorgesehen.
- Schonende Licht-/Bewegungseinstellung ist vorhanden.
- Die Tests decken unter anderem Mehrheitsentscheidung, Gleichstand, falsche Entscheidungen, Rettung eines Mitspielers, einen vollständigen simulierten Durchlauf und private Informationen in Snapshots ab.

## Empfohlene Reihenfolge

1. **Logik und Verständlichkeit:** Leerlauf-Sieg verhindern, deutsche Texte vervollständigen, Hilfe im Übungsmodus pausieren.
2. **Erste Minute verbessern:** geführte Untersuchung, sichtbarer Normalzustand, eindeutiger nächster Schritt und besserer Kamerastart.
3. **Atmosphäre und UI zusammen abstimmen:** kompakteres HUD, klare räumliche Soundereignisse, verständliche Flucht für alle Spieler.
4. **Abnahme mit Menschen:** neue Spieler ohne Erklärung beobachten; danach Vier-Spieler-Runden, Touch-Geräte, Voice, Reconnect und Hostwechsel prüfen.

Von drei möglichen Richtungen ist die Verbindung aus **klarem Einstieg und konzentrierter Horrorinszenierung** am sinnvollsten. Nur das HUD aufzuräumen wäre schneller, lässt aber die geringe Variation bestehen. Ein umfassender Horror-Neubau wäre deutlich aufwendiger und würde die bereits funktionierende Koop-Grundidee unnötig früh ersetzen.

Für diesen Auftrag wurden ausschließlich Prüfungen durchgeführt und dieser Report erstellt. Produktcode und Deployment wurden nicht verändert.
