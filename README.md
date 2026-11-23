# ACAISAN PLAN para computador (Windows)

Programa instalável (`ACAISAN-PLAN-Setup.exe`), com ícone na área de trabalho e no menu Iniciar, janela e interface próprias:
- **Barra de título da ACAISAN:** logotipo, BETA, voltar, avançar, recarregar e Painel, o nome da tela aberta, um ponto de conexão e os botões nativos do Windows.
- **Tela de abertura** no estilo visor de câmera (REC, "Abrindo seu workspace").
- **Tela "Sem conexão"**, que tenta de novo sozinha.
- **Atalhos:** Ctrl+R recarrega, Alt+← e Alt+→ navegam, Ctrl+= e Ctrl+- dão zoom, F11 põe em tela cheia, Ctrl+Shift+H volta ao Painel.
- **Janela:** lembra o tamanho e a posição entre aberturas.
- **Uma instância só:** abrir de novo traz a janela para a frente.
- **Atualização automática:** baixa a versão nova em segundo plano e mostra "Atualização pronta · Reiniciar".

Dentro da janela roda a mesma ACAISAN PLAN (`https://acaisanplan.com/app.html`): mesma conta, mesmos dados, sempre atualizada com o site. O PRESENT abre em janela própria.

## Segurança

- **Isolamento:** o conteúdo do site roda isolado (`sandbox`, `contextIsolation`, sem Node). O preload do conteúdo só informa à barra qual tela está aberta e expõe `window.acaisanDesktop`.
- **Navegação:** a janela navega apenas em `acaisanplan.com` (e `www` e `beta`) e nas páginas de pagamento da Stripe (`checkout`, `billing` e `pay.stripe.com`). Qualquer outro link (WhatsApp, YouTube, e-mail…) abre no navegador padrão.
- **Permissões:** só notificações, área de transferência, tela cheia e microfone, e só para a ACAISAN PLAN.
- **Ferramentas de desenvolvedor:** desligadas no app instalado.
- **Identificação:** o app se apresenta como `AcaisanPlanDesktop/<versão>` no user agent. Os botões "Baixar app" do site somem dentro dele.

**Limite conhecido:** o ditado por voz da Central de comando usa o reconhecimento de fala do Chrome, que não funciona dentro de apps Electron. No app para computador, o ditado não funciona; o resto da Central de comando funciona normalmente.

## Desenvolvimento

```
npm install
npm start            # abre o app (em desenvolvimento, AC_DESKTOP_URL troca o endereço)
npm run smoke -- --ac-shot=<pasta>   # abre, tira prints da abertura, do app e do "Sem conexão" e fecha
npm run dist         # gera dist/ACAISAN-PLAN-Setup.exe, latest.yml e .blockmap
```

O Electron não abre a partir de pastas com permissões especiais de "AppContainer". Nesse caso, rode de uma cópia em outra pasta.

## Publicação (GitHub Releases)

1. Crie o repositório **público** `caisanfilms-commits/acaisan-plan-desktop` e coloque nele o conteúdo desta pasta `desktop/` (na raiz). Ele não tem segredos: só a casca do app.
2. Para publicar uma versão: ajuste `version` no `package.json` (ex.: `1.0.0-beta.1`), faça commit e envie a tag igual (`v1.0.0-beta.1`).
3. O workflow `.github/workflows/publicar.yml` gera o instalador numa máquina Windows do GitHub e publica na Releases, com `latest.yml` para a atualização automática.
4. O link fixo de download fica `https://github.com/caisanfilms-commits/acaisan-plan-desktop/releases/latest/download/ACAISAN-PLAN-Setup.exe`. É esse o link que os botões "Baixar app" do site usam.

## Assinatura (depois do beta)

- **Hoje:** sem certificado, o Windows mostra "O Windows protegeu o computador" na primeira instalação ("Mais informações › Executar assim mesmo").
- **Para tirar o aviso:** um certificado de assinatura de código em nome da empresa. Configurado em `win.signtoolOptions` ou nas variáveis `CSC_LINK` e `CSC_KEY_PASSWORD` do workflow.
- **Mac:** um build `--mac` num runner `macos-latest`, com conta Apple Developer para assinar e "notarizar".

## Testado (23/11/2026)

- **Modo de teste:** abriu `https://acaisanplan.com/app` (tela de entrada, sem login), com tela de abertura, barra de título e a tela "Sem conexão" com o ponto vermelho.
- **Instalador:** gerado `ACAISAN-PLAN-Setup.exe` (≈ 117 MB) com `latest.yml` e `.blockmap`.
- **Pacote:** contém só o app, as telas e o `electron-updater`, sem ferramentas de build.
- **App montado:** abre a janela "ACAISAN PLAN" e fica estável.
- **Ainda não testado:** instalar com o `.exe` (cria atalhos no computador) e a atualização automática, que depende do repositório público e da primeira versão publicada.
