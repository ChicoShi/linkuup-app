# Begleitendes Design der Karten- und Zugangswege

Lokaler Folgeauftrag: bestehendes Navy-Design mit den Funktionen weiterführen.

- Leerkarte als klare Statusfläche mit Erklärung und Rückweg; keine erfundene Karte oder Öffnungszusage.
- Veröffentlichte Karte mit Kategorie, Beschreibung, ausgerichtetem Preis und eigenem Bestelleinstieg.
- Erster Abruf hat Ladezustand, feste Fehleransicht und Retry; alle Gastro-Fetches auf zehn Sekunden begrenzt. Späterer Fehler erhält den zuvor geladenen Inhalt.
- MFA-Anzeige erklärt die ausstehende technische Einrichtung. Rückweg auch bei eingerichteter Anmeldung vorhanden; Admintext ohne behauptete Betreiberrechte.
- Navy-Farben, vorhandene Schrift, sichtbarer Fokus, mobile Touchflächen. Keine neue Seite oder Registrierung erzeugt.

134 App-Tests, JS/PHP-Syntax und Diff-Prüfung bestanden. Bestehender Chrome-Tab: Leerkarte mit echtem Rückweg; tatsächliche MFA-Sperre; simuliertes Fetchversagen mit anschließend echtem Retry. Ansichten bei390/1280px angesehen, Karteninhalte nur als gekennzeichnetes UI-Beispiel, keine Daten gespeichert. Screenshots lokal unter simion/research/gastro-flow-design.

MFA-Schlüsselbereitstellung und vollständiger schreibender Betreiber-/Gasttest weiterhin offen. Backend unverändert; kein Push, PR-Update oder Live-Deploy.
