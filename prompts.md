- Repo immagini:
okay, ora in demo-moves-sanmauro vorrei aggiungere alla sezione stages lo stage "Mercatò"
dopo Piazza Europa.
Sarà composto da 5 immagini:
- demo-moves-sanmauro\assets\stages\Mercatò\cielo.png z-index 0
- demo-moves-sanmauro\assets\stages\Mercatò\mercato.png: z-index 4, sfondo principale, le proprorzioni dell'immagine sono determinate da quest'immagine, non deve essere ritagliata, deve essere visibile per intero.
- demo-moves-sanmauro\assets\stages\Mercatò\01-nuvole-lontane.png z-index 2, devi mantenere la sua dimensione e centrarle orizzontalemente nello stage, quindi avrai abbondaggio a destra e sinistra. Deve muoversi lentamente da destra verso sinistra, in loop, per dare l'effetto di parallax.
- demo-moves-sanmauro\assets\stages\Mercatò\02-nuvole-intermedie.png z-index 3, devi mantenere la sua dimensione e centrarle orizzontalemente nello stage, quindi avrai abbondaggio a destra e sinistra. Deve muoversi più velocemente delle nuvole lontane da destra verso sinistra, in loop, per dare l'effetto di parallax.
- demo-moves-sanmauro\assets\stages\Mercatò\03-nuvole-prossime.png z-index 4, devi mantenere la sua dimensione e centrarle orizzontalemente nello stage, quindi avrai abbondaggio a destra e sinistra. Deve muoversi più velocemente delle nuvole intermedie da destra verso sinistra, in loop, per dare l'effetto di parallax.

devo ora creare come fatto per gli altri personaggi il portrait di LELE, trovi i portraits qui: demo-moves-sanmauro\assets\portraits
lo sprite di lele è res://../demo-moves-sanmauro/assets/characters/lele/lele-idle.png
la persona vera e propria di riferimento è qui: original-images/lele

Ora nello stage di mercatò metti Lele e mangler anziche Ari e Oscare, rispetto alla sezione Piazza europa, gli sprites risultano più piccoli, puoi usare la stessa scala di piazza europa?


Vorrei creare un nuovo progetto godot in questo repo per rifare quello vecchio:
F:/Personali/Godot
Ho anche scaricato una nuova versione di Godot_v4.7.2, mi guidi?


Descrizione Progetto

Step 1
- La Prima schermata sarà quella presente in "UI", dobbiamo ricreare in Godot gli stessi filtri CRT.
	- Per i contenuti puoi fare riferimento alla prima schermata del vecchio progetto: F:/Personali/Godot
	
	- Al press dell'enter devono comaprire altre voci di menu:
		- Single Player
		- Versus
		- Debug (che mi servirà per il debug)
		- Cliccando sul joypad il tasto B da questa sezione, si torna indietro alla schermata principale

	- Centra Verticalmente i testi dei bottoni dei menu, ora sono spostati verso il basso.
	- Al press dell'enter deve essere associato un suono: "F:\Personali\Godot\assets\sounds\sfx\light-punch.wav"
	- Al movimento all'interno del menu va associato questo suono: "F:\Personali\Godot\assets\sounds\sfx\swosh.wav"
	- Alla selezione di un elemento del menu sempre: "F:\Personali\Godot\assets\sounds\sfx\light-punch.wav"
	Riporta i suoni nel progetto attuale
	- Se si può, i filtri CRT, vanno applicati sopra a tutta l'interfaccia, non solo all'immagine di background
		
Step 2
- Pagina di Debug:
- Per lo sfondo utilizziamo lo stage: demo-moves-sanmauro\stages.html
- Lo sfondo deve avere lo stesso comportamento della demo precedente: F:/Personali/Godot, centrato nello stage, quando un personaggio raggiunge il bordo sinistro o destro, lo sfondo scrolla fino alla sua fine se non è bloccato dalla posizione dei sue peronaggi.
- In questa sezione vorrei iniziare a comporre hurtbox e hitbox per ogni personaggio, vorrei poter selezionare il personaggio da visualizzare in qualsiasi momento, metti un menù in alto magari in modo che possa switchare da uno all'altro.
- Iniziamo con il personaggio in idle, i parametri per spritesheet, fps di ogni personaggio  li trovi in: demo-moves-sanmauro\personaggio.html
- Hai domande?
- Per il ritorno al titolo non usare B perchè sarà una mossa, solo esc. Per la selezione di player 1 metti frecce orizzontali, per player 2, frecce verticali

