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

## Ergänzung: Glas und Online-Anzeige

- Alle `!important`-Zusätze aus den eigenen Styles entfernt. Vorhandene Dateien und Imports weiterverwendet; keine neuen CSS-Dateien. Angular-Toolbar, Suchfeld und Dialog erhalten gezielt passende Selektoren für die normale Kaskade.
- Location-Karte als weitgehend transparente Glasschicht mit schmalen Kantenreflexen. Beim Wischen werden nur die zwei sichtbaren Karten aktualisiert. Linie unter der Kategorieauswahl entfernt und Abstand zur Karte verkleinert.
- Route und Chat betreten teilen sich ein Bedienelement. Das Standortsignal bestimmt dessen Funktion; unmittelbar vor dem Chatwechsel wird die Reichweite erneut geprüft. Serverseitige Zutritts- und Besucherkontaktsperren bleiben erhalten.
- Beitritts-/Austrittsbanner entfernt. Der Online-Zähler animiert echte Änderungen an `room.USERS`; beim ersten Rendern und bei reduzierter Bewegung bleibt er ruhig. Acht Avatare stehen separat, danach steigt die Überlappung bis 45 % bei zwanzig Avataren. Zusätzliche Besucher erhöhen den ungekürzten Gesamtzähler.
- Aktuellen Upstream einschließlich Kategoriezuordnungen übernommen und eine doppelte, ältere Kategoriedefinition entfernt.

### Prüfung dieser Ergänzung

- 30 Node-Tests erfolgreich, einschließlich Standortwechsel zwischen Klick und Chatöffnung, Avatargrenzen, Zähler, reduzierter Bewegung und Aufräumen beim Verlassen der Ansicht.
- Produktionsbuild erstellt und JavaScript-/PHP-Syntax sowie Diff geprüft. Eigene CSS-, JS- und Template-Dateien enthalten keine `!important`-Zusätze.
- Browser mit Touch bei 320/390 px und Desktop bei 1440 px. Kurze 36-px-Gesten wechseln jeweils eine Karte; 5-px-Zittern und vertikale Gesten wechseln keine Karte.
- Avatarbelegung 0/8/14/20/45 bei drei Breiten: keine Überstände, höchstens zwanzig Gesichter, Gesamtzahl bleibt vollständig.
- Tatsächlicher lokaler Chatbeitritt im Produktionsbundle: Mitgliedschaft bestätigt, Online-Zahl 1, Nachrichtenfeld sichtbar und keine zusätzliche Chatnachricht. Keine Nachricht versendet. Private Nachrichtengestaltung mit ausschließlich lokalen Layoutdaten geprüft.

Lokaler Vorschlag zur gemeinsamen Durchsicht; kein Deployment. Test mit physischem iPhone/Safari und produktiven Konten bleibt ausstehend.

### Nachkorrektur: klare Tropfenkante und kurzer Wischwechsel

- Glasmitte nahezu ungefüllt (Alpha 0,006), ohne flächigen Backdrop-Weichzeichner. Gewölbte Kante mit schmalen, maskierten Randreflexen; vorhandene Hintergrundlinien bleiben sichtbar. Veraltete dunkle Kartenfüllung aus der gemeinsamen Hintergrunddatei entfernt.
- Wischschwelle 24 CSS-Pixel. CSS-Snapping bleibt bis zum Abschluss des Übergangs deaktiviert; ein kurzes Wischen springt dadurch nicht vorzeitig zur Ausgangskarte zurück. Fingerbewegungen werden einmal pro Bild zusammengefasst, die Auswahl erst nach dem Übergang aktualisiert.
- Unveränderte GPS-Updates lösen keine erneute Zentrierung aus. Während einer Geste oder des Übergangs unterbrechen Hintergrundupdates die Karte nicht. Vertikale Gesten, Abbruch, reduzierte Bewegung und der Schutz gegen versehentliche Klicks bleiben berücksichtigt.
- 31 Tests erfolgreich, einschließlich kurzem Wechsel, Abbruch, GPS während der Geste und gebündelten Bewegungen. Produktionsbuild 593 erstellt. Im bereits geöffneten Chromium-Tab mit iPhone-Emulation wechselte ein 28-Pixel-Zug genau von Karte 7 auf Karte 8; klare Glasfläche dort visuell kontrolliert. Kein zusätzliches Browserfenster geöffnet.


