# Análise de extração — Epic Voyage (com.epi.voyage) v1.0.2

Documentação técnica gerada a partir da engenharia reversa do arquivo `Epic+Voyage_1.0.2_APKPure.xapk`, para fins de investigação/documentação de um jogo clone não autorizado de One Piece (Bandai Namco) publicado por operação chinesa de "reskin" de jogos.

## 1. Identificação do app

| Campo | Valor |
|---|---|
| Nome exibido | Epic Voyage |
| Package | `com.epi.voyage` |
| Versão | 1.0.2 (versionCode 2) |
| minSdk / targetSdk | 23 / 35 |
| Tamanho total | ~72,6 MB (XAPK com splits) |
| Motor de jogo | **Egret Engine** (motor HTML5/JS chinês, via wrapper nativo Android — não é Unity) |

Fonte: `extracted_raw/manifest.json`, `decoded/base/AndroidManifest.xml`.

## 2. Infraestrutura real por trás do app

O app **não** aponta para nenhum domínio "Epic Voyage" ou relacionado a One Piece. O endpoint de configuração inicial (`assets/config.properties`, campo `EntryPoint1`, codificado em Base64) resolve para:

```
http://dragon.sjmobilegame.com:82/fengban/native_setting_vc/Android
```

Isso indica que o app se conecta a uma infraestrutura de backend genérica (`sjmobilegame.com`), reutilizada entre múltiplos jogos/reskins — consistente com a prática descrita de recompilar o mesmo jogo sob nomes diferentes.

Além disso, `assets/epi/epi_sdk.ini` contém comentários em chinês e um `game_id=1000788`, confirmando que o app roda sobre um SDK de publicação de terceiros ("MG运营" = "operação MG" nos comentários) que atribui um ID numérico por "reskin" — o mecanismo técnico que permite trocar nome/visual do jogo mantendo o mesmo backend/monetização.

## 3. Permissões declaradas

Inclui, além do básico de rede: `READ_PHONE_STATE`, `com.android.vending.BILLING`, `AD_ID` (Google/Meta ads attribution), `ACCESS_ADSERVICES_ATTRIBUTION`, `com.android.vending.CHECK_LICENSE`, integração com Huawei/Samsung app stores. Ou seja, monetização via IAP (billing) + ads attribution tracking (AppsFlyer, presente em `assets/com/appsflyer`).

## 4. Proteções anti-extração encontradas

O app foi deliberadamente blindado contra este tipo de extração:

- **`lib/armeabi-v7a/libgavesec.so`** — implementa **AES** e **SHA1** customizados em C++ (símbolos `AES::Cipher`, `SHA1::...`, `Java_com_utils_EncryptUtil_nativeAES`, `Java_com_utils_EncryptUtil_nativeEncrypt`). Usado para criptografar/descriptografar dados sensíveis (provavelmente comunicação com o backend e/ou parte dos assets).
- **`lib/armeabi-v7a/libqkcheck.so`** — expõe `get_md5` e `check_sha1`: checagem de integridade (anti-tamper), provavelmente valida se o APK/assets não foram modificados.
- **Todos os assets do jogo em si** (`assets/game/*`, `assets/game/resource/assets/*`) estão **criptografados e com nomes de arquivo ofuscados** (ex: `bottle_earth.png`, `hardpan_leisure_ear.png` — mas os bytes não correspondem a PNG real, são blobs de dados sem cabeçalho reconhecível). Isso contrasta com os ícones/recursos padrão do Android em `res/drawable`, que são PNGs normais e legíveis.
- **`assets/runtime-dex.jar`** — um `.dex` separado carregado **dinamicamente em tempo de execução** (fora do APK principal analisado pela loja). É o runtime nativo do Egret Engine (pacote `org.egret.runtime.*`). Essa técnica de carregar código fora do pacote revisado é comumente usada para dificultar análise estática e permitir atualizações sem nova submissão à loja.

**Conclusão sobre os assets do jogo (arte, animações, sons):** tentei chegar até a descriptografia real com engenharia reversa binária completa (ver seção 7.1) e não consegui recuperá-los em formato legível dentro do tempo investido. Resumo da investigação:

