# Java, passo passo

Un sito statico in italiano per studiare **Java P1**: lezioni, esempi guidati, quiz e correzioni dettagliate. Funziona su GitHub Pages senza server applicativo, account o database esterno.

## Pubblicazione su GitHub Pages

1. Apri il repository `NotKNow21Br/JavaQuizApp` su GitHub. Se è ancora vuoto, scegli **Add file → Upload files** e crea il primo commit sulla branch `main`.
2. Carica **il contenuto di questa cartella**, mantenendo le sottocartelle `data` e `materiali`. `index.html` deve essere nella radice del repository, non dentro un'altra cartella `JavaQuizApp`. Includi anche `.nojekyll`.
3. Vai in **Settings → Pages → Build and deployment**.
4. Seleziona **Deploy from a branch**, branch **main**, cartella **/ (root)** e salva.
5. Attendi il completamento del deployment. GitHub mostrerà l'indirizzo pubblico del sito. I percorsi relativi funzionano anche sotto `/JavaQuizApp/`.

Non servono `npm install`, build, Java installato o chiavi API per usare il sito. I test non devono essere eseguiti da GitHub Pages.

## Cosa può fare l'alunno

- Leggere **60 sezioni di teoria** con esempi Java commentati, ragionamento e consigli.
- Scegliere uno o più argomenti, tutti gli argomenti oppure il ripasso degli errori.
- Indicare 5, 10, 15, 30 o 45 minuti: vengono proposte circa 0,8 domande al minuto, con 75 secondi medi previsti per domanda. Sono una stima, non una difficoltà adattiva.
- Fare domande di teoria, previsione dell'output, comprensione del codice e ricerca degli errori.
- Vedere subito soluzione, motivazione della propria risposta, passaggi del ragionamento e spiegazione delle alternative. Il timer **si ferma durante la correzione** e riprende alla domanda successiva.
- Ottenere un voto scolastico in decimi, un grafico delle risposte, percentuali per argomento e collegamenti alle lezioni da ripassare.
- Rivedere ogni domanda, riprovare gli errori, scaricare un resoconto e consultare lo storico degli ultimi 30 quiz.
- Aprire o scaricare entrambi i PDF originali dalla sezione Materiali.

Le domande sono distribuite tra gli argomenti selezionati e mescolate, comprese le alternative. Si preferiscono gli esercizi non ancora incontrati nello storico locale. Un quiz di 5 o 10 minuti non contiene abbastanza domande per coprire tutti i 10 argomenti: la schermata lo indica. Per una simulazione che includa tutti gli argomenti scegli almeno **15 minuti**, con la banca completa e tipo «Un po' di tutto». Gli argomenti non valutati sono indicati nel risultato.

## Banca di domande

La banca locale contiene **1.000 domande, 100 per argomento**:

1. Fondamenti di Java: JVM, bytecode, JDK, classi e primo programma.
2. Input e output: Scanner, print, println e sequenze di escape.
3. Tipi, variabili e operatori: espressioni, casting e incrementi.
4. Math e numeri casuali: operazioni e intervalli inclusivi.
5. Condizioni: if, else, ternario e switch.
6. Cicli: while, do-while, for e foreach.
7. Array e matrici: indici, scansioni e riferimenti.
8. Classi, oggetti e metodi: parametri, return e chiamate.
9. Eccezioni: try, catch, finally e flusso di esecuzione.
10. Stream e BufferedReader: lettura di righe e conversioni.

Ogni argomento combina quesiti teorici scritti singolarmente con **varianti parametrizzate di diversi schemi di esercizio**: cambiano dati, risultati e spiegazioni. Non sono 100 concetti diversi per argomento. In totale ci sono 804 domande di codice/debug e 196 di teoria. I file `data/*.js` costituiscono il database statico: puoi versionarli con Git ed estenderli senza infrastruttura.

Le lezioni sono state ricavate dai due PDF forniti, correggendone alcuni refusi di sintassi e precisazioni: `Math` è in `java.lang`, `Math.max` ha due parametri, i decimali usano il punto, `\a` e `\?` non sono escape Java validi. I frammenti usano la sintassi classica compatibile con Java 21. Il sito non compila né esegue codice inserito dall'alunno: le risposte e le spiegazioni sono già nella banca.

## Voto e statistiche

`voto = max(1, risposte corrette / domande del quiz × 10)`, arrotondato a un decimale. Sufficienza: **6/10**. Ogni domanda pesa allo stesso modo. Errori e omissioni valgono zero, senza penalità aggiuntive. Il voto minimo è 1/10, non 0.