- Ora iniziamo che la creazione delle hurtbox, falle tu analizzando il personaggio. Fai si che siano visualizzabili con il tasto F3
- Okay ora quando le hurtbox dei personaggi si toccano, il personaggio non dovrebbe continuare ad avanzare in direzione dell'avversario
- Ora possiamo iniziare a implementare i movimenti di base, li trovi tutti in demo-moves-sanmauro\personaggio.html
	- Camminata<-ok
	- Camminata indietro<-ok
	- Corsa (attivabile con 2 volte avanti, resta attiva finchè non si rilascia avanti)<-ok
	- Salto indietro (attivabile con 2 volte indietro) <-ok
	Bugfixes:
		- Controlla le ombre, fanno strane rotazioni soprattutto durante la corsa 
		- Aggiorna le hurtBox
	- Salto indietro: dev'essere uno spostamento più veloce della camminata (in godot non lo sprite)
	Bug Ombre:
		- Nella camminata avanti e indietro l'ombra risulta staccata dai piedi: oscar,torpe,Arianna, Bue, MIleto, Mangler (solo quella indietro)
	
	- Ora passa al salto, per l'altezza e lo spostamento controlla i parametri usati nel vevvhio progetto godot, guarda anche le hurtbox durante il salto <-ok

	- Ora vorrei implementare le animazioni per il passaggio da idle a crouched, va eseguita per intero e mantenuta finchè si tiene premuto basso, al rilascio di basso, il personaggio deve eseguire l'animazione al contrario e tornare in idle position

	- Ora passiamo al pugno medio, implementalo per tutti i personaggi prendendo come riferimento per i timing il solito catalogo, fai attenzione sempre a Mangler che potrebbe avere delle mosse composte da più spritesheet, lo puoi controlalre nel vecchio progetto godot

	- In genrale, il personaggio che colpisce, deve avere uno z-index più alto dell'avversario

	- Ora passiamo al pugno potente, implementalo per tutti i personaggi prendendo come riferimento per i timing il solito catalogo, fai attenzione sempre a Mangler che potrebbe avere delle mosse composte da più spritesheet, lo puoi contrllare nel vecchio progetto godot, usa i suoni utilizzati nel vecchio progetto.

	- Bug salto: I salti hanno un momento di stallo in atteragio in cui non cxi si può muovere, quando lo sprite tocca terra deve subito tornare in idle e potersi muovere. Mangler mentre atterra, rallenta l'atterragio per qualche motivo

	- Per tutti i personaggi ora c'è un blocco leggero a mezz'aria poco prima dell'atterraggio, se l'animazione del salto è finita prima, torna in idle

	Arianna: se è in aria deve rimanere a fotogramma 28 ed eseguire il resto dell'animazione di atterrata (29 -> 49), quando è atterrata deve trovarsi al fotogramma 39 e poi eseguire da 39 a 49 ad un fps molto alto, diciamo 100 e poi tornare in idle
	
	Bue: se è in aria deve rimanere a fotogramma 21 ed eseguire il resto dell'animazione di atterrata (21 -> 37), quando è atterrata deve trovarsi al fotogramma 27 e poi eseguire da 27 a 37 ad un fps molto alto, diciamo 100 e poi tornare in idle

	Mangler: se è in aria deve rimanere a fotogramma 15 ed eseguire il resto dell'animazione al contrario, deve ritrovarsi a fotogramma 1 quando è a terra

	Mileto: se è in aria deve rimanere a fotogramma 25 ed eseguire il resto dell'animazione di atterrata (25 -> 39), quando è atterrato deve trovarsi al fotogramma 33 e poi eseguire da 33 a 39 ad un fps molto alto, diciamo 100 e poi tornare in idle

	Oscare: se è in aria deve rimanere a fotogramma 21 ed eseguire il resto dell'animazione di atterrata (21 -> 38), quando è atterrato deve trovarsi al fotogramma 31 e poi eseguire da 38 a 38 ad un fps molto alto, diciamo 100 e poi tornare in idle

	Torpe: se è in aria deve rimanere a fotogramma 18 ed eseguire il resto dell'animazione di atterrata (18 -> 34), quando è atterrato deve trovarsi al fotogramma 25 e poi eseguire da 25 a 34 ad un fps molto alto, diciamo 100 e poi tornare in idle

	Ora passiamo al pugno leggero da in piedi, gli hurt e le parate le vedremo in seguito
		- prendi i timing da demo-moves-sanmauro
		- per il suono usa questo: "F:\Personali\Godot\assets\sounds\sfx\swosh.wav"
		- se il colpo va a segno aggiungi questo: "F:\Personali\Godot\assets\sounds\sfx\light-punch.wav"
		- crea le hitbox in base allo sprite
	
	Il pugno leggero deve generare nell'avversario:
		- Hurt alto se colpito
		- Parata alta se parato (usa questo suono: "F:\Personali\Godot\sound-libraries\block_small_69.wav")
			- la parata alta va mantenuta nella sua posa di guardia fino a fine mossa per poi proseguirla e toprnare in idle

	ora mi servirebbero le seguenti integrazioni
		- 2 shortcut:
			pulsante g per mettere player 2 in guardia, g di nuovo per rimuovere la guardia
			pulsante c pper metterr player 2 in crouched, c d nuovo per pfarlo tornare in idle, se metto in crouched e clicco g, deve essere in guardia bassa
	  	- ora vorrei aggiungere un effetto di hit quando il colpo colpisce ed uno diverso quando viene parato, hai suggerimenti?