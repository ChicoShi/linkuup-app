# Konto, Betreiber-Einstieg und Kartenhinweis – Review

Folgeänderung nach Gastro-PR #23. Gemeinsam mit dem Backend-PR desselben Branches `simion/localhost-integration-20261107` prüfen.

## Verhalten

- Ein „Mein Betrieb“-Eintrag: Antrag/Status ohne freigegebene Location, sonst bestehende Verwaltung. Dies vergibt keine Betreiberrechte.
- Veröffentlichtes Menü öffnet wie bisher; fehlendes Menü erhält einen eigenen Navy-Dialog. Karte bleibt an derselben Stelle der Einzel-Location sichtbar.
- Kontoübersicht mit Profilansicht und direkten Links zu Profil-/Sichtbarkeitseinstellungen, ohne neue Tabs.
- Sidebar mit Linien-SVGs; ruhiger Ladehintergrund im Debug-Einstieg.
- Same-origin HTTP behält die Hoheit über das HttpOnly-Sessioncookie. Der alte JS-Domaincookie wird entfernt, Cross-origin-Verhalten bleibt bestehen.
- Betreiberlogin zeigt bei fehlendem Backend-MFA-Schlüssel einen Bereitschaftshinweis statt eines unbrauchbaren Eingabeformulars.

## Prüfung

`node --test tests/*.test.cjs`: 114 Tests bestanden. JS/PHP/JSON-Syntax und Diff geprüft.
Zusätzlich lokal isoliert: Konto-Direktwege, Formular-/CSRF-Erhaltung, Kartenleerzustand und Dialogschließen; Darstellung bei 326, 390 und 1280 Pixeln. Diese Browser-Fixtures sind kein vollständiger authentifizierter App-Ende-zu-Ende-Test.

## Review und Integration

- Backend muss den aktuellen `ready`-Status liefern und Betreiberrechte serverseitig prüfen.
- Persönlichen Login, Standort-/Bestellweg und Zurück-Navigation gemeinsam prüfen. Vollständiger aktueller Betreiber-/Payment-E2E ist nicht belegt.
- Lokale Apache-Proxys, Konfiguration und Buildnummer sind nicht Bestandteil des PR. Beim Einspielen reguläre Assetversion erhöhen.
- Keine Echtgeldfreigabe. Bestehende Gastro-Core-/Schema-Abhängigkeiten bleiben separat zu prüfen.
