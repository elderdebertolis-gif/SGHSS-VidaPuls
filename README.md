# SGHSS VidaPlus

Protótipo front-end do Sistema de Gestão Hospitalar e de Serviços de Saúde VidaPlus.

## O que foi implementado

- Fluxo inicial com login, recuperação de senha, cadastro inicial, política de privacidade e aviso LGPD.
- Área do paciente com dashboard, cadastro, consultas, exames, histórico clínico, teleconsulta, prescrições, notificações e privacidade.
- Área do profissional com agenda, pacientes, prontuário, prescrições, solicitação de exames, telemedicina, home care e histórico de atendimentos.
- Área administrativa com pacientes, profissionais, unidades, internações, leitos, suprimentos, relatórios financeiros, indicadores, auditoria e perfis de acesso.
- Dados fictícios, feedback visual, controle por perfil, logs simulados, disponibilidade, backup e múltiplas unidades.

## Estrutura principal

- `src/App.tsx`: orquestra estados, navegação e fluxos simulados.
- `src/mockData.ts`: massa de dados fictícia usada em todo o protótipo.
- `src/App.css`: identidade visual, layout responsivo e componentes visuais.

## Documentação de apoio

- `docs/aderência-escopo.md`: checklist resumido de aderência ao escopo.
- `docs/mapa-navegação.md`: estrutura de navegação por perfil.
- `docs/guia-visual.md`: direção visual e princípios de UX.
- `docs/roteiro-apresentacao.md`: roteiro-base para apresentação do trabalho.

## Execução

1. Abra a pasta `Documents/SGHSS`.
2. Instale as dependências com `npm install`.
3. Rode `npm run dev`.

Senha demo da tela inicial: `VidaPlus@2026`

## Publicação

O projeto está preparado para publicação no GitHub Pages via GitHub Actions.

URL esperada da aplicação publicada:

`https://elderdebertolis-gif.github.io/SGHSS-VidaPuls/`

## Observação

O projeto foi validado com `tsc --noEmit` e `vite build` após os ajustes finais.
