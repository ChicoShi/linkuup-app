# LinkUUp App – Arbeitsregeln

## Ziel
LinkUUp ist eine standortgebundene Social-App. Änderungen sollen mobil zuerst,
schnell, zugänglich und visuell konsistent mit dem dunklen LinkUUp-Design sein.

## Sicherer Git-Workflow
- Niemals direkt auf `main` entwickeln oder Live-Systeme verändern.
- Vor Änderungen: `git status --short` und den aktuellen Branch prüfen.
- Nur auf einem Feature-Branch arbeiten; vorhandene, fremde Änderungen erhalten.
- Vor einem PR: den aktuellen `upstream/main` in den Feature-Branch holen.
- Kleine, abgeschlossene Commits erstellen; nicht force-pushen, nicht resetten.
- PRs gehen an `gizmore/linkuup-app:main` und werden von Mira/Gizmore geprüft.

## Prüfen vor dem Commit
- `git diff --check`
- Für jede geänderte JavaScript-Datei: `node --check <datei>`
- Bei Übersetzungen: beide `locale/locale-de.json` und `locale/locale-en.json`
  als valides JSON prüfen.
- Wenn die Ansicht betroffen ist: in lokaler iPhone-Breite und Desktop-Breite
  auf Überlappungen, Fokus, Scrollen und Lesbarkeit prüfen.

## App-Konventionen
- Sichtbare Texte immer über de/en-Locale-Keys führen.
- Keine GPS-/Privatsphäre-Sperren lockern, um UI-Fehler zu verdecken.
- Browser-Cache bei lokalen UI-Änderungen kontrolliert über `index_debug.php`
  aktualisieren.
- Keine externen UI-Frameworks oder großen Abhängigkeiten für kleine Effekte.
- Produktions-Build nur bewusst ausführen: `php build.php`.

## Kommunikation
- Erst kurz Ursache, Plan und Prüfweg nennen; dann implementieren.
- Bei unklarer Produktlogik erst fragen. Keine Annahmen zu Live-Deployment,
  Finanzen oder Zugangsdaten treffen.
