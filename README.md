# codocs

Gera documentação técnica automaticamente a partir do **código** e do **histórico Git** de um repositório — e entrega um **PDF estruturado** pensado para novos membros da equipe.

## Como funciona

O codocs combina duas camadas (ver `docs/adr/0001`):

1. **Análise estática** (tree-sitter + Git): extrai fatos verificáveis — estrutura, módulos, dependências, entry points e *hotspots* (áreas com mais mudanças no histórico). Nenhuma IA envolvida aqui.
2. **IA generativa** (Gemini, gratuito): escreve a narrativa — ELI5, arquitetura, fluxos e onboarding — **apenas** sobre os fatos extraídos. Omissão é aceitável; invenção não.

O PDF é renderizado a partir de arquivos Markdown intermediários, que também ficam no output (`codocs-output/docs/`).

## Pré-requisitos

- Node.js 20+
- Uma API key gratuita do Google AI Studio: https://aistudio.google.com/apikey

## Instalação

```bash
git clone <este-repo> && cd codocs
npm install
npm run build
npm link        # disponibiliza o comando `codocs` globalmente
```

## Configuração (uma vez)

```bash
codocs config api-key SUA_CHAVE_DO_AI_STUDIO
```

Ou via variável de ambiente: `export GEMINI_API_KEY=SUA_CHAVE`.

Opcionais:

```bash
codocs config lang pt-BR      # força idioma (default: auto-detect pelo README)
codocs config model gemini-2.0-flash
```

## Uso

```bash
cd meu-projeto
codocs generate
```

Ou apontando para outro lugar:

```bash
codocs generate ../outro-repo
codocs generate https://github.com/usuario/repo   # clona temporariamente
```

O que acontece:

```
✔ análise concluída: 342 arquivos, 18 módulos, typescript, python

Estimativa: ~22 requests ao Gemini (free tier), ~3 min.
Continuar? [s/N] s

✔ documentação gerada

  PDF:      ./codocs-output/meu-projeto-docs.pdf
  Markdown: ./codocs-output/docs
```

Use `--yes` para pular a confirmação e `--out <dir>` para mudar o destino.

## Estrutura do PDF

1. **Capa** — nome, data do snapshot, hash do commit analisado
2. **ELI5** — o que é o sistema, em linguagem simples, com metáfora
3. **Visão Geral da Arquitetura** — stack, camadas, entry points + grafo de módulos (gerado deterministicamente do código, nunca pela IA)
4. **Fluxos Principais** — jornadas do sistema com diagramas Mermaid (validados antes de entrar no PDF)
5. **Módulos** — um capítulo por módulo; hotspots ganham mais profundidade
6. **Guia de Onboarding** — por onde começar a ler, setup, glossário
7. **Apêndice** — estatísticas e ranking de hotspots

## Privacidade

O repositório **nunca sai da sua máquina**. Os únicos dados enviados ao provider de IA são resumos estruturais e trechos selecionados de código. O provider é intercambiável (`src/engine/llm/`) — suporte a modelos locais (Ollama) está no roadmap.

## Desenvolvimento

```bash
npm run dev -- generate .   # roda o CLI sem build
npm run typecheck
npm run build
```

Decisões de arquitetura estão registradas em `docs/adr/`. O glossário do domínio está em `CONTEXT.md`.