## Glaslinse und Avatarplatzierung – lokale Überarbeitung

- Dieselbe blaue Vektorszene wird außerhalb und innerhalb der Karte abgebildet; im Zentrum 1,055-fach, im schmalen Rand 1,16-fach vergrößert. Hintergrundkoordinaten bleiben beim Wischen synchron. Kein SVG-Backdrop-Filter und keine Verzerrung von Schrift oder Bedienelementen. Der Effekt ist auf dieses gemeinsame Hintergrundmotiv beschränkt.
- Nur aktuelle Karte und je zwei Nachbarn erhalten vollständige Angular-Inhalte. Der Katalog bleibt vollständig erhalten. Keine Layoutmessungen pro Wischframe; Glasbewegung über Transform.
- Snap wird bereits beim Gestenbeginn deaktiviert. Kurze horizontale Gesten wechseln eine Karte; vertikale Bewegung und kleine unbeabsichtigte Bewegungen bleiben davon getrennt. Namen, Adressen und Präsenzbereich reservieren Höhe gegen Versatz.
- Pfeilbuttons entfallen; Avatare und ein Online-Zähler sitzen unter den Aktionen. Acht Gesichter separat, anschließend bis 45 % Überlappung bei maximal 20; Gesamtzahl zählt weiter. Keine erfundenen Besucher in der Anwendung. Fokus auf der Leiste unterstützt Pfeile, Home und End.
- Chat-Verfügbarkeit erhält grünen Rand und Statusschein. Vorhandene CSS-Dateien bearbeitet, keine neuen Imports und kein `!important`.

Prüfung: 31 Node-Tests; Syntax- und Diff-Prüfung. Chromium mit 390 px: neun Touchsequenzen mit 28 px vor/zurück bzw. 18 px ohne Wechsel bestanden; maximal fünf vollständige Karten, durchgehend 529 px Leistenhöhe im geprüften Ausschnitt, p95 Frameabstand rund 16,7 ms, keine Long Tasks im Messlauf. Browser-Testdaten für 0/8/9/20/103 Online-Gäste bei 320/390/1440 px: Avatare innerhalb der Karte, unter den Aktionen, korrekter Gesamtzähler. Testdaten anschließend im isolierten Testbrowser entfernt; keine Serverdaten geändert. Kategorie, leeres Suchergebnis, erster/letzter Eintrag per Tastatur, Detailansicht und Rückkehr sowie reduzierte Bewegung geprüft.

Grenze: Chromium-Emulation und lokale Daten, kein Leistungstest auf einem physischen iPhone/Safari. Sichtbare Freigabe durch Shippi steht aus.

## Profil, soziale Aktionen und lokale Präsenzvorschau

- Profilkopf und Avatar zentriert; vorhandene animierte Statistikschalter erhalten. Die Profilbereiche nutzen eine begrenzte Inhaltsbreite, eine ruhige Informationsmatrix und den rahmenlosen Schalter „Details entdecken“. Die zuvor beim Fokussieren seitlich verschobene Tab-Fläche ist ersetzt.
- Seitenleiste mit blauer Glasfläche, kompaktem Profilkopf, eigenem scrollbarem Menü und erreichbarem Schließen-Button. Glocke und Ereignis-Menü öffnen gezielt Ereignisse, private Nachrichten gezielt den Posteingang.
- Freundschaftsaktionen warten auf die Serverbestätigung. Fehler und abgebrochene Dialoge lösen die Sperre wieder; abgesagte Aktionen werden nicht als Erfolg dargestellt. Freundschaftszahlen werden nach Ereignissen vom Server aktualisiert, statt bei wiederholten Ereignissen hochgezählt zu werden. Anfragen aus Profil und Suche bleiben möglich; Besucherkontakte außerhalb eines Standorts bleiben gesperrt.
- Ereignisse werden mit einem zusätzlichen ID-Cursor geladen, damit gleiche Zeitstempel keine Einträge verschlucken. Ungelesene Gesamtzahlen bleiben unabhängig von den bereits geladenen Seiten. Annehmen/Ablehnen aktualisieren die Anfrage erst nach Bestätigung.
- Hilfedialoge werden je Konto nach Schließen oder Bestätigen lokal und serverseitig gemerkt. Wiederholungen durch Netzfehler und Antworten einer alten Anmeldung sind abgefangen. Ein ausdrückliches Zurücksetzen in den Einstellungen bleibt möglich.
- Private Lesestatus-Häkchen sitzen innerhalb der Nachrichtenblase. Soziale Menüs und Hilfe verwenden die gemeinsame blaue Dialoggestaltung. Die bestehende Location-Glaslinse bleibt erhalten. Keine neuen CSS-Dateien oder Imports, kein `!important`.
- `?preview=presence` aktiviert ausschließlich auf localhost/127.0.0.1/::1/app.localhost eine Vorschau für „Braunschweig Chat“: 20 markierte Demo-Avatare und drei schreibgeschützte Beispielnachrichten. Die echten Mitglieder und deren Zähler werden nicht verändert. Vorschau lässt sich direkt wieder beenden; keine Bots, Nutzer oder Nachrichten auf der Live-Installation angelegt.

