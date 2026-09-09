# Permit Pending: vollständige Touch-Steuerung

Stand: 8. September 2026. Mit „Okay, dann bitte jetzt umsetzen“ freigegeben und unter `games/chaos` für `/chaos` umgesetzt. Ergebnisse und verbleibende Geräteprüfungen stehen im [Umsetzungs- und Prüfbericht](../validation/2026-09-08-permit-pending-mobile-touch.md). Die folgenden Ausgangsbefunde beschreiben den Stand vor der Umsetzung.

## Ziel und Rahmen

Auf dem Handy soll jede für den eigenen Spielzustand erlaubte Desktop-Aktion mit Touch erreichbar und verständlich sein. Zwei Daumen müssen gleichzeitig bewegen und handeln können. Aufheben, Benutzen, Ablegen, Werfen und Entfernen haben jeweils eine eindeutige Bedeutung. Kamera- und Positionierungsgesten dürfen keine dieser Aktionen versehentlich auslösen.

Umsetzungsentscheidung: Hoch- und Querformat werden unterstützt; kompakte Fenster und Geräte mit Touch plus Maus werden berücksichtigt. Dokument und Erläuterungen sind auf Deutsch; die Spieloberfläche verwendet weiterhin Englisch. Eine komplette Übersetzung ist kein Teil dieser Änderung.

## Was bereits vorhanden ist und wo es hakt

Die Befunde stammen aus einer Codeprüfung, nicht aus einem Handy-Spieltest.

| Befund | Auswirkung auf die Bedienung |
| --- | --- |
| `TouchControls.tsx` bietet einen Joystick und Springen; `touch.ts` unterscheidet Tap, Ziehen und zwei Finger. | Eine funktionierende Grundlage ist vorhanden. Es geht um vollständige Aktionsabläufe und ihre klare Zuordnung. |
| Der mobile Hauptknopf in `Game.tsx` wählt bei benutzbaren Möbeln automatisch `use` statt `grab`. Aufheben liegt dann zusätzlich unter „More“. | Dasselbe Objekt lässt sich über unterschiedliche Wege unterschiedlich behandeln; die Auswahl zwischen Aufheben und Benutzen ist schwer erkennbar. |
| Ein Objekt-Tap startet im freien Spiel sofort das Hinlaufen und Aufheben. | Ein Tap zum Erkunden oder Ausrichten kann bereits eine Spielaktion starten. |
| In `scene.ts`, `tap()`, kann ein weiterer Tap bei bereiter Bauvorschau `place-touch` auslösen. Der Platzieren-Knopf existiert zusätzlich. | Ein Tap zum Wechseln des Bauziels kann die bisherige Vorschau bestätigen. |
| `interaction-status` wird nur außerhalb der kompakten Ansicht gerendert; `context-hint` ist mobil ausgeblendet. | Objektname, Tragezustand und Handlungshinweise fehlen gerade auf kleinen Displays. |
| Die Bewegung in `scene.ts` aktiviert Sprint ausschließlich über Shift. | Für diese Desktop-Funktion fehlt eine direkte Touch-Entsprechung. |
| In der Ego-Ansicht löscht `onPointerUp` den Blickkontakt auch bei einem fremden `pointerId`; der Cancel-Pfad löscht ihn ebenfalls pauschal. | Das Loslassen des Joysticks kann eine laufende Blickgeste beenden. Dieser konkrete Mehrfinger-Fall benötigt einen Regressionstest. |
| Normale Bewegung wird relativ zur Kamera umgerechnet; Touch-Eingaben für Crew-Lasten gehen bisher direkt als Weltachsen weiter. | Nach einer Kameradrehung kann dieselbe Joystickbewegung bei einer Lieferung anders wirken. |
| `compact` steuert sowohl das Layout als auch `scene.touchMode`. | Fenstergröße und tatsächliche Eingabeart sind vermischt, besonders bei kleinen Desktop-Fenstern und Tablets mit Maus. |
| Mobile Regeln verteilen sich über `mobile.css`, `mobile-play.css` und `game.css`; Bauhöhe wird mehrfach überschrieben. | Zusätzliche Etagen-, Bau- und Trageleisten müssen gemeinsam angeordnet werden, damit nichts überdeckt wird. |

Quellen im Projekt: [Game.tsx](../../../games/chaos/Game.tsx), [scene.ts](../../../games/chaos/scene.ts), [TouchControls.tsx](../../../games/chaos/TouchControls.tsx), [touch.ts](../../../games/chaos/touch.ts), [PartyPanel.tsx](../../../games/chaos/PartyPanel.tsx), [mobile-play.css](../../../games/chaos/mobile-play.css).

## Wahl des Interaktionsmodells

| Ansatz | Vorteil | Nachteil / Entscheidung |
| --- | --- | --- |
| **Zwei Daumen, feste Aktionsplätze, Antippen wählt ein Ziel** | Bewegung und Aktion sind gleichzeitig möglich; häufige Aktionen bleiben sichtbar; Vorschauen können ohne Zeitdruck korrigiert werden. | Bei einem ausdrücklich ausgewählten entfernten Objekt kommt ein Aktions-Tap hinzu. **Empfehlung.** In Reichweite genügt weiterhin ein Tap auf „Pick up“. |
| Antippen führt möglichst sofort aus | Wenige Schritte beim Holen und Bauen. | Kollidiert mit Kamera, Zielauswahl und mehreren möglichen Objektaktionen. Die heutigen Unklarheiten bleiben. |
| Halten, Wischen und Radialmenüs für fast alles | Viel freie Spielfläche. | Funktionen sind schlecht auffindbar und fehleranfällig beim Mehrfinger-Spiel. Als primäre Steuerung ungeeignet. |

