## Ideas

Die Ideen ruhig wild durcheinander.
Auch wenn es manchmal nach ner doofen Idee klingt,
die doofen Ideen stellen sich manchmal als gut heraus,
und die guten Ideen als dämlich.

Also immer Out- mit eurem In-put :)
giz


- UPs ermöglichen wenn bereits weniger als lup_up_dist_tolerance=64m Entfernung besteht, statt selben raum erzwingen.
- Musikrichtunge als profile field
- Audionachrichten (kommt später iwann mit audio plugin)
- Room Slogan zum setzen vom owner. (so ne art kurze info als spruch)
- PM in textconnector ermöglichen.
- unclegame with 100 uniques, 50 hi, mid, lo. all chances are real in mob, you start with lo mid card. 
- Set languagae to channel language for hooks'n'reply'n'stuff.
- botfight.cc - people buy pygdo instances and have to install a root agent that takes prompts (copy protection!) then they get dyndns added to the network.



## Bugs

- Farbe in Locations

## 2026-09-21 – Mobiler Chat-Wiederbeitritt nach Browserwechsel
- Shippi: Nach Rückkehr aus dem Hintergrund ist der Raum verlassen; der untere Beitreten-Button hilft erst nach Neuladen.
- Auf Basis `8ef7780` isoliert reproduziert: `CHATROOM` bleibt nach Disconnect gesetzt und derselbe Join wird ohne Netzwerkframe als Erfolg behandelt. Zusätzlich kann Join vor abgeschlossener WS-Authentifizierung senden.
- Folgepatch: Raum-Merker bei Disconnect löschen, Join auf Connect/Auth warten lassen, alte Socket-Ereignisse ignorieren und wartende Antworten bei Disconnect ablehnen. GPS-/Radiusregeln unverändert.
- Offen: echter iPhone-Test (Beitritt, Hintergrund, Rückkehr, unterer Button) mit gültigem GPS und serverseitiger Anwesenheit. Kein Live-Deploy aus den Tests ableiten.