- Localizei e desmontei (via `capstone`/`pyelftools`) a função nativa `Java_org_egret_egretnativeandroid_NativeKey_getKey`, que retorna uma string de 16 bytes embutida no binário: **`"5ce4b0e76844477\x00"`** (endereço `0xa9f004` em `.data` do `libegret.so`).
- Testei essa string como chave AES (ECB/CBC, raw/MD5/SHA256), como chave XOR (byte único e repetida) e como chave XXTEA contra vários arquivos criptografados de `assets/game/` — **nenhuma combinação produziu dados reconhecíveis** (sem PNG/JPEG/ZIP/texto válido).
- Rodei análise completa do **Ghidra 12.1.2** (auto-análise de ~15,5 min) no `libegret.so` e busquei todos os chamadores das funções `AES_decrypt`, `AES_cbc_encrypt`, `AES_encrypt`, `AES_set_decrypt_key` (OpenSSL, estaticamente linkado nesse binário) — **nenhuma delas é chamada internamente**. Ou seja, o AES do OpenSSL está ali só porque o binário empacota a lib inteira (usada para TLS/rede via libcurl), não para descriptografar os recursos do jogo.
- `libgavesec.so` também tem uma implementação própria de AES (símbolos `EncryptUtil.nativeAES`/`nativeEncrypt`), mas essa classe Java (`com.utils.EncryptUtil`) **não existe em nenhum dos dex descompilados** (nem no app principal, nem no `runtime-dex.jar`) — não achei nenhum ponto do código que efetivamente a chame.

**Atualização — investigação mais profunda (varredura bruta de instruções):** fui além da análise automática do Ghidra. Escrevi um scanner (`tools/brute_scan_xrefs.py`) que desmonta o `.text` inteiro do `libegret.so` (7,2 MB) instrução por instrução em modo Thumb, procurando o padrão `ldr rX,[pc,#imm]` + `add rX,pc` (carregamento de endereço PIC) que resolvesse para os endereços das tabelas AES já localizadas. Isso encontrou uma referência de código a uma segunda tabela inversa do AES, isolada, em `0x71679e`. Rastreei a função até seu início (`0x71653c`) e, ao procurar quem a chama (varredura de `bl`/`blx` diretos — zero resultados — e depois busca bruta pelo próprio endereço como ponteiro cru em `.data`/`.dynsym`), descobri que essa função **é o próprio símbolo exportado `AES_decrypt` do OpenSSL** (confirmado no `.dynsym`, tamanho 0x38c bytes). Ou seja: não é uma segunda implementação custom — é a implementação padrão do OpenSSL, chamada apenas indiretamente através do próprio despacho interno da OpenSSL (ponteiros de função do `EVP_CIPHER`), o que explica por que nem o Ghidra nem buscas por chamadas diretas a encontraram. Isso é usado quase certamente para **TLS/HTTPS** (via `libcurl`, também embutido nesse binário), não para descriptografar os assets locais do jogo.

**Conclusão honesta sobre a criptografia dos assets:** depois de tentar chave extraída + múltiplos algoritmos/modos, análise Ghidra completa, e varredura bruta de instruções cruzando as tabelas AES conhecidas, **não consegui identificar a rotina real de descriptografia dos assets binários** (imagens/sons). Ela não usa nenhuma das tabelas AES presentes no binário do jeito que eu consegui rastrear — o mecanismo real permanece desconhecido. Recuperar isso exigiria uma sessão de engenharia reversa manual muito mais profunda (rastrear a ponte `JNIShell_call` dinamicamente, ou instrumentar o app rodando de verdade num emulador Android e interceptar as chamadas de descriptografia em tempo real) — fora do escopo razoável de uma sessão de análise estática.

### 7.2 O que consegui recuperar em texto legível (achado extra)

Nem tudo estava criptografado. Dentro de `assets/game/resource/assets/rock_safety_tamers/` encontrei **150 arquivos `.fnt`** que são, na verdade, **JSON puro e legível** (não criptografado) — são descritores de spritesheet no formato do Egret Engine (`{"file":"nome.png","frames":{...}}`), cada um listando os nomes reais dos arquivos de imagem e as coordenadas de cada sprite dentro da folha.

Isso me permitiu catalogar, sem precisar quebrar a criptografia:
- **148 spritesheets únicos** referenciados por nome real (ex: `combat1.png` a `combat8.png`, `boss_shalu1-3.png`, `arena_cross_server1-3.png`, `guild_boss1.png`, `vip_1-7.png`, `dungeon1-2.png`, `activity1-4.png`, `haiyuzhengduozhan_1-4.png` — "海域争夺战" = "batalha por território marítimo")
- **3.004 sprites/frames individuais** catalogados com posição e tamanho em pixels

