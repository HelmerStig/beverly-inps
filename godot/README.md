# Sanmauro Fighters — Godot 4.7.2

Aprire `project.godot` con Godot 4.7.2 e premere **F5**.
La scena principale è `scenes/title/title_screen.tscn`.

## Step 1: schermata iniziale

- Fondale della sezione UI della demo: dieci PNG originali, composizione cover
  3240×1080 centrata in 1920×1080, nuvole a 6/12/20 px/s e riflessi sincronizzati.
- Foschia a bande e polvere deterministica come nella demo. Acqua statica.
- Logo `10099`, ingresso animato, neon “Beverly INPS” e testo lampeggiante
  “PRESS ENTER TO START” ripresi dalla TitleScreen del vecchio progetto.
- **F8** confronta tutta l'interfaccia con/senza CRT, foschia e polvere.
- **F11** alterna finestra e fullscreen. Il rapporto 16:9 è conservato.
- Invio/Start apre il menu **Single Player / Versus / Debug** e assegna il focus
  alla prima voce. Frecce, direzionale o stick navigano; Invio/A o clic selezionano.
- **B del joypad** oppure **Esc** torna al titolo e ripristina il testo lampeggiante.
  Le voci emettono `mode_selected` (`single_player`, `versus`, `debug`);
  Debug apre lo stage descritto sotto; Single Player e Versus saranno collegati
  nei prossimi step.
- Apertura menu e conferma: `assets/sounds/sfx/light-punch.wav`.
  Cambio voce con tastiera, joypad o mouse: `assets/sounds/sfx/swosh.wav`.
  Il focus iniziale non aggiunge un suono di navigazione alla conferma.

Fondale, logo, testi e pulsanti sono composti nello stesso SubViewport prima
dei passaggi CRT: scanline, bloom, fosfori e vetro coprono l'intera interfaccia.
Il SubViewportContainer inoltra mouse, tastiera e joypad al menu filtrato.
I margini dei pulsanti compensano la baseline del font Oswald per centrare
visivamente le scritte.

## Step 2: Debug — stage, idle, movimento e camera

Dal menu iniziale scegliere **Debug**. La pagina usa Piazza Europa della demo,
2550×1080, con finestra 1920×1080 inizialmente centrata (offset camera 315).
I selettori superiori **P1** e **P2** consentono di cambiare indipendentemente
tra tutti i sette personaggi, anche selezionando lo stesso su entrambi i lati.
Il cambio conserva posizione e camera e riavvia la nuova idle.

- **P1:** A/D; primo joypad collegato: stick sinistro o direzionale.
- **P2:** J/L; secondo joypad: stick sinistro o direzionale.
- **Selezione personaggio:** ?/? per P1, ?/? per P2; frecce cliccabili anche nella toolbar.
- **Centra / Reset:** ripristina posizioni iniziali e camera centrale.
- **Esc / Indietro:** ritorna al titolo. Nei selettori aperti chiude prima il popup.
  B del joypad ? riservato alle mosse e non esce dal Debug.
- **F8 / F11:** confronto senza effetti / fullscreen.

Le posizioni usano le animazioni di locomozione descritte sotto.
Non sono ancora implementati attacchi o pushbox separate.
I personaggi si rivolgono automaticamente l'uno verso l'altro; l'avanzamento
si ferma quando le hurtbox entrano in contatto.
Tutte le idle mantengono frame e FPS della demo (24 FPS: Arianna 24 frame,
Mangler 49, Torpe 61, gli altri 63). Le proporzioni usano la scala normalizzata
moltiplicata per altezza/165 e per 4/3, come nello stage della demo.
Ombre e contatti delle suole seguono il frame corrente. CRT, foschia, polvere
e tinta calda riprendono i valori della demo; il CRT copre anche la toolbar.

La camera segue i bordi, senza spostarsi per movimenti dentro l'area visibile.
Lo scroll è limitato a 0–630 e mantiene 180 px di margine per i personaggi.
La distanza massima è 1560 px: un fighter non può spingere fuori vista l'altro
né trascinarlo quando è fermo. Il vincolo viene risolto per entrambi i movimenti
dello stesso frame. Questa è la variante ai bordi richiesta; il vecchio
MainArena seguiva invece continuamente il punto medio dei personaggi.
Le hurtbox idle sono ora definite come descritto sotto; hitbox d'attacco ed editor
interattivo delle box restano ai prossimi step.