Die Empfehlung braucht für normale Aktionen keine zusätzlichen Bestätigungsdialoge. Die sichtbaren Knöpfe führen aus; die Welt dient zum Auswählen, Ausrichten und Bewegen.

## Vollständige Zuordnung der Aktionen

| Desktop / Funktion | Touch-Ablauf | Rückmeldung und Grenzen |
| --- | --- | --- |
| WASD / Pfeiltasten: laufen | Linker Joystick; in der Übersicht alternativ freien Boden antippen, um dorthin zu laufen. | Bewegungsrichtung relativ zur sichtbaren Kamera. Loslassen stoppt manuelles Laufen. Joystickbewegung bricht einen automatischen Weg ab. |
| Shift: sprinten | Joystick bewusst in den markierten äußeren „Sprint“-Ring ziehen. | Startwerte: Eintritt bei 90 % Auslenkung, Rückkehr zum Gehen unter 80 %. Dazwischen bleibt der Zustand stabil. Die bisherige maximale Lauf-/Sprintgeschwindigkeit und Gewichtsverlangsamung gelten. Bei Crew-Aufgaben ist der Sprint-Ring inaktiv. |
| Leertaste: springen | Fester „Jump“-Knopf rechts. | Sofortige Reaktion bei Berührungsbeginn, genau einmal pro Kontakt. Rollen und Spielphasen sperren Springen wie auf Desktop. |
| Maus / Rechtsziehen: Kamera | Ein Finger zieht über freie Spielfläche; in Ego-Sicht horizontal und vertikal schauen. | Kamera-Geste wählt, holt oder platziert nichts. Joystick und HUD gehören nicht zur Kamerafläche. |
| Mausrad / Kamera verschieben | Zwei Finger auf der Spielfläche: Zoom und Verschieben in der Übersicht. „View“ bietet zusätzlich antippbare Dreh-, Verschiebe-, Zoom- und Zentrierknöpfe. | Beide Finger müssen auf der Spielfläche begonnen haben. Die Kamera-Knöpfe bieten eine Alternative zu Mehrfinger-Gesten. |
| Objekt anklicken / E: aufheben | In der Übersicht Objekt antippen und „Pick up“ drücken; in Ego-Sicht mit dem Fadenkreuz auswählen. Bei einem bereits hervorgehobenen nahen Objekt genügt „Pick up“. Für ein entferntes ausgewähltes Objekt heißt die Aktion „Fetch“. | Zielname und Umriss bleiben sichtbar. „Fetch“ läuft zum gewählten Objekt und hebt genau dieses auf. Joystick oder „Stop“ bricht den Weg ab. |
| X: Gegenstand benutzen | Bei einem benutzbaren Ziel zusätzlich „Use“; die Statuszeile erklärt z. B. „Play the piano“. | „Pick up“ bleibt separat erreichbar. Distanz, Belegung und laufende Objektanimationen liefern konkrete Gründe für eine Sperre. Bei einem entfernten Objekt wird nach bewusstem „Use“ herangelaufen. |
| E beim Tragen: ablegen | Sichtbare Ablagevorschau vor der Figur; „Put down“ befestigt das Objekt dort. | Vorschau verwendet dieselbe Raster-, Etagen-, Rotations- und Kollisionslogik wie die Spielregeln. Bei ungültiger Ablage bleibt das Objekt in der Hand. |
| Maus ausrichten / F: werfen | Beim Tragen Boden antippen, Wurfrichtung prüfen, „Throw“ drücken. In Ego-Sicht mit dem Blick ausrichten. | Wurfbogen kennzeichnet die Richtung; nur „Throw“ löst aus. Feste bestehende Wurfstärke. Weder Kamerawischen noch Fingerloslassen wirft. |
| B: Baukasten | „Build“ öffnet einen scrollbaren Baukasten. Bauteil, Oberfläche und Farbe wählen, dann „Build with …“. | Der Baukasten schließt zur Positionierung. Das gewählte Teil bleibt als kompakte Schaltfläche sichtbar. |
| Ziffern 1–9: Bauteil wählen | Bauteilkarten antippen; alle vorhandenen Kategorien und Teile bleiben verfügbar. | Gewähltes Teil, Name und Variante sichtbar. Keine Tastenkürzel als Touch-Anweisung. |
| Klick / Enter: bauen | Bauort antippen, Vorschau prüfen und mit „Place“ bestätigen. Weitere Welt-Taps setzen die Vorschau um. | Eine Vorschau kann nie durch einen weiteren Welt-Tap fest eingebaut werden. Wenn nötig läuft die Figur nach „Place“ erst zum Bauort. |
| R: Teil drehen | „Rotate“ dreht die Bau- bzw. Dachvorschau um 90°. | Winkel und belegte Fläche aktualisieren sich sofort. Beim Ablegen getragener Objekte bestimmt weiterhin die Ausrichtung der Figur die Einrastrotation. |
| Etage wählen / Treppen bauen | Etagenwahl im kompakten Baubereich; während der Positionierung dauerhaft sichtbar. | Vorschau und Validierung beziehen sich auf dieselbe Etage. Wechsel verwirft die bisherige Positionsfreigabe; ein passender neuer Bauort ist nötig. |
| Bestehende Teile streichen | „Build“ → Farbe/Oberfläche → „Paint existing parts“; Objekt auswählen, Vorschau, „Paint“. | „Alle Hauswände“ ist ein sichtbar eigener Umfang. Bestätigung benennt die betroffene Gruppe, z. B. „Paint 12 walls“. |
| Delete / Abbauwerkzeug | „More“ → „Remove parts“; Teil wählen, roter Umriss, „Remove“. | Entfernt ein Bauteil. Hat eine andere Beschriftung und ein anderes Symbol als Werfen. Tragende, belegte oder gesperrte Teile erklären ihre Sperre. |
| C: Dachkran | „More“ → „Roof crane“ oder Dach im Baukasten wählen; Dach auswählen, „Lift“, Ziel wählen, „Rotate“ und „Place roof“. | Eigener Kranmodus mit sichtbaren Phasen; „Return roof“ bricht die Arbeit ab und gibt die Last zurück. |
| V / Ansicht wechseln | „View“ → „Overhead“ oder „First person“. | Auswahl und Tragezustand bleiben erhalten. Der Dachkran verwendet die Übersicht und kehrt danach zur vorherigen Ansicht zurück. |
| Q: Ausruf | „More“ → „Shout an excuse“. | Gleiche Spielaktion und Audio-Rückmeldung wie bisher. |
| Escape: Vorgang verlassen | Sichtbares „Cancel“ bzw. Schließen-Kreuz im aktuellen Werkzeug oder Fenster; allgemeines Menü über den Kopfbereich. | Ein klarer Schritt zurück: Auswahl → Werkzeug → Spiel. Rückkehr wirft nichts und entfernt nichts. |
| Crew-Rolle übernehmen | Auftragskarte oder markierten Griff auswählen, dann die konkret benannte Rolle antippen. | Figur läuft zum Griff; belegte Rollen zeigen den Spielernamen. Nach Zuweisung erscheint automatisch die Rollensteuerung. |
| Crew bewegen / Q und R drehen | Derselbe linke Joystick steuert die Last; rechte Haltknöpfe „Turn left“ / „Turn right“. | Touch wird auch hier relativ zur Kamera in Weltbewegung umgerechnet. Balance, Partnerstatus und die eigene Rolle bleiben sichtbar. |
| Crew liefern / loslassen | Eigene Knöpfe „Deliver“ und „Release role“. | Partnerbestätigung sichtbar als „1/2 ready“, sofern die Spielregel zwei Stimmen verlangt. „Release role“ ist kein Objektwurf. |
| Leiter halten / klettern | Halter sieht „Holding ladder“; Kletterer hält „Climb & fit“. | Fortschritt sichtbar; Loslassen oder Unterbrechung beendet das Arbeitssignal. Die Halterrolle bekommt keinen nutzlosen Bewegungsjoystick. |
| Spezielle Lieferaktionen | „Collect bag“, „Recover delivery“, „Steady sofa“ und „Fix pipe“ erscheinen passend zur Aufgabe. | Zeitkritische Aktionen sind aus dem Spiel erreichbar; sie liegen nicht ausschließlich in einer verdeckten Detailkarte. |
| Inspektion / Build & Swap | Auftragskarte zeigt Prüfungen, Team, Phase und Timer; berechtigte Aktionen wie „Call customer“, „Skip“ oder Ersatzspielerzuweisung sind antippbar. | Bestehende Host-, Team-, Phasen- und Reparaturregeln bleiben maßgeblich. Eine gesperrte Bauphase bietet kein ausführbares „Place“. |
| Sprache / Push-to-talk / Funk | Sichtbarer Mikrofonstatus; „Hold to talk“ und ggf. „Site radio“ auch bei geschlossener Detailansicht erreichbar. | Eigenständige Kontakte für Sprechen/Funk. Loslassen, Abbruch und Hintergrund beenden das jeweilige Haltesignal. Offenes Mikrofon folgt weiter der gewählten Einstellung. |
| Einladen / Raum / Bereitschaft / Einstellungen | Crew- und Menüfenster mit Raumcode, Teilen, „Ready“, Start und Einstellungen. | Alle Desktop-Optionen bleiben erreichbar. Tastatur darf das aktive Textfeld oder den nächsten Knopf nicht verdecken. |
| Speichern / Laden / Remixen / Projekte | Vorhandene Bau-Sammlung und Projekte über „More“ bzw. Crew-Details. | Formulare, Bauliste, gespeicherte Bauwerke und Challenge-Links funktionieren per Touch. |
| Foto / Clip / Highlights / Teilen | „More“ → „Photos & clips“ mit den vorhandenen Aufnahme- und Exportoptionen. | Aufnahmezustand während des Spiels sichtbar; Freigaben und bestehende Download-/Teilen-Fallbacks bleiben erhalten. Abbruch des Systemdialogs ist kein Spielfehler. |
| Neustart / nächste Runde / verlassen | Vorhandene Ergebnis- und Menüaktionen mit eindeutigen Labels. | Bestehende Berechtigungen und Bestätigungen für das Zurücksetzen bzw. Verlassen gelten weiterhin. |