Isso confirma, mesmo sem ver a arte, o conjunto de features típico de jogo "gacha" chinês: sistema de VIP/monetização, boss de guilda, arena cross-server, ranking, calabouços (dungeon), atividades por tempo limitado, recompensas por login — o playbook padrão desse tipo de operação.

Todos esses arquivos legíveis (150 `.fnt` + `base.version` + `resource.version` + `infoinfo.bin`) foram copiados para a pasta **`extracted_readable/text/`**, junto com um `manifest.json` listando a origem de cada um. As imagens em si (`.png`/`.jpg`) continuam inacessíveis — testei e **nenhuma delas tem cabeçalho válido**, mesmo as referenciadas por esses `.fnt`.

## 5. O que foi extraído com sucesso (nesta pasta)

- `extracted_raw/` — conteúdo bruto do `.xapk` (APK base + 4 splits + ícone + manifest.json)
- `decoded/base/` — recursos do APK base decodificados via `apktool` (AndroidManifest.xml legível, `res/` com imagens/layouts/strings legíveis, assets brutos)
- `decoded/config.*/` — os 4 splits decodificados (arquitetura ARM, idiomas EN/ZH, densidade de tela)
- `decoded/jadx-output/sources/` — código Java/Kotlin descompilado do APK principal (~8.175 arquivos)
- `decoded/jadx-runtime-dex/sources/` — código Java descompilado do `runtime-dex.jar` (runtime do Egret Engine)

## 6. ATUALIZAÇÃO — algoritmo de criptografia quebrado, conteúdo real recuperado

Depois da análise inicial (que não tinha conseguido decifrar os assets), continuei a investigação e **consegui reverter o algoritmo de criptografia real e recuperar a grande maioria do conteúdo do jogo em formato legível**, incluindo código-fonte, catálogo de dados de jogo e ~2.400 imagens reais.

### 6.1 Como o algoritmo foi encontrado

A pista veio do código Java descompilado (`decoded/jadx-output/sources/com/zhuhuan/game/utils/XXTeaUtil.java` e `EncodeJsonReader.java`), que continha a implementação **completa e legível** de uma variante customizada do algoritmo **XXTEA**:

- Todo arquivo protegido tem uma marca mágica ASCII **`"onepieceencrypts"`** nos bytes `[16:32]` (mais uma prova cômica de que é clone de One Piece — até a própria marca de criptografia deles entrega isso).
- A chave real (16 bytes, nos bytes `[32:48]` do arquivo) é obtida fazendo XOR de `[32:48]` com a string ASCII fixa **`"onepiecedecryptk"`**.
- O restante do arquivo (`[48:]`) é descriptografado com uma rodada de um TEA/XXTEA customizado (implementação exata reproduzida em `tools/decrypt_onepiece_xxtea.py`).
- O resultado costuma ser um PNG/JPG direto, ou um arquivo ZIP (que por sua vez contém o pacote real).

Reimplementei esse algoritmo em Python (`tools/decrypt_onepiece_xxtea.py`) e validei contra os arquivos reais — bateu 100%.

### 6.2 O pacote principal do jogo

O arquivo `assets/game/tamis_hocuses_pieridine.bin` (referenciado internamente por `assets/game/infoinfo.bin`) descriptografa para um **ZIP de ~7 MB** contendo:

- **Código-fonte JavaScript completo do jogo** (`js/`, 15 arquivos, ~6 MB total): `game.min.js`, `battlelogic.min.js`, `main.min.js` (4,6 MB — a lógica principal do cliente), `assetsmanager.min.js`, engine Egret completo (`egret.min.js`, `egret.web.min.js`, `eui.min.js`), `dragonBones.min.js` (animação esqueletal), `socket.io.min.js`, etc.
- **423 arquivos JSON de configuração/design do jogo** (`resource/json/`): definem literalmente todos os sistemas do jogo — heróis, equipamentos, gacha (`summonPool.json`, `randomHeroSummon.json`), monetização (`firstRecharge.json`, `monthCard.json`, `vipMarket.json`, `dragonWishVIP.json`), PvP/arena, guildas, dungeons, eventos por tempo limitado, etc. Isso documenta o design completo de monetização "gacha" do jogo.
- **7 arquivos de idioma** (`resource/language/`): chinês, alemão, inglês, português, tailandês, chinês tradicional, vietnamita.
- **294 arquivos de animação esqueletal** (`resource/assets/`, formato DragonBones — spritesheets + esqueletos `_ske.json`), já em texto/imagem legível dentro do ZIP.

