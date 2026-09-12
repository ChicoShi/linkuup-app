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

## Offene Ortsbühne statt gerahmter Karten
Styles vollständig ersetzt: freie Ortsidentität, räumlicher Marker mit ruhenden Bahnlinien, Symbolkategorien, kompakte Aktionen. Vom Nutzer abgelehnte gestapelte Hauptbuttons entfernt. Suchradius auf ausdrücklichen Wunsch vollständig aus Oberfläche und Filterlogik entfernt; kein versteckter Radiusfilter. Entfernungsanzeige und GPS-Zugangsprüfung bleiben bestehen. Laufende 390x844-Ansicht visuell geprüft. JS/PHP/Diff-Prüfung bestanden; Geräte-/FPS-Abnahme weiterhin offen.

## Kompakte Kategorien und ruhigere Bewegung
Atomringe und ungenutzte Landschaftsdekoration entfernt. Kategorien mobil als kompaktes Raster mit sechs sichtbaren Einträgen; Desktop einreihig. Ortsfläche und Schrift werden beim Scrollen nicht mehr skaliert. Nur der ausgewählte Marker erhält nach Scrollende eine kurze Ankunftsbewegung. Auswahl misst maximal zwei Karten statt sämtliche Orte pro Scrollframe; auch gebrochene Pixelabstände werden berücksichtigt. Text-/Aktionslayout gegen geerbte Positionierung und Überlauf abgesichert.

Laufende mobile Chromium-Ansicht 390x844 visuell geprüft: Kategorien und Titel lesbar, Atomringe entfernt. 126 isolierte Auswahlchecks gegen den tatsächlichen Funktionscode einschließlich Listenende, verschiedener Breiten und gebrochener Abstände sowie leere Liste bestanden. JS-/PHP-Syntax und Diff-Prüfung bestanden. Keine FPS-Messung und kein Test auf echtem iPhone; QR-Backendfehler bleibt offen.

## Schlichte Kategorienleiste
Auf Nutzerwunsch Symbolkacheln durch eine einzige Textzeile ersetzt. Aktive Kategorie nur mit heller Schrift und dünner violetter Unterstreichung. Mobile Leiste horizontal nativ scrollbar, 44 px hohe Ziele; Desktop zeigt alle sechs Kategorien. Filterbindung und aria-pressed unverändert. Mobile 390-px- und Desktopansicht visuell geprüft; PHP-Syntax und Diff-Prüfung bestanden.

## Saubere Kartenränder
Lichtschein hinter Marker und radiale Seitenbeleuchtung entfernt. Jede Karte belegt die volle Breite des begrenzten Scrollbereichs; Inhalt bleibt mittig mit Innenabstand. Dadurch sind nach Einrasten keine Nachbarbuttons sichtbar. Native Scroll-/Snap- und Aktionslogik unverändert. Mobile 390px und Desktop visuell geprüft; Weiter-Button wechselt korrekt von Ort 1 auf 2, ohne angeschnittene Nachbaraktionen. PHP-/Diff-Prüfung bestanden. Echter Touch-Gerätetest bleibt offen.

## Symbolkategorien und nahe Navigation
Sechs zentrierte Symbolbuttons mit 44-px-Touchzielen, übersetzten aria-label/title und bestehendem aria-pressed. Aktive Symbole tragen eine eigene Kategorienfarbe mit dezentem Schein; keine Kachelfläche. Seitennavigation direkt innerhalb der jeweiligen Ortskarte 16 px unter den Aktionen angeordnet, unabhängig von der Höhe anderer Orte. Mobile und Desktop visuell geprüft; Kategorienwechsel und farbliche Auswahl sichtbar geprüft. PHP-/Diff-Prüfung bestanden.
