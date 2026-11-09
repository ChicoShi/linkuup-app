# Bestelltafel – lokaler Prüfschritt

- Offene Aufträge gemeinsam nach `created` aufsteigend; neue unten. Gleiche Zeit behält Serverreihenfolge, alte Datensätze ohne gültige Zeit stabil davor. Statuswechsel sortiert nicht neu. Keine Server-/Geldlogik verändert.
- Gastansicht ebenfalls chronologisch; abgeschlossene Betreiberbestellungen in aufklappbarer Historie. Offen-Zustand bleibt bei Neurendern bestehen.
- Navy-Bestellkarten mit Tisch, Zeit, Status, Artikel-Einzelsummen, Gesamtbetrag, Zahlungszustand und gleich breiten Aktionen. Neue Warteschlangen-Texte mit de/en-Keys; vollständige Übersetzung des bestehenden Gastro-Prototyps bleibt getrennt.
- 137 App-Tests bestanden; neue Regression prüft umgekehrte Eingangsreihenfolge, gleiche Zeit, Statuswechsel und fehlende Zeit. JS/PHP-Syntax und Diff geprüft.
- Bestehender localhost-Tab: beschriftete flüchtige UI-Fixture, API/fetch gesperrt. 320/390/1280px ohne horizontalen Überlauf; Buttons mindestens44px, gleiche Breite. Handy-Screenshots visuell angesehen. Nachricht öffnen/schließen, Historie öffnen und erneutes Rendern geprüft; richtige Aktionen je Status gelesen. Keine echte Bestellung/Zahlung/DBänderung.
- Keine vollständige App-/MFA-/HTTP-Abnahme. Die bekannte MFA-Konfigurationsgrenze bleibt. AGB-Prüfbaustein separat; keine aktive Rechts-/Kassenfreigabe.