### 6.3 Os assets de imagem individuais

O arquivo `assets/game/vvcc.bin` descriptografa para um **JSON de mapeamento** com 2.557 entradas, ligando o nome real de cada asset (ex: `/image/en/bitMapFont/baqixiulian_1.png`) ao nome ofuscado no disco (ex: `/rock_safety_tamers/waiter_landlord_infinite.png`). Usando esse mapa, escrevi um descriptografador em lote (`tools/batch_decrypt.py`) que processou os 2.803 arquivos em `assets/game/resource/assets/`:

- **2.403 arquivos descriptografados com sucesso** (2.348 PNG + 53 JPG + 1 ZIP + 1 JSON)
- **2.401 renomeados com o nome real** usando o mapa
- 400 falharam — a maioria são os `.fnt` (156, que já eram texto puro, não precisavam de descriptografia) e arquivos `.version`/`infoinfo.bin` (também já em texto puro); sobram cerca de 150 arquivos (`.png`/`.jpg`/`.txt`/`.bin`/`.data`) espalhados em outras subpastas (`pebble_listener_sunday/`, `span_top/`, `rake_sialogogic/`) que parecem usar um segundo esquema (relacionado à função `decode()`/"enc/encs" no código, não totalmente investigado) — provavelmente conteúdo de uma versão/canal alternativo, não o pacote principal.

Validei uma amostra aleatória de 100 imagens descriptografadas com a biblioteca PIL — **100% abriram corretamente**.

### 6.4 Onde está o resultado

Tudo organizado em **`CONTEUDO_DECIFRADO/`**, na raiz desta pasta:

- `codigo_fonte_js/` — os 15 arquivos JavaScript do jogo
- `dados_jogo_json/` — os 423 arquivos JSON de configuração/design
- `idiomas/` — os 7 arquivos de idioma
- `animacoes_esqueleto/` — as 294 animações DragonBones
- `imagens_por_nome_real/` — as 2.401 imagens renomeadas com o caminho/nome real
- `mapa_nomes_reais.json` — o mapa completo nome-ofuscado → nome-real

O pacote ZIP bruto (antes de reorganizar) também está em `decrypted_all/main_package/`, e todas as imagens descriptografadas (mesmo as sem nome mapeado) estão em `decrypted_all/raw/`.

### 6.4.1 Rodando o jogo de verdade no navegador (pra tirar prints)

Como o motor é Egret (JS/HTML5), montei uma pasta **`local_preview/`** que roda o jogo de verdade num navegador comum, usando o código e os assets recuperados — sem precisar de Android/celular.

**Como usar:**
1. Abra um terminal na pasta `local_preview/`
2. Rode: `python ../tools/threaded_server.py 8080 .` (ou `python -m http.server 8080`)
3. Abra `http://localhost:8080/index.html` no Chrome/Edge
4. Espere uns 15-20 segundos carregando

**O que você vai ver:** a engine carrega de verdade (aparece "Egret Engine Version: 5.2.29" no console), mostra a tela de carregamento com a arte real do jogo (personagens animados, céu estrelado com lua, barra de progresso), carrega as 44 imagens dessa tela com sucesso — e então **fica presa num loop infinito**, porque o próximo passo tenta conectar no servidor de login deles (`socket.io`) e o servidor está morto. Isso é evidência visual direta e reproduzível do "abandono": o jogo mostra a tela de entrada bonitinha e trava pra sempre tentando falar com um servidor que não existe mais.

**Nota sobre autenticidade:** os arquivos `assets/image/en/loading_bg/chapterLoading_*.jpg` (13 variantes de fundo aleatório da tela de loading) não estavam no conjunto que consegui decifrar — substituí por uma cópia de outra imagem de fundo já recuperada (`bg_zhucheng5.jpg`) só pra não travar o carregamento nessa etapa. **Tudo o resto na tela (personagens, barra de progresso, céu/lua, textos) é 100% arte original recuperada do jogo**, não é placeholder.

### 6.5 O que ainda não foi recuperado

