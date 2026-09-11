# Location-Navigator – lokaler Reviewstand

2026-09-12, Branch simion/location-navigator. Lokale App: app.localhost/index_debug.php#!/locations.

Die Ortsauswahl nutzt ein neues, mobiles Layout mit Kategorien, Suchradius, abstrakten Kartenkonturen, GPS-Marker, räumlicher Wischbewegung und beschrifteten Ortsaktionen. Die Konturen sind dekorativ, keine geografischen Daten. Bestehende Orts-, QR-, Besucher- und Chat-Aktionen sowie GPS-Zugangsprüfung bleiben angebunden.

Suche unterstützt mehrere Begriffe unabhängig von Reihenfolge und Akzenten. Radiusfilter verwendet vorhandene Kilometerdistanzen; ohne GPS ist der Regler deaktiviert. Verdeckte/unbekannte Entfernungen werden nicht in einen begrenzten Radius aufgenommen. Alle Kategorien bedeutet tatsächlich ungefilterte Kategorien, statt dem gerade sichtbaren Ort zu folgen.

Korrigiert: Auswahl nach Suchwechsel mit nicht mehr vorhandenem Ort, Zentrierung bei verschachtelten Containern, konkurrierende Kategorie-Stile. Nach Ziehen schützt eine gemeinsame Klicksperre die Kartenaktionen. Touch-Abbruch räumt den Ziehzustand auf. Entfernte Karten erhalten keine wiederholten Stiländerungen. Keine neuen Bibliotheken oder externen Medien.

## Tatsächlich geprüft
- JS-Syntax, PHP-Syntax, DE/EN-JSON und git diff --check bestanden.
- Fünf isolierte Checks gegen den tatsächlichen Filtercode: Mehrwort/Akzente, Entfernung, Kategorie+Radius, fehlendes GPS, leere Treffer.
- Laufende angemeldete Ansicht in Chromium: mobile Emulation 390x844 sowie Desktop mit angedockten Entwicklerwerkzeugen visuell geprüft.
- Suche Braunschweig: 83 Treffer. Kombination Café & Bar + 2 km: ein Treffer, angezeigte Entfernung 1,6 km.
- Detailöffnung funktioniert; Browser-Zurück führt zur neuen Auswahl.

## Noch vor Merge prüfen
Echtes iPhone/Safari, virtuelle Tastatur, reduzierte Bewegung im Gerätetest, schnelle Touchwechsel, QR/Profil/Chat-Rückkehr und belastbare Frame-Zeiten. Der Stand verspricht keine gemessenen 60 FPS. Browserkonsole zeigt auch bestehende Meldungen; kein vollständiger Fehlerfreiheit-Nachweis.

Die Ortsdetailseite wird weiterhin vom bestehenden Modul dargestellt. Kein bildfüllender Morph-Übergang in diese Seite und kein zusätzlicher Listenmodus umgesetzt. Gestaltung ist der erste lokale, benutzbare Stand zur gemeinsamen Sichtprüfung. Kein Produktionsbuild, kein Deployment und kein PR veröffentlicht; vor PR upstream/main abgleichen und verbleibende Checks abschließen.

## Korrektur der Klickbehandlung
Native Touchbewegung ersetzt manuelles preventDefault/scrollLeft bei Touch. Neue bewusste Berührung setzt die vorherige Klicksperre zurück; pointercancel, pointerleave und lostpointercapture beenden Mausgesten. Vier Regressionen gegen die tatsächlichen Event-Handler bestanden: synthetischer Klick nach Drag blockiert, unmittelbarer bewusster Tap erlaubt, Verlassen vor Drag, Abbruch plus neuer Klick. JS/PHP/Diff-Prüfung bestanden. Im laufenden Browser öffnet der QR-Button den Dialog; Bildabruf meldet HTTP 500 für backend/linkuup.qrforroom.room_id.2100.html. Das QR-Bildproblem ist weiterhin offen und kein behobener Backendfehler.

## Aktionsgestaltung
Hauptaktion über volle Breite, eigene beschriftete Routenschaltfläche, QR-Nebenaktion und klar umrandeter Chat-Button. Verfügbarkeit wird aus der bestehenden Zugangsprüfung dargestellt; keine Anwesenheitsbehauptung. Fehlender Standort erhält am Routenbutton eine passende Beschriftung. Kurze Transform-Rückmeldung mit Reduced-Motion-Ausnahme. Mobile Höhenkompression erhält die Aktionsflächen. DE/EN-Template-Schlüssel, PHP und Diff geprüft. Keine zusätzliche Geokarte umgesetzt; QR-Serverproblem weiterhin offen.