Prüfung: 38 Node-Tests erfolgreich. Produktionsbuild 598 erstellt und JavaScript-/PHP-Syntax, Locale-JSON und Diff geprüft. Lokale Browser-Abläufe mit getrennten Testprofilen: Anfrage, Annahme, Ablehnung, Zurückziehen und Entfernen; nach dem Entfernen die gespeicherte Beziehung auf beiden Seiten erneut abgefragt. Unberechtigte Annahme abgewiesen. Private Häkchen geometrisch innerhalb der Blase geprüft. Mobile und Desktop-Darstellung, Sidebar-Scrollen sowie die gekennzeichnete Vorschau geprüft.

Backend und App gehören zu diesem gemeinsamen Prüfstand. Die lokale WebSocket-Anwendung wurde für den Test neu gestartet. Gastkonten dürfen laut bestehender Serverkonfiguration keine privaten Nachrichten senden; diese Sperre bleibt erhalten. Versand zwischen zwei registrierten Konten, echter QR-Kamera-Scan und physisches iPhone/Safari bleiben separate Freigabechecks. Noch kein Deployment oder Versand dieser Änderungen.

## Kategorien zurücksetzen und Glasflächen angleichen

- Eigener Reset in der Kategorienleiste: zwei ineinandergreifende GPS-Nadeln ziehen sich zusammen, ein kurzer Blaseneffekt löst sich auf und die fünf Kategorie-Symbole leuchten nacheinander. Wiederholte Tipps ersetzen laufende Effekte; bei reduzierter Bewegung bleibt die Funktion ohne Bewegung verfügbar.
- Reset entfernt Suche und Kategorieauswahl und kehrt zur ersten Location zurück. Scroll-Synchronisierung und CSS-Snapping bleiben während des Listenwechsels kurz ausgesetzt, damit eine aus der gefilterten Liste wiederverwendete Karte das Ziel nicht überschreibt.
- Kategorie-Buttons, normale Chatblasen und die Online-Gästeliste teilen die vorhandene nahezu transparente Glasfläche. Eigene Nachrichten behalten einen sehr leichten Farbunterschied. Die obere Testgast-Vorschauleiste ist entfernt; die lokale Beispielkennzeichnung im Chat und an Demo-Profilen bleibt sichtbar.
- 39 Node-Tests erfolgreich, einschließlich veralteter Scrollereignisse während Reset, Wiederholung, Aufräumen und reduzierter Bewegung. Build 602 erstellt und geprüft. Produktionsbundle im Chromium bei 320/390/1440 px: Reset nach Filterwechsel auf Index 0; acht schnelle Tipps ohne laufende Restanimation; sechs Buttons passen ohne Überlauf. Chat und Online zeigen 20 lokale Demo-Gäste mit transparenter Fläche, ohne obere Vorschauleiste. Keine JavaScript-Ausnahmen im Ablauf.

Aktueller Stand für den gemeinsamen App-/Backend-PR; noch kein Live-Deployment. Die oben beschriebenen Geräte-/Kontotests bleiben vor der Freigabe ausstehend.