- Áudio: não encontrei arquivos de música/som decifrados nesta passada — os arquivos candidatos (`.data`/`.bin` pequenos como `music_psalmed.bin`) não bateram com o algoritmo `onepieceencrypts` testado; podem usar o segundo esquema mencionado acima, ou não estarem presentes neste pacote (pode ser que sons sejam baixados sob demanda do servidor, que está fora do ar).
- ~150 arquivos nas subpastas secundárias (`pebble_listener_sunday/`, `span_top/`, `rake_sialogogic/`) mencionadas acima.

## 7. Ferramentas usadas

- OpenJDK Temurin 17 e 21 (portáteis, instalados em `tools/`, sem alterar o sistema/registro do Windows)
- `apktool` 2.9.3
- `jadx` 1.5.1
- `Ghidra` 12.1.2 (NSA) — engenharia reversa de binário nativo
- `capstone` + `pyelftools` (Python) — desmontagem leve de trechos específicos do ELF/ARM
- `pycryptodome` + `xxtea` (Python) — testes de descriptografia

Todas as ferramentas foram baixadas dos repositórios oficiais dos projetos e ficam em `tools/` dentro desta pasta (~1,2 GB no total) — podem ser removidas se não forem mais necessárias.

### 7.1 Scripts de análise (em `tools/`)

- `scan_crypto_sigs.py` — varre binários por assinaturas de AES S-box / XXTEA
- `find_getkey.py` — desmonta a função `NativeKey.getKey()` via capstone
- `resolve_getkey_strings2.py` — resolve os endereços PC-relative da função e extrai a string da chave
- `try_decrypt.py` — testa a chave contra AES (várias derivações/modos) nos arquivos criptografados
- `ghidra_scripts/FindDecryptFunc.java` — script Ghidra que busca XREFs à chave e chamadores das funções AES do OpenSSL dentro do `libegret.so`
- `ghidra_scripts/FindSboxXrefs.java` — variante que busca XREFs de dados às tabelas AES específicas e decompila as funções encontradas
- `scan_full_sbox.py` — localiza endereços virtuais precisos das tabelas AES (forward/inverse) dentro dos binários
- `brute_scan_xrefs.py` — desmonta o `.text` inteiro em Thumb, resolvendo padrões PIC (`ldr`+`add pc`) pra achar referências de código a endereços de dados específicos, sem depender do reconhecimento de função do Ghidra
- `find_callers.py` — mesma técnica de varredura bruta, mas procurando instruções `bl`/`blx`/`b` que chamem um endereço-alvo
- `collect_readable.py` — varre toda a árvore de assets do jogo e copia pra `extracted_readable/` qualquer arquivo genuinamente válido (PNG/JPG reais ou texto/JSON legível)
- `ghidra_proj/` — projeto Ghidra já analisado (pode ser reaberto na GUI do Ghidra para continuar a investigação manualmente: abra `tools/ghidra_12.1.2_PUBLIC/ghidraRun.bat`, abra o projeto em `tools/ghidra_proj/egret_analysis.gpr`)
- **`decrypt_onepiece_xxtea.py`** — implementação em Python do algoritmo de criptografia real do jogo (XXTEA customizado, marca `"onepieceencrypts"`). Uso: `python decrypt_onepiece_xxtea.py <arquivo_entrada> <arquivo_saida>`
- **`batch_decrypt.py`** — roda o script acima em lote sobre toda `assets/game/`, detecta o tipo de cada arquivo pelos bytes mágicos, extrai a tabela de mapeamento de nomes do `vvcc.bin` e reorganiza tudo com os nomes reais

### Sobre a tentativa de análise dinâmica (Frida/emulador/celular)

Antes de achar o algoritmo por análise estática, tentei uma abordagem de análise dinâmica (rodar o jogo de verdade e capturar os dados já descriptografados da memória) — envolveu instalar um emulador Android, depois migrar para o celular físico do usuário (via ADB + ferramenta de instrumentação Frida injetada no APK), mas esbarrou num mecanismo de "kill switch": o app tenta buscar configuração num servidor remoto (`cdn-mten.stonqugkzxc.xyz`, hoje fora do ar) e se autodestrói (`System.exit(0)`) quando isso falha — **achado relevante por si só para a documentação**, pois prova que essas operações têm desligamento remoto embutido no app. Essa linha de investigação foi abandonada em favor da análise estática (que teve sucesso completo). Os scripts dessa tentativa (`launch_and_attach.py`, `hook_script.js`) ficam no `tools/` como registro, mas não foram necessários para o resultado final.