Gli asset necessari sono locali: cinque livelli e le animazioni di locomozione
dei sette personaggi (35 sequenze, con fogli condivisi dove previsto).
Per rigenerarli dai dati verificati della demo, dalla radice del repository:

```powershell
node godot/tools/import-debug-assets.cjs
```

Il catalogo ridotto con provenienza, SHA-256, frame e contatti è
`data/debug-roster.json`. Non richiede il progetto Godot precedente.
Verifica con renderer reale:

```powershell
& 'C:/Program Files (x86)/Godot_v4.7.2-stable_win64_console.exe' --path godot --script res://tests/debug_screen_check.gd --windowed --resolution 1920x1080
```

Il controllo include tutti i cambi personaggio, avanzamento delle idle, limiti
camera e distanza in 300 movimenti ripetibili, input da tastiera, selezione con frecce, B riservato e ritorno con Esc
e apertura dal titolo. Il mapping dei joypad è predisposto; il test non sostituisce
la prova fisica di due controller. Anteprima locale: `tests/artifacts/debug-screen.png`.

## Hurtbox delle idle

**F3** mostra/nasconde le hurtbox di entrambi i personaggi nel Debug. La scelta
resta attiva cambiando personaggio. L'overlay segue frame, scala fisica,
posizione, camera e riflessione del fighter, anche con CRT disattivato.

Ogni personaggio ha 13 capsule anatomiche: testa (giallo), tronco/bacino (azzurro),
braccia, avambracci, cosce, stinchi e piedi (verde). Sono forme di ricezione del
colpo, non hitbox offensive né pushbox. Non infliggono danno e non impediscono
di attraversare l'avversario.

Le capsule sono vere `CollisionShape2D` in un'`Area2D` monitorabile sul layer 2,
con maschera 0: restano presenti anche quando F3 nasconde il disegno.
Le future hitbox potranno cercare questo layer. La metainformazione `body_part`
sulle forme identifica la parte anatomica. Tutte le forme sono indipendenti
per istanza: modificare P1 non modifica P2.

Le sagome sono state analizzate sui PNG originali: i riferimenti anatomici del
frame 0 sono in `data/idle-hurtbox-seeds.json`. Chignon, cappelli e capelli sciolti
non ingrandiscono automaticamente la testa. Le capsule distinguono gli arti e
lasciano vuoti tra gambe e guardia, invece di usare un rettangolo dell'intero PNG.
Il generatore adatta le posizioni con confronto locale di colore/alpha tra i
frame; per gli arti registra separatamente i due estremi, seguendo le flessioni.
È una prima proposta per il gameplay, da rifinire con le future mosse e prove
di combattimento, non una segmentazione anatomica esatta o un bilanciamento definitivo.

`data/idle-hurtboxes.json` conserva le 13 capsule di ciascuno dei 386 frame idle,
in coordinate locali della cella sorgente 512×512. Include hash del PNG e della
sequenza; il runtime controlla provenienza e numero di frame contro il catalogo.
Per rigenerare, con Python e Pillow:

```powershell
python -B godot/tools/build-idle-hurtboxes.py
```

Il generatore non modifica i PNG e salva confronti primo/centrale/ultimo frame in
`tests/artifacts/hurtboxes-<personaggio>.png`. Il controllo Debug verifica anche
validità delle capsule in ogni frame, toggle F3, cambio personaggio e query fisica
di una hurtbox con overlay nascosto. Anteprima: `tests/artifacts/debug-hurtboxes.png`.
Gli asset sono copie locali; il gioco non richiede il vecchio progetto o la demo.
La provenienza di logo/font è in `assets/ui/title-sources.json`; quella dei livelli
è in `assets/ui/title-screen/screen.json`.

## CRT

`crt_pipeline.gd` carica il preset originale `crt-preset.json` e costruisce:

1. Preparazione: grana, livelli, gamma, conversione in luce lineare.
2. Selezione delle luci per bloom.
3. Blur orizzontale e verticale del bloom.
4. Fosfori LCD, glow e convergenza.
5. Composizione screen del bloom e conversione del colore finale.
6. CRT base: contrasto, saturazione, luminosità, trama RGB, scanline, vignetta e vetro.

