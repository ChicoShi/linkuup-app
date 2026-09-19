# App-Review 20.09.2026

Basis: upstream/main fc4cbf6. Feature: simion/locations-visual-rail-20260919.

Enthält Wiederanbindung der bestehenden Location-Glasdarstellung, Kategorien/Reset-Effekt, Rating/QR/Sidebar, Profil-Eigenansicht, stabilere Kopfzeile, Chat-Eingabedarstellung, Kontoübersicht sowie Entfernung-/Shout-/Raumformulare. Sidebar schließt vor den Kaufdialogen. Keine Testgäste oder Datenbank-Seeds.

## Prüfungen

- Vollständiger Node-Testlauf: 45/54 bestanden; dieselben neun fehlgeschlagenen Testfälle auf unverändertem upstream/main (39/48). Navigator-Altannahmen und Room-Loading-Parser/Katalogtests bleiben offen. Keine Behauptung eines vollständig grünen Builds.
- Kauf-/Raumformulare isoliert bei 320/390/1440 px, zusätzlich 480 px Höhe: Aktionen sichtbar, kein horizontaler Formularüberlauf. Mockdaten nur in unversionierter Testvorschau; keine Käufe oder Raumerstellung.
- Angemeldeter lokaler Navigationslauf: Konto, Einstellungen, Profil, Nachrichten, Locations, Shout, Entfernung und Raumformular ohne JS-Ausnahmen. Nach Dialogfix eine statt zwei überlagerte Abdunkelungsflächen.
- Profil mit geöffneten Details bei 320 px: Mausrad und emuliertes Touch-Scrollen geprüft.
- Sidebar bei 320/390/1440 px: Scrollen und Escape geprüft.

## Offen vor Übernahme

Echtes Mobilgerät, WebSocket-/Kartenverfügbarkeit, tatsächlicher Raum- und Zahlungsablauf sowie menschliche Designabnahme. Der lokale Backend-Protokollfix d699efa wird separat behandelt und ist nicht Bestandteil des Backend-Design-PRs. Backend und App müssen hinsichtlich RoomList-Protokoll zusammen geprüft werden. Kein Merge/Deploy durch diesen Review.