## Aufheben, Tragen und Werfen im Detail

**Zielauswahl:** Ein Objekt-Tap markiert ein Ziel, führt jedoch keine Objektaktion aus. Ohne explizite Auswahl kann das Spiel ein erreichbares Objekt hervorheben. Ein ausdrücklich gewähltes Ziel hat Vorrang vor einem zufällig näheren Gegenstand. Bei überlappenden Objekten erlaubt „Next target“ das Wechseln zwischen sichtbaren Treffern. Ein verbreitertes Auswahlgebiet hilft bei kleinen Objekten, ohne Wände oder andere Sichtbarrieren zu umgehen.

In der Ego-Ansicht übernimmt das Fadenkreuz die Zielauswahl. „Pick up“ und „Use“ beziehen sich auf genau den sichtbaren Treffer darunter. Eine Berührung an anderer Bildschirmposition ist keine zweite, abweichende Zielquelle. Der Wechsel zwischen überlappenden Treffern gilt nur für die Übersicht; in Ego-Sicht bleibt die erste sichtbare Oberfläche maßgeblich.

**Aufheben:** Der Aktionsbereich zeigt Objektname und „Pick up“, bei größerer Distanz „Fetch“. Während des Heranlaufens lautet die Statuszeile etwa „Walking to sofa …“ und bietet „Stop“. Verschwindet das Ziel, trägt es inzwischen jemand anderes oder ist der Weg nicht erreichbar, endet der Auftrag mit einer konkreten Rückmeldung. Es wird nicht automatisch ein Ersatzobjekt geholt.

