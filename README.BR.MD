# Teste Técnico

---

Este projeto foi desenvolvido para um teste técnico para uma vaga na empresa Shopper.

O projeto consiste de uma API REST desenvolvida com Node.js e Typescript, utilizando Docker para criação de containers e Express.js como framework.

Recebe imagens de medidas de água e gás, repassa elas para um modelo de LLM (Gemini neste caso.), o qual realiza a leitura das medidas, retorna elas e armazena os dados.

---

## Funcionalidades

O projeto apresenta 3 principais endpoints.

- /upload: **(POST)** Recebe uma imagem em Base64, data e tipo da medida e o código do cliente. Realiza a validação dos dados, incluindo a imagem, a qual é requerido um mime type (ex: data:image/png), devido aos requerimentos da API do Google. Valida os dados únicos e grava no banco de dados.
- /confirm: **(Patch)** Confirma o valor escrito anteriormente no banco de dados e salva o valor atualizado no banco de dados.
- /:customerCode/list: **(GET)** Recebe a lista de medidas para um determinado cliente. Pode receber uma query para o tipo de medida.(ex: /abc/list?measure_type=GAS).
  
---

## Tecnologias

As tecnologias utilizadas:
- Express.js
- Docker and Docker-Compose
- Prisma
- Postgresql
- Zod
  
---

## Rodar

Os passo necessários para rodar o projeto são:

1. Instalar Docker e Docker Composer.
2. Criar um arquivo .env contendo a chave de API do Gemini. **Ex:GEMINI_API_KEY=API KEY**
3. Rodar **docker compose up --build**