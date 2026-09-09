# Uphill Delivery: NPC-Crew

Stand: 2026-09-08. Vom Nutzer mit „Okay, implementieren.“ freigegeben. Lobby, Netzwerk und kooperative NPC-Steuerung sind implementiert. Fünf vollständige autonome Lieferungen sind nachgewiesen; die Abnahme der vollständigen gemischten Crew-Matrix bleibt offen. Siehe [Validierungsbericht](../validation/2026-09-08-uphill-delivery-npcs.md).

## Ziel

Der Ersteller einer Lobby kann jeden freien Crewplatz einzeln mit einem NPC besetzen, alle freien Plätze auf einmal füllen und NPCs wieder entfernen. Menschen und NPCs liefern das Sofa gemeinsam über die bestehende Strecke aus. NPCs erkennen Aufgaben, stimmen sich ab, reagieren auf menschliche Bewegungen und bewältigen Fehler und Hindernisse mit den normalen Spielhandlungen.

Vier Crewplätze bleiben die Obergrenze. „Alle Slots“ bedeutet alle neben den anwesenden Menschen noch freien Plätze: Ein menschlicher Host kann mit bis zu drei NPCs spielen. Der Host wird nicht ersetzt. Eine reine Zuschauerrolle ist nicht Bestandteil dieser Änderung.

Ausgangspunkt für die Verhaltensabstimmung: NPCs planen aktiv mit und übernehmen bei Bedarf die Führung. Eine optionale Rückfrage dazu wurde gestellt. Bewegungen mittragender Menschen geben die gemeinsame Richtung vor; Sicherheit und erreichbare Wege begrenzen die Unterstützung.

## Bestehende Grundlagen und konkrete Lücken

Die Befunde stammen aus dem aktuellen Quellcode.

| Grundlage | Konsequenz für NPCs |
| --- | --- |
| `games/uphill-delivery/Game.tsx` zeigt die anwesende Crew und einen gemeinsamen Lobby-Startknopf. | Vier feste Platzkarten ergänzen den vorhandenen Ablauf; NPC-Verwaltung bleibt beim Host. Die bestehende englische Oberfläche wird beibehalten. |
| `types.ts` kennt bislang nur normale Spieler, Eingaben und sechs Spielaktionen. | NPC-Kennzeichnung, stabile Platzzuordnung, Aufgabenstatus und serialisierbarer Steuerzustand müssen ausdrücklich modelliert werden. |
| `connection.ts` erstellt Browser-Lobbys über WebRTC; `rooms.ts` betreut zusätzlich direkte HTTP-Räume. | Beide Wege benötigen dieselben Regeln für NPC-Belegung und dieselbe Simulation. Nur die HTTP-API zu ändern würde das normale Browser-Spiel verfehlen. |
| `shared/peer/coordinator.ts` zählt nur menschliche Mitglieder und vergibt darüber Farben/Plätze. | NPC-Plätze müssen bei der zentralen Vergabe mitgezählt werden; ein verschlüsselter Welt-Checkpoint allein kann Beitrittskonflikte nicht verhindern. |
| `shared/peer/engine.ts` entfernt bei jedem Abgleich Figuren ohne Netzwerkmitglied und setzt veraltete Eingaben auf Leerlauf. | Eine ausdrücklich optionale Adapter-Erweiterung muss simulationsgesteuerte Figuren erhalten und von menschlichem Verbindungsstatus unterscheiden. |
| HTTP-Räume entfernen Figuren nach 30 Sekunden ohne Lebenszeichen und wählen den ersten verbleibenden Spieler als Host. | NPCs brauchen keine Lebenszeichen, Mitgliedstoken oder Hostberechtigung. Hostnachfolge berücksichtigt ausschließlich Menschen. |
| `simulation.ts` baut beim Start/Neustart alle Figuren neu auf. | NPC-Kennzeichnung und Platzbelegung bleiben erhalten; Rundenziele und Bewegungszustand werden neu initialisiert. |
| `physics.ts` simuliert mit 60 Schritten pro Sekunde. Greifen, Kräfte, Kollisionen, Stolpern und Springen sind bereits vorhanden. | Die NPC-Steuerung erzeugt normale Eingaben und Aktionen vor dem jeweiligen Physikschritt. |
| Nur ein echter Einzelspieler erhält zusätzliche Tragekraft. Im Team tragen mindestens zwei Figuren. | Bots zählen als volle Crewmitglieder und nutzen dieselben Kräfte wie Menschen. Toraufgaben müssen die tatsächlich verbleibenden Träger berücksichtigen. |
| Die bestehenden Tests prüfen einzelne Streckenabschnitte teilweise aus vorbereiteten Positionen. | Sie beweisen noch keine vollständige autonome Lieferung vom Depot bis ins Kundenhaus. Dafür sind zusätzliche durchgehende Tests nötig. |