**Tragen:** Die Hauptaktion wechselt zu „Put down“; daneben erscheint „Throw“. Beide bleiben an festen Stellen. Der kleine Objektname über den Knöpfen macht den Tragezustand deutlich. „Use“ und der normale Bauvorgang stehen mit vollen Händen nicht zur Verfügung. Der Hinweis erklärt „Put it down to build“.

**Ausrichten in der Übersicht:** Vor einem bewussten Ziel-Tap folgt die Tragerichtung der Bewegung. Ein Boden-Tap setzt eine feste Wurfrichtung; weiteres Laufen überschreibt diese Richtung während desselben Tragevorgangs nicht. Die Figur kann damit weiterlaufen und gezielt werfen. Ein neuer Boden-Tap setzt die Richtung neu. Nach Ablegen oder Werfen wird die Fixierung gelöscht. Der Bogen wandert mit der Figur und beschreibt die Richtung, keinen garantierten Landepunkt. Kamera-Drehungen verändern die gewählte Weltrichtung nicht. In Ego-Sicht bleibt die Blickrichtung maßgeblich.

**Ablegen:** Eine kompakte, zum Bauteil passende Bodenfläche zeigt den tatsächlichen Einrastplatz vor der Figur. Gültig: Haken und Umriss. Ungültig: Sperrsymbol und z. B. „No room here“ oder „Someone is standing here“. Wurfbogen und Ablagefläche sind verschieden gezeichnet. Die Vorschau darf keine andere Position versprechen als die serverseitige Ablageberechnung.

**Werfen:** Ein einzelner Tap auf „Throw“ wirft in die angezeigte Richtung. Kein Aufladen, kein Wischen als Pflichtgeste, keine zusätzliche Kraftmechanik. Das Aktionsziel wird beim Berührungsbeginn festgehalten; wird das Objekt zwischenzeitlich freigegeben oder die Rolle gewechselt, verfällt dieser Tap. Solange die Antwort aussteht, ist kein zweiter Wurf möglich.

Beim gültigen Auslösen wird die aktuelle Zielrichtung zusammen mit der Aktionsposition übernommen. Eine später bewegte Kamera oder eine Warteschlange darf diesen bereits ausgelösten Wurf nicht nachträglich umrichten.

## Bildschirmaufteilung

Die Baustelle bleibt die zentrale Fläche. Der bestehende Baustellenstil wird weitergeführt: Papier `#f8faf4`, Tinte `#293c3b`, Helmgelb `#ffc83d`, Grün `#628775`, Rand `#d4dece`, Warnrot `#a32925`. Fredoka bleibt für kurze Überschriften, DM Sans für Knöpfe und Hinweise; Timer verwenden tabellarische Ziffern.

Das charakteristische Element ist eine kleine Werkzeugkarte über dem rechten Daumenbereich: Objekt oder Werkzeug, aktueller Zustand, eine kurze Erklärung. Sie wirkt wie ein beschrifteter Baustellenzettel und beantwortet unmittelbar „Was habe ich ausgewählt, und was passiert als Nächstes?“ Keine dauernden großen Hilfe- oder Inventarkarten über dem Haus.

### Hochformat, normales Tragen

```text
┌──────────────────────────────────────┐
│ Auftrag · Zeit       Crew/Mikro  Menü │
│                                      │
│                                      │
│        FREIE BAUSTELLE                │
│     Figur, Ziel, Wurfrichtung         │
│                                      │
│                        Sofa · tragen │
│                          [Springen]  │
│  Sprint-Ring               [Werfen]   │
│   (Joystick)              [Ablegen]  │
│       [Bauen] [Ansicht] [Mehr]        │
└────────── System-Sicherheitsraum ─────┘
```

### Querformat

```text
┌──────────────────────────────────────────────────────────┐
│ Auftrag · Zeit                           Crew/Mikro  Menü │
│                                                          │
│                 FREIE BAUSTELLE               Objektname │
│                                              [Springen] │
│  Sprint-Ring                                  [Werfen]  │
│   (Joystick)       [Bauen] [Ansicht] [Mehr]     [Ablegen]  │
└────────────────── System-Sicherheitsraum ─────────────────┘
```

