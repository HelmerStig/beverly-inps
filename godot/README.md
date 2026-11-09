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
dei sette personaggi (42 sequenze, con fogli condivisi dove previsto).
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
durata/distanza del salto e caricamento di tutte le 42 sequenze:

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

## Salto normale

- **P1:** W oppure Spazio. **P2:** I.
- **Joypad 1/2:** direzionale su oppure stick sinistro verso l'alto.
- Direzione orizzontale alla pressione: salto verticale, avanti o indietro.
  L'arco resta fissato durante il volo; tenere il salto non lo ripete.
- Preparazione a terra di 4/60 s; movimento orizzontale solo dallo stacco.
- Al contatto con il terreno si azzera l'altezza e si torna subito in idle
  o camminata se una direzione ? premuta, senza recupero bloccante. Reset/cambio personaggio
  annullano il salto. I controlli di selezione restano sulle frecce della tastiera.

Parametri verificati nel vecchio progetto e salvati con hash dei sorgenti in
`data/jump-profiles.json` (valori in unit? della vecchia arena):

| Personaggio | Impulso Y | Gravit? | Velocit? X | Moltiplicatore X da corsa |
|---|---:|---:|---:|---:|
| Arianna | -850 | 1800 | 280 | 1 |
| Mangler | -1275 | 3150 | 280 | 1,35 |
| Bue, Mileto, Oscare, Peir?, Torpe | -1275 | 3150 | 280 | 1 |

Velocit? e gravit? sono moltiplicate per **1080/648** per conservare le
proporzioni rispetto all'altezza della vecchia arena. La traiettoria ? integrata
analiticamente con gli stessi parametri: altezza del nodo fisico circa 334,5 px
per Arianna e 430,1 px per gli altri; volo circa 0,944 s e 0,810 s rispettivamente.
Lo spostamento libero direzionale ? circa 440,7 px / 377,8 px (Mangler da corsa
510 px); camera, stage e hurtbox possono limitarlo. Questi valori descrivono il
nodo, oltre alla posa verticale eventualmente incorporata nel PNG.

Per il salto l'importatore ripristina `sourceFrameDurations`, `sourceFps` e
`sourceTakeoffMs`, invece del timing uniformato della demo con apice a 500 ms.
Tutti i rettangoli e PNG restano quelli del catalogo. ? importata una sesta
sequenza per ogni fighter; i due generatori di contatti e hurtbox comprendono
anche `jump`. Le hurtbox seguono frame, scala e altezza fisica. Il contatto
orizzontale tiene conto del dislivello: due sagome che non si incontrano
verticalmente non si bloccano a vicenda. Ombre sempre proiettate a terra,
contatti delle suole nascosti durante il volo; facing bloccato fino alla fine
del salto e aggiornato dopo l'atterraggio se i personaggi hanno scambiato lato.

Verifica dedicata (profili, apex/distanza a 30/60/120 Hz, startup, direzione
fissata, input W e hurtbox per ogni frame dei sette personaggi):

```powershell
& 'C:/Program Files (x86)/Godot_v4.7.2-stable_win64_console.exe' --path godot --script res://tests/jump_check.gd --windowed --resolution 1920x1080
```

Anteprima locale: `tests/artifacts/jump-screen.png`. I test Jump, Debug e
Locomotion sono passati con Godot 4.7.2. I joypad richiedono una prova fisica.

### Atterraggio senza stallo

Il salto termina alla fine del volo fisico (startup + 2|v|/g), senza attendere
la coda del foglio animato. L'eventuale frazione residua del tick di atterraggio
viene subito usata per camminare: non ? necessario rilasciare e ripremere
la direzione. Tenere il salto continua a non generare salti automatici.

