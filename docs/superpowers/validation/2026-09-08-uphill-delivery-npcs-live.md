# Uphill Delivery NPCs — Live-Veröffentlichung

Der geprüfte Stand wurde am 8. September 2026 auf dem bestehenden öffentlichen [Jumbleyard-Dienst](https://jumbleyard.up.railway.app/uphill-delivery) veröffentlicht. Railway meldet für Deployment `ad21977d-46ef-4516-b392-bf6f89318bed` den Status `SUCCESS`.

## Veröffentlichter Stand

- Eingefrorene Kopie von 728 Quelldateien aus dem aktuellen Projekt. Drei Formatierungsfehler wurden ausschließlich in dieser Veröffentlichungskopie korrigiert: `games/first-person/Game.tsx`, `shared/ui/GameToolbar.tsx` und `games/dont-wake-the-giant/level.ts`.
- Diese Kopie bestand `npm run check` mit allen 650 Tests sowie `npm run build:railway`.
- Die neun maßgeblichen Uphill-Simulationsdateien tragen unverändert die geprüfte Kennung `2bb80f92c4cd704adbd239aa0bbba52134ff0fc5152e48273b04ebe713d1819a`.
- Der bestehende Produktionsdienst wurde aktualisiert. Es wurden keine Dienstvariablen, Zugriffsregeln oder Volumeeinstellungen geändert. Die separate Sites-Version wurde nicht veröffentlicht; Ziel dieser Freigabe war die öffentliche Railway-Spielseite.

## Onlineprüfung

Abgeschlossen um 16:56 UTC / 18:56 Uhr Berliner Zeit:

- 16 Seiten und Endpunkte einschließlich aller sieben Spiele, der Sound-Werkstätten und `/api/health` antworteten erfolgreich.
- Alle 70 aus diesen Seiten ermittelten eigenen Skripte, Stylesheets und weiteren referenzierten Dateien waren erreichbar.
- Das ausgelieferte Uphill-Skript enthält NPC-Slotsteuerung, die Erinnerung an fehlgeschlagene Griffanläufe und den Abbruch eines veralteten Lückensprungs. Das Skript ist nicht bytegleich mit dem lokalen Windows-Build; die relevanten Korrekturen wurden im tatsächlich ausgelieferten Code geprüft.
- Eine kurzlebige Zweispieler-Testlobby bestätigte gezieltes Hinzufügen, Auffüllen und Entfernen von NPCs, reservierte Plätze beim menschlichen Beitritt, die Ablehnung einer Gast-Verwaltungsaktion und den Erhalt der NPCs beim Hostwechsel. Die Testteilnehmer verließen anschließend ihre Lobby.
- Die Hashes sämtlicher 728 Dateien der Veröffentlichungskopie waren nach der Onlineprüfung unverändert.

Die Prüfung des Hostwechsels nutzte die produktive Raum-API; sie ersetzt keinen erneuten vollständigen WebRTC-Spieltest. Bereits geöffnete Spielseiten müssen neu geladen werden, um die neuen NPC-Entscheidungen im Browser zu verwenden.

Die bekannten Grenzen der Mischcrew-KI bestehen weiter. Diese Veröffentlichung ist kein neuer Nachweis vollständiger gemischter Lieferungen; maßgeblich bleibt der [Verhaltens- und Simulationsbericht](2026-09-08-uphill-delivery-npcs.md).

Die eingefrorene Quelle, Dateimanifeste, Build- und Deploymentprotokolle sowie die maschinenlesbare Onlineprüfung liegen lokal unter `.tmp/uphill-npc-live-20260908/`.
