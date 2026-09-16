# App – Reparatur und Prüfung vom 16.09.2026

## Änderungen

- Kurze horizontale Gesten ab 28 CSS-Pixeln wechseln genau eine Location. Vertikale Gesten bleiben vertikal; Zittern und Abbruch wechseln keine Karte. Touch, Maus und Pfeiltasten bleiben nutzbar. Der Klick nach einem Wischen öffnet keine Location versehentlich.
- Die im aktuellen Controller fehlenden Kategorien-, Pfeil-, Reset- und GPS-Anbindungen sind wieder vorhanden. Ein neu geladener Filter wählt sofort die erste sichtbare Karte. Suche kombiniert Begriffe aus Name/Adresse/Kategorie und normalisiert Akzente/ß.
- Außerhalb des Bildes liegende Karten werden nicht fortlaufend neu ausgemessen oder mit Glas compositiert. Eine alte 62-%-Deckkraftregel verdunkelt die Schrift nicht mehr.
- Ein Glasstil für Locations, Ereignisse, privaten Posteingang und private Nachrichten; keine zusätzlichen Reflexionsstreifen oder Doppelrahmen, Fallback ohne Backdrop-Filter.
- HTTP-Fehler ohne JSON behalten ihren eigentlichen Fehler und erzeugen keinen zusätzlichen TypeError. Die Dialogwarteschlange produziert beim Schließen keine verwaiste Promise-Ablehnung.
- Ein fehlgeschlagener Annotate-/Minify-Schritt wird beim Build erkannt. Vorherige noch nicht gemergte Profil-/Story-/Einblick- und Lesestatus-Korrekturen sind enthalten.

## Prüfung

- `node --test tests/*.test.cjs`: 28 Tests erfolgreich, einschließlich GPS-/Besucherkontakt-Sperren, Polygon-/Binärdaten, Laden/Fehler/Retry, Such-/Filterlogik, Dialogreihenfolge und HTTP-Fehler.
- Geänderte JS-Dateien sowie Produktionsbundle mit `node --check`, PHP-Build mit `php -l`, `git diff --check` erfolgreich. Produktionsbuild mit `php build.php` erstellt; Compiler nur lokal in einem separaten Werkzeugverzeichnis installiert.
- Tatsächliches Produktionsbundle (`index.php`): Chromium-Touch-Ereignisse mit 36 px vorwärts/rückwärts, 5 px Zittern und vertikaler Geste. Wechsel genau eine Karte, keine unbeabsichtigte Navigation. Vollständiger lokaler Katalog: 528 Einträge. Kategorie Nachtleben: 15 Treffer; Pfeil, erfolglose Suche, Zurücksetzen, Öffnen und Zurücknavigieren geprüft.
- Einstellungen, Nachrichten/Ereignisse, Freunde, Profil bei 320, 390 und 1440 px: kein seitlicher Überstand; längere Einstellungen/Profile scrollbar. Glasschichten im privaten Posteingang und Chat mit ausdrücklich lokalen, nicht gesendeten Layoutdaten geprüft.

## Übergabe und Grenzen

Nach dem Merge auf der Zielinstallation regulär `php build.php` ausführen und die zugehörigen HTML-Templates mit ausliefern. Keine lokalen Konfigurationen, Cachedateien, Buildwerkzeuge oder Testkonten im Commit. Keine Live-Datenbank geändert, keine Nachrichten an Nutzer versendet.

Kein physisches iPhone/Safari verfügbar. Private Nachrichten wurden visuell mit lokalen Daten geprüft, nicht zwischen zwei echten produktiven Konten verschickt. Kauf-, Admin- und Produktiv-GPS-Abläufe sind keine vollständig geprüften End-to-End-Prozesse. Bitte diese geräte-/kontobezogenen Freigabechecks vor Deployment ergänzen. Die öffentliche Version bleibt bis zum Merge und Deployment durch Mira/Gizmore unverändert.
