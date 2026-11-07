# Sanmauro Fighters — Godot 4.7.2

Aprire `project.godot` con Godot 4.7.2 e premere **F5**.
La scena principale è `scenes/title/title_screen.tscn`.

## Step 1: schermata iniziale

- Fondale della sezione UI della demo: dieci PNG originali, composizione cover
  3240×1080 centrata in 1920×1080, nuvole a 6/12/20 px/s e riflessi sincronizzati.
- Foschia a bande e polvere deterministica come nella demo. Acqua statica.
- Logo `10099`, ingresso animato, neon “Beverly INPS” e testo lampeggiante
  “PRESS ENTER TO START” ripresi dalla TitleScreen del vecchio progetto.
- **F8** confronta il fondale con/senza CRT, foschia e polvere.
- **F11** alterna finestra e fullscreen. Il rapporto 16:9 è conservato.
- Invio/Start apre il menu **Single Player / Versus / Debug** e assegna il focus
  alla prima voce. Frecce, direzionale o stick navigano; Invio/A o clic selezionano.
- **B del joypad** oppure **Esc** torna al titolo e ripristina il testo lampeggiante.
  Le voci emettono `mode_selected` (`single_player`, `versus`, `debug`);
  le rispettive schermate saranno collegate nei prossimi step.

Logo e testi rimangono sopra il fondale filtrato, come nel titolo precedente.
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