Schematische Anordnung, keine maßstäbliche Darstellung. Die rechte Zone reserviert dauerhaft Plätze für Hauptaktion, Nebenaktion und Springen. Nicht verfügbare Plätze werden ruhig bzw. inaktiv, statt andere Knöpfe unter den Finger nachrücken zu lassen. „Use“ und „Throw“ teilen sich den Nebenaktionsplatz in klar verschiedenen Zuständen. Im Bauen lautet die Hauptaktion „Place“, die Nebenaktion „Rotate“.

Bei einer Crew-Lieferung stehen beide Drehrichtungen nebeneinander in der Nebenaktionszeile; „Deliver“ ist die Hauptaktion, „Release role“ steht getrennt in der Rollenkarte. Bei einem Rollen- oder Werkzeugwechsel werden laufende Aktionskontakte vor dem Wechsel der Anordnung beendet. Längere Objektaktionen stehen ausgeschrieben in der Werkzeugkarte; der Knopf kann dadurch kurz und stabil „Use“ heißen.

Normale Knöpfe und Schließen-Flächen mindestens 48 × 48 CSS-Pixel, die Hauptaktion mindestens 64 Pixel hoch, Joystick 96 Pixel im Hochformat bzw. 88 Pixel bei niedriger Bildschirmhöhe; mindestens 8 Pixel Abstand zwischen Aktionsflächen. Das sind Entwurfswerte. Die W3C-Empfehlung für große Ziele beschreibt 44 × 44 CSS-Pixel; häufige Spielaktionen erhalten hier zusätzlich Platz. [W3C: Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html)

Im Normalbetrieb bleiben an den Referenzgrößen 360 × 640 und 844 × 390 mindestens 50 % der sichtbaren Höhe in der Bildschirmmitte als zusammenhängender Spielbereich frei. Safe Areas und Browserleisten zählen zur verfügbaren Höhe; HUD und Kamera berücksichtigen den tatsächlich freien Ausschnitt. Kleine Bildschirme reduzieren Nebentexte, nicht die Trefferflächen. Ein 320 × 568 großes Layout bleibt ohne horizontales Scrollen bedienbar.

Baukasten und lange Details öffnen als scrollbares Fenster von unten, bei niedriger Querformat-Höhe als großes eigenes Fenster mit festem Schließen-Knopf. Während der Auswahl sind Spielkontakte gesperrt. Nach Schließen oder „Build with …“ ist die Welt wieder direkt bedienbar. Es ist immer nur ein solches Fenster aktiv.

## Bauen, Streichen, Entfernen und Kran

Beim Bauen ist die Reihenfolge fest: **Teil wählen → Bauort wählen → korrigieren → Place**. Ein Griff an der Vorschau vergrößert ihre Touch-Fläche auf mindestens 56 × 56 Pixel. Ziehen startet nur an diesem Griff bzw. der Vorschau, mit relativem Versatz zur Ausgangsposition; das Teil springt nicht unter den Finger. Der Griff sitzt unterhalb des Modells, damit der Finger den Einrastpunkt nicht verdeckt. Ziehen außerhalb dieser Fläche steuert die Kamera.

Ein Boden-Tap setzt den Bauort auch ohne Ziehen. Drehknopf, Etagenwahl und Kamera-Knöpfe sind antippbar. Damit bleibt die Präzision nicht an eine Drag-Geste gebunden. [W3C: Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)

Zwei Spielflächen-Finger übernehmen die Kamera, auch wenn zuvor die Bauvorschau gezogen wurde. Die letzte Vorschauposition bleibt erhalten. Beim Loslassen passiert keine Bauaktion. Einrasten, fehlende Unterstützung, belegte Fläche und automatische Anfahrt werden mit Symbol und kurzen Worten erklärt; Farbe allein reicht nicht. Ein gültiger, weiter entfernter Bauort darf mit „Place“ beauftragt werden; die Figur läuft dorthin. Ist kein Weg möglich, bleibt die Vorschau mit einer Erklärung stehen.

Streichen und Entfernen verwenden dieselbe Auswahl-/Vorschau-/Aktionsfolge. Einzelfärbung und gesamtes Haus erhalten klar benannten Umfang. Beim Verlassen eines Werkzeugs wird nur die unbestätigte Vorschau gelöscht. Ein erfolgreich gebautes Teil erfordert eine neue ausdrückliche Bestätigung für den nächsten Bau; schnelles Doppeltippen legt keine zwei Teile aufeinander.

Der **Dachkran** ist von der **Crew-Kranlieferung** getrennt. Dachkran-Zustände: Dach wählen, „Lift“, Seil fährt, Last gesichert, Hausposition wählen, „Place roof“, Dach wird eingesetzt. Fortschritt und Bediener sind sichtbar. Während der Fahrt bleiben unzulässige Aktionen gesperrt. Bei ungültiger Position bleibt die Last am Haken. „Return roof“ gibt sie über die bestehende Kranregel zurück; ein Fehler dabei darf nicht durch bloßes Schließen der Oberfläche verdeckt werden.

## Zustände und Mehrspieler-Verhalten

