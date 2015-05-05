/*
*	Javascript Socket 1.0 - Websocket Wrapper
*   
*	Lucas Phillip Rosa Leite
*   21/01/2015
*/

"use strict";

/* namespace WebSocket library */
(function(wsocketlib, jQuery) {

	/* 
	* Classe Socket - Representa uma conexão com por um websocket.
	*
	* Encapsula toda a comunicação via websocket.
	*/
	wsocketlib.Socket = function(parameters) {
		
		//Atributos privados
		var self, uiHandler, params, connection, strategies, reconnecting, reconnectCounter, adapters;

		/* Armazena uma referência para o objeto websocket para ser utilizado no escopo das funções internas */
		self = this;

		/* Armazena o objeto responsável pela manipulação da interface gráfica */
		uiHandler = new UIHandler(parameters, this);

		/* Parametros de inicialização */
		params = parameters;
		
		/* Armazena as estratégias para os recebimentos de mensagens */
		strategies = {};

		/* Informa se há uma tentativa de reconexão ativa */
		reconnecting = false;

		/*
		* Armazena a lista de adaptadores utilizados para converter mensagens de protocolos diferentes;
		* Permite a utilização da biblioteca com sistemas no qual o protocolo já está definido e não pode ser modificado pelo usuário
		*/
		adapters = [];

		/* Inicializa os parametros com um objeto vazio */
		params = {};

		//Propriedades públicas

		/* Identificador ou nome do objeto websocket */
		this.id = 'wssocket';

		/* Informa se uma nova conexão deve ser criada automaticamente ou não caso ocorra algum erro com a atual */
		this.attemptReconnect = false;

		/* Uri da conexão */
		this.connectionUri = null;

		/* Informa se foi possível conectar ou não na determinada URI */
		this.validUri = false;

		/* 
		* Retorna o estado da conexão.
		*/
		this.state = function() {
			if (connection != null) {
				return connection.readyState;
			}
			return null;
		};

		/*
		 * Sobrecarrega o método toString do objeto state para retornar o estado formatado.
		 */
		this.state.toString = function() {
			if (connection != null) {
				return Resources.connectionStates[connection.readyState];
			}
			return Resources.connectionStates[3]; //3 - Conexão fechada
		};
		
		//Métodos públicos
		
		/* 
		* Cria uma nova conexão.
		* @param {uri} Endereço do recurso.
		*/
		this.connect = function(uri) {			
			if (connection != null) {
				throw Resources.connectionExists;
			}
			self.connectionUri = uri;

			connection = createConnection();

			if (params.dataType == 'binary') {
				connection.binaryType = 'arraybuffer';
			}

			connection.addEventListener('message', function(evt) {
				onPackageReceive(evt);
			});
			connection.addEventListener('open', function(evt) {
				if (!reconnecting) {
					onOpen(evt);
				}
				else {
					onReconnect(evt);
				}
				reconnectCounter = 5;
				reconnecting = false;
			});
			connection.addEventListener('close', function(evt) {
				onClose(evt);	
			});
			connection.addEventListener('error', function(evt) {
				onError(evt);
			});
		};
		
		/* 
		* Fecha a conexão
		*/
		this.close = function() {
			connection.close();
		};
		
		/*
		* Envia um pacote.
		* @param {pkg} Pacote a ser enviado pelo stream.
		*/
		this.send = function (pkg) {
			if (pkg == null) {
				throw Resources.nullPackage;
			}			
			if (connection == null) {
				throw Resources.connectionClosed;
			}
			pkg = parseOutgoingPackage(pkg);
			queueForSend(pkg);
		};
		
		/*
		* Registra a estrategia para recebimento dos pacotes.
		* @param {strategy} Objeto contendo a estratégia.
		*/
		this.addStrategy = function(strategy) {
			if (strategy.opcode == undefined || strategy.opcode == null || typeof strategy.onMessage !== 'function') {
				throw Resources.invalidStrategy;
			}
			
			strategies[strategy.opcode] = strategy;
		};

		/*
		* Remove uma estratégia.
		* @param {opcode} Identificador da estratégia a ser removida.
		*/
		this.removeStrategy = function(opcode) {

			if (opcode != undefined && opcode != null)
				delete strategies[opcode];

		};

		/*
		* Define o adaptador para converter os pacotes para formatos diferentes
		* @param {type} Tipo do adaptador. Pode ser 'read' para a leitura de mensagens ou 'write' para escrita.
		* @param {adapter} Função que será chamada para converter a mensagem
		*/
		this.setAdapter = function(type, adapter) {

			/* Interrompe caso o adapter esteja nulo ou indefinido */
			if (adapter == undefined || adapter == null) return;
			/* Interrompe caso o tipo do adaptador seja inválido */
			if (type != 'read' && type != 'write') return;

			if (adapter instanceof Function) {
				adapters[type] = adapter;
			}

		};

		/*
		* Remove o adaptador para um determinado tipo
		* @param {type} Tipo do adaptador. Pode ser 'read' para a leitura de mensagens ou 'write' para escrita.
		*/
		this.removeAdapter = function(type) {

			/* Interrompe caso o tipo do adaptador seja inválido */
			if (type != 'read' && type != 'write') return;

			delete adapters[type];

		};
		
		//Métodos privados

		/* Factory method para a criação do objeto 'socket' */
		var createConnection = function() {
			if ("MozWebSocket" in window) {
				//Adiciona suporte para firefox
				return new MozWebSocket(self.connectionUri);
			}
			else if ("WebSocket" in window) {
				return new WebSocket(self.connectionUri);
			}
			else {
				throw Resources.websocketNotSupported;
			}
		};

		var onPackageReceive = function(evt) {
			var data, strategy;
			data = parseIncomingPackage(evt.data);

			strategy = strategies[data.opcode]; 

			if (strategy != undefined && strategy != null) {
				strategy.onMessage(data);
			}
			else {
				throw Resources.missingStrategy + data.opcode;
			}
		};

		var onOpen = function(evt) {
			self.validUri = true;
			
			if (validateParam("onOpen"))
				params.onOpen(evt);
		};

		var onReconnect = function(evt) {
			uiHandler.hideModal();

			if (validateParam("onReconnect"))
				params.onReconnect(evt);
		};

		var onClose = function(evt) {
			if (!self.validUri) {
				resetConnection();
				uiHandler.displayModal(Resources.couldNotConnect + self.connectionUri, 5000);
			} else if (self.attemptReconnect) {
				//Tenta reconectar em erros quando a URL for válida
				 if (!reconnecting) {
					uiHandler.displayModal(Resources.reconnecting);
					reconnect();
				} else {
					//Aguarda alguns segundos antes de tentar a conexão novamente
					setTimeout(function() { reconnect(); }, 1500 * (6 - reconnectCounter));
				}
			} else {
				if (validateParam("onClose"))
					params.onClose(evt);
			}
		};

		var onError = function(evt) {
			if (validateParam("onError"))
				params.onError(evt);
		};

		var queueForSend = function(pkg) {
			if (connection.readyState == 1) {
				sendData(pkg);
			} else if (connection.readyState == 0) {
				setTimeout(function() {
					queueForSend(pkg);
				}, 200);
			} else if (self.validUri) {
				throw Resources.connectionAbortedBeforeSend;
			}
		};

		var sendData = function(pkg) {
			if (params.dataType == 'binary') {
				alert('not implemented');
			}
			else {
				connection.send(pkg);
			}
		};

		/* Analisa os pacotes recebidos, formatando caso necessário */
		var parseIncomingPackage = function(data) {
			var receivedMessage;

			//Executa o adaptador ANTES do código interno
			if ('read' in adapters) {
				receivedMessage = adapters['read'](data);
			} else {
				
				try {

					if (params.dataType == 'binary') {
						//Formata um pacote binário
						//TODO: implementar leitura de pacotes binários.
					}
					else {
						//Formata um pacote recebido como string
						receivedMessage = JSON.parse(receivedMessage);
					}

				} catch (ex) {
					console.log(Resources.parsePackageException);
				}
			}
			
			//Verifica se a mensagem possui um opcode.
			if (receivedMessage.opcode == undefined || receivedMessage.opcode == null) {
				throw Resources.invalidPackageReceived;
			}
			
			return receivedMessage;
		};

		/* Analisa os pacotes a serem enviados, formatando caso necessário */
		var parseOutgoingPackage = function(pkg) {
			var pkgParsed;
			
			if (pkg.opcode == undefined) {
				throw Resources.invalidSentPackage;
			}

			//Executa o adaptador
			if ('write' in adapters) {
				pkgParsed = adapters['write'](pkg);
			} else {

				if (params.dataType == 'binary') {
					//Formata o pacote para ser enviado como buffer binário
					//TODO: formatar o pacote para envio binário. Converter (serializar) de object para arraybuffer
				}
				else {
					//Formata o pacote para ser enviado como string
					pkgParsed = JSON.stringify(pkg);
				}

			}
			return pkgParsed;
		};
		
		var validateParam = function(param) {
			return (params != null && params[param] != undefined);
		};

		var reconnect = function() {
			reconnecting = true;

			if (reconnectCounter == 0) {
				uiHandler.displayModal(Resources.disconnected);
				reconnecting = false;
				resetConnection();
				return;
			}
			reconnectCounter -= 1;

			connection = null;
			self.connect(self.connectionUri);
		};

		var resetConnection = function() {
			connection = null;
			uiHandler.enableConnectButton();
			self.validUri = false;
		};

		//Construtor
		var init = function() {
			if (validateParam("id")) {
				self.id = params.id;
			}

			if (validateParam("attemptReconnect")) {
				self.attemptReconnect = params.attemptReconnect;
			}

			//Define um valor padrão para dataType
			if (!validateParam('dataType')) {
				params.dataType = 'string';
			}

			uiHandler.addConnectionButtonEventHandlers();
		};
		init();
	};

	/*
	 * Classe UIHandler - Representa os componentes visuais da biblioteca.
	 *
	 * Responsável por fazer a integração entre o socket e o DOM.
	*/
	var UIHandler = function (parameters, wsobj) {

		//Atributos privados

		var self = this;

		/* Parametros de inicialização */
		var params = parameters;

		/* Armazena a referência para o objeto websocket */
		var wsref = wsobj;

		/* Armazena a referência para todos os botões de conexão da tela */
		var connectionButtons;

		/* Armazena o botão clicado para conectar */
		var connectionButton;

		/*  Amazena o evento de timeout da div de avisos */
		var windowTimeout;

		//Métodos públicos

		/*
		* Adiciona o evento de conectar ao botão html
		*/
		this.addConnectionButtonEventHandlers = function() {

			var i;
			connectionButtons = document.querySelectorAll('button[data-ws=' + wsref.id + ']');

			//Adiciona o evento de conectar em todos os botões wsconnect
			for(i = 0; i < connectionButtons.length; ++i) {
				connectionButtons[i].addEventListener('click', function () {
					connectionButton = this;
					connectionButton.disabled = true;
					wsref.connect(connectionButton.getAttribute('data-wsurl'));
				});	
			}

		};

		/* 
		* Ativa o botões de conexão 
		*/
		this.enableConnectButton = function () {
			connectionButton.disabled = false;
		};

		/*
		* Exibe mensagem modal.
		* @param {message} Mensagem a ser exibida.
		* @param {timer} Tempo de exibição da imagem. Deixe nulo para mensagens permanentes.
		*/
		this.displayModal = function(message, timer) {
			var modalWindow, modalMessageSpan;

			modalWindow = findWindow();

			//Cria um novo div caso ainda não exista
			if (modalWindow == null) {
				modalWindow = createDisplayModal();
			}
			
			modalMessageSpan = document.getElementById('ws-modal-window');
			modalMessageSpan.innerHTML = message;

			if (!jQuery) {
				modalWindow.style.display = 'block';
			}
			else {
				jQuery(modalWindow).show(250);
			}

			//Fecha a janela caso exista um temporizador
			clearTimeout(windowTimeout);
			if (timer != null) {
				windowTimeout = setTimeout(function() {
					self.hideModal(modalWindow);
				}, timer);
			}
		};

		this.hideModal = function(modalWindow) {

			if (modalWindow == null) modalWindow = findWindow();

			if (!jQuery) {
				modalWindow.style.display = 'none';
			}
			else {
				jQuery(modalWindow).hide(250);
			}
		};

		//Métodos privados

		var createDisplayModal = function() {
			var displaycss, modalWindow, modalMessageSpan;

			displaycss = params.modalcss || 'websocket-modal-window';

			modalWindow = document.createElement('div');	
			modalWindow.id = 'ws-modal-window';
			modalWindow.style.display = 'none';
			modalWindow.className = displaycss;

			modalMessageSpan = document.createElement('span');
			modalMessageSpan.id = 'ws-modal-label';				

			modalWindow.appendChild(modalMessageSpan);
			document.body.appendChild(modalWindow);

			return modalWindow;
		};

		var findWindow = function() {
			return document.getElementById('ws-modal-window');
		};
	};
	
})(window.wsocketlib = window.wsocketlib || {}, jQuery);