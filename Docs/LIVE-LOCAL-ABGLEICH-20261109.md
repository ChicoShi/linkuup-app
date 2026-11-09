# Live / vorbereiteter Folge-PR

Vergleich 09.11.2026. App-Basis PR24:500f433, Backend-Basis PR11:a6a8e28; Merge jeweils über öffentliche GitHub-API bestätigt. Vor diesem Prüfschritt lokal Appd86729f, Backendf4f4e17. Kein neuer Push/Deploy.

## Öffentlich gelesen

- https://app.www.linkuup.de/ HTTP200, Build136-gastro-access-state417.
- Öffentliches Listen-Template bytegleich zum lokalen Stand VOR Routenzielkorrektur. Der Route/Chat-Wechsel ist bestehendes Verhalten.
- Öffentliches Detail-Template enthält mapsHref/primaryLocationAction. Gegen PR24 wurde lokal der Admin-Kartenprüfbutton hinzugefügt, der primäre Route/Chat-Link blieb unverändert.
- Öffentliches preview/gastro/app.js weicht vom lokalen Stand ab. Einzelne Controller-Quelldateien HTTP403; nicht als vollständige ausgelieferte Codeprüfung werten.
- Keine angemeldete Live-Sitzung, Standortsimulation, echte Bestellung oder Zahlungsaktion geprüft.

## Neuerungen lokal seit den PR-Heads

1. Betreiberzugang nach wiederhergestellter Anmeldung neu laden; Vorbereitung, Fehler, Retry und Rückwege klar unterscheiden.
2. Bestehenden Antrag getrennt einer passenden Location zuordnen; bleibt pending, keine automatische Freigabe.
3. Anonyme minimale Kartenprojektion im lokalen Pilot; Bestellen weiterhin Anmeldung und Standort.
4. Kartenveröffentlichung unabhängig von Bestellfreigabe; Ausblenden pausiert neue Bestellungen.
5. Gesonderte Admin-Kartenmoderation mit Rechten/MFA/Revision/Begründung; keine fremden Wallet-/Bestellrechte.
6. Navy-Lade-/Fehler-/Leerzustände, Timeouts, Rückwege und Kartenbeschreibung.
7. Symmetrische Tabs, Kennzahlen, Aktionsleisten und Preise.
8. Chronologische offene Bestellungen, neue unten; Status-/Artikel-/Summenanzeige, Abschluss-Historie.
9. Dokumentation/AGB-Arbeitsfassung, keine aktive Vertrags- oder Kassenfreigabe.

## Korrektur dieses Schritts

Beide Routencontroller verwerfen leere, nichtnumerische, außerhalb des Wertebereichs liegende und LinkUUp-Platzhalterkoordinaten0,0. Vollständige Adresse als Fallback; ohne Ziel keine Google-Maps-Navigation. Liste/Detail zeigen dann übersetzte deaktivierte Route. Gültige Koordinaten auf Äquator/Nullmeridian bleiben erlaubt. Gewollter Route→Chat-Wechsel unverändert, keine GPS-Rechte gelockert.

143 App-Tests bestanden, inklusive sechs neuer Routenzieltests; JS/PHP/LocaleJSON/Diff geprüft. Bestehender Localhost-Tab zeigt nach Reload621-gastro-route-target429; Testbar zeigt deaktivierten Hinweis statt0,0-Link. Handyansicht angesehen, kein horizontaler Überlauf. Öffnen externer Navigation wurde vermieden.

## Vor Review weiterhin offen

Miras unabhängige Prüfung neuer lokaler Commits erst nach Bereitstellung; echte Anmeldung/MFA/HTTP-Lifecycle und Core-/Session-/WebSocket-Abgleich; Schreibabläufe, Widerruf und Produktionskonfiguration. UI-/Unitnachweise sind keine komplette Live-Abnahme. Simuliertes Geld bleibt simuliert.
