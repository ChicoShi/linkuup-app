# Gleichmaßprüfung der Navigation und Datenleisten

Lokaler Folge-PR-Stand, 9. November 2026. Keine Produktionsfreigabe.

## Korrigiert
- Gast- und Betreiber-Tabs: gleiche Spaltenbreite, lange Beschriftungen dürfen umbrechen.
- Vier Betreiberkennzahlen: vier Spalten auf breitem Bildschirm, zwei mal zwei auf Handy; vorher vier Werte in drei Spalten.
- Artikelwerkzeugleiste und Bestellaktionen: gleiche Buttonbreiten ohne leere Rasterzelle nach Entfernen der CSV-Vorlage im eingebetteten Modus.
- Artikelpreise: identische rechte Spalte pro Zeile (mobil 88px), Beträge im Zahlungsüberblick rechtsbündig.
- Embed-URL enthält App-Buildstand; HTML und CSS werden gemeinsam aktualisiert.

## Geprüft
Echter lokaler Browser mit temporären, ausdrücklich beschrifteten UI-Fixtures; Serveraktionen dabei blockiert. Breiten 320/390/1280: Gasttabs, Betreibertabs, Kennzahlen, Artikelwerkzeugleiste und Preiszeilen gemessen, kein horizontaler Dokumentüberlauf. Mobile Editoraufnahme angesehen. Location/Chat/Online bereits gleich breit. Gastnavigation ohne Wallet verteilt zwei sichtbare Tabs gleichmäßig. Einrichtung, Tischraster und Paketansicht bei390px auf horizontalen Überlauf geprüft. Anschließend Fixtures durch Neuladen verworfen.
134 vorhandene App-Tests und PHP-Syntax/Diffprüfung bestanden.

## Weitere Bereiche – nur Quellprüfung
App- und Backend-CSS für Navigation, Aktionen und Tabellen durchsucht. Bestehende Freunde-/Konto-/Admin-Raster nutzen bereits gleiche Spalten. Datentabellen behalten inhaltsabhängige Spalten und lokalen horizontalen Scrollbereich; Icons und Primär-/Abbruchaktionen werden nicht pauschal gleichgesetzt. Kategorien bleiben eine variable horizontale Filterleiste.
Nicht alle persönlichen Backend-, Admin- oder Dialogzustände wurden im Browser geöffnet. Keine vollständige visuelle Abnahme jeder Route behauptet. Keine Backend-, Rechte-, Zahlungs- oder DBänderung.