| Zustand | Sichtbare Haupt-/Nebenaktion | Wesentliche Regel |
| --- | --- | --- |
| Hände frei, kein Ziel | „Pick up“ inaktiv; kurzer Auswahlhinweis | Kein zweckloser Knopf, der nur eine Fehlermeldung erzeugt. |
| Ziel ausgewählt | „Pick up“ / „Fetch“, optional „Use“ | Name, verfügbare Aktionen und tatsächliches Ziel stammen aus derselben Zielbeschreibung. |
| Automatisch unterwegs | „Stop“ im Statusbereich | Derselbe Auftrag wird nur einmal ausgeführt; manuelle Bewegung bricht ihn ab. |
| Objekt getragen | „Put down“, „Throw“ | Vorschau und Objektname sichtbar; Hände bleiben bei fehlgeschlagener Aktion belegt. |
| Bauvorschau | „Place“, „Rotate“ | „Place“ wartet auf gültigen Bauort; für die Anfahrt muss die Figur noch nicht in Reichweite stehen. |
| Malen / Entfernen | „Paint“ / „Remove“, „Cancel“ | Nur das ausgewählte Ziel bzw. der ausdrücklich gewählte Umfang wird verändert. |
| Dachkran | „Lift“ bzw. „Place roof“, „Rotate“, „Return roof“ | Richtet sich nach der bestätigten Kranphase und dem Bediener. |
| Crew-Rolle | Rollenspezifische Last-, Leiter- oder Lieferaktionen | Sprint und normales Aufheben, Bauen oder Werfen verschwinden; Rollenwechsel setzt alte Eingaben zurück. |
| Fenster offen | Fensteraktionen | Bewegung, Drehen, Arbeits-Halten und PTT-Kontakte stoppen. Besitz bzw. Rolle bleiben entsprechend den Spielregeln erhalten. Die Mehrspielerrunde läuft weiter, wenn der Server keine Pause meldet. |
| Verbindung unklar | Verbindungsstatus | Keine neuen Bau-, Greif- oder Wurfbefehle. Nach Wiederverbindung Besitz, Phase und Ziel neu prüfen; alte Berührungen werden nicht nachgeholt. |
| Inspektion / Ergebnisse / Lobby | Passende Phasenaktionen | Kein ausführbares Werkzeug aus einer vorherigen Phase. |

Bei Crew-Lieferungen bleiben Partnerstatus und Balance im Spiel sichtbar. Beim Sofa/Glas stimmen beide Träger entsprechend der bestehenden Regel der Ablieferung zu. Beim Crew-Kran bewegt der Bediener die Last, der Einweiser bestätigt die Ablieferung; der Solo-Helfer folgt den vorhandenen Sonderregeln. Bei Leiter und Schubkarre bleiben ebenso alle bestehenden Rollen erhalten.

Sammeln, Bergen, Reparieren und Stabilisieren werden als konkret benannte Zusatzaktion angezeigt, sobald sie für die eigene Rolle zulässig sind. Muss man dafür die Tragerolle verlassen, lautet der Hinweis entsprechend; die Oberfläche gibt die Rolle nicht heimlich frei. Geheimaufträge bleiben privat und dürfen weder durch einen neuen HUD-Hinweis noch durch einen Clip-Export offengelegt werden.

## Eingabevertrag und robuste Unterbrechungen

1. **Kontakt gehört genau einem Bereich:** Joystick, Aktion, Kamerafläche, Baugriff oder Haltefunktion. Jeder Bereich verfolgt seinen `pointerId`. Ein fremdes Loslassen beendet keinen anderen Kontakt. Pointer Capture und Abbruchereignisse gehören zum selben Kontakt. [MDN: Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)
2. **Ein Tap führt höchstens eine Aktion aus:** normale Aktionen bei gültigem Loslassen, Sprung bei Berührungsbeginn. Kein zusätzlicher synthetischer Klick auf die Spielfläche. Aktion und Ziel werden beim Beginn festgehalten; eine inzwischen andere Beschriftung darf keinen neuen Befehl auslösen.
3. **Geste und Aktion bleiben getrennt:** Bewegung über den bestehenden 8-Pixel-Schwellwert ist kein Tap. Lange Kontakte und Kontakte, die Teil einer Mehrfinger-Geste waren, führen beim Loslassen nichts aus. Ein zweiter Spielflächen-Finger kann eine Baukorrektur in Kamerasteuerung überführen, niemals in Bestätigung.
4. **Browserunterbrechung ist kein Loslassen zum Ausführen:** `pointercancel`, verlorener Fokus, Verlassen der Seite und Hintergrund setzen betroffene Eingaben zurück. Für den Joystick bleibt der vorhandene getestete Fenster-Fallback bei Capture-Verlust erhalten; er endet beim tatsächlichen Loslassen oder globalen Abbruch. [MDN: touch-action und pointercancel](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action)
5. **Größenänderung ist keine neue Eingabe:** Browserleisten und Neulayout initialisieren einen gehaltenen Joystick nicht neu. Kontaktanker bleiben stabil. Ein tatsächlicher vom Browser gemeldeter Kontaktabbruch stoppt ihn. Werkzeugvorschauen bleiben bei einem reinen Formatwechsel in Weltkoordinaten erhalten und werden erneut geprüft.
6. **Fenster und Spiel überlappen funktional nicht:** Jeder Auftrag, den ein Fensterknopf startet, schließt zuerst das betreffende Fenster und startet danach die Anfahrt. Dadurch wird z. B. „Fix pipe“ nicht durch eine weiterhin pausierte Szene blockiert. Schließen eines Fensters reaktiviert keine alten Haltesignale.
7. **Browserbedienung bleibt erhalten:** `touch-action: none` nur auf der Spielfläche und echten Gesten-/Halteflächen. Scrollbare Fenster und Formulare behalten Scrollen und Browserzoom. Kein globales `user-scalable=no`. [MDN: touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action)
8. **Eingabeart und Platzbedarf trennen:** Kompaktes Layout folgt dem Viewport; Touch-Verhalten folgt der tatsächlichen Eingabeart. Ein kleines Mausfenster behält Desktop-Eingabesemantik. Beim Wechsel zwischen Maus, Touch und Tastatur werden nur Hinweise und notwendige Eingabeadapter angepasst, nicht Objektbesitz oder Spielmodus.