Sono sette passaggi shader, oltre al viewport sorgente, a risoluzione 1920×1080.
Si usano buffer 2D senza HDR e il renderer Compatibility: gli shader eseguono
esplicitamente le conversioni colore della pipeline RGBA8 WebGL.
Il preset avanzato conserva tutti i valori della demo, senza aggiungere i vecchi
shader Godot dell'acqua o del color grading.

I cinque shader avanzati derivano da `demo-moves-sanmauro/crt-webgl.js`:

```powershell
node godot/tools/build-crt-shaders.cjs
```

Il CRT base è scritto in `shaders/crt/base.gdshader`. Il vetro e le ombre interne
del bordo sono un adattamento dei gradienti e box-shadow CSS; non si dichiara
un'identità pixel per pixel. La scala della trama è riferita al rendering 1080p.

## Verifica

Dalla radice del repository, con un renderer reale per compilare anche gli shader:

```powershell
& 'C:/Program Files (x86)/Godot_v4.7.2-stable_win64_console.exe' --path godot --script res://tests/title_screen_check.gd --resolution 1920x1080
```

Il controllo verifica caricamento livelli, compilazione shader, preset, segnale
Start, output e confronto senza effetti. Salva PNG locali in `tests/artifacts/`,
esclusa da Git e dall'importazione Godot.

Per generare il riferimento browser fermo a t=0:

```powershell
node godot/tools/build-title-reference.cjs
```

Aprire l'HTML generato con accesso ai file locali, a 1920×1080 e scala 1×.
Salvare la sola viewport come `tests/artifacts/browser-reference.png`.
Se presente, il controllo confronta anche questa immagine con l'output Godot.
Il riferimento richiede la demo nel percorso relativo del repository.

Verifica del 7 novembre 2026: Godot 4.7.2 / OpenGL Compatibility su RTX 2060,
zero controlli falliti. Confronto con Chrome/SwiftShader a 1080p e t=0:
errore medio RGB campionato su griglia di 5 px pari a 0,01313 su scala 0–1.
Questa misura riguarda il fondale, non il logo, e non certifica altre risoluzioni
o tutti i frame dell'animazione. Shader, vetro e bordi sono stati anche ispezionati
visivamente. L'ambiente di esecuzione segnala un problema del certificato root
Windows, indipendente dalle risorse locali della schermata.

### Blocco al contatto

`hurtbox_contact.gd` calcola la distanza di primo contatto tra le capsule del
frame corrente, comprese estremit? arrotondate, scala e riflessione. Il vincolo
viene applicato al movimento relativo prima di aggiornare la camera, impedendo
attraversamenti anche con spostamenti maggiori di un singolo passo fisico.
Un avversario fermo non viene trascinato; se entrambi avanzano si divide solo
la parte di movimento che li farebbe compenetrare. ? sempre possibile
allontanarsi. Se un cambio di personaggio o posa crea una sovrapposizione,
non vengono applicati scatti di separazione: si blocca l'ulteriore avvicinamento
e si permette di uscire. F3 non modifica questo comportamento.

Il controllo Debug verifica arresto, allontanamento, avanzamento simultaneo,
assenza di attraversamento e non compenetrazione delle forme Godot reali.

## Locomozione

Con i controlli di movimento gi? disponibili (A/D, J/L o stick/direzionale dei
due joypad), avanti e indietro sono relativi al lato dell'avversario:

- Avanti: **camminata**. Indietro: **camminata indietro**.
- **Due tocchi avanti entro 250 ms**, con un rilascio tra i tocchi: corsa.
  Resta attiva finch? si tiene avanti; al rilascio termina e serve un nuovo doppio
  tocco per riattivarla. Tenere una direzione non conta come tocco ripetuto.
- **Due tocchi indietro entro 250 ms**: salto indietro completo, anche se poi si
  rilascia la direzione. Non si ripete automaticamente tenendo indietro.

`locomotion.gd` centralizza riconoscimento e parametri iniziali: camminata
420 px/s, indietro 320 px/s, corsa 840 px/s, salto indietro a 630 px/s
per la durata della sequenza, senza cambiare FPS o tempi dello sprite. Sono valori iniziali del nuovo progetto,
non le velocit? originali Godot. Stage, camera e contatto possono ridurre
lo spostamento effettivo. Reset e cambio personaggio azzerano lo stato e i tocchi;
un controllo UI con focus sospende il movimento.

