# Lokale Gastro-Oberfläche

Auf app.localhost lädt der Karte-Button das eingebettete Menü mit tatsächlicher Location-ID. GDO liefert Rolle und Berechtigung; kein browserseitiger Rollenwechsel im eingebetteten Betrieb. Aufladen/Bestellen bewegt ausschließlich getrenntes Testguthaben. Keine echten Zahlungen und keine Coin-Konversion.

Die separate CLI-Testansicht index.html hat ausdrücklich simulierte Rollen und Beispieldaten; sie ist kein Anmeldetest. Der neue Loopback-Prüfserver befindet sich im Backend unter tools/gastro-wallet-preview/router.php. embed.html ohne room-Parameter dient nur der Vorschau.

Bestehende Location-Gestaltung bleibt unverändert. Nur der Karte-Zugang und ein schließbares Overlay kommen hinzu. Frontend und Backend liegen auf simion/gastro-review-20261106, als Draft zur Gegenprüfung. Vier echte lokale HTTP-Formanmeldungen wurden separat geprüft; ein lokaler nativer App-/WebSocket-Ablauf wurde danach geprüft; aktueller Gesamtstand und Grenzen stehen in ../../Docs/GASTRO-REVIEW.md. Die eingebetteten Texte sind derzeit deutsch; vollständige de/en-Übernahme vor Produktivfreigabe noch ausstehend. Technische und rechtliche Grenzen siehe Backend Commerce/README.md.

Designprüfung5881: Betreiber-Navigation, Kennzahlen und Preisraster verfeinert; OriginalLocation bleibt unverändert. Der localhost-Prüfserver zeigt explizit simulierte Rollen/Beispieldaten. place.html ist eine historische visuelle Fixture, kein funktionierender Login- oder Integrationsnachweis.

## Automatische Bestellaktualisierung
Bestelltafel und Gast-Bestellstatus lesen bei sichtbarer Seite alle fünf Sekunden
den aktuellen Stand. Keine parallelen Polls; Netzwerk-Zeitlimit zehn Sekunden.
Editor, andere Ansichten, offene Dialoge und laufende Bedienaktionen pausieren
die Abfrage. Nach neueren Bedienaktionen werden alte Antworten verworfen.
Fehler und letzter erfolgreicher Abruf sind sichtbar; identische Daten lösen
keinen Neuaufbau aus. Kein Echtzeit-Push und keine Hintergrundbenachrichtigung.
Fünf isolierte Tests und ein lokaler Browserlauf mit simulierten API-Antworten
prüfen neue Bestellungen, Gaststatus, Ausfall und Erholung. Kein Backend-E2E.
