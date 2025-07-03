# Transcritor de Áudio

Uma aplicação web minimalista para upload e transcrição de arquivos de áudio MP3 usando Supabase e webhooks.

## 🚀 Funcionalidades

- **Upload de Áudio**: Interface drag & drop para arquivos MP3
- **Storage Supabase**: Armazenamento seguro dos arquivos de áudio
- **Transcrição Automática**: Webhook para processamento em tempo real
- **Interface Minimalista**: Design moderno e responsivo
- **Progresso em Tempo Real**: Feedback visual durante upload e transcrição

## 🛠️ Tecnologias

- **React 18** com TypeScript
- **Supabase** para storage e autenticação
- **CSS3** com design responsivo
- **Webhooks** para transcrição

## 📋 Pré-requisitos

- Node.js 16+ 
- Conta no Supabase
- Acesso ao webhook de transcrição

## ⚙️ Configuração

### 1. Clone o repositório
```bash
git clone <repository-url>
cd transcritor
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Vá para Settings > API
3. Copie a URL do projeto e a chave anônima
4. Crie um bucket chamado `audio-files` no Storage

### 4. Configure as variáveis de ambiente

Copie o arquivo `env.example` para `.env`:
```bash
cp env.example .env
```

Edite o arquivo `.env` com suas credenciais:
```env
REACT_APP_SUPABASE_URL=sua_url_do_supabase
REACT_APP_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

### 5. Configure o bucket do Supabase

No painel do Supabase, vá para Storage e:

1. Crie um bucket chamado `audio-files`
2. Configure as políticas de acesso (RLS):

```sql
-- Permitir upload de arquivos
CREATE POLICY "Allow uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'audio-files');

-- Permitir leitura pública dos arquivos
CREATE POLICY "Allow public read" ON storage.objects
FOR SELECT USING (bucket_id = 'audio-files');
```

## 🚀 Executando o projeto

```bash
npm start
```

A aplicação estará disponível em `http://localhost:3000`

## 📁 Estrutura do Projeto

```
src/
├── App.tsx              # Componente principal
├── App.css              # Estilos da aplicação
├── index.tsx            # Ponto de entrada
├── index.css            # Estilos globais
└── supabase.ts          # Configuração do Supabase
```

## 🔄 Fluxo de Funcionamento

1. **Upload**: Usuário seleciona ou arrasta um arquivo MP3
2. **Storage**: Arquivo é enviado para o bucket `audio-files` do Supabase
3. **Webhook**: URL pública do arquivo é enviada para o webhook de transcrição
4. **Transcrição**: Processamento é realizado pelo serviço externo
5. **Resultado**: Transcrição é exibida na interface

## 🌐 Webhook

A aplicação envia uma requisição POST para:
```
https://webhook.gabrielsena.net/webhook/transcritor
```

Com o payload:
```json
{
  "audioUrl": "https://url-do-arquivo-no-supabase",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 📱 Responsividade

A aplicação é totalmente responsiva e funciona em:
- Desktop
- Tablet
- Mobile

## 🔧 Personalização

### Cores
As cores principais podem ser alteradas no arquivo `src/App.css`:
- Gradiente principal: `#667eea` → `#764ba2`
- Cores de destaque: `#667eea`

### Webhook
Para alterar o endpoint do webhook, edite a URL em `src/App.tsx`:
```typescript
const response = await fetch('sua_url_do_webhook', {
  // ...
});
```

## 🐛 Solução de Problemas

### Erro de CORS
Se houver problemas de CORS com o webhook, verifique se o endpoint está configurado para aceitar requisições do domínio da aplicação.

### Erro de Upload
Verifique se:
- As credenciais do Supabase estão corretas
- O bucket `audio-files` existe
- As políticas de acesso estão configuradas

### Erro de Transcrição
Verifique se:
- O webhook está acessível
- O formato do payload está correto
- O serviço de transcrição está funcionando

## 📄 Licença

Este projeto está sob a licença MIT.

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request 