I dati di idle, walk, backwalk, run e back-jump provengono dal catalogo demo:
frame, rettangoli, FPS, durate variabili e scale sono conservati, incluse le scale
legacy di Mangler e la sua animazione dodge per il salto indietro. Il movimento
verticale incorporato nei PNG del salto non riceve un secondo arco artificiale.
Al termine si torna alla idle, o alla camminata se la direzione resta premuta.
I contatti delle suole per ombre e disegno si rigenerano dopo l'importazione con:

```powershell
python -B godot/tools/build-movement-contacts.py
```

**Hurtbox delle nuove pose:** camminata, camminata indietro, corsa e salto
indietro hanno dati distinti per ogni frame in `data/movement-hurtboxes.json`.
La scala e l'ancoraggio coincidono con quelli dello sprite corrente, comprese
le animazioni legacy di Mangler; il contatto usa le stesse capsule visualizzate
con F3. Non viene pi? impiegato il profilo idle per questi movimenti.

Verifica di input relativi, finestra del doppio tocco, rilascio della corsa,
durata/distanza del salto e caricamento di tutte le 35 sequenze:

```powershell
& 'C:/Program Files (x86)/Godot_v4.7.2-stable_win64_console.exe' --path godot --script res://tests/locomotion_check.gd --windowed --resolution 1920x1080
```

### Correzione ombre e hurtbox di locomozione

In corsa e salto indietro l'ombra usa un piano a terra orizzontale e una
proiezione a direzione fissa: il piede sollevato non inclina pi? il piano come
se fosse un secondo appoggio. Il riferimento ? la suola pi? bassa del frame;
l'ombra resta sul piano dello stage anche nei frame sospesi e attenua l'opacit?
con l'altezza. I piccoli contatti scuri non vengono disegnati sui piedi sollevati.
La idle conserva la sua proiezione approvata, con inclinazione limitata.

Le nuove hurtbox seguono il contorno alpha tramite fasce di capsule adattive,
separando gli spazi trasparenti tra arti. Le fasce poco aderenti vengono
suddivise per seguire meglio mani e gambe inclinate. Il numero varia con la posa;
la idle mantiene le 13 capsule anatomiche precedenti. Le fasce sono una
approssimazione della sagoma visibile (compresi abiti/accessori), da rifinire
per il bilanciamento del combattimento, non una classificazione anatomica.
Le forme inutilizzate vengono disabilitate e riusate per evitare allocazioni
continue. Il calcolo del contatto scarta subito le coppie separate verticalmente.

Rigenerazione dai PNG locali, con Python/Pillow:

```powershell
python -B godot/tools/build-movement-hurtboxes.py
```

Il controllo locomozione verifica ogni frame delle 35 sequenze sui due lati,
l'allineamento tra sprite e hurtbox, l'assenza di rotazioni del piano dell'ombra
e il contatto delle forme reali su 28 combinazioni personaggio/movimento.
I report visivi sono in `tests/artifacts/hurtboxes-<id>-<movimento>.png`.

### Aggancio ombre nella camminata e velocit? del salto indietro

Camminata e camminata indietro ancorano la proiezione alle coordinate effettive
delle suole dello sprite, che possono differire dall'ancoraggio normalizzato.
Con due appoggi sufficientemente distanti e pendenza entro 0,3, entrambi restano
fissi; altrimenti si usa la suola pi? bassa senza inclinazioni instabili. Anche
i contatti scuri sono disegnati sulle suole effettive. Corsa e salto mantengono
il piano orizzontale per non reintrodurre rotazioni con un piede sollevato.
Il controllo verifica l'aggancio dell'appoggio in ogni frame di walk/backwalk
per tutti e sette i personaggi e su entrambi i lati.

Il salto indietro sposta il personaggio a 630 px/s, pi? velocemente della
camminata avanti (420) e indietro (320). La durata e i FPS delle animazioni
restano invariati: cambia solo la traslazione Godot, con distanza risultante
proporzionale alla durata e sempre limitata da stage, camera e contatto.
