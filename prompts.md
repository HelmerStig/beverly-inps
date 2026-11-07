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