Andere Spiele dürfen nicht aus Uphill Delivery importiert werden. Vorhandene NPC-Muster in Blend Business sind lediglich eine Referenz für Kennzeichnung und Persistenz; die Steuerung bleibt in diesem Spiel.

## Wahl des Ansatzes

| Ansatz | Nutzen | Grenze |
| --- | --- | --- |
| **Gemeinsame Aufgabenplanung, Navigation und lokale Bewegungsregelung** | Rollen können wechseln; Sofa, Hindernisse und menschliche Eingaben fließen laufend in die Entscheidung ein. Zustand und Fehlerfälle sind gezielt prüfbar. | Erfordert echte Strecken- und Physiktests. **Empfehlung.** |
| Festes Ablaufen von Wegpunkten | Kleine erste Implementierung für eine unveränderte Strecke. | Reicht nach Stürzen, bei blockierten Griffen und beim gemeinsamen Drehen nicht als vollständige Steuerung. |
| Ein externes Sprachmodell entscheidet die Spielhandlungen | Könnte zusätzlich sprachliche Absprachen formulieren. | Würde eine weitere Dienstabhängigkeit einführen und ersetzt weder Navigation noch die Regelung der Tragephysik. Für diese Umsetzung nicht erforderlich. |

„Intelligent“ wird an erfolgreicher Zusammenarbeit und nachvollziehbaren Entscheidungen gemessen. Ein späterer menschlicher Spieltest bewertet, wie natürlich sich die Crew anfühlt; das lässt sich nicht allein durch Unit-Tests nachweisen.

## Lobby und Bedienung

- Die Lobby zeigt vier stabile Plätze mit Farbe, Name und Zustand: Mensch, NPC oder frei. NPCs tragen ein sichtbares `NPC`-Kennzeichen.
- Bei einem freien Platz sieht der Host `Add NPC`; an einem NPC-Platz `Remove NPC`. `Fill empty slots` besetzt alle aktuell freien Plätze in einem Vorgang.
- Ein belegter menschlicher Platz bietet keine Ersetzungsaktion. Gäste sehen die Belegung, können sie aber nicht ändern.
- Menschen treten freien Plätzen wie bisher per Einladung bei. Sind alle Plätze belegt, gibt die Lobby eine klare Vollmeldung zurück. Der Host kann vor dem Start einen NPC entfernen und dadurch einen Platz freigeben.
- Änderungen sind vor dem Start und nach abgeschlossener Lieferung möglich. Während der laufenden Lieferung bleibt die Besetzung fest; menschliches Verlassen wird weiterhin verarbeitet. Es erfolgt kein automatischer NPC-Ersatz bei Verbindungsabbruch.
- Der normale Neustart behält die Crew und startet erneut am Depot. Nach einer Lieferung bleiben die Platzkarten zum Umbesetzen verfügbar.
- Nur der betroffene Vorgang wird während einer Anfrage gesperrt. Die Anzeige bestätigt Belegung erst anhand des autoritativen Ergebnisses; bei Konflikten wird sie mit dem aktuellen Stand abgeglichen.
- Im Spiel zeigt die bestehende Crewleiste kurze Aufgaben wie `Carrying`, `Opening gate`, `Waiting for crew` oder `Recovering sofa`. Bedeutende Wechsel können eine sparsame Textmeldung auslösen. Mikrofon- und Sprecheranzeigen beziehen sich auf Menschen.
- Die zusätzlichen Platzkarten funktionieren mit Tastatur und Touch und dürfen in Hoch- oder Querformat keine Spielsteuerung überdecken.

## Zuständigkeit, Plätze und Netzwerk

### Gemeinsame Regeln

Die Platznummer liegt zwischen 0 und 3 und stimmt mit der bisherigen Farbzuordnung überein. Ein Platz hat höchstens einen Bewohner. Jede NPC-Instanz hat eine vom autoritativen Raum vergebene ID, Namen und Platznummer. Der Client darf keine Identität oder beliebige NPC-Anzahl erzeugen.

Eine kleine spielbezogene Belegungsfunktion validiert Hinzufügen, Entfernen und Auffüllen. Alle Operationen prüfen Host, erlaubte Phase, gültigen Platz und Kapazität. Request-IDs machen Wiederholungen idempotent. Entfernen adressiert zusätzlich die konkrete NPC-ID, sodass eine verspätete Anfrage keinen späteren Bewohner entfernt.

### WebRTC

Der zentrale Peer-Koordinator speichert NPC-Platzreservierungen samt Belegungsrevision getrennt von authentifizierten menschlichen Mitgliedern. Diese optionale Fähigkeit wird ausschließlich für Uphill Delivery aktiviert. NPCs gehören nicht zu `Member[]`, erhalten keine Token und nehmen weder an Signalisierung noch Hostwahl teil.

NPC-Verwaltung und menschlicher Beitritt aktualisieren denselben Raum über dessen bestehenden Compare-and-Swap-Mechanismus. Der Koordinator vergibt menschliche Plätze nur aus der um NPCs bereinigten freien Menge. Auffüllen und Beitritt können dadurch auch bei parallelen Anfragen nie einen fünften Bewohner erzeugen.

`PeerView` übermittelt die bestätigte Belegung und Revision. Die gemeinsame Verbindung reicht diese Metadaten an einen optionalen Adapter-Hook weiter. Der Uphill-Adapter gleicht menschliche Figuren und bestätigte NPCs ab. Andere Spiele ohne diesen Hook behalten ihr bisheriges Verhalten. NPCs entstehen nicht durch eine zweite, unabhängige Client-Spielaktion.

Start und Belegungsänderungen müssen dieselbe Ordnungsgrenze beachten: Der Host sperrt den Raum und gleicht die dabei bestätigte Belegungsrevision ab, bevor die Welt in die Spielphase wechselt. Verzögerte Checkpoints dürfen weder eine neuere Belegung überschreiben noch eine laufende Runde wieder für Änderungen öffnen. Diese Fälle sind Teil der Abnahme.

Nur der gewählte menschliche Host berechnet NPC-Entscheidungen in der gemeinsamen Simulation. Gäste erhalten Figurenpositionen und öffentliche Aufgaben mit dem normalen Snapshot. Beim Hostwechsel enthält der vorhandene verschlüsselte Checkpoint auch den NPC-Steuerzustand. Aktuelle Platzmetadaten entscheiden über Bewohner; der gespeicherte Zustand wird nur für dazu passende NPC-IDs übernommen.

### HTTP und Wiederaufnahme

Im HTTP-Raum werden die Belegung und Welt gemeinsam atomar gespeichert. NPCs sind vom menschlichen Timeout ausgenommen; gültige menschliche Mitgliedstoken bleiben Voraussetzung für externe Befehle. Hostnachfolge überspringt NPCs.

Fehlende NPC-Felder in bestehenden Räumen bedeuten eine rein menschliche Crew. Die gewohnten Speicher- und Einladungsformate bleiben lesbar. NPCs ohne menschliche Teilnehmer betreiben keine eigenständige Hintergrundrunde; ein verlassener Raum wird entsprechend seinem bestehenden Transport-Lebenszyklus pausiert beziehungsweise beendet.

## NPC-Steuerung

