# Karten- und Betreiberablauf – lokaler Prüfstand 08.11.2026

Aufträge 6395/6396. Keine Gesamt-, Produktions- oder Zahlungsfreigabe.

## Rollen und Ablauf

| Rolle | Soll | Heute belegt / offen |
|---|---|---|
| Nicht angemeldet | veröffentlichte Karte ansehen, Anmeldung für Bestellung | GastroLocal verlangt Mitglied/Sitzung; anonymes Lesen fehlt |
| Normales Mitglied | veröffentlichte Karte, eigene Bestellungen; keine fremde Bearbeitung | Access-Policy/Bestelldomain isoliert geprüft; kein neuer vollständiger HTTP-Rollentest |
| Antragsteller | Antrag → Prüfstatus, ohne automatische Freigabe | getrennte Antragslogik; Inputtests bestanden, neuer Zuordnungs-HTTP-Ablauf offen |
| Freigegebener Betreiber | eigene Location → MFA → Karte/Tische → Veröffentlichung → Bestellungen | Codeprüfung und echter lokaler Einstieg; Testbar endet an fehlender MFA-Serverbereitschaft |
| Fremder Betreiber | keine Bearbeitung fremder Karte | Policy fordert serverseitige Eigentümerschaft und Freigabe; Integration weiter prüfen |
| Plattform-Admin | Anträge unabhängig prüfen; mögliche Kartenmoderation | OperatorReview existiert; keine allgemeine Kartenkorrekturrolle. Umfang mit Nutzer klären, keine pauschale Betreiber-/Walletfreigabe hinzufügen |

Normale Mitgliedschaft, Betreiberfreigabe und Plattform-Administration sind unterschiedliche Rechte. Ein Betreiberantrag oder Testfixture ist kein gebuchtes Abo. Keine neue Eigentumsübertragung, kein Echtgeld.

## Lokal korrigiert

- Kartenabfrage unterscheidet idle/loading/error/unavailable/ready. Nur ein erfolgreicher geeigneter Antwortkörper darf fehlende Karte anzeigen.
- HTTP-/Netz-/Antwortfehler führen zu Retry, Timeout nach 10 Sekunden beendet den echten Fetch per AbortController.
- Requestgeneration und Raum-ID verhindern verspätetes Überschreiben; keine UI-Aktualisierung nach Routeabbau.
- Unsupported Host zeigt Pilotgrenze statt fälschlich „keine Karte“; Schutz bleibt erhalten.
- Retry im offenen Dialog zeigt den aktualisierten Zustand. „Zugang geladen“ verspricht keine veröffentlichte Karte, wenn ein Betreiber nur seinen geschützten Bereich öffnen kann.
- Dunkelblauer Dialog, Abstand zwischen Aktionen, de/en, lokaler Cachemarker420.

## Prüfnachweise

127 App-Tests bestanden, einschließlich fünf neuer State-/Fehler-/Timeout-/Renn-/Hostfälle. JS/PHP-Syntax, Locale-JSON und Diffcheck bestanden. Erster Testaufruf aus falschem Arbeitsverzeichnis scheiterte an relativen Pfaden; der vollständige erneute Lauf im App-Repo bestand.
Backend unverändert: 158 Access-Policy, 23 MFA plus 3 Readiness, 19 Antragseingaben, 30 Presence, 50 Ordering und 8 Pilotgate-Prüfungen bestanden. Isolierte Tests, keine frische echte GDO-Login-/DB-Transaktionsabnahme.
Echter Browser: lokale Testbar mit vorhandener Sitzung, Sidebar-Eintrag und Kartenbutton sichtbar; Karte öffnet MFA-Sperrseite. Im Browser kurz ausschließlich GastroLocal-Fetch abgelehnt (Simulation, fetch danach wiederhergestellt); Retry benutzt wieder echten Endpunkt und lädt Zugang. Mobile390 und Desktop1280 geprüft; finaler mobiler Dialog visuell gesehen, kein horizontaler Überlauf. Kein Kontowechsel oder Passworttest.

## Noch notwendige Arbeit

1. Gewünschte Plattform-Admin-Kartenmoderation von Betreiberkonto unterscheiden, separaten minimalen Rechteumfang mit Audit/Versionskonflikten/MFA prüfen.
2. Reguläre lokale MFA-Konfiguration klären; anschließend persönlichen Betreiber-Login und vollständige Bearbeitung prüfen, keine Umgehung.
3. Veröffentlichten Karten-Leseweg für unangemeldete Gäste separat vom geschützten Bestell-/Bearbeitungsweg entwerfen und testen.
4. Eigenständige Kartenveröffentlichung ohne gleichzeitige Bestellfreigabe fehlt im bisherigen Ablauf.
5. Antrag→Zuordnung→Annahme→MFA→Artikel→Tische→Veröffentlichung→Gast/Bestellung→Pause/Widerruf mit getrennten echten Sessions prüfen.
6. Abomodell, Vertrag und Provider-/Zahlungsintegration sind nicht durch UI oder Simulation umgesetzt. Marketing darf keinen verfügbaren Abschluss behaupten.
7. Tatsächliches öffentliches Hosting/Release, Proxygrenze und Schema-/Core-Abhängigkeiten vor gesondertem Deploy klären.

Nächster Schritt: Nutzerantwort zum Umfang der Admin-Korrekturrechte; Simion übernimmt danach gezielte Umsetzung. Kein Push/PR/Live-Deploy in diesem Schritt.
