# CONTEXT — codocs

Glossário do domínio. Termos canônicos usados no projeto. Sem detalhes de implementação.

## Termos

**Documentação Viva** — A fonte da verdade da documentação, em Markdown, versionada dentro do repositório junto com o código. Visão de longo prazo; o POC gera apenas o snapshot.

**Snapshot** — Uma geração única e completa da documentação de um repositório em um dado momento. O entregável do POC.

**ELI5** — Seção introdutória da documentação que explica a aplicação em linguagem simples, com metáforas e fluxogramas fundamentais. Destinada a quem chega sem contexto (novos membros, não-técnicos).

**Documentação Formal** — Seção principal da documentação: fluxogramas de arquitetura, textos, trechos relevantes de código, descrição de pipelines e fluxos.

**Esqueleto** — O resultado factual da análise estática de um repositório: estrutura, módulos, dependências, entry points e hotspots. Serve de base verificável para a narrativa gerada por IA (evita alucinação de arquitetura).

**Hotspot** — Região do código com alta frequência de mudança segundo o histórico Git. Indica áreas que merecem documentação mais profunda.

**Motor** — O núcleo de análise e geração, independente de interface. Consumido pelo CLI (POC) e futuramente pela interface web.

**Provider** — Abstração sobre o serviço de IA utilizado para gerar a narrativa. Intercambiável por configuração.
