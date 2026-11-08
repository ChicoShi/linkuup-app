# Karten- und Betreiberwege – lokaler Prüfstand 08.11.2026

## Ergebnis

Die Location-Karte und die geschützte Verwaltung sind getrennte Einstiege. Das vorhandene Navy-Design bleibt erhalten; der Dialog ist auf Mobilgerät und Desktop zentriert.

| Person | Einstieg | Befugnis |
|---|---|---|
| Nicht angemeldet | Location → Karte | Veröffentlichte Karte lesen; keine Bestellung, Kontodaten oder Bearbeitung |
| Angemeldeter Gast | Karte → Vor Ort bestellen | Eigene Bestellung nach serverseitiger Standortprüfung; eigenes simuliertes Guthaben |
| Freigegebener Betreiber | Sidebar → Mein Betrieb | Eigene Location nach MFA bearbeiten; Karte separat veröffentlichen, Tische und Bestellungen gesondert freigeben |
| Plattform-Admin | Location → Karte prüfen | Nach frischer Adminprüfung und MFA die Karte korrigieren; Begründung, Revision und Vorher-/Nachher-Hash werden protokolliert |

Admin-Kartenprüfung ist KEIN Betreiberwechsel. Sie erlaubt keine fremden Guthaben-, Bestell-, Tisch-, Abo- oder Freigabeaktionen. Nur aktive Locations mit bestehender Betreiberfreigabe können korrigiert werden. Antrag, Zuordnung und Annahme bleiben im vorhandenen Backend; keine Selbstfreigabe hinzugefügt.

## Änderungen

- `GastroMenu`: explizite anonym erlaubte GET-Leseroute, ausschließlich minimales Kartendatenformat. Lokaler Pilot-/Origin-/Netzwerkfilter bleibt bestehen. Alle privaten Storefelder werden ausgeschlossen. Globale Loginweiterleitung für genau diese Route ausgenommen.
- `menu-publication`: gespeicherte Karte unabhängig von Tischen sichtbar machen; Ausblenden pausiert neue Bestellungen, bestehende bleiben erhalten. Einschalten der Bestellfunktion verlangt weiterhin vollständige Einrichtung.
- `GastroLocal?moderation=1`: Adminrecht unter InnoDB-Sperre frisch prüfen; gleiche Sperrreihenfolge wie Antragsprüfung. MFA/CSRF/Revision gelten auch für Korrekturen. Maximal 500 Admin-Historieneinträge, danach explizite Archivierungsanforderung statt stiller Löschung.
- `GastroVenues` liefert `canReviewMenus` nur als Navigationshinweis. Rechte werden bei jeder Moderationsaktion erneut geprüft. Veraltete Antworten, Fehler und Logout können den Hinweis nicht dauerhaft erhalten.
- UI: reine Kartenansicht, Bestelleinstieg und Admin-Karteneditor; erforderliche Korrekturbegründung, Historie, getrennte Veröffentlichung. Keine neuen Browser-Tabs.

## Belege und Grenzen

- 132 App-Tests bestanden (einschließlich Navigation, anonymer Kartenauswahl, Moderationsdarstellung und Veröffentlichungssteuerung).
- Backend: 179 isolierte Zugriffspolitik-,56 Bestell-/Veröffentlichungs-,41 Moderations- und20 öffentliche Projektionsprüfungen bestanden.
- Temporäre MariaDB ohne Netzwerk: 54 Transaktionsprüfungen einschließlich frischem Adminrecht, parallelem Rechteentzug und Ablehnung nichttransaktionaler Berechtigungstabellen; zusätzlich4 Eigentümer-Sperrtests mit separaten Verbindungen. Keine bestehende Datenbank migriert.
- Echter lokaler HTTP-Abruf ohne Cookies: GastroMenu200/readOnly; POST abgewiesen (409 durch vorgelagerten GDO-Schutz). Authentifizierter Admin-State200/canModerate=true; MFA-ready=false.
- Persönlicher bestehender Chrome-Tab aktualisiert: Karte und Kartenprüfeinstieg sichtbar. Kartenansicht und technische MFA-Sperre tatsächlich geöffnet. Editor/Veröffentlichung ausschließlich als klar markierte synthetische Browserdarstellungen bei390/1280px geprüft; kein Speichern über echte MFA behauptet.

## Noch vor abschließender PR-/Produktabnahme

1. Sichere lokale Bereitstellung von `LINKUUP_MFA_KEY` fehlt. Keine Secrets gespeichert und keine MFA umgangen. Erst danach echter Betreiber-/Admin-Login und vollständiger Speichern-/Veröffentlichen-/Gastbestellablauf.
2. Vollständige HTTP-Rollenmatrix, CSRF-Fehler und Revisionkonflikte mit isolierten Konten für den kombinierten neuen Stand durchführen. Isolierte Regeln/DB-Tests ersetzen dies nicht.
3. Gemeinsamen App-/Backend-PR mit aktuellem upstream abgleichen; keine Aussage über öffentlichen Deploy. Pilot bleibt lokal, Zahlung simuliert, echtes Abo/Provider separat.
4. Bestehende Gastro-Vorschau ist deutsch; vollständige englische Oberfläche bleibt gesonderte UI-Arbeit. Die neuen App-Navigationstexte sind de/en vorhanden.

Dieser Stand ist lokal umgesetzt und testbar, aber wegen der genannten Integrationspunkte nicht als fertiges Produktionsprodukt freigegeben. Kein Push, Merge oder Live-Deploy im Auftrag6399.
