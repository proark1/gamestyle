# Panic Curling: freigegebene Korrekturen

Grundlage: Nutzerreport zu fehlendem Ziel, NPC-Blickrichtung, Wischanimation und Kamera. Der Nutzer hat die Umsetzung aller berichteten Punkte freigegeben.

## Umsetzung

- Zielkreise und Bahnlinien oberhalb der Eisoberfläche; kleine Bahnübersicht mit Steinpositionen.
- Wurfgeschwindigkeit je Stein aus Reibung und gewünschter Reichweite berechnen. 50 Prozent ist ein Zielwurf; niedrigere und höhere Stärken bleiben unterscheidbar. Botwürfe sind etwas kürzer und werden bei Bedarf gewischt.
- Wischer orientieren sich weich zum Stein, unabhängig vom aktiven Wischen. Werkzeugmodell folgt der Auswahl; Besenstiel verbindet Wischfläche und Hand.
- Kameraposition und Blickziel werden zeitbasiert geglättet. Die Zielperspektive wird entlang der Bahn eingeblendet. Alle Steine müssen ruhen, bevor eine 1,6 Sekunden lange Ergebnisphase und die Rückfahrt folgen.
- Verdeckende Hütte und Bögen werden entlang der Sichtlinien zu den Spielfiguren und zum Stein ausgeblendet.
- Team- und Rollenwechsel sind während des Wurfs gesperrt. Menschen ersetzen Bots auch in Wischer- und Verteidigerrollen.
- Bananenprüfung gilt auch für begleitende Wischer. Pointer Capture, Abbruch-, Fokusverlust- und Tastaturbehandlung verhindern hängende Haltebefehle.
- Hammer richtet sich nach dem Ergebnis des letzten Ends; leere Ends behalten den Hammer. Wurfzähler bleibt innerhalb der Gesamtzahl.
- Seitliche Abwurfsteuerung auf breiten Bildschirmen; tatsächlicher Wischstatus im HUD.

## Prüfung

13 Curling-Tests bestanden, einschließlich vollständiger Würfe für alle drei Steinarten, Wischhilfe, Ergebnisphase, Rollenwechsel, Bananenkollision und Hammerwechsel. Curling-Lint, Architekturprüfung und Produktionsbuild bestanden. Browser-Sichtprüfung zeigt sichtbare Zielkreise, zum Stein gerichtete Wischer, Besen und Kamerafahrt bis zur Zielansicht.

Der abschließende projektweite Typecheck meldete Fehler außerhalb von Panic Curling in games/zorb-clash und shared/audio/buffer-cache.test.ts. Diese gleichzeitig bearbeiteten Bereiche wurden nicht verändert. Kein Deployment ausgeführt.