Alla scadenza o alla terminazione anticipata, le domande non visitate sono **omesse**. Il pulsante «Non lo so, spiegamelo» registra anch'esso un'omissione e mostra la spiegazione. I grafici distinguono sempre corrette, errate e omesse. Le percentuali per argomento usano come denominatore le domande di quell'argomento nel quiz; non indicano la quota degli errori globali. I consigli di ripasso ordinano gli argomenti in base a errori più omissioni sul totale affrontato. Poche domande sono un'indicazione di studio, non una misura definitiva di competenza.

I dati sono salvati nel `localStorage` del browser, non condivisi automaticamente tra dispositivi. Il quiz in corso riprende dopo una ricarica; il tempo per rispondere continua a trascorrere anche se si chiude la pagina, mentre resta fermo se si era nella correzione. La navigazione chiede di terminare il quiz prima di uscire. In modalità privata o se la memoria è bloccata, scarica il resoconto prima di chiudere.

## Discord: attivazione per il tutor

L'indirizzo del webhook **non è incluso nel repository o nel pacchetto pubblico**.

1. Apri **Impostazioni e tutor** (da telefono, tocca il profilo in alto).
2. Inserisci un nome o soprannome e incolla il webhook Discord fornito dal tutor.
3. Seleziona **Attiva l'invio degli errori e dei risultati a Discord** e salva.

Il webhook resta nel `sessionStorage` di questa scheda: va reinserito su un altro dispositivo o alla chiusura della sessione. Quando l'invio è attivo, il sito invia:

- **a ogni risposta errata**, soprannome, argomento, domanda/codice, risposta scelta, corretta, spiegazione e conteggio provvisorio;
- **al termine di ogni quiz**, voto e conteggi con un file JSON allegato contenente tutti gli argomenti, le domande, gli errori e le correzioni.

I messaggi disattivano le menzioni Discord. Non viene richiesto un contatto personale. Gli invii sono serializzati; errori di rete, CORS, webhook eliminato o limiti Discord vengono segnalati. Il risultato rimane salvato. Il pulsante **Riprova invii falliti** ritenta gli invii non confermati, finché la scheda conserva la coda. In caso di timeout dopo una ricezione già avvenuta, un tentativo manuale può produrre un duplicato. Il resoconto scaricabile è disponibile anche senza Discord.

**Limite di GitHub Pages:** un sito statico non può mantenere segreto un webhook che usa nel browser. L'impostazione locale evita di pubblicarlo nei sorgenti, ma chi lo inserisce può leggerlo. Per invii automatici da una classe senza distribuire il webhook, serve un piccolo servizio/proxy con il webhook conservato lato server. Se l'indirizzo è stato condiviso pubblicamente, rigeneralo su Discord. Gli invii reali al webhook fornito non sono stati effettuati durante i test; trasporto, payload, coda, errori e tentativi sono stati verificati con richieste simulate.

## Sviluppo locale e controlli

Servi questa cartella con un server statico:

```sh
cd /workspace/JavaQuizApp
python3 -m http.server 4173 --bind 0.0.0.0
```

In una copia scaricata, usa il percorso della cartella sul tuo computer. Apri il server locale nel browser. Il sito non richiede processi oltre al server statico; in produzione il servizio è GitHub Pages.

Test automatici, senza pacchetti npm:

```sh
node --test tests/core.test.js
```

Il test nel browser usa Python Playwright e Chromium; consulta `tests/browser_test.py` per l'esecuzione. Nessun test invia messaggi a un webhook reale. Durante lo sviluppo sono stati anche compilati ed eseguiti 720 frammenti Java della banca: gli output corrispondevano alle risposte dichiarate. Sono stati verificati errori di compilazione intenzionali e controllati senza esecuzione i cicli infiniti didattici.

## File

- `index.html`, `style.css`, `favicon.svg`: interfaccia responsive.
- `core.js`: selezione delle domande e calcolo dei risultati.
- `app.js`: navigazione, lezioni, quiz, timer, progressi e Discord.
- `data/`: banca di domande e lezioni.
- `materiali/`: i due PDF originali, invariati.
- `tests/`: verifiche del modello e dei percorsi nel browser.

I caratteri Google Fonts sono un miglioramento facoltativo: senza rete vengono usati quelli di sistema. Non vengono caricati script o librerie esterne. Le soluzioni sono presenti nei file statici: questo è uno strumento per imparare, non un sistema per esami sorvegliati.
