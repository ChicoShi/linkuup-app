# Gastro-Review: App und Backend gemeinsam prüfen

App-PR23 benötigt Backend-PR10 sowie dessen separat zu prüfende Core-/Session-/Login-/WebSocket-Patches. Siehe dort Commerce/INTEGRATION-REVIEW.md und Patchmanifest. Kein isolierter Merge dieser App-Anmeldung auf einen alten Sessionstand.

Die Mitgliedsanmeldung läuft über GDO-HTTP, prüft den neuen serverseitigen Sitzungsstand und authentifiziert danach den WebSocket. Logout funktioniert auch bei ausgefallenem WebSocket. Die App sendet dabei keine Passwortframes. Abgeschlossene Sync-Einträge stören das Aufräumen der Verbindung nicht mehr.

11 gezielte Auth-/Transporttests bestanden; echte Chromium-HTTP/TCP-WS-Anmeldung, Logout/Widerruf und erneute Anmeldung mit tatsächlichen Servicedateien getestet. Zwei getrennte Browser-Sitzungen haben den eingebetteten Gastro-Bestellablauf durchlaufen. Der Testadapter ersetzt keinen vollständigen Angular-SPA-/OAuth-/Registrierungsregressionstest.

Design beibehalten; neue Funktionen bleiben dem vorhandenen Location-Einstieg zugeordnet. Pilot und Testguthaben sind ausdrücklich simuliert. Keine Echtgelder oder Live-Freigabe.
