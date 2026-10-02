# Zorb Clash – Produktionsrelease am 20.09.2026

Live: https://www.jumbleyard.com/zorb-clash

- Quellcommit: `b9a197e` – auf `origin/main` veröffentlicht.
- Railway-Deployment: `4e9d52f0-b404-468c-bec7-367ef842351d`, Status **SUCCESS**.
- Release aus einem isolierten Checkout des aktuellen main, ausschließlich mit Zorb-Clash-Änderungen. Der gemeinsame Arbeitsstand anderer Aufgaben wurde nicht hochgeladen oder zurückgesetzt.
- Alle **1.500 Projekttests** bestanden; TypeScript, Zorb-Clash-Lint und Architekturprüfung erfolgreich. Railway-Produktionsbuild erfolgreich.
- Öffentliche Spielseite und `/api/health`: HTTP 200; Gesundheitscheck `status: ok`.
- Der neue Startdialog wurde auf der Live-Seite bei 390 × 844 Pixeln verifiziert: Spielerkugeln zählen nicht als Tore, Touchanleitung erklärt Halten/Loslassen des Sprints.
- Im lokalen Release wurden zusätzlich die Desktop-Spielansicht, laufende Matchzeit, neue Spielfeldzäune und der Hilfe-Pausenzustand geprüft. Physische Smartphone-Mehrfingereingaben wurden nicht getestet.
- Der anschließend gestartete Sample-Stampede-Release `8a3a84e` enthält `b9a197e` als Vorfahren; er baut auf diesen Korrekturen auf.

Deployment: https://railway.com/project/21b9cdf4-0b3e-4eea-b1e5-88613f7f8a88/service/a89aec5c-5a7e-4e15-a684-3c4e61625ccb?id=4e9d52f0-b404-468c-bec7-367ef842351d

Dieser Release-Vermerk ersetzt die früheren Angaben „noch nicht live“ und die damaligen Typprüfungsblocker im Umsetzungsbericht. Diese betrafen den gleichzeitig bearbeiteten gemeinsamen Arbeitsstand, nicht den geprüften isolierten Release.
