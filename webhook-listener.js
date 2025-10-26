// Importar bibliotecas 
require('dotenv').config();
const http = require('http');
const Pusher = require('pusher-js');
const axios = require('axios');

// Carregar variáveis de ambiente
const { 
    PUSHER_APP_KEY, 
    PUSHER_CLUSTER, 
    PUSHER_CHANNEL_KEY, 
    PUSHER_EVENT_NAME, 
    WEBHOOK_TARGET_URL,
    LOG_LEVEL = 'info',
    WEBHOOK_TIMEOUT = 10000,
    SERVER_PORT = 3000
} = process.env;

// Estado do servidor
let serverState = {
    status: 'starting',
    pusherConnected: false,
    startTime: new Date().toISOString(),
    uptime: 0,
    webhooksSent: 0,
    webhooksFailed: 0,
    lastEvent: null
};

// Função para log com diferentes níveis
function log(level, message, ...args) {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = levels[LOG_LEVEL] || levels.info;
    
    if (levels[level] <= currentLevel) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, ...args);
    }
}

// Função para enviar os dados para o Webhook
async function sendWebhook(data) {
    try {
        const payload = {
            transactionId: data.TransactionId,
            donatorNickname: data.DonatorNickname,
            totalAmount: data.TotalAmount,
            donatorMessage: data.DonatorMessage,
            awsPublicLink: data.AWSPublicLink,
            audioDuration: data.AudioDuration,
            timestamp: new Date().toISOString(),
            originalEvent: data // Envia o objeto completo para debug/referência
        };

        log('info', `Enviando webhook para: ${WEBHOOK_TARGET_URL}`);
        log('debug', 'Payload:', JSON.stringify(payload, null, 2));

        const response = await axios.post(WEBHOOK_TARGET_URL, payload, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'PIXGG-Webhook-Listener/1.0.0'
            },
            timeout: parseInt(WEBHOOK_TIMEOUT)
        });

        log('info', `Webhook enviado com sucesso! Status: ${response.status}`);
        serverState.webhooksSent++;
        return true;
    } catch (error) {
        serverState.webhooksFailed++;
        if (error.response) {
            log('error', `Falha ao enviar Webhook - Status: ${error.response.status}, Data:`, error.response.data);
        } else if (error.request) {
            log('error', `Falha ao enviar Webhook - Sem resposta do servidor:`, error.message);
        } else {
            log('error', `Falha ao enviar Webhook:`, error.message);
        }
        return false;
    }
}

// Inicializa o Listener do Pusher
function startPusherListener() {
    log('info', `Iniciando conexão com Pusher [${PUSHER_APP_KEY}, ${PUSHER_CLUSTER}]...`);

    const pusher = new Pusher(PUSHER_APP_KEY, {
        cluster: PUSHER_CLUSTER,
        encrypted: true
    });

    const channel = pusher.subscribe(PUSHER_CHANNEL_KEY);

    channel.bind('pusher:subscription_succeeded', () => {
        log('info', `Conectado com sucesso no canal: ${PUSHER_CHANNEL_KEY}`);
        serverState.pusherConnected = true;
        serverState.status = 'running';
        
        // Escuta o evento 'messages'
        channel.bind(PUSHER_EVENT_NAME, (data) => {
            log('info', `--- Nova Doação Recebida! ---`);
            log('info', `Doador: ${data.DonatorNickname}, Valor: ${data.TotalAmount}`);
            log('debug', 'Dados completos:', JSON.stringify(data, null, 2));
            
            // Atualiza o último evento
            serverState.lastEvent = {
                timestamp: new Date().toISOString(),
                donatorNickname: data.DonatorNickname,
                totalAmount: data.TotalAmount,
                transactionId: data.TransactionId
            };
            
            // Envia o Webhook
            sendWebhook(data);
        });
        
        // Escutar outros eventos opcionais
        channel.bind('skip-alert', (data) => {
            log('info', 'Alerta ignorado recebido:', data);
        });
        
        channel.bind('clear-queue', (data) => {
            log('info', 'Fila limpa:', data);
        });
        
        channel.bind('pause', (data) => {
            log('info', 'Pausa recebida:', data);
        });
    });

    pusher.connection.bind('error', (err) => {
        log('error', 'Erro na conexão Pusher:', err);
        serverState.status = 'error';
    });

    pusher.connection.bind('disconnected', () => {
        log('warn', 'Conexão Pusher desconectada');
        serverState.pusherConnected = false;
        serverState.status = 'disconnected';
    });

    pusher.connection.bind('reconnected', () => {
        log('info', 'Conexão Pusher reconectada');
        serverState.pusherConnected = true;
        serverState.status = 'running';
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
        log('info', 'Recebido SIGINT, desconectando...');
        pusher.disconnect();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        log('info', 'Recebido SIGTERM, desconectando...');
        pusher.disconnect();
        process.exit(0);
    });
}

// Validação das variáveis de ambiente
function validateEnvironment() {
    const requiredVars = [
        'PUSHER_APP_KEY',
        'PUSHER_CLUSTER', 
        'PUSHER_CHANNEL_KEY',
        'PUSHER_EVENT_NAME',
        'WEBHOOK_TARGET_URL'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        log('error', `Variáveis de ambiente obrigatórias não configuradas: ${missingVars.join(', ')}`);
        log('error', 'Copie o arquivo env.example para .env e configure as variáveis');
        process.exit(1);
    }

    // Validar URL do webhook
    try {
        new URL(WEBHOOK_TARGET_URL);
    } catch (error) {
        log('error', `URL do webhook inválida: ${WEBHOOK_TARGET_URL}`);
        process.exit(1);
    }
}

// Inicia o servidor HTTP para status
function startHttpServer() {
    const server = http.createServer((req, res) => {
        // Apenas aceita requisições GET na raiz
        if (req.method === 'GET' && req.url === '/') {
            // Calcula o tempo de atividade
            const startTime = new Date(serverState.startTime);
            const now = new Date();
            serverState.uptime = Math.floor((now - startTime) / 1000); // em segundos
            
            // Prepara a resposta JSON
            const response = {
                service: 'PIXGG Webhook Listener',
                status: serverState.status,
                pusher: {
                    connected: serverState.pusherConnected,
                    cluster: PUSHER_CLUSTER,
                    channel: PUSHER_CHANNEL_KEY,
                    eventName: PUSHER_EVENT_NAME
                },
                webhooks: {
                    sent: serverState.webhooksSent,
                    failed: serverState.webhooksFailed,
                   // target: WEBHOOK_TARGET_URL
                },
                uptime: {
                    startTime: serverState.startTime,
                    seconds: serverState.uptime,
                    humanReadable: `${Math.floor(serverState.uptime / 60)}m ${serverState.uptime % 60}s`
                },
                lastEvent: serverState.lastEvent,
                timestamp: new Date().toISOString()
            };

            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Access-Control-Allow-Headers': 'Content-Type'
            });
            res.end(JSON.stringify(response, null, 2));
        } else {
            // Retorna 404 para outras rotas
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not Found', message: 'Use GET / for server status' }));
        }
    });

    server.listen(SERVER_PORT, () => {
        log('info', `Servidor HTTP iniciado na porta ${SERVER_PORT}`);
        log('info', `Acesse http://localhost:${SERVER_PORT} para ver o status`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            log('error', `Porta ${SERVER_PORT} já está em uso`);
        } else {
            log('error', `Erro no servidor HTTP: ${err.message}`);
        }
    });
}

// Iniciar o processo
log('info', '=== PIXGG Webhook Listener Iniciando ===');
validateEnvironment();
startHttpServer();
startPusherListener();