### Zustand und Ausführung

Der Weltzustand erhält eine versionierte, JSON-serialisierbare NPC-Struktur: gemeinsame Aufgabe, reservierte Griffe, zuständiger Interaktionshelfer, Routenabschnitt und pro NPC Rolle, Weg, Wiederholungsfrist, letzte Fortschrittsposition und reproduzierbarer Zufallszustand. Referenzen auf Physikobjekte bleiben außerhalb dieser Struktur.

Die Planung startet mit einem Intervall von 200 ms pro NPC, zeitlich versetzt. Bewegung wird in jedem vorhandenen Physikschritt aus dem aktuellen Körperzustand geregelt. Kritische Ereignisse wie Griffverlust oder ein nicht mehr tragfähiger Weg erzwingen eine Neubewertung. Das begrenzte Planungsbudget enthält keine Netzwerkaufrufe.

Der Controller liefert Bewegung, Sprung und zulässige Interaktionswünsche. Bewegung läuft über `DeliveryInput`; Greifen, Loslassen, Drehen und Öffnen nutzen dieselbe validierte Aktionslogik wie bei Menschen. Änderungen an Positionen, Geschwindigkeiten oder Türwinkeln als Abkürzung sind nicht zulässig. Die normale Aktionsimplementierung darf selbstverständlich ihre bestehenden physikalischen Impulse auslösen.

### Zusammenarbeit

1. **Sammeln und greifen:** Geeignete freie Griffe nach Erreichbarkeit und Abstand vergeben. Reservierungen verhindern, dass mehrere NPCs dieselbe Ecke verfolgen. Menschliche Griffe haben Vorrang; verlorene Reservierungen werden neu verteilt.
2. **Gemeinsam tragen:** Eine Formation um das tatsächliche Sofa bestimmen. Zielgeschwindigkeit und Position werden an Winkel, Griffspannung, Tragfähigkeit und Abstand der Crew angepasst. Bei fehlender Unterstützung anhalten oder sicher absetzen.
3. **Menschliche Richtung berücksichtigen:** Aktive Eingaben mittragender Menschen gewichten. Bei widersprüchlichen Eingaben abbremsen, statt drei Bots gegen einen Menschen ziehen zu lassen. Ein stillstehender Mensch mit Griff wird als Haltesignal behandelt. Sind Menschen nicht am Sofa, darf die NPC-Crew bei ausreichender Tragfähigkeit selbstständig weiterarbeiten.
4. **Drehen und Engstellen:** Sofaausdehnung und Platz für die Figuren berücksichtigen. Genau ein zuständiger NPC löst einen nötigen Drehimpuls aus; anschließend die reale Ausrichtung beobachten. Keine sich überlagernden Rotationsbefehle.
5. **Tor und Haustür:** Einen erreichbaren Helfer bestimmen, Tragefähigkeit prüfen, Ecke freigeben, außerhalb des Türschwenks heranlaufen, einmal öffnen, tatsächliche Öffnung abwarten und wieder zur Crew gehen. Bei nur zwei Trägern zunächst auf tragfähigem Boden absetzen. Eine bereits geöffnete Tür wird nicht versehentlich wieder geschlossen.
6. **Abgeben:** Das ganze Sofa ins Kundenhaus bringen, in einer geeigneten Position abbremsen und NPC-Griffe lösen. Hält ein Mensch weiter fest, auf dessen Loslassen warten. Es gilt ausschließlich die bestehende vollständige Innenraum- und Ruheprüfung.

### Wege und Hindernisse

Die vorhandene Route dient als grobe Orientierung. Begehbarkeit wird aus den tatsächlichen Straßen, Podesten, Brückenplanken, Treppen und Kollisionen abgeleitet. Höhen gehören zur Wegprüfung: Eine nahe Serpentine unterhalb der Figur ist kein direkt erreichbarer Nachbar.

Die Navigation unterscheidet freie Figuren von einer Crew mit Sofa. Letztere benötigt Platz für den gedrehten Sofakörper und erreichbare Standorte für alle Träger. Wand- und Kantenprüfungen begrenzen lokale Ausweichbewegungen.

- **Brücke:** Im begehbaren Korridor bleiben, Abstände verkleinern und Bewegungen auf die aktuelle Unterstützung abstimmen.
- **Gasse und Kurven:** Vorher passende Ausrichtung herstellen; bei Blockade Positionen und Griffverteilung ändern.
- **Ziegen:** Aktuelle sichtbare Position und Bewegung für kurzes Ausweichen oder Warten verwenden. Ein Zusammenstoß wird über die normale Stolperphysik verarbeitet.
- **Weglücke:** Ein eigener, an Tragflächen geprüfter Ablauf richtet das Sofa längs aus, positioniert es über der Lücke und lässt Figuren nur mit vorhandener Unterstützung beziehungsweise einem erreichbaren Sprungziel überqueren. Danach auf der Gegenseite neu greifen. Ohne tragfähige Auflage wird nicht blind weitergelaufen.
- **Eis:** Frühzeitig abbremsen, kleinere Richtungsänderungen und genügend Abstand zur Kante. Impuls und tatsächlicher Fortschritt bestimmen die nächsten Eingaben.

### Fehler und Erholung

Fortschritt wird an Bewegung zum Ziel und an tragfähigen Positionen gemessen. Nach etwa zwei Sekunden Blockade wird zunächst lokal neu positioniert; bei anhaltender Blockade werden Weg oder Griff neu vergeben. Zeitgrenzen werden anhand realer Tests abgestimmt und bleiben begrenzt, damit Aktionen nicht in jeder Simulation wiederholt werden.

Nach einem Sturz entscheidet der tatsächliche Standort von Sofa und Crew über den neuen Weg. Die zuletzt erreichte Höhe ist kein Wiederaufsetzpunkt. Bei einem gefallenen NPC prüfen die übrigen Träger, ob sie halten können oder sicher absetzen müssen. Eine unerreichbare Lage führt zu einem sichtbaren Hilfebedarf und ruhendem Verhalten statt endlosen Sprüngen oder automatischem Zurücksetzen.

Unterschiedliche stabile Präferenzen für Griffwahl, Reaktionszeit und Helferrollen vermeiden identische Bewegungen. Sie erzeugen keine absichtliche Sabotage und ersetzen keine funktionierende Grundsteuerung.

## Implementierungsgrenzen

| Bereich | Verantwortung |
| --- | --- |
| `games/uphill-delivery/types.ts` | NPC-Kennzeichnung, Belegung, Aufgaben- und Steuerzustand. |
| Neue spielinterne Module für Belegung, Navigation und NPC-Planung | Jeweils validierte Platzoperationen, Geometrie/Wege und Aufgaben/Eingaben; keine React- oder Netzwerkschnittstellen. |
| `simulation.ts`, `physics.ts` | Integration vor Physikschritten und kleine lesende Hilfsfunktionen für Unterstützung/Kollision; gleiche Kräfte und Aktionsregeln für alle Figuren. |
| `rooms.ts`, `peer.ts`, `connection.ts` | Anbindung beider Raumtypen, Wiederaufnahme und öffentliche Snapshots. |
| `shared/peer/types.ts`, `coordinator.ts`, `engine.ts`, `connection.ts` | Optionale Belegungsmetadaten und Adapter-Erweiterung, atomare Kapazitätsprüfung, Startreihenfolge und menschliche Autorität. Keine importierte Spielsimulation. |
| Lobby-Komponente und vorhandene Crew-Anzeige | Slotverwaltung, verständliche Statusanzeige, Tastatur und Touch. |

Die riskanteste Stelle ist die durchgehende Beförderung über Kurven und die Weglücke. Deshalb zuerst die reale Physiksteuerung durch diese Abschnitte nachweisen und anschließend die vollständige Runde prüfen. Eine fertige Lobby mit anschließend blockierten Bots erfüllt diesen Entwurf nicht.

## Abnahme

Die folgenden Punkte sind Anforderungen an die spätere Umsetzung, keine bereits bestandenen Ergebnisse.