## Umsetzungsschnitt und vorhandene Regeln

Der Entwurf bleibt auf Permit Pending begrenzt. Er braucht keine neue Physik oder zweite Spielregel-Implementierung.

| Baustein | Verantwortung / Anschluss |
| --- | --- |
| Neue lokale Aktionsbeschreibung, etwa `mobile-actions.ts` | Ermittelt aus Snapshot, Spieler, ausgewähltem Ziel und Werkzeug die erlaubten Aktionen, Texte und Sperrgründe. Keine Netzwerkanfragen und keine direkte Szenenmutation. |
| Kompakte HUD-Komponente, etwa `MobileActionHud.tsx` | Rendert feste Aktionsplätze, Zielkarte, Trage- und Baustatus. Verwendet die Aktionsbeschreibung statt unabhängiger Entscheidungen in mehreren Knöpfen. |
| `TouchControls.tsx`, `touch.ts`, `scene.ts` | Kontaktzuordnung, Sprint-Eingabe, Zielauswahl, Kameragesten, Baugriff und getrennte Tragerichtung. `scene.ts` liefert eine strukturierte Zielbeschreibung mit Objekt-ID statt nur dem nahen Objekttyp. |
| `Game.tsx` | Verbindet Auswahl und Aktionen mit den vorhandenen `perform`-/`workAt`-Pfaden. Orchestriert Werkzeuge und genau ein offenes Fenster. |
| `BuildKit.tsx`, `CraneControls.tsx`, `PartyPanel.tsx` | Behalten Katalog, Kran und Crew-Regeln, erhalten passende mobile Darstellung und rollenbezogene Knöpfe. Sprachverbindung bleibt beim Schließen eines Fensters bestehen. |
| `model.ts`, `placement.ts`, `connection.ts` | Bleiben maßgeblich für Erreichbarkeit, Einrasten, Besitz, Unterstützung und bestätigte Aktionen. Ablagezielberechnung bei Bedarf als reine Funktion gemeinsam für Vorschau und Validierung verwenden. Bestehende Aktionsidentität und Wiederholungslogik beibehalten. |
| Mobile Styles im Spiel | Zustandsklassen und eine gemeinsame Höhen-/Safe-Area-Berechnung ordnen vorhandene Leisten. Überholte betroffene Overrides ersetzen, statt eine weitere widersprechende CSS-Schicht anzuhängen. |

Empfohlene Reihenfolge: zuerst Zielwahl, Aufheben/Benutzen/Ablegen/Werfen und Mehrfinger-Verhalten; darauf Bau-, Mal-, Abbau- und Kranabläufe; anschließend sämtliche Crew-, Menü- und Medienaktionen mit beiden Formaten prüfen. Alle Schritte gehören zur vollständigen Abdeckung, nicht nur die Basissteuerung.

## Einführung und Rückmeldung

Vier kleine kontextbezogene Hinweise statt eines langen Pflicht-Tutorials: „Drag to move“ am ersten Start, „Pick up“ beim ersten geeigneten Objekt, „Tap ground to aim · Throw“ beim ersten Tragen, „Tap a spot · Place“ beim ersten Bauen. Sie zeigen auf den tatsächlichen Knopf, blockieren keine Eingabe und verschwinden nach erfolgreicher Nutzung. Sie lassen sich über „Help“ erneut aufrufen.

Touch-Hilfe enthält Touch-Handlungen, Maus-Hilfe enthält Maushandlungen. Sichtbare Namen stimmen mit den Knöpfen überein. Zustandswechsel erhalten vorhandene Geräusche und eine kurze visuelle Rückmeldung; kein Erfolg hängt davon ab, Ton oder Vibration wahrzunehmen. Reduzierte Bewegung wird respektiert. Fehler bleiben direkt beim Ziel bzw. Aktionsbereich sichtbar, bis der Zustand korrigiert oder gewechselt wird.

## Prüfung und Abnahmekriterien

**Ausgangsprüfung:** Vor der Umsetzung bestanden 50 Tests in `touch.test.ts`, `joystick.test.ts`, `scene.test.ts` und `model.test.ts`. Die Tests zur bisherigen Bestätigung durch Welt-Tap wurden auf die explizite Place-Aktion umgestellt und ergänzt. Nach der Umsetzung bestehen 215 Prüfungen der Bau-Spiele, einschließlich der neuen Eingabelogik. Browserprüfungen mit Touch-Emulation sind im Prüfbericht dokumentiert; echte Geräte und Erstnutzer wurden nicht getestet.

**Gezielt zu prüfende Abläufe:**

