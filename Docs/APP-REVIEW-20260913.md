# App-Prüfstand · 13.09.2026

Dieser Branch enthält die bisherige Location-/Profil-/Sidebar-Überarbeitung und die neuen Location-, Chat-, Online-, Freunde-, Ereignis-, Nachrichten- und Einstellungsansichten. Upstream/main wurde integriert, einschließlich Polygon-Editor, Google-Login, kostenpflichtigem Shout und explizitem Chat-Verlassen. Keine echte kostenpflichtige Aktion getestet oder ausgelöst.

## Geprüft

- `node --test tests/place-boundaries.test.cjs`: Ortsbeschreibungen/Quellenzuordnung, sichere Maps-Suchlinks, bestehende GPS-Zutrittssperre und Unterscheidung zwischen Tippen, horizontalem Wischen und vertikalem Scrollen.
- Zusätzlich 100 echte lokal importierte Backend-Raum-/Adress-Payloads durch LUPRoom geprüft. Wiederholbar mit `LUP_IMPORTED_ROOMS_JSON=DATEI.json node --test tests/place-boundaries.test.cjs`; die Datei erzeugt `tools/check_location_import.php` im Backend.
- Isolierter Chromium-Test mit echten Angular-Controllern und Templates, Testdiensten ohne WebSocket-Versand: Location/Chat/Online, Freunde/Suche/Pagination, Kommentare, Nachrichten/Ereignisse, Privatnachrichten, Einstellungen, Telefon-/Öffnungszeiten-/QR-/Rechtsdialoge. Kein horizontaler Dokumentüberlauf bei 320, 390 und 1440 px in der Location-Ansicht; übrige neue Ansichten bei 390 px geprüft. Composer bleibt bei Fokus sichtbar. Reduced Motion stoppt die Ambient-Animation.
- Nachrichten: ein Versand je Enter, leere Eingaben gesperrt, Privatnachrichten nur HH:mm; Entwurf bleibt bei fehlgeschlagenem Privatversand erhalten. Einstellungen: Speichern, Fehlerzustand und ACL-Auswahl mit isolierten Testdiensten geprüft. Kritische Aktionen wurden nicht mit echten Konten durchgeführt.
- Neue Designflächen verwenden dasselbe Blau (#111a2d), inklusive Chatblasen und Composer. Kategorie-Farben bleiben zur Orientierung erhalten.

## Grenzen / Review vor Live

Kein echtes iPhone/Safari und keine angemeldete Ende-zu-Ende-Abnahme aller Benutzerrollen. Der bestehende Server ist für Zutrittsprüfung maßgeblich. Seine neu hinzugekommenen Polygon-/GPS-Toleranzen müssen mit der App und den tatsächlichen Geschäftsflächen abgeglichen werden. Keine GPS-Sperre für die Gestaltung aufgehoben; der alte feste Debug-Standort aus index_debug.php ist entfernt.

Google-Öffnungszeiten werden nicht live abgefragt. Das Profil verwendet vorhandene Öffnungszeiten und einen korrekt adressierten Maps-Link; eine Places-Anbindung benötigt Konfiguration und Freigabe der Nutzungskosten. Die neuen 100 Orte sowie Datenprüfung und Rechtstextabgleich liegen im zugehörigen Backend-PR. Importhinweise werden aus dem Beschreibungstext gefiltert; OSM wird gesondert als Quelle gezeigt.

App und Backend zusammen aktualisieren und anschließend den Produktionsbuild im vorgesehenen Review-/Release-Ablauf erstellen. Das neue Upstream-Protokoll setzt aktuelle PHPGDO-Abhängigkeiten voraus. Es wurde nicht deployed.