1. **Platzverwaltung:** Einzelne gewählte Slots, Auffüllen, Entfernen, wiederholte Requests, volle Lobby, ungültige Plätze, Fremdbefehle und veraltete Host-Epochen. Gleichzeitiger Beitritt/Auffüllen sowie Start/Auffüllen erhalten maximal vier eindeutige Plätze.
2. **Lebenszyklus:** Zwei Menschen plus zwei NPCs überleben laufenden Mitgliederabgleich, Neustart, Serialisierung, Hostverlust und Wiederaufnahme. NPCs werden weder wegen fehlender Pings entfernt noch als Host oder Sprachchat-Mitglied geführt. Gefälschte externe NPC-Eingaben werden abgelehnt.
3. **Einzelne Mechaniken mit echter Physik:** Greifen, gemeinsames Tragen, menschlicher Stopp/Richtungswechsel, Kurve, Brücke, Gasse, Tor mit zwei und vier Crewmitgliedern, Weglücke, Eis, Ziege, Griffverlust, Sturz und nach außen öffnende Haustür. Neben Erfolg auch gültige Griffe, Kollisionen und ausbleibende Aktionsschleifen prüfen.
4. **Durchgehende Lieferung:** Vom normalen Depotstart ohne Versetzen von Figuren oder Sofa bis zur regulären `delivered`-Phase. Alle gemischten Besetzungen aus zwei bis vier Figuren mit reproduzierbaren menschlichen Steuerverläufen prüfen: 1+1, 1+2, 1+3, 2+1, 2+2 und 3+1 (Menschen+NPCs). Fünf festgelegte Varianten pro Besetzung berücksichtigen Bewegungsunterbrechungen und unterschiedliche Startzeiten der Hindernisse. Ergebnisse und benötigte Simulationszeit dokumentieren. Vorbereitete Einzelabschnitte ersetzen diesen Nachweis nicht.
5. **Eigeninitiative und Teamverhalten:** Drei NPCs organisieren eine Lieferung bei einem nicht mittragenden Menschen. Ein Mensch mit Griff kann die Crew stoppen; widersprüchliche menschliche Bewegungen erzeugen keinen dauerhaften Zugkampf. Ein NPC in einer Zweiercrew kann eine Toraufgabe nach sicherem Absetzen übernehmen.
6. **Netzwerk und Oberfläche:** Echter Browserablauf mit Host und Gast: Plätze verwalten, beitreten, starten, NPCs gemeinsam sehen und einen Hostwechsel durchlaufen. Zusätzlich HTTP-Integration und Touch-/Tastaturprüfung der Lobby durchführen.
7. **Leistung und Regression:** Planungszeit bei drei NPCs gesondert messen; Zielwert auf dem dokumentierten Prüfgerät ist weniger als 2 ms zusätzliche Arbeit pro Frame im 95. Perzentil. `npm run check`, die betroffenen Peer-/HTTP-Integrationen und beide bestehenden Produktionsbuilds ausführen. Geräteklasse, Durchlauf, Fehlschläge und verbleibende Grenzen in einem Validierungsbericht festhalten.

## Bearbeitungsstand

- [x] Bestehende Lobby, Physik, Strecke, Verbindungen und Tests untersucht.
- [x] Ansätze verglichen und einen vollständigen Entwurf formuliert.
- [x] Entwurf auf widersprüchliche Platz-, Host-, Physik- und Erfolgsregeln geprüft.
- [x] Entwurf durch den Nutzer zur Implementierung freigegeben; menschliche Tragebewegung hat Vorrang.
- [x] Umsetzungsplan erstellt, Lobby und Netzwerk integriert, kooperative Steuerung implementiert.
- [x] Ausgeführte Abnahmeszenarien und Fehlschläge dokumentiert.
- [x] Fünf vollständige autonome Depotstarts mit drei NPCs über die reguläre Lieferung abschließen; Messberichte abgelegt.
- [ ] Sämtliche Abnahmeszenarien einschließlich der vollständigen gemischten Crew-Matrix bestehen.
