# Panic Curling: Drei Werkzeuge mit eigenen Rollen

## Ziel

Während ein Stein gleitet, sollen die drei vorhandenen Werkzeuge sofort verständliche, unterschiedliche Entscheidungen bieten: weiter gleiten, seitlich korrigieren oder abbremsen. Namen, Requisiten und Jumbleyard-Charaktere bleiben erhalten. Ein Werkzeugwechsel während des Wurfs bleibt möglich.

## Entscheidung

Die bisherige Abstufung (Besen, Warm Dryer und Mega Blowtorch reduzieren die Reibung um 45, 62 und 82 Prozent und lenken alle seitlich) wird durch drei getrennte Wirkungen ersetzt. Eine reine Stärkeleiter gibt dem stärksten Werkzeug keinen echten Nachteil. Ein Energie- oder Cooldown-System würde die Bedienung unnötig erschweren. Die drei Rollen wurden mit dem Nutzer abgestimmt:

| Werkzeug | Spielwirkung | Kurze Erklärung |
| --- | --- | --- |
| Besen | Reduziert die Reibung beim Fegen; der Stein verliert langsamer Tempo und gleitet weiter. Keine zusätzliche Seitenkraft. | Tempo erhalten |
| Warm Dryer | Bläst von links oder rechts und korrigiert die Bahn seitlich. Verändert die Vorwärtsbremsung nicht merklich. | Seitlich lenken |
| Mega Blowtorch | Richtet einen kräftigen Gegenstrahl auf den Stein und erhöht seine Verzögerung. Keine zusätzliche Seitenkraft. | Abbremsen |

Der Besen beschleunigt den Stein nicht über seine aktuelle Geschwindigkeit. Der Blowtorch kann ihn nicht rückwärts schicken. Der normale, vor dem Wurf gewählte Spin bleibt bei allen Werkzeugen wirksam.

## Bedienung und Rückmeldung

Werkzeugwahl bleibt während der Gleitphase verfügbar. Besen und Blowtorch wirken, solange die zentrale Aktion gehalten wird; deren Beschriftung wechselt passend zwischen Fegen und Gegenwind. Beim Warm Dryer blasen die vorhandenen Links-/Rechts-Tasten jeweils direkt in die gewünschte Bewegungsrichtung des Steins, solange man sie hält. Für Besen und Blowtorch werden diese Richtungstasten ausgeblendet. Auf der Tastatur bleibt Leertaste für Besen und Blowtorch; A/D oder die Pfeiltasten bedienen den Warm Dryer. Es ist nie nötig, auf dem Handy gleichzeitig zwei Tasten zu halten.

Die Werkzeugknöpfe erhalten eine kurze Rollenbeschreibung. Die Telemetrie nennt die tatsächliche Wirkung des aktiven Werkzeugs statt pauschal SWEEPING mit einem Reibungs-Prozentwert. Richtung, Partikel und Ton sollen Seitenluft beziehungsweise Gegenwind sichtbar und hörbar machen; die Charaktermodelle bleiben unverändert. Texte werden auf Englisch und Deutsch gepflegt.

## Simulation

Die vorhandenen Eingaben für Werkzeug, Aktion und Richtung sowie das Netzwerkformat reichen aus. Die Physik wertet je Werkzeug nur dessen eigene Wirkung aus, wenn der aktive Mitspieler vor und nahe genug am Stein steht. Als Ausgangspunkt bleibt der Besen bei etwa 45 Prozent weniger Reibung. Der Warm Dryer bekommt eine begrenzte Seitenkraft ohne nennenswerte Änderung der Gleitweite. Der Blowtorch erhöht die normale Vorwärtsverzögerung ungefähr auf das Doppelte; die Geschwindigkeit wird bei null geklemmt. Die Zahlen werden mit identischen Testwürfen so abgestimmt, dass alle drei Entscheidungen sichtbar, aber kontrollierbar sind.

Bots priorisieren einen drohenden Überschuss mit dem Blowtorch, sonst eine deutliche seitliche Abweichung mit dem Warm Dryer und sonst einen zu kurzen Wurf mit dem Besen. Loslassen oder Werkzeugwechsel beendet die vorherige Wirkung sofort. Die derzeit gespeicherte Eisbelastung durch Wärme hat keine Spielwirkung und wird nicht als versteckte Nebenregel eingeführt. Unbenutzte Konfigurationswerte dafür werden bereinigt, sofern sie nur für diese alte Werkzeug-Abstufung existieren.

## Prüfung

Deterministische Vergleichswürfe prüfen: Besen reicht weiter als ohne Aktion; Warm Dryer verschiebt nach links beziehungsweise rechts, ohne den Vorwärtsweg wesentlich zu ändern; Blowtorch hält früher an, ohne umzukehren. Ohne Aktion oder außerhalb der Reichweite bleibt die Bahn unverändert. Eingaben für Maus, Touch und Tastatur, Werkzeugwechsel in Einzel- und Mehrspieler-Partien, Telemetrie und bestehende Spielfiguren werden im Browser geprüft. Typecheck, Lint, die gezielten Panic-Curling-Tests und der Produktions-Build müssen bestehen.
