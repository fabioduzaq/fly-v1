# 🎯 PIXGG Webhook Listener

Servidor Node.js que escuta eventos de doação do Pusher em tempo real e re-encaminha os dados para um webhook externo.

## 🚀 Instalação e Configuração

### 1. Instalar Dependências

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e configure suas variáveis:

```bash
cp env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Configurações do Pusher
PUSHER_APP_KEY=787e05d557a8480c3ee7
PUSHER_CLUSTER=mt1
PUSHER_CHANNEL_KEY=4968d406-c496-41f0-856b-bf68b77175a6
PUSHER_EVENT_NAME=messages

# URL do Webhook de destino
WEBHOOK_TARGET_URL=https://sua-url-aqui.com/webhook/pixgg

# Configurações opcionais
LOG_LEVEL=info
WEBHOOK_TIMEOUT=10000
```

### 3. Executar o Servidor

```bash
# Execução simples
npm start

# Ou diretamente
node webhook-listener.js
```

## 📋 Scripts Disponíveis

```bash
# Iniciar o servidor
npm start

# Executar em modo desenvolvimento
npm run dev

# Gerenciar com PM2 (produção)
npm run pm2:start    # Iniciar processo
npm run pm2:stop     # Parar processo
npm run pm2:restart  # Reiniciar processo
npm run pm2:logs     # Ver logs
```

## 🔧 Configuração das Variáveis

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `PUSHER_APP_KEY` | Chave pública do aplicativo Pusher | ✅ |
| `PUSHER_CLUSTER` | Cluster do servidor Pusher | ✅ |
| `PUSHER_CHANNEL_KEY` | Chave do canal a ser escutado | ✅ |
| `PUSHER_EVENT_NAME` | Nome do evento a ser interceptado | ✅ |
| `WEBHOOK_TARGET_URL` | URL que receberá os dados | ✅ |
| `LOG_LEVEL` | Nível de log (error, warn, info, debug) | ❌ |
| `WEBHOOK_TIMEOUT` | Timeout para requisições HTTP (ms) | ❌ |

## 📊 Formato dos Dados Enviados

O webhook receberá um JSON com a seguinte estrutura:

```json
{
  "transactionId": "12345",
  "donatorNickname": "João Silva",
  "totalAmount": 50.00,
  "donatorMessage": "Parabéns pelo trabalho!",
  "awsPublicLink": "https://s3.amazonaws.com/...",
  "audioDuration": 5.2,
  "timestamp": "2024-01-15T10:30:00.000Z",
  "originalEvent": { /* dados completos do evento original */ }
}
```

## 🛠️ Execução em Produção

### Usando PM2 (Recomendado)

1. Instalar PM2 globalmente:
```bash
npm install -g pm2
```

2. Iniciar o processo:
```bash
npm run pm2:start
```

3. Configurar para iniciar automaticamente:
```bash
pm2 startup
pm2 save
```

### Usando Docker

Crie um `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

## 📝 Logs

O servidor gera logs detalhados incluindo:
- Conexão com o Pusher
- Eventos de doação recebidos
- Status dos webhooks enviados
- Erros de conexão ou envio

Níveis de log disponíveis:
- `error`: Apenas erros críticos
- `warn`: Avisos e erros
- `info`: Informações gerais (padrão)
- `debug`: Informações detalhadas

## 🔍 Monitoramento

Para monitorar o funcionamento:

```bash
# Ver logs em tempo real
npm run pm2:logs

# Status do processo
pm2 status

# Reiniciar se necessário
npm run pm2:restart
```

## ⚠️ Troubleshooting

### Problemas Comuns

1. **Erro de conexão com Pusher**
   - Verifique se as chaves estão corretas
   - Confirme se o cluster está correto

2. **Webhook não está sendo chamado**
   - Verifique se a URL está acessível
   - Confirme se o servidor de destino aceita POST JSON

3. **Processo para de funcionar**
   - Use PM2 para reinicialização automática
   - Configure monitoramento de logs

### Logs de Debug

Para mais detalhes, configure `LOG_LEVEL=debug` no arquivo `.env`.

## 📄 Licença

MIT License
