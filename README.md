# Gerador de Caça-Palavras

Ferramenta gratuita para criar caça-palavras educativos e recreativos, direto no navegador.
Site: <https://eliseuangelos.github.io/caca-palavras/>

Desenvolvido por **Eliseu Fernandes Laurindo** — [site pessoal](https://eliseuangelos.github.io) · [GitHub](https://github.com/eliseuangelos)

Tecnologia: HTML5, CSS3 e JavaScript puro, hospedagem estática no GitHub Pages. Sem servidor, sem banco de dados, sem chaves de API, sem cadastro. Tudo o que o visitante digita é processado no próprio aparelho.

## Três modos de uso

| Aba | O que faz | Saída |
|---|---|---|
| **Jogo individual** | Palavras em um campo único, tamanho, direções e jogo interativo (arrastar com mouse ou dedo, teclado, cronômetro, dica, embaralhar, gabarito). | Tela, impressão ou PDF A4 retrato (atividade + gabarito) |
| **Gerar revista** | De 1 a 50 caça-palavras diferentes a partir de um banco de palavras, com identificação sequencial (P0001, P0002…). | Um único PDF A4 retrato: uma atividade por página e **todos os gabaritos no final**, quatro por página |
| **Página personalizada** | Título, subtítulo, texto com vários parágrafos, instruções e lista de palavras na coluna esquerda; matriz na direita. | PDF com 2 páginas A4 **paisagem** (atividade e respostas) |

Há ainda as abas **Ajuda** (guia de uso e perguntas frequentes) e **Créditos**.

## Atualização de 10/11/2026

1. **Endereço do site pessoal:** agora é somente `https://eliseuangelos.github.io`. Foi corrigido nos Créditos, no rodapé, nos dados estruturados (JSON-LD) e neste README. Nenhum arquivo do projeto usa mais o endereço antigo (`…/eliseuangelos/`).
2. **Efeito e toque sonoro de vitória:** ao achar a última palavra, a matriz pulsa e brilha, sai um confete nas cores da marca, as palavras da lista "pulam" em sequência e toca um toque curto de vitória; só depois abre o diálogo "Parabéns!". Há um botão de som no cabeçalho. Veja a seção **Efeito e som de vitória**.
3. **Logomarcas:** o favicon, o símbolo da marca e o ícone do iPhone/iPad agora são os **arquivos oficiais** de `https://eliseuangelos.github.io/assets/icons/`, copiados sem alteração para `assets/icons/`. O cabeçalho usa o favicon; os Créditos, o símbolo. A imagem de compartilhamento (Open Graph) foi refeita com o símbolo oficial.
4. **CSS no novo padrão:** a folha de estilos foi reescrita com a **paleta oficial** nos temas claro e escuro, tokens semânticos (`--color-background`, `--color-primary`…) e as fontes Inter e IBM Plex Mono. O tema vale para a página inteira, inclusive o tabuleiro. Os PDFs também passaram a usar as cores da marca. Veja a seção **Identidade visual**.

Nenhum recurso foi removido: jogo individual, revista, página personalizada, PDFs, configurações e SEO continuam como antes, e a meta tag do Google Search Console foi mantida exatamente como estava.

## Principais recursos

**Interface**
- Abas discretas com transições rápidas, destaque da aba ativa e menu compacto no celular (só o ícone nas abas inativas).
- Identidade visual da marca pessoal, com tema claro e escuro: segue o sistema, pode ser alternado no botão do cabeçalho e a escolha fica salva.
- Formulários em seções recolhíveis, botões grandes para toque, foco visível e navegação por teclado; respeita `prefers-reduced-motion`.
- Mensagens de erro e de sucesso objetivas, com a causa e o que fazer.

**Palavras, tamanho e direções**
- **Campo único de palavras**, separadas por vírgula (também aceita ponto e vírgula e quebra de linha). Ignora espaços e itens vazios, avisa palavras repetidas (mesmo quando só o acento muda), mostra a contagem e aponta palavras maiores que a matriz. A lista mantém acentos e hífens como digitados; só a matriz usa letras sem acento, sem espaços e sem hífens.
- **Seletor visual de tamanho**: cartões com miniatura da matriz — 10 × 10, 15 × 15 (padrão) e 20 × 20.
- **Seletor de direções**: oito botões (→ ← ↓ ↑ ↘ ↖ ↙ ↗) e atalhos (todas, só horizontal, só vertical, só diagonal, horizontal e vertical). O gerador respeita exatamente as direções marcadas.
- Palavras de 2 letras (como "FÉ") são aceitas; o mínimo original era 3.

**Algoritmo (aproveitado do projeto original e aperfeiçoado)**
- Posiciona as palavras mais longas primeiro, sorteia a direção entre as permitidas e, se travar, recomeça com preferência crescente por cruzamentos.
- **Nunca entrega uma atividade incompleta**: se não couber, explica o motivo e sugere o que ajustar.
- Troca letras de preenchimento para evitar que uma palavra da lista apareça "por acaso" uma segunda vez.
- A seleção do jogador compara as letras marcadas nos dois sentidos.

**Revista**
- Banco de palavras livre e/ou temas (os mesmos 16 temas do gerador automático), distribuição aleatória e equilibrada (uma palavra só volta depois que todas as outras foram usadas) e opção de **permitir ou impedir reutilização**.
- Sem reutilização, **valida antes de começar** se o banco tem palavras suficientes e informa quantas faltam.
- Cada jogo tem matriz própria; matrizes idênticas são refeitas.
- Identificação alfanumérica com incremento do número final e zeros preservados (`P0001`, `#001`, `JOGO001`, `ATIVIDADE01`); sem número no final, usa sufixo (`ATIVIDADE-01`, `ATIVIDADE-02`…).
- Geração em lote com barra de progresso e botão **Cancelar**; a tela não congela.
- No PDF, cada gabarito mostra a identificação e a página da atividade; o rodapé de cada atividade indica a página do gabarito. Os PDFs usam **exatamente** os jogos mostrados na pré-visualização (nada é regerado na exportação).

**PDF**
- Desenho vetorial (texto, linhas e retângulos), sem transformar a matriz em imagem; fonte Helvetica com acentos corretos; numeração "Página 01 de 63". Cores da marca (azul-marinho e verde-azulado), com letras escuras sobre o marca-texto do gabarito para sair legível até em impressora preto e branco.
- **Nome do arquivo** começa com data e hora do clique, `AAAAMMDDHHMMSS`, no horário local: `20261104101435-revista-caca-palavras.pdf`, `20261104101620-atividade-personalizada.pdf`, `…-caca-palavras.pdf`, `…-gabarito-caca-palavras.pdf`. Duas exportações no mesmo segundo ganham sufixo depois da data (`…-2-…`).
- **Pré-visualização** antes de exportar, desenhada pelo mesmo código do PDF.
- Na página personalizada, o texto da esquerda reduz a fonte automaticamente (até 60%) para caber; se ainda assim não couber, a exportação é bloqueada com aviso — nunca corta conteúdo.

**Configurações**
- Menu **Configurações** em cada formulário: salvar no navegador, ver as últimas configurações usadas, exportar e importar em JSON, e botão **Limpar formulário**. Tudo no armazenamento local do navegador; nada é enviado a servidores.

**Desempenho**
- Nenhuma dependência além do jsPDF, que só é carregado quando o PDF é pedido (a página abre mais rápido no celular). HTML, CSS e JavaScript próprios somam cerca de 230 KB sem compressão (cerca de 65 KB comprimidos, como o GitHub Pages costuma enviar).
- As fontes vêm do Google Fonts **sem travar a abertura da página**; enquanto não chegam (ou sem internet) aparecem fontes do sistema.
- O efeito de vitória só anima `transform` e `opacity` (o navegador acelera essas propriedades), e o som é sintetizado na hora: não há arquivos de áudio nem imagens extras.

## Identidade visual

O visual usa os mesmos tokens do site pessoal. A folha `assets/css/style.css` começa pelos tokens; todos os componentes usam apenas tokens, então trocar uma cor é mudar uma linha no começo do arquivo (tema claro em `:root`, tema escuro em `:root[data-theme="dark"]`).

### Paleta oficial

| Função | Token no CSS | Tema claro | Tema escuro |
|---|---|---|---|
| Fundo | `--color-background` | `#F4F7FB` | `#111C28` |
| Superfícies | `--color-surface` | `#FFFFFF` | `#1B2A3A` |
| Superfícies secundárias | `--color-surface-secondary` | `#E9EFF5` | `#24364A` |
| Texto principal | `--color-text` | `#162638` | `#EDF3F8` |
| Texto secundário | `--color-text-secondary` | `#526579` | `#B7C5D3` |
| Bordas | `--color-border` | `#D5DEE8` | `#3A4D60` |
| Cor primária | `--color-primary` | `#1D4263` | `#91B7D8` |
| Cor primária (hover) | `--color-primary-hover` | `#143048` | `#A9C8E3` |
| Destaque | `--color-accent` | `#2563EB` | `#83B4FF` |
| Destaque secundário | `--color-accent-secondary` | `#0B7E82` | `#68CBC2` |

### Cores complementares (fora da paleta oficial)

A paleta oficial não define cores de erro, aviso e sucesso, nem um contorno forte para campos: a borda oficial é discreta demais para delimitar um campo (contraste de cerca de 1,4:1 no tema claro e 1,7:1 no escuro, abaixo dos 3:1 recomendados para componentes de formulário). Por isso foram acrescentados estes tokens, em tons da mesma família:

| Token | Uso | Claro | Escuro |
|---|---|---|---|
| `--color-on-primary` | texto sobre a cor primária (botões) | `#FFFFFF` | `#111C28` |
| `--color-control-border` | contorno de campos e botões | `#7A8CA0` | `#6F8398` |
| `--color-field` | fundo dos campos | `#FFFFFF` | `#111C28` |
| `--color-danger` / `--color-on-danger` | erros | `#B42318` / `#FFFFFF` | `#FF9A92` / `#111C28` |
| `--color-warning` | avisos | `#8A5A00` | `#FFD36A` |
| `--color-success` | sucesso | `#0D6C73` | `#68CBC2` |

Todos os pares de texto e fundo usados têm contraste de pelo menos 4,5:1 e os elementos de interface, 3:1, nos dois temas (conferido por teste automático; veja "Testes realizados"). As cores do tabuleiro (`--cv-*`) são valores literais porque o `canvas` não entende `color-mix()`.

### Tema claro e escuro
- O botão de lua/sol no cabeçalho alterna o tema (`aria-pressed` informa o estado a leitores de tela).
- Sem escolha salva, o site segue o tema do sistema e acompanha mudanças dele.
- A escolha é gravada no navegador na chave `ed-theme` (`light` ou `dark`), **a mesma do site pessoal**. Como os dois sites ficam no mesmo endereço-base (`eliseuangelos.github.io`), a escolha feita em um vale para o outro. Quem usava a versão anterior (chave `cpg:tema`) tem a escolha aproveitada.
- O tema é aplicado por um pequeno script no `<head>` antes da primeira pintura, então a página não "pisca" ao abrir no tema escuro. O `theme-color` (barra do navegador no celular) muda junto.
- Ao trocar o tema durante um jogo, o tabuleiro é redesenhado com as cores novas.

### Fontes
**Inter** (textos e títulos) e **IBM Plex Mono** (apenas pequenos indicadores e metadados, como cronômetro, contagens e identificação), carregadas do Google Fonts. Para o navegador buscar as fontes, ele consulta servidores do Google (que recebem, como qualquer servidor, o endereço IP do visitante). Se preferir evitar isso, baixe os arquivos das duas fontes, coloque em `assets/fonts/`, troque o `<link>` do Google Fonts no `index.html` por regras `@font-face` no CSS e reenvie. Sem as fontes, o site funciona normalmente com as do sistema.

### Logomarcas e ícones

| Arquivo | Origem | Uso |
|---|---|---|
| `assets/icons/favicon.svg` | **oficial** | ícone da aba do navegador e logo do cabeçalho |
| `assets/icons/brand-symbol.svg` | **oficial** | símbolo da marca na aba Créditos e na imagem de compartilhamento |
| `assets/icons/apple-touch-icon.png` | **oficial** (180 × 180) | ícone do iPhone/iPad ao adicionar à tela de início |
| `assets/icons/favicon-48.png` | derivado do `favicon.svg` | PNG de 48 × 48 para navegadores sem suporte a favicon SVG |
| `assets/img/og-image.png` | gerada com o símbolo oficial | imagem de 1200 × 630 que aparece ao compartilhar o link |

Os três arquivos oficiais são cópias idênticas dos que estão em `https://eliseuangelos.github.io/assets/icons/` (um teste confere a impressão digital SHA-256 de cada um). Se a marca mudar, troque esses arquivos mantendo os nomes e rode `ferramentas/make-images.js` para refazer o PNG de 48 px e a imagem de compartilhamento.

## Efeito e som de vitória

**Quando acontece:** ao achar (ou revelar) a última palavra do jogo individual. Mostrar o gabarito não conta como vitória, e embaralhar durante a comemoração cancela tudo.

**Efeito visual (CSS):**
- a matriz dá um pequeno pulso, ganha um brilho que cruza o tabuleiro e um anel que se expande;
- as palavras da lista "pulam" em sequência;
- um confete (até 46 peças; 28 em telas pequenas) sai do tabuleiro nas cores da marca, nos dois temas, e desaparece sozinho em cerca de 3 s;
- o diálogo "Parabéns!" abre cerca de 1,5 s depois, com um selo de confirmação desenhado em SVG e animado.

**Toque sonoro:** um arpejo ascendente em Dó maior com acorde final, de cerca de 1,7 s, **sintetizado no próprio navegador** (Web Audio API). Não há arquivo de áudio, nada é baixado e funciona offline. O volume é moderado e o timbre é de sino (sem "bipe" áspero).
- O botão de **alto-falante** no cabeçalho liga e desliga o som. A escolha fica salva (chave `cpg:som`) e o padrão é **ligado**. Ao ligar, toca uma confirmação curta de duas notas e aparece o aviso "Som de vitória ligado."
- Os navegadores só liberam áudio depois de um toque, clique ou tecla da pessoa; no jogo isso sempre ocorre antes da vitória (para gerar o jogo ou marcar a palavra), e o site "destrava" o áudio no primeiro toque. Se o áudio não estiver disponível, o jogo segue normalmente, só sem o som.
- No iPhone, com o botão lateral de silêncio ligado, o som pode não tocar.

**Movimento reduzido:** se o sistema pede "reduzir movimento", não há confete, brilho nem anel; a matriz só ganha uma borda destacada em verde-azulado, o diálogo abre na hora e o som continua (porque há um botão próprio para silenciá-lo).

**Para ajustar:**
- tempo de espera antes do diálogo: constante `WIN_DELAY` em `assets/js/app-views.js` (milissegundos);
- animações: seção "9) Vitória" de `assets/css/style.css` (`@keyframes v-pulso`, `v-brilho`, `v-anel`, `v-pop`, `c-*`, `v-selo`);
- notas, duração e volume do toque: função `playWin()` (e `bus(0.16)` para o volume) em `assets/js/efeitos.js`;
- número e cores do confete: função `confetti()` e lista `COLORS` no mesmo arquivo.

## Estrutura dos arquivos

```
index.html                  página única (head com SEO, abas, formulários, ajuda, créditos)
sitemap.xml                 mapa do site
robots.txt                  referência (veja "robots.txt e o endereço do GitHub Pages")
.nojekyll                   opcional: pede ao GitHub Pages para publicar os arquivos como estão
assets/
  css/style.css             tokens da paleta, temas claro/escuro, componentes, vitória e impressão
  js/core.js                geração das matrizes, palavras, identificação e lotes (sem DOM)
  js/sheets.js              layout das páginas (A4 retrato e paisagem), usado pelo PDF e pela pré-visualização
  js/metrics.js             larguras da fonte Helvetica (gerado a partir do jsPDF)
  js/pdf.js                 exportação em PDF e nome dos arquivos
  js/game.js                tabuleiro interativo (canvas, mouse, toque e teclado)
  js/efeitos.js             efeito de vitória (confete), toque sonoro (Web Audio) e botão de som
  js/app-core.js            componentes de interface, abas, tema, configurações
  js/app-views.js           telas: jogo individual, revista e página personalizada
  js/themes.js              bancos de palavras por tema (para criar um tema, acrescente uma chave com name e words)
  vendor/jspdf.umd.min.js   jsPDF 4.2.1 (licença MIT em jspdf.LICENSE.txt)
  icons/                    logomarcas: favicon.svg, brand-symbol.svg e apple-touch-icon.png (oficiais) + favicon-48.png
  img/og-image.png          imagem de compartilhamento (1200 × 630)
```

## Como substituir os arquivos no GitHub

**Antes:** em <https://github.com/eliseuangelos/caca-palavras>, clique em **Code → Download ZIP** para guardar uma cópia da versão atual.

### Pelo navegador (sem instalar nada)
1. Descompacte o arquivo recebido e abra a pasta `site`.
2. No repositório, clique em **Add file → Upload files**.
3. Arraste **o conteúdo** da pasta `site` (não a pasta em si): `index.html`, `assets` (agora com a pasta nova `icons`), `sitemap.xml`, `robots.txt`, `README.md` e, se aparecer, `.nojekyll` (no Mac, arquivos com ponto ficam ocultos; ele é opcional).
4. Escreva uma mensagem (por exemplo, "Marca pessoal, efeito e som de vitória") e clique em **Commit changes**. Arquivos com o mesmo nome são substituídos.
5. Aguarde de 1 a 3 minutos. A publicação aparece em **Actions → pages build and deployment**.
6. Abra o site com **Ctrl + F5** (ou Cmd + Shift + R) para ignorar o cache e faça o roteiro de conferência abaixo.
7. **Opcional (recomendado):** apague os três ícones antigos, que o site não usa mais. Em `assets/img/`, abra `favicon.svg`, `favicon-48.png` e `apple-touch-icon.png` (se existirem), clique no menu **⋯ → Delete file** e confirme com **Commit changes**. O site funciona mesmo que você não apague; o envio por navegador só substitui arquivos, não remove os antigos.

### Pelo Git
```bash
git clone https://github.com/eliseuangelos/caca-palavras.git
cd caca-palavras
# copie o conteúdo da pasta site/ para cá, sobrescrevendo os arquivos
git rm -f --ignore-unmatch assets/img/favicon.svg assets/img/favicon-48.png assets/img/apple-touch-icon.png   # ícones antigos
git add -A
git commit -m "Marca pessoal, efeito e som de vitória"
git push
```

### Testar antes de publicar (opcional)
```bash
cd site
python3 -m http.server 8000      # depois abra http://localhost:8000
```

### Roteiro de conferência depois de publicar
1. Veja o **ícone da aba** do navegador e o logo no cabeçalho (devem ser os da marca) e alterne o **tema claro/escuro** no botão do cabeçalho.
2. Gere um jogo 15 × 15, marque uma palavra arrastando e clique em **Salvar PDF**: o arquivo deve começar com a data e a hora.
3. Marque (ou use **Revelar palavra** em) todas as palavras: a matriz deve brilhar, sair o confete e **tocar o som de vitória** antes do diálogo "Parabéns!". Teste também o botão de som. (O teste automático só confirma que o som é gerado; ouvir é com você.)
4. Em **Gerar revista**, gere 10 jogos e baixe: as atividades vêm primeiro e os gabaritos nas últimas páginas.
5. Em **Página personalizada**, gere e baixe: 2 páginas A4 paisagem.
6. Abra no celular e confira abas, formulário, tabuleiro e o tema escuro.
7. Em **Créditos**, confira o símbolo da marca e os links (o do site pessoal deve abrir `https://eliseuangelos.github.io`).

Se algo der errado, abra o commit no GitHub e clique em **Revert**, ou envie de novo o ZIP de backup.

Para trocar o endereço do gerador (por exemplo, domínio próprio), altere a URL em `index.html` (canonical, Open Graph, JSON-LD), em `sitemap.xml`, em `robots.txt` e a constante `SITE` em `assets/js/sheets.js` (texto do rodapé dos PDFs). O endereço do site pessoal aparece em `index.html` (Créditos, rodapé e JSON-LD).

## SEO e indexação

**O que já está no código:** `title` e `description` objetivos; canonical; Open Graph e Twitter Cards com imagem 1200 × 630; `lang="pt-BR"`; `meta robots` liberando indexação; ícones oficiais da marca (favicon, ícone do iPhone/iPad); `theme-color` para os dois temas; dados estruturados JSON-LD (Schema.org) com `WebSite`, `WebApplication` e `Person` (você como autor, com o endereço `https://eliseuangelos.github.io`), descrevendo apenas recursos que existem; hierarquia de títulos (um `h1`, seções em `h2`/`h3`); links internos entre as abas; e a aba **Ajuda** com texto original: o que é o gerador, como criar, tamanhos, direções, revistas, páginas de atividade, PDF, efeito de vitória e perguntas frequentes. A meta tag de verificação do Google Search Console foi **mantida exatamente como estava**. Sem JavaScript, todo o conteúdo aparece, sem abas.

Os dados estruturados são válidos, mas não prometem nenhum destaque especial nos resultados. Para conferir: [Teste de Resultados Ricos](https://search.google.com/test/rich-results) e [validator.schema.org](https://validator.schema.org/).

### robots.txt e o endereço do GitHub Pages
- Os buscadores só leem o `robots.txt` na **raiz do domínio**: `https://eliseuangelos.github.io/robots.txt`. Hoje essa raiz é o seu site pessoal, e o arquivo dele (conferido na cópia do repositório de 09/11/2026) libera tudo (`Allow: /`) e aponta o sitemap do próprio site. Portanto, nada bloqueia o `/caca-palavras/`.
- O `robots.txt` que está dentro de `/caca-palavras/` é **ignorado** pelos buscadores. Ele fica no projeto como referência e para quem publicar o gerador em domínio próprio; manter ou apagar não muda nada na prática.
- **Opcional, no repositório do site pessoal** (este pacote não mexe nele): para ajudar a descoberta do gerador, o `sitemap.xml` da raiz pode listar também `https://eliseuangelos.github.io/caca-palavras/`, ou o `robots.txt` da raiz pode ganhar uma segunda linha `Sitemap: https://eliseuangelos.github.io/caca-palavras/sitemap.xml`. Uma das duas basta. O site pessoal já tem links para o gerador (botão "Acessar projeto" e a página de links), o que também ajuda os buscadores a encontrá-lo.
- O mesmo vale para o IndexNow e para arquivos de verificação: o que fica em `/caca-palavras/` só vale para URLs dentro de `/caca-palavras/`.

### sitemap.xml
Lista a única URL pública, `https://eliseuangelos.github.io/caca-palavras/` (`lastmod` 2026-11-10). As abas (`#revista`, `#pagina`…) não são páginas separadas para os buscadores, então não entram. O sitemap está dentro de `/caca-palavras/`, o que é permitido, porque ele só lista URLs dessa pasta. Atualize o `<lastmod>` quando publicar mudanças relevantes.

### Google Search Console
1. Acesse o [Search Console](https://search.google.com/search-console) com sua conta Google.
2. **Adicionar propriedade → Prefixo do URL** e informe `https://eliseuangelos.github.io/caca-palavras/`. (A opção "Domínio" exige controle do DNS, que o `github.io` não oferece.) Se você já tem a propriedade `https://eliseuangelos.github.io/` (prefixo do URL), ela já inclui o `/caca-palavras/`: pode usar essa, ou as duas.
3. Método de verificação **Tag HTML**: a tag já está no `index.html`. Depois de publicar a nova versão, clique em **Verificar**. Se o Google pedir um código diferente do que está no arquivo (outra conta), substitua o valor de `google-site-verification`.
4. Em **Sitemaps**, informe `sitemap.xml` e envie. O status deve ficar como "Sucesso".
5. Em **Inspeção de URL**, cole a URL do site e use **Solicitar indexação** (a cota é limitada).
6. Monitoramento: **Indexação → Páginas** (motivos de não indexação e erros de rastreamento), **Desempenho** (consultas e cliques) e **Sitemaps** (páginas descobertas). A primeira leitura costuma levar de dias a semanas.
7. Para conferir se a página está no Google: Inspeção de URL ("O URL está no Google") ou a busca `site:eliseuangelos.github.io/caca-palavras` (indicador aproximado).

### Bing Webmaster Tools
O Bing alimenta, em boa parte, os resultados do DuckDuckGo e do Yahoo, então vale a pena cuidar dele.
1. Acesse o [Bing Webmaster Tools](https://www.bing.com/webmasters) e entre com sua conta.
2. **Mais simples:** em **My Sites → Import**, entre com o Google e autorize. Os sites já verificados no Search Console, com seus sitemaps, são importados e verificados automaticamente ([explicação do Bing](https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools)). Os dados podem levar até 48 horas.
3. **Alternativa:** adicione o site manualmente, escolha verificação por **meta tag**, copie a linha `<meta name="msvalidate.01" content="…">` e cole no `<head>` do `index.html` (há um comentário indicando o lugar, logo abaixo da tag do Google). Publique e clique em **Verify**.
4. Em **Sitemaps**, envie `https://eliseuangelos.github.io/caca-palavras/sitemap.xml`.
5. Em **Submit URLs**, envie a página principal. Para acompanhar o rastreamento, use as ferramentas de inspeção de URL e os relatórios do próprio painel.

### Outros buscadores
- **DuckDuckGo e Yahoo:** não têm painel próprio de envio. O que você faz no Bing ajuda neles.
- **Brave Search:** não tem um painel de webmaster como Google e Bing. Segundo discussões da comunidade Brave, existe um formulário de envio de URL em `search.brave.com/submit-url`; **não consegui abrir essa página para confirmar**, então teste você mesmo. O Brave também descobre sites por outros meios, sem garantia de prazo.
- **Yandex, Naver e Seznam** aceitam o IndexNow (próxima seção).

### IndexNow (opcional)
**É viável e seguro**, com limites: o protocolo avisa os buscadores participantes (Bing, Yandex, Naver, Seznam e outros) de que uma URL mudou. **O Google não o utiliza.** A "chave" é um arquivo público; não é segredo. No GitHub Pages não há como automatizar o envio sem servidor, então o aviso é manual, e só vale a pena quando houver mudança relevante (o site tem uma URL só).

Regra do protocolo: a chave pode ficar em subpasta, mas só vale para URLs daquela subpasta ([documentação](https://www.indexnow.org/documentation)). Como o site inteiro está em `/caca-palavras/`, serve.

1. Gere uma chave de 8 a 128 caracteres (letras, números e hífen). No navegador: tecle F12, aba **Console**, e digite `crypto.randomUUID().replaceAll('-','')`.
2. Crie no repositório um arquivo chamado `CHAVE.txt` (troque `CHAVE` pela chave gerada) contendo **apenas a chave**. Ele ficará em `https://eliseuangelos.github.io/caca-palavras/CHAVE.txt`.
3. Abra no navegador (trocando `CHAVE`):
   ```
   https://api.indexnow.org/indexnow?url=https%3A%2F%2Feliseuangelos.github.io%2Fcaca-palavras%2F&key=CHAVE&keyLocation=https%3A%2F%2Feliseuangelos.github.io%2Fcaca-palavras%2FCHAVE.txt
   ```
4. Resposta **200** ou **202** significa "recebido" (202 = chave em validação). Isso **não garante indexação**. Erros: 403 (chave não encontrada ou diferente do conteúdo do arquivo) e 422 (URL que não pertence ao site ou chave fora do padrão).

### O que esperar
Nenhuma configuração garante posição na primeira página nem indexação imediata. O que está feito é a base técnica; o resultado depende do tempo e da qualidade do conteúdo.

## Testes realizados

Executados no Chromium com Playwright, contra um servidor local servindo exatamente os arquivos desta pasta, mais testes unitários em Node. Resultado final (10/11/2026): **28 testes unitários e 150 verificações no navegador, todos aprovados.**

### Cenários obrigatórios da reestruturação

| # | Cenário pedido | Como foi verificado |
|---|---|---|
| 1–3 | Matrizes 10 × 10, 15 × 15 e 20 × 20 | Geração, desenho no canvas e todas as palavras achadas por arrasto de mouse, nos dois sentidos |
| 4 | Palavras com acento | Lista mantém acentos; matriz sem acento; PDF exibe ç, ã, é, º e — corretamente |
| 5 | Palavras separadas por vírgula | Espaços sobrando e itens vazios tratados; contagem correta |
| 6 | Palavras repetidas | Avisadas, inclusive quando só o acento muda; geração bloqueada |
| 7 | Palavra maior que a matriz | Informada com o tamanho; geração bloqueada |
| 8–10 | Só horizontal, só vertical, só diagonal | Verificação independente de que cada palavra está onde diz estar e em direção permitida; o seletor enviou as direções esperadas |
| 11 | 10 caça-palavras diferentes | 10 matrizes diferentes entre si, P0001 a P0010 |
| 12 | 50 caça-palavras | JOGO001 a JOGO050 gerados em cerca de 4 s no teste, PDF de 63 páginas (50 atividades + 13 de gabaritos) |
| 13 | Identificação sequencial | `P0001`, `#001`, `JOGO001`, `ATIVIDADE01`, sem número (sufixo), virada de dezena e de centena |
| 14 | Gabaritos iguais às atividades | A matriz de cada gabarito, lida do PDF, é idêntica à da atividade (10 de 10 conferidas) |
| 15 | Gabaritos nas últimas páginas | Começam depois da última atividade, quatro por página; a última página traz JOGO049 e JOGO050; cada um indica a página da atividade |
| 16 | Exportação A4 paisagem | PDF de 2 páginas de 842 × 595 pt, mesmas identificação e matriz nas duas |
| 17 | Nomes com data e horário | `AAAAMMDDHHMMSS-…pdf` no horário do clique; sufixo `-2` quando repete o segundo; vale para gabarito individual e para o JSON de configuração |
| 18 | Celular | Tela de 390 × 844 com toque: sem rolagem horizontal, tabuleiro ocupando a largura, botões com altura de toque, palavra marcada com o dedo |
| 19 | Console | Nenhum erro, aviso, requisição falha ou resposta HTTP ≥ 400 em todos os fluxos |
| 20 | Recursos originais | Cronômetro, Revelar palavra, Embaralhar, gabarito liga/desliga, sorteio por tema, teclado, impressão, efeito e diálogo de vitória |

### Correções de 10/11/2026

| Pedido | Como foi verificado |
|---|---|
| URL do site pessoal | Teste unitário varre todos os arquivos de texto do projeto: nenhum contém o endereço antigo do site pessoal (o que terminava em `/eliseuangelos/`). No navegador, o botão "Site pessoal" (Créditos) e o link do rodapé apontam para `https://eliseuangelos.github.io`; o JSON-LD também |
| Logomarcas oficiais | Impressão digital SHA-256 dos três arquivos oficiais conferida; links do `<head>` corretos; cabeçalho e Créditos usam os arquivos novos e todos são servidos com HTTP 200; tamanhos 180 × 180, 48 × 48 e 1200 × 630; ícones antigos removidos; imagem de compartilhamento conferida visualmente |
| Paleta e CSS | As 10 cores de cada tema conferidas contra o CSS; contraste calculado nos pares reais de uso (texto ≥ 4,5:1 e interface ≥ 3:1, nos dois temas); letras do tabuleiro sobre o marca-texto ≥ 4,5:1; telas conferidas nos dois temas, no computador e no celular; tema salvo em `ed-theme` e aplicado antes da primeira pintura; aproveitamento da escolha do site pessoal e da versão anterior |
| Efeito e som de vitória | Classes e animações CSS ativas; confete criado e removido; toque iniciado (um "espião" de `AudioContext` conta os osciladores: 14 em 1 contexto); diálogo só depois da comemoração; botão de som por teclado; escolha lembrada ao recarregar; gabarito não dispara efeito; embaralhar cancela; com "reduzir movimento": sem confete, brilho nem anel, diálogo imediato |
| PDFs na nova paleta | Atividade, gabaritos, revista e página paisagem convertidos em imagem e conferidos visualmente |

Também testados: erro antecipado quando não há palavras suficientes sem reutilização, texto longo demais na página personalizada, salvar/carregar/importar/exportar configurações, navegação pelas cinco abas. Observação: o ambiente de teste não acessa o Google Fonts; as requisições de fontes são simuladas e o teste usa a Inter instalada no computador.

A pasta `testes/` (opcional, não precisa ir para o GitHub) tem os testes para repetir:
```bash
node --test testes/core.test.js testes/brand.test.js          # unitários (Node 18+; liste os arquivos, a pasta inteira não funciona no Node 22)
# navegador: precisa de Node 18+, Playwright e poppler-utils (pdftotext, pdfinfo).
# Sirva a pasta site/ em http://127.0.0.1:8765 (por exemplo: cd site && python3 -m http.server 8765 --bind 127.0.0.1) e rode:
NODE_PATH=$(npm root -g) node testes/e2e.js
```

A pasta `ferramentas/` (também opcional) guarda os scripts que geram a imagem de compartilhamento e o PNG de 48 px a partir dos ícones oficiais (`make-images.js`) e a tabela de larguras da fonte usada nos PDFs (`gen-metrics.js`). Só são necessários se você quiser refazer esses arquivos.

## Limitações conhecidas

- **Navegadores e aparelhos:** testado no Chromium e com emulação de celular. **Não** foi testado em Safari, Firefox nem em aparelhos reais (iPhone, Android). Use versões atuais (a partir de 2023). Há um plano B para navegadores sem o seletor CSS `:has()` e para os que não entendem `color-mix()`.
- **Som:** o teste automático confirma que o toque é gerado e enviado ao navegador, mas não "escuta" o resultado; o timbre e o volume (moderado) foram definidos por cálculo, então confira de ouvido e ajuste `bus(0.16)` em `efeitos.js` se achar alto ou baixo. No iPhone, o botão lateral de silêncio pode silenciar o som. Se o navegador bloquear o áudio, o jogo continua sem o som.
- **Fontes:** Inter e IBM Plex Mono vêm do Google Fonts (veja "Identidade visual"). No ambiente de teste a IBM Plex Mono não estava disponível, então os indicadores em fonte monoespaçada foram conferidos com a fonte monoespaçada do sistema.
- **Letras no PDF:** a fonte é a Helvetica padrão do PDF. Em títulos e textos, caracteres fora do alfabeto latino (emojis, grego, cirílico…) saem como "?" ou sem acento. A matriz usa apenas A–Z.
- **Celular:** alguns navegadores (principalmente no iPhone e iPad) abrem o PDF em outra aba em vez de baixar direto; o nome com data e hora é aplicado conforme o navegador respeitar o nome sugerido.
- **Velocidade:** 50 jogos levaram cerca de 4 s no teste. Em celulares simples pode demorar mais; há barra de progresso e botão Cancelar.
- **Limites:** matrizes de 10, 15 e 20; de 3 a 40 palavras por jogo; palavras de 2 letras até o tamanho da matriz; revistas de 1 a 50 jogos.
- **Configurações salvas** ficam só no navegador daquele aparelho; limpar os dados do navegador apaga. Para levar para outro aparelho, exporte em JSON.
- **Impressão do jogo individual** usa a janela de impressão do navegador (escala e cabeçalhos dependem dele). Para revistas e atividades, o PDF é o caminho recomendado.
- **SEO:** página única; abas por `#` não viram URLs separadas. Páginas próprias (por exemplo `/revista/`) poderiam trazer mais descoberta, mas não foram criadas para manter o projeto simples.
- **Sem garantia** de indexação ou de posição nos buscadores.

## Licenças

O PDF é criado com a biblioteca [jsPDF](https://github.com/parallax/jsPDF) 4.2.1, licença MIT (texto em `assets/vendor/jspdf.LICENSE.txt`). As fontes [Inter](https://rsms.me/inter/) e [IBM Plex Mono](https://github.com/IBM/plex) usam a licença SIL Open Font License 1.1 e são servidas pelo Google Fonts. As logomarcas oficiais pertencem à sua marca pessoal. Este projeto não declara licença própria; se quiser definir uma (por exemplo MIT), acrescente um arquivo `LICENSE` ao repositório.
