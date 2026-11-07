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
	- Camminata
	- Camminata indietro
	- Corsa (attivabile con 2 volte avanti, resta attiva finchè non si rilascia avanti)
	- Salto indietro (attivabile con 2 volte indietro)
	Bugfixes:
		- Controlla le ombre, fanno strane rotazioni soprattutto durante la corsa
		- Aggiorna le hurtBox
	- Salto indietro: dev'essere uno spostamento più veloce della camminata (in godot non lo sprite)
	Bug Ombre:
		- Nella camminata avanti e indietro l'ombra risulta staccata dai piedi: oscar,torpe,Arianna, Bue, MIleto, Mangler (solo quella indietro)
	
	- Ora passa al salto, per l'altezza e lo spostamento controlla i parametri usati nel vevvhio progetto godot, guarda anche le hurtbox durante il salto

	- Bug salto: I salti hanno un momento di stallo in atteragio in cui non cxi si può muovere, quando lo sprite tocca terra deve subito tornare in idle e potersi muovere. Mangler mentre atterra, rallenta l'atterragio per qualche motivo

	- Per tutti i personaggi ora c'è un blocco leggero a mezz'aria poco prima dell'atterraggio, se l'animazione del salto è finita prima, torna in idle

	Arianna: se è in aria deve rimanere a fotogramma 28 ed eseguire il resto dell'animazione di atterrata (29 -> 49), quando è atterrata deve trovarsi al fotogramma 39 e poi eseguire da 39 a 49 ad un fps molto alto, diciamo 100 e poi tornare in idle
	
	Bue: se è in aria deve rimanere a fotogramma 21 ed eseguire il resto dell'animazione di atterrata (21 -> 37), quando è atterrata deve trovarsi al fotogramma 27 e poi eseguire da 27 a 37 ad un fps molto alto, diciamo 100 e poi tornare in idle

	Mangler: se è in aria deve rimanere a fotogramma 15 ed eseguire il resto dell'animazione al contrario, deve ritrovarsi a fotogramma 1 quando è a terra

	Mileto: se è in aria deve rimanere a fotogramma 25 ed eseguire il resto dell'animazione di atterrata (25 -> 39), quando è atterrato deve trovarsi al fotogramma 33 e poi eseguire da 33 a 39 ad un fps molto alto, diciamo 100 e poi tornare in idle

	Oscare: se è in aria deve rimanere a fotogramma 21 ed eseguire il resto dell'animazione di atterrata (21 -> 38), quando è atterrato deve trovarsi al fotogramma 31 e poi eseguire da 38 a 38 ad un fps molto alto, diciamo 100 e poi tornare in idle

	Torpe: se è in aria deve rimanere a fotogramma 18 ed eseguire il resto dell'animazione di atterrata (18 -> 34), quando è atterrato deve trovarsi al fotogramma 25 e poi eseguire da 25 a 34 ad un fps molto alto, diciamo 100 e poi tornare in idle