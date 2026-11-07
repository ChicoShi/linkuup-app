# Betreiberweg: Rollen, Zustände und Abnahme

Stand: lokale Folgeänderung nach App PR24 / Backend PR11. Keine Produktionsfreigabe.

## Ein gemeinsamer Einstieg

Sidebar → Mein Betrieb. Ein angemeldetes Mitglied sieht diesen Einstieg unabhängig von einer Freigabe. Laden ist kein abgelehnter Antrag; Fehler bietet Retry. Nach wiederhergestellter Anmeldung wird die Liste neu geladen. Nur ein erfolgreich leeres Ergebnis führt zum Backend-Antrag/Status. Bei mehreren freigegebenen Locations folgt die Auswahl, bei einer direkt diese Location.

| Rolle/Zustand | Sichtbar / nächste Aktion | Berechtigung |
|---|---|---|
| Gast ohne Anmeldung | öffentliche Location/Kartenansicht, reguläre Anmeldung | keine Betreiberaktionen |
| Mitglied ohne Betrieb | Mein Betrieb → Antrag/Status | keine Verwaltung fremder Locations |
| Antrag pending | Prüfstatus, keine wiederholte Antragstellung für dieselbe Zuordnung | keine Betreiberfreigabe |
| Admin | OperatorReview → Zuordnung und Entscheidung prüfen | Admin ist nicht automatisch Betreiber; eigene Anträge nicht selbst entscheiden |
| Freigegebener Betreiber | Locationauswahl → Betreiberanmeldung | nur eigene zugeordnete Location |
| MFA serverseitig nicht bereit | klare technische Sperre, Retry, zurück zur Location | kein Passwortformular und kein Bypass |
| MFA bereit, noch nicht eingerichtet | Kontopasswort → Authenticator verbinden → Code → Wiederherstellungscodes | kein Zugriff vor Bestätigung |
| MFA eingerichtet | Code oder Wiederherstellungsweg → Arbeitsbereich | zeitlich begrenzte Sitzungsfreigabe |
| Betreiberfreigabe widerrufen | keine Verwaltung; veröffentlichte Karte unterdrückt | serverseitiger Status maßgeblich |

## Antrag und Adminprüfung

Backend OperatorApply: Einrichtung, vorhandene eigene Location oder neue Einrichtung, Kontakt, Rolle/Nutzung → absenden → Status. Keine automatische Zahlung, kein automatischer Vertrag, keine automatische Adminrolle.

**Lokal ergänzt, noch zu prüfen:** Ein Antrag ohne oa_room erhält eine getrennte Aktion „Location zuordnen“. Das Team legt die Location zuvor regulär für den Antragsteller an; ein anderer Admin trägt deren ID am offenen Antrag ein. Die Transaktion prüft aktive Mitglieder, Adminrecht, unveränderte Version, Eigentümer und nicht gelöschte Location sowie Doppelanträge. Sie schreibt die Historie und erhöht die Version, lässt den Antrag aber pending. Danach mit der neuen Version gesondert freigeben. Keine Selbstzuordnung, keine automatische Eigentumsübertragung und keine automatische Freigabe. Die bisherige Doppelantrag-Schleife entfällt. Isolierte DB-Prüfung bestanden; echter HTTP-Formularablauf bleibt ausstehend.

## Einrichtung und Tagesgeschäft

1. Karte & Tische → Karte bearbeiten: Artikel, Kategorie, Preis, Verfügbarkeit speichern; zurück zur Einrichtung.
2. Tische verwalten: feste Nummern aktivieren; zurück zur Einrichtung.
3. Bestellungen bewusst freigeben, erst bei vollständiger Einrichtung. Der aktuelle Backendweg veröffentlicht dabei auch die Karte.
4. Bestelltafel: neue / laufende / abgeschlossene Aufträge; Statuswechsel, Nachrichten. Automatische Aktualisierung darf Eingaben/Dialogs nicht überschreiben.
5. Pause stoppt neue Bestellungen, erhält offene Aufträge. Die bereits veröffentlichte Karte bleibt grundsätzlich lesbar, solange Location/Betreiber freigegeben sind.
6. Betreiberpaket ist ein Informationsbereich; **keine fertige Abrechnung** und kein buchbares Abo. Tab deshalb nicht „Abrechnung“ nennen.

**Offen:** Eigenständige Veröffentlichung nur der Karte ohne aktivierte Bestellungen ist derzeit nicht als eigener UI-Schritt verfügbar. Vor weiterer Umsetzung explizit mit Backendvertrag abgleichen.

## Gastweg

Location → Karte (ohne Betreiberabo). Ohne veröffentlichte Karte: verständlicher Leerzustand und zurück. Veröffentlichte Karte ist unabhängig vom Standort lesbar; Bestellen benötigt serverseitige Standortprüfung, aktive Bestellung, Tischwahl und gültige Preise/Verfügbarkeit. Warenkorb → Bestätigung → Status. Guthaben/Zahlungen sind weiterhin simuliert; ein veröffentlichter PR ist kein Zahlungsnachweis.

## Technische Grenzen und Testbelege

- Öffentliche App lieferte beim letzten lesenden Check alte Dateien, obwohl PR24 gemergt war. Hostingziel/Release müssen zugeordnet werden.
- Gastro-Frontend und Backend sind auf lokale Pilotumgebung beschränkt. Keine Freigabe durch Entfernen einzelner Hostchecks.
- Lokale Testbar100452 gehört dem lokalen Konto3; Simulation, kein Abo/Vertrag. Authentifizierter GastroVenues-Aufruf liefert sie. Kein MFA-Serverkey vorhanden, daher tatsächlicher Bearbeitungsweg blockiert.
- Auth-Restore-Fix12a6169: 120 App-Tests; echter lokaler Sidebarweg öffnet die MFA-Sperrseite.
- Neuer Sperrseitentext benennt die fehlende technische Einrichtung; Retry und Rückweg werden separat geprüft.

## Verbindliche Abnahme vor einer Fertigmeldung

Echte separate Sessions für Gast, Betreiber, fremden Betreiber und Admin verwenden. Antrag→Zuordnung→Freigabe→MFA→Artikel→Tische→Veröffentlichung→Gastansicht→Bestellung→Status→Pause→Widerruf prüfen. Dazu Zurück/Reload, langsames Netz/Fehler/Retry, Konto-/Locationwechsel, abgelaufene MFA, fremde IDs und zwei konkurrierende Statuswechsel. Mobile und Desktopansicht prüfen. Offene Integrationspunkte separat melden; isolierte DOM-/Unit-Tests sind kein vollständiger E2E-Nachweis.

## Neue Prüfbelege

122 App-Tests bestanden, darunter Retry/Return und Herkunftsprüfung des iframe-Schließsignals sowie Listenerabbau. Backend: 38 isolierte DB-Serviceprüfungen auf temporärem MariaDB ohne Netzwerk, einschließlich Selbstzuordnung, Fremdlocation, gelöschter Location, gesperrtem Mitglied, veralteter Version, Doppelantrag, Historie und separater Freigabe. Synthetisches Schema, kein Nachweis des kompletten HTTP-/CSRF-Lebenszyklus. 19 Eingabeprüfungen und PHP/JS-Syntax/Diff bestanden. Keine reale Freigabe oder Datenmigration vorgenommen.
