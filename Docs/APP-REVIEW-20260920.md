# App-Review 20.09.2026

Basis: upstream/main fc4cbf6. Feature: simion/locations-visual-rail-20260919.

Enthält Wiederanbindung der bestehenden Location-Glasdarstellung, Kategorien/Reset-Effekt, Rating/QR/Sidebar, Profil-Eigenansicht, stabilere Kopfzeile, Chat-Eingabedarstellung, Kontoübersicht sowie Entfernung-/Shout-/Raumformulare. Sidebar schließt vor den Kaufdialogen. Keine Testgäste oder Datenbank-Seeds.

## Prüfungen

- Vollständiger Node-Testlauf: 45/54 bestanden; dieselben neun fehlgeschlagenen Testfälle auf unverändertem upstream/main (39/48). Navigator-Altannahmen und Room-Loading-Parser/Katalogtests bleiben offen. Keine Behauptung eines vollständig grünen Builds.
- Kauf-/Raumformulare isoliert bei 320/390/1440 px, zusätzlich 480 px Höhe: Aktionen sichtbar, kein horizontaler Formularüberlauf. Mockdaten nur in unversionierter Testvorschau; keine Käufe oder Raumerstellung.
- Angemeldeter lokaler Navigationslauf: Konto, Einstellungen, Profil, Nachrichten, Locations, Shout, Entfernung und Raumformular ohne JS-Ausnahmen. Nach Dialogfix eine statt zwei überlagerte Abdunkelungsflächen.
- Profil mit geöffneten Details bei 320 px: Mausrad und emuliertes Touch-Scrollen geprüft.
- Sidebar bei 320/390/1440 px: Scrollen und Escape geprüft.

## Offen vor Übernahme

Echtes Mobilgerät, WebSocket-/Kartenverfügbarkeit, tatsächlicher Raum- und Zahlungsablauf sowie menschliche Designabnahme. Der lokale Backend-Protokollfix d699efa wird separat behandelt und ist nicht Bestandteil des Backend-Design-PRs. Backend und App müssen hinsichtlich RoomList-Protokoll zusammen geprüft werden. Kein Merge/Deploy durch diesen Review.

## Ergänzung: Sende-Button und Safari-Tastaturversatz

- Raumchat-Sende-Button: transparente blaue Fläche, heller SVG-Pfeil und feine Glaskante; doppelte unbenutzte place-send-link-Regeln entfernt. Versand-/Zugangslogik unverändert.
- Reproduzierter Layoutfehler: Der höher spezifische Soft-Keyboard-Block in lup-online-core.css setzte inset:0 und überschrieb --lup-viewport-top aus lup-viewport.js. Die redundante Positionierung wurde entfernt; lup-place-room.css ist jetzt allein für Höhe und Offset verantwortlich.
- Die zusätzliche focus-Regel, die die Topbar verbarg, ist entfernt. Navigation bleibt beim Schreiben sichtbar.
- Gegenbefund von Mira im IRC vom 20.09.: unabhängig dieselbe inset:0-Ursache bestätigt; keine parallelen Änderungen durch Mira.
- Chromium-Darstellungstest mit Angular-Komponenten und simulierten VisualViewport-resize/scroll-Ereignissen: Breiten 320/390/1440; mobil Höhe420 mit Offset0/60/130/0. Vorher Composer-Unterkante stets420, erwartet420/480/550/420. Nachher alle vier Werte korrekt. Raumchat- und Privatnachrichten-Composer geprüft, Topbar sichtbar. Isolierte Testdaten, keine Nachricht verschickt. Kein echter iPhone-/Safari-Test; dieser bleibt Abnahmepunkt.
- Vorhandene drei mobile-viewport-Tests bestehen, PHP-Lint/index_debug und git diff --check sauber. Der frühere Gesamt-Testbefund mit neun Baseline-Fehlern bleibt unverändert; nicht erneut als vollständig grün bezeichnet.

## Raumchat: feste Navigation und kompakte Ereignisanzeige

Die Fokus-/Keyboard-Regeln ändern jetzt keine Abstände der Location/Chat/Online-Leiste mehr. Nur Gesprächsüberschrift, Ereigniszusammenfassung und Leerhinweis geben beim Schreiben Platz frei. Neue vom bestehenden Chatservice gemeldete Joins/Shouts erzeugen einen einmaligen Lichtimpuls im Online-Tab des betroffenen Raums. Abruf alter Zusammenfassungen erzeugt kein Ereignis. Die letzte Impulsmarkierung bleibt nach der Animation unsichtbar; sie verändert weder Zähler noch Versand/ACL. Reduzierte Bewegung verwendet nur eine kurze Helligkeitsänderung ohne Skalierung. Angulars auslaufender ng-leave-Effekt ist ausgeblendet, damit schnelle Ereignisse keine überlagerten Impulse erzeugen.

Prüfung: 11 Social-/Viewport-Tests grün; Angular-Darstellungsprüfung mit drei schnellen Impulsen, Ausblenden danach und reduced-motion erfolgreich. Mobil-/Desktop-Viewportprüfung erneut bestanden; keine Nachricht an echte Nutzer gesendet. Physischer Safari-Test und Miras Code-Abnahme weiterhin offen.

## Kürzere Wischbewegung

Die vorhandene Pointer-Erkennung wechselt ab 24 statt 48 CSS-Pixeln; horizontale Bewegung muss mindestens 1,25-mal so groß wie die vertikale sein. Keine neue Gestenbibliothek und kein Eingriff in Daten-/Kategorieauswahl. Chromium mit synthetischen Touch-Pointer-Ereignissen bei 320/390/1440 px: 28px vor/zurück wechselt genau eine Karte, 8px-Tippen sowie vertikale/diagonale Bewegungen lassen die Auswahl stehen. Echte iPhone-Touchprüfung bleibt offen.
