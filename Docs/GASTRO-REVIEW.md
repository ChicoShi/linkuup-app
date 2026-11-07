# Gastro: Integration in die bestehende LinkUUp-App

Lokaler Prüfstand vom 07.11.2026. App-PR23 benötigt Backend-PR10 und die dort dokumentierten Core-/Session-/Login-/WebSocket-Patches. Kein isolierter Merge auf einen alten Sessionstand.

## Bedienwege

- Gäste öffnen die freigegebene Karte direkt an der Location. Tisch, Warenkorb, eigenes Guthaben und Bestellstatus bleiben in diesem Ablauf. Gäste sehen keinen Betreiberzugang und benötigen kein Betreiberpaket.
- Zugeordnete und nach Antrag freigeschaltete Betreiber sehen **Mein Betrieb** direkt unter **Entfernung kaufen** in der vorhandenen App-Sidebar. Der Eintrag bleibt auch außerhalb der Location verfügbar. Mehrere eigene Locations werden vor dem Öffnen ausgewählt.
- Die Betreiberansicht gliedert sich in **Bestellungen**, **Karte & Tische** und **Abrechnung**. Kartenbearbeitung/CSV-Import, Tischzahl und Bestellfreigabe gelten nur für die gewählte Location. Abrechnung/Paketverkauf sind ausdrücklich noch nicht verfügbar.
- Die ursprüngliche Sidebar, Profil- und Locationgestaltung bleibt erhalten. Gastro verwendet die blaue Gestaltung und dezente Profilbewegung, ohne eine zweite Sidebar im eingebetteten Fenster.

## Rechte und Navigation

`GastroVenues` liefert nur aktuelle eigene, nicht gelöschte Locations mit genehmigtem Betreiberantrag. Beim Öffnen wird die Liste erneut vom Server abgerufen. Eine sichtbare Navigation ersetzt keine serverseitige Autorisierung: Jede Verwaltungsaktion bleibt an die aktuelle Location-Zuordnung und Betreiber-MFA gebunden.

Zugriff verlangt `room_owner` UND einen genehmigten Betreiberantrag. Anträge werden im Backend eingereicht, von einem anderen Administrator geprüft und nach manueller Vertragsklärungsbestätigung freigeschaltet. Das ist kein automatischer Gewerbenachweis oder Aboabschluss. Die bestehende allgemeine VIP-Funktion „Location hinzufügen“ ist hiervon getrennt und wurde nicht verändert. Bestehende Coins bleiben ebenfalls getrennt vom simulierten Gastro-Guthaben.

Veraltete Antworten und abgebrochene Navigation dürfen keine alten Ziele öffnen. Geschlossene Gastro-Fenster pausieren Statusabfragen; Wiederöffnen lädt frisch. Nicht notwendige Animationen respektieren reduzierte Bewegung.

## Lokale Nachweise

- 112 App-Tests bestanden, einschließlich Pollingpause bei offener Sidebar bzw. geschlossenem Hostfenster.
- 14 zusätzliche echte GDO-HTTP-Prüfungen der Betreiberliste: Gäste, eigene/fremde Locations, gefälschter Ownerparameter, Rechteverlust, Mehrlocationfall, gesperrtes Konto und unerlaubte Requests.
- 47 bestehende echte HTTP-Rollen-/Bestellprüfungen wurden im isolierten Neuaufbau wiederholt.
- Vollständige Angular-Browserfolge: Login, ursprüngliche Sidebar, Einstellungen, Mein Betrieb, MFA, Karte/Tische/Freigabe, Gastbestellung mit simuliertem Guthaben, Betreiberstatus bis Lieferung, automatischer Gaststatus, Fenster schließen/wieder öffnen und Browser-Zurück; keine JavaScript-Fehler.
- Unabhängige Agenten prüften Designbilder, Rollen und Navigation. 11 zusätzliche VM-/DOM-Fälle decken späte Antworten, abgebrochene Auswahl und iframe-Lade-/Schließreihenfolge ab.

Diese Nachweise gelten für die ausdrücklich isolierte lokale Konfiguration. Öffentliche Bereitstellung, echter Zahlungsanbieter, Aufladung/Auszahlung, Betreiberabo, Gewerbeprüfung, Steuern/Kasse und Maintainer-Abnahme sind nicht dadurch freigegeben. Keine Zahlung oder Live-Änderung wurde ausgeführt.

## Aktuelle Erweiterung und Prüfgrenzen
Veröffentlichte Karten bleiben während Bestellpausen lesbar. Neue Bestellungen benötigen serverseitig einen frischen, ausreichend genauen Client-GPS-Fix innerhalb der Location; kein gekaufter Distanzbonus. GPS ist manipulierbar, kein sicherer Anwesenheitsbeweis.
55 Gastro-HTTP-Prüfungen bestanden erneut nach dem Lockreihenfolge-Patch; 10 Antrags-HTTP-Prüfungen bestanden nach Ergänzung des Statuslinks. Der aktuelle frisch gebaute Angular-App-Stand bestand den vollständigen lokalen Gastro-Ablauf mit zwei getrennten Chromium-Sitzungen: Sidebar unter Entfernung kaufen, Einstellungen → Mein Betrieb, MFA, Kartenartikel/Tische/Freigabe, Standortprüfung, Testaufladung/Bestellung, Annahme/Zubereitung/Lieferung, automatischer Gaststatus, Schließen ohne Polling, Wiederöffnen und Browser-Zurück; keine JavaScript-Fehler. Registrierung, Logout und Relogin wurden zusätzlich im Build geprüft. Mobilansichten bei 390px; kein echter iPhone-/Safari-Nachweis. Ein spät eintreffendes iframe-Load/Close nach Seitenwechsel wird nun ignoriert und hat einen Regressionstest. Dekorative Flächen folgen nun einheitlich der Profil-Navy-Palette; Text/Fokus bleiben hell.
