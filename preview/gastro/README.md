# Lokale Gastro-Oberfläche

Auf app.localhost lädt der Karte-Button das eingebettete Menü mit tatsächlicher Location-ID. GDO liefert Rolle und Berechtigung; kein browserseitiger Rollenwechsel im eingebetteten Betrieb. Aufladen/Bestellen bewegt ausschließlich getrenntes Testguthaben. Keine echten Zahlungen und keine Coin-Konversion.

Die separate CLI-Testansicht index.html hat ausdrücklich simulierte Rollen und Beispieldaten; sie ist kein Anmeldetest. Der neue Loopback-Prüfserver befindet sich im Backend unter tools/gastro-wallet-preview/router.php. embed.html ohne room-Parameter dient nur der Vorschau.

Bestehende Location-Gestaltung bleibt unverändert. Nur der Karte-Zugang und ein schließbares Overlay kommen hinzu. Frontend und Backend liegen auf simion/gastro-local-20261106, als Draft zur Gegenprüfung. Vier echte lokale HTTP-Formanmeldungen wurden separat geprüft; vollständiger App-WebSocket-Login bleibt offen. Die eingebetteten Texte sind derzeit deutsch; vollständige de/en-Übernahme vor Produktivfreigabe noch ausstehend. Technische und rechtliche Grenzen siehe Backend Commerce/README.md.

Designprüfung5881: Betreiber-Navigation, Kennzahlen und Preisraster verfeinert; OriginalLocation bleibt unverändert. Der localhost-Prüfserver zeigt explizit simulierte Rollen/Beispieldaten. place.html ist eine historische visuelle Fixture, kein funktionierender Login- oder Integrationsnachweis.
