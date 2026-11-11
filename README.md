# Rennspiel

3D-Rennspiel im Browser mit den Fahrern aus Marienfeld. Läuft am Handy als App (Web-App) und offline.

## Spielen
Die Seite auf dem Handy öffnen und als App installieren:
- **Android (Chrome):** Knopf „Als App installieren“ im Menü, oder Menü ⋮ → „App installieren“
- **iPhone (Safari):** Teilen-Knopf → „Zum Home-Bildschirm“

## Etwas ändern
- `tracks.js` – Strecken
- `themes.js` – Aussehen der Streckenarten
- `surfaces.js` – Grip und Untergründe
- `characters.js` – Fahrer und ihre Werte
- `cars.js` – Fahrzeuge

**Wichtig:** Alle Dateien liegen im selben Ordner, ohne Unterordner.

Nach jeder Änderung in `sw.js` die Versionsnummer erhöhen
(`rennspiel-v1` → `rennspiel-v2` …), sonst sehen die Handys die alte Version weiter.