La preparazione e i frame aerei usano il clock sorgente, senza stirare la
sequenza per riempire il tempo fisico. Appena termina la sequenza aerea
(primo rientro delle suole dopo l'apice, esclusa la coda di recupero),
si passa alla idle anche se il nodo ? ancora in aria. La discesa e la velocit?
orizzontale continuano senza interruzione; hurtbox e ombre seguono la nuova posa.
Se il volo fisico termina prima, prevale l'atterraggio immediato. Per Mangler,
il cui foglio non contiene una posa finale a terra, vale la fine della sequenza
o l'atterraggio fisico, senza mantenere un ultimo frame sospeso.
Il controllo Jump include atterraggio immediato e movimento nello stesso tick
per tutti e sette i personaggi.

Il test Jump verifica anche il passaggio alla idle prima del contatto a terra,
la prosecuzione della discesa senza pausa e le hurtbox della idle in aria.

### Discesa accelerata

`descentSpeedMultiplier` in `data/jump-profiles.json` ? impostato a **1,35**.
Salita e altezza massima conservano i parametri originali; solo dopo l'apice
la gravit? viene moltiplicata per 1,35?. Il tempo di discesa diventa quindi
1/1,35 del precedente, con posizione e velocit? continue all'apice.
Il volo complessivo dura circa 0,822 s per Arianna e 0,705 s per gli altri,
escluso lo startup. La velocit? orizzontale resta invariata: il salto
direzionale percorre naturalmente meno spazio perch? atterra prima.
Restano attivi passaggio alla idle a fine sequenza e controllo immediato
all'atterraggio. I valori teorici precedenti descrivono il profilo simmetrico
originale, prima di questa regolazione richiesta. Test Jump superati.

### Sequenza completa e maggiore portata del salto

La sequenza `jump` ora termina esclusivamente alla fine di **tutti** i suoi
frame oppure al contatto fisico con il terreno. La posizione dei piedi dentro
il PNG non viene pi? usata per troncarla: ? una posa, non una collisione.
Se la sequenza finisce prima del volo, viene mostrata la idle in aria, mentre
la fisica e lo spostamento continuano. Atterrando si riprende subito il controllo.
Questa regola sostituisce la precedente ricerca di una posa di rientro delle suole.

I frame di preparazione hanno durata minima di 1/60 s; lo stacco fisico segue
la loro durata reale. Questo evita di comprimere 8?12 frame in soli 67 ms:
Bue/Torpe/Arianna preparano per 150 ms, Mileto per 183 ms, Peir? per 200 ms,
Oscare per 133 ms e Mangler per 83 ms. La salita e l'altezza massima non cambiano.
La parte aerea viene solo accelerata quando ? pi? lunga del volo disponibile,
mai rallentata per allungarne la coda; sono mantenuti tutti i frame, con
hurtbox sincronizzate. Il test verifica che tutti i frame siano visibili a 60 Hz.

`horizontalDistanceMultiplier=2.5` aumenta la portata orizzontale rispetto
alla velocit? aerea originale, senza modificare la discesa rapida n? il salto
indietro. Lo spostamento libero ? circa 959 px per Arianna e 822 px per gli altri
(Mangler da corsa circa 1111 px), prima dei limiti di stage/camera e contatto.
Il test verifica per tutti i sette personaggi il salto partendo dal contatto
con Oscare, il passaggio sull'altro lato senza trascinare l'avversario.

### Arianna: posa aerea 28, contatto al 39, recupero a 100 FPS

Regola specifica del salto normale di Arianna, con numerazione da 1:
si raggiunge il frame 28 durante la salita e lo si mantiene fino alla discesa.
I frame 29?38 seguono la discesa; il frame 39 coincide col contatto fisico a terra.
A terra si riproduce 39?49 a 100 FPS (110 ms totali), poi si torna alla idle
oppure all'animazione di movimento richiesta. La coda non blocca lo spostamento;
un nuovo salto pu? interromperla. Hurtbox sincronizzate alla posa mostrata.
Salto indietro e salti degli altri personaggi non usano questa regola.
Il test Jump verifica il 28 in aria, il 39 al contatto, gli 11 frame a 100 FPS
e la disponibilit? del movimento durante il recupero. A 60 Hz alcuni frame
della coda a 100 FPS non sono materialmente renderizzati; il clock resta corretto.

### Riduzione della portata in avanti

`forwardDistanceScale=0.8` riduce del 20% il solo salto diretto in avanti
rispetto al facing alla partenza, anche partendo in corsa. Il salto direzionale
indietro e il doppio-indietro restano invariati, cos? come fisica verticale
e sequenza specifica di Arianna. La portata libera in avanti diventa circa
767 px per Arianna e 658 px per gli altri, prima dei limiti di stage/contatto.

### Bue e Mangler: sequenze del salto normale

Numerazione visiva da 1, senza modifiche alla fisica o alla sequenza di Arianna:

- **Bue:** raggiunge il 21 in salita e lo mantiene fino alla discesa; durante
  la discesa procede 21?26, arriva al 27 al contatto fisico, quindi riproduce
  27?37 a 100 FPS (110 ms) e torna alla idle/locomozione richiesta.
- **Mangler:** raggiunge il 15 in salita e lo mantiene fino alla discesa;
  riproduce poi 15?1 al contrario, con il frame 1 al contatto a terra.
  Dal tick seguente torna alla idle/locomozione richiesta.

Il recupero non blocca i comandi. Le hurtbox usano il frame realmente mostrato,
anche nella riproduzione inversa. Le regole sono centralizzate in `JUMP_POSES`
di `debug_fighter.gd`; non si applicano al salto indietro. Il test Jump verifica
pose aeree, discesa, touchdown e recupero a 100 FPS, mantenendo i controlli
specifici di Arianna e le verifiche degli altri personaggi.

### Mileto, Oscare e Torpe: pose di salto

Numerazione da 1, con recupero a 100 FPS senza bloccare il movimento:

| Personaggio | Posa mantenuta in aria | Frame al contatto a terra | Recupero a terra |
|---|---:|---:|---|
| Mileto | 25 | 33 | 33?39 |
| Oscare | 21 | 31 | 31?38 |
| Torpe | 18 | 25 | 25?34 |

Durante la discesa si riproduce il tratto tra la posa mantenuta e quella di
contatto. Al termine del recupero torna la idle/locomozione richiesta; le
hurtbox seguono sempre il frame mostrato. Per Oscare la scritta ?38?38?
nella richiesta ? stata interpretata come refuso per ?31?38?, coerentemente
con il frame 31 richiesto al contatto. Le regole di Arianna, Bue e Mangler
restano invariate. Il test Jump comprende mantenimento, discesa, contatto
e durata esatta del recupero per questi tre personaggi.

### Portata simmetrica del salto direzionale

Il salto normale usa ora la stessa portata in avanti e indietro, a parit? di
profilo di corsa: `horizontalDistanceScale=0.8` sostituisce la riduzione solo
in avanti. La portata in avanti resta quella approvata; il salto direzionale
indietro si riduce del 20% rispetto al valore precedente. Altezza, discesa
e sequenze per personaggio restano invariati. Il doppio-indietro continua
a essere una mossa separata, con il proprio spostamento. Il test verifica
la simmetria per tutti e sette i personaggi.

### Ripristino della discesa originale

`descentSpeedMultiplier=1.0` ripristina la gravit? originale anche in discesa.
Per conservare la portata gi? approvata nonostante il maggior tempo in aria,
`horizontalFallSpeedScale=1/1.35` compensa soltanto la traslazione durante la
discesa. Salita, altezza, portata simmetrica e regole dei fotogrammi per ciascun
personaggio restano invariati, inclusi i recuperi a 100 FPS.

## Pugno leggero in piedi

Disponibile per tutti i sette personaggi nel Debug:

- **P1:** F. **P2:** O. **Joypad 1/2:** X (pulsante ovest).
- Solo a terra, senza attacco aereo o accovacciato. Una pressione avvia un
  colpo; tenere premuto non lo ripete. Il movimento ? fermo durante i 500 ms
  dell'attacco. Il facing resta quello scelto alla partenza.
- Timing della demo copiati senza retiming: durata totale **500 ms**, frame
  di estensione selezionato a **300 ms**, ritorni e durate per frame originali
  del catalogo. La fase attiva comprende il frame di impatto e il successivo
  (300?344/350/357 ms secondo il personaggio).
- **F3** mostra hurtbox e hitbox offensive rosse solo quando attive.
- `swosh.wav` all'avvio; `light-punch.wav` solo al contatto reale con una
  hurtbox avversaria. I WAV locali sono identici ai file richiesti.
- Un solo contatto per bersaglio e per attacco, con contatore ?Colpi? nella
  toolbar. Per ora non vengono applicati danni, stun, animazioni hurt o parate.

Le hitbox sono capsule riviste sui PNG al frame di impatto: pugno/polso, con
parte distale dell'avambraccio per Mileto. Il frame seguente ? adattato tramite
confronto locale dello sprite. Non si usano rettangoli dell'intero personaggio.
Sono vere Area2D (layer 4, bersagli layer 2), con geometria disattivata fuori
dalla fase attiva. La rilevazione confronta le forme reali dei due fighter,
comprendendo scala, riflessione e altezza del bersaglio. Il bersaglio mantiene
la sua animazione corrente finch? non implementeremo le reazioni.
Anche le hurtbox del pugno seguono la sagoma di ogni frame.

Dati modificabili: `data/light-punch-hitbox-seeds.json`; dati generati:
`data/light-punch-hitboxes.json`. Rigenerazione dalla radice:

```powershell
node godot/tools/import-debug-assets.cjs
python -B godot/tools/build-movement-contacts.py
python -B godot/tools/build-movement-hurtboxes.py light-punch
python -B godot/tools/build-light-punch-hitboxes.py
```

Il generatore hurtbox accetta ora nomi di animazioni come argomenti per
aggiornare solo quelle, conservando i dati delle altre. Senza argomenti
rigenera tutte le animazioni di movimento e il pugno leggero.

Verifica dedicata:

```powershell
& 'C:/Program Files (x86)/Godot_v4.7.2-stable_win64_console.exe' --path godot --script res://tests/light_punch_check.gd --windowed --resolution 1920x1080
```

Il controllo copre i sette personaggi su entrambi i lati, timing 300/500 ms,
colpi a vuoto, contatto, singolo impatto, suoni, input F/O reali, fine hitbox,
nuova pressione e rifiuto dell'attacco aereo. I joypad sono mappati ma richiedono
una prova fisica. Anteprima locale: `tests/artifacts/light-punch-screen.png`.

### Reazioni al pugno leggero
Il contatto non parato avvia Hurt alto con i timing della demo (500 ms). Per parare, tenere la direzione opposta all'avversario, a terra e senza attaccare. La parata entra nella posa di guardia della sequenza block-high, la mantiene fino alla fine del pugno avversario anche rilasciando indietro, poi completa il ritorno della demo e torna in idle. Durante le reazioni non si possono avviare mosse; un colpo in aria non ferma la fisica del salto. Il suono block_small_69.wav � copiato localmente ed � alternativo al suono d'impatto; le parate non incrementano il contatore Colpi. Hurtbox e ombre seguono anche le nuove animazioni, visualizzabili con F3.

### Editor manuale delle hurtbox
Aprire Debug e premere F4 oppure il pulsante Hurtbox. Il gioco si ferma; scegliere Player 1/2, il personaggio dai selettori superiori, l'animazione e il fotogramma (numerato da 1). Riproduci/Pausa permette di controllare la sequenza; le frecce ai lati del numero avanzano di un frame.
Selezionare una capsule nell'elenco o sopra lo sprite: trascinare il corpo per spostarla, i due punti bianchi per modificarne gli estremi. I campi A x/y, B x/y e Raggio usano le coordinate del fotogramma originale, indipendenti da orientamento e scala. Aggiungi, Elimina e Annulla agiscono sul frame corrente. Ripristina frame recupera le forme generate; anche il ripristino va salvato.
Salva scrive `godot/data/manual-hurtboxes.json`: contiene solo i frame modificati e viene ricaricato automaticamente dal gioco. I generatori delle hurtbox non sovrascrivono queste correzioni. Le modifiche non salvate restano in memoria durante la sessione. F3 mostra/nasconde le forme; F4 o Esc chiudono l'editor e riprendono il gioco. Il salvataggio richiede che la cartella del progetto sia scrivibile.