| Prüffall | Erwartung |
| --- | --- |
| Nahes Objekt aufheben, laufen, gültig ablegen | Jede Aktion per Touch erreichbar; nach Erfolg stimmen HUD und gemeinsamer Besitz. |
| Klavier auswählen | „Pick up“ und „Use“ gleichzeitig verständlich verfügbar, ohne Umweg über ein Menü. |
| Entferntes Objekt holen; Partner greift zuerst | Anfahrt auf genau dieses Ziel; klare Rückmeldung statt Zugriff auf ein anderes Möbelstück. |
| Ablage blockiert / falsche Etage / Spieler im Weg | Vorschau und Server sind konsistent; Objekt bleibt getragen. |
| Beim Laufen zielen und werfen | Joystick bleibt aktiv; Wurfrichtung entspricht dem Bogen; genau ein Wurf. |
| Sprint-Ring betreten, an seiner Grenze bewegen, verlassen | Eintritt und Austritt sind stabil; bestehende Geschwindigkeiten und Gewichte gelten; Crew-Rollen aktivieren keinen Sprint. |
| Beim Tragen Kamera drehen oder pinchen | Kein Ablegen, Werfen oder unbeabsichtigtes Neuausrichten. |
| Finger hält Aktion, Server ändert Objekt oder Rolle | Loslassen führt keine inzwischen andere Aktion aus. |
| Ego-Sicht: links laufen, rechts schauen; Finger links zuerst loslassen | Blickgeste bleibt aktiv; keine unerwartete Auswahl. Auch umgekehrte Reihenfolge prüfen. |
| Bauen: Welt antippen, ziehen, andere Stelle antippen | Nur die Vorschau ändert sich; erst „Place“ baut. |
| Bauvorschau drehen, Etage wechseln, Kamera zoomen | Objekt bleibt verständlich positionierbar; Stützen, Raster und Etage stimmen. |
| Baugriff ziehen, zweiten Szenenfinger hinzufügen, unterschiedlich loslassen | Kamera übernimmt; kein unbeabsichtigter Bau. |
| Ein Teil streichen / alle Wände streichen / Teil entfernen | Ausgewählter Umfang stimmt mit dem Ergebnis; freie Kamera-Geste verändert nichts. |
| Dachkran bedienen, besetzter Kran, ungültiges Ziel, Rückgabe | Phasen und Sperren sichtbar; Last geht nicht durch UI-Schließen verloren. |
| Alle fünf Crew-Aufgaben, einschließlich Solo-Helfer | Sofa, Glas, Crew-Kran, Leiter und Schubkarre mit richtiger Rollenzuordnung, Bewegung, Drehen, Arbeiten, Liefern und Freigeben. |
| Crew-Kamera um 90° drehen | Joystick bewegt die Last aus Spielersicht in die erwartete Richtung. |
| Lieferung beschädigt / Sack verschüttet / Rohr undicht | Bergen, Sammeln, Stabilisieren und Reparieren sind für die zulässige Rolle erreichbar. |
| Build & Swap / Inspektion / Ergebniswechsel | Nur gültige Phasenaktionen; private Missionsdaten bleiben privat. |
| Menü während Bewegung oder Halteaktion; danach schließen | Bewegung und Arbeits-/PTT-Kontakte stoppen; nichts startet von selbst neu. |
| App-Wechsel, Hinweis des Betriebssystems, Verbindungsabbruch | Kein festhängender Joystick, Kletter-, Dreh- oder Funkkontakt; keine nachträglich ausgeführte Touch-Aktion. |
| Browserleiste, Bildschirmtastatur, Formatwechsel, Maus am Tablet | Keine verdeckten Hauptknöpfe, Eingabesprünge oder verlorenen Vorschauen. |
| Einladen, Bereitschaft, Einstellungen, Speichern/Laden/Remix, Foto/Clip/Teilen | Alle vorhandenen Optionen ohne physische Tastatur oder Maus nutzbar; Systemdialog-Abbruch funktioniert. |

Automatisierte Tests konzentrieren sich auf Aktionszustände, Besitz-/Zielwechsel, Geste gegen Aktion und Kontakt-Unterbrechungen. Bestehende Modell-, Kran- und Multiplayer-Tests sichern die Spielregeln. Reine CSS-Anordnung wird visuell überprüft, nicht durch Tests, die nur Klassennamen wiederholen.

Nach Umsetzung prüfen: 320 × 568, 360 × 640, 390 × 844, 667 × 375, 844 × 390 und Tablet-Hoch-/Querformat; zusätzlich echte Geräte mit iOS Safari und Android Chrome. Zwei mobile Spieler plus Desktop-Teilnehmer testen paralleles Greifen, Crew-Lieferung, Reconnect und gemischte Eingaben. Ein kleiner Erstnutzer-Test prüft, ob fünf neue Spieler ohne mündliche Erklärung Aufheben, Ablegen und Werfen jeweils innerhalb von 30 Sekunden finden. Ziel: mindestens vier von fünf pro Aktion und keine versehentliche Bau-/Wurfaktion beim Kamerabewegen. Diese Werte sind Abnahmekriterien, keine bereits gemessenen Ergebnisse.

## Entwurfsprüfung

Die Zuordnung deckt die Tastaturaktionen aus `scene.ts`, die Werkzeuge aus `Game.tsx` und `BuildKit.tsx`, beide Kranarten, alle Crew-Aufgaben sowie die vorhandenen Menü-, Medien- und Speicherfunktionen ab. Die Semantik wurde mit `model.ts` abgeglichen. Die Welt-Tap-Bestätigung wurde durch explizite Aktionen ersetzt und mit angepassten Tests geprüft. Der verlinkte Prüfbericht trennt die durchgeführten Prüfungen von noch offenen Geräte- und Erstnutzerprüfungen.
