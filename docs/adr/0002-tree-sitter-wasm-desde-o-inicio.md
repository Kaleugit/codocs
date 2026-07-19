# tree-sitter via WASM desde o dia 1

O motor será consumido primeiro pelo CLI (Node) e futuramente por uma versão 100% no navegador (site estático, sem backend, por privacidade — o código do usuário nunca toca nossa infra). Usamos `web-tree-sitter` (WASM) em vez dos bindings nativos de Node, mesmo sendo mais lento, para que o mesmo motor rode em Node e no browser sem reescrita. Se a versão browser for abandonada, este trade-off deve ser revisitado.
