# =============================================================================
#  CUIDAR+  -  Instala, configura e abre o projeto (Windows / PowerShell)
#
#  Como usar: coloque este arquivo na pasta do projeto, cuidar-mais (a que tem
#  "backend" e "app") e, no PowerShell, rode:
#      powershell -ExecutionPolicy Bypass -File .\iniciar-cuidar.ps1
#
#  O script NUNCA envia a senha para lugar nenhum: ela só é gravada no arquivo
#  backend\.env do seu computador (que não vai para o Git).
# =============================================================================

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$app = Join-Path $root 'app'
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Passo($texto) { Write-Host ''; Write-Host "==> $texto" -ForegroundColor Cyan }
function Ok($texto) { Write-Host "    OK: $texto" -ForegroundColor Green }
function Aviso($texto) { Write-Host "    ATENÇÃO: $texto" -ForegroundColor Yellow }
function Parar($texto) {
  Write-Host ''
  Write-Host "ERRO: $texto" -ForegroundColor Red
  Write-Host 'Copie as mensagens acima e mande no chat.' -ForegroundColor Red
  Read-Host 'Pressione Enter para fechar'
  exit 1
}
function Rodar($descricao, [scriptblock]$comando) {
  & $comando
  if ($LASTEXITCODE -ne 0) { Parar "falhou: $descricao" }
}
function LerSegredo($pergunta) {
  $seguro = Read-Host $pergunta -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
function DefinirVariavel([string[]]$linhas, $nome, $valor) {
  $achou = $false
  $saida = foreach ($linha in $linhas) {
    if ($linha -match "^$nome=") { $achou = $true; "$nome=$valor" } else { $linha }
  }
  if (-not $achou) { $saida += "$nome=$valor" }
  return ,$saida
}

# -----------------------------------------------------------------------------
Passo 'Conferindo a pasta e o Node.js'
if (-not (Test-Path $backend) -or -not (Test-Path $app)) {
  Parar "não achei as pastas 'backend' e 'app' ao lado deste script ($root)."
}
try { $versao = (node -v) } catch { Parar 'Node.js não encontrado. Instale a versão LTS em https://nodejs.org e abra o PowerShell de novo.' }
$maior = [int]($versao.TrimStart('v').Split('.')[0])
if ($maior -lt 22) { Parar "seu Node.js é $versao. Instale a versão 22 ou mais nova (LTS) em https://nodejs.org." }
Ok "Node.js $versao"

# Restos de comandos rodados fora do lugar (não fazem parte do projeto).
$pkgRaiz = Join-Path $root 'package.json'
if ((Test-Path $pkgRaiz) -and ((Get-Item $pkgRaiz).Length -lt 200)) {
  foreach ($item in 'package.json', 'package-lock.json', '.env') {
    $caminho = Join-Path $root $item
    if (Test-Path $caminho) { Remove-Item -LiteralPath $caminho -Force }
  }
  $nm = Join-Path $root 'node_modules'
  if (Test-Path $nm) { Remove-Item -LiteralPath $nm -Recurse -Force }
  Ok 'limpei arquivos que sobraram na pasta principal'
}

# -----------------------------------------------------------------------------
Passo 'Instalando o servidor (backend)'
Set-Location -LiteralPath $backend
Rodar 'npm install no backend' { npm install --no-fund --no-audit }
Ok 'dependências do servidor instaladas'

Passo 'Configurando a conexão com o banco (Supabase)'
$envBackend = Join-Path $backend '.env'
$linhas = if (Test-Path $envBackend) { Get-Content -LiteralPath $envBackend } else { Get-Content -LiteralPath (Join-Path $backend '.env.example') }
$atual = ($linhas | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
$configurado = $atual -and ($atual -notmatch 'xxxxxxxx') -and ($atual -notmatch 'YOUR-PASSWORD') -and ($atual -match '^DATABASE_URL=postgres')

$trocar = $true
if ($configurado) {
  $resposta = Read-Host '    Já existe uma conexão salva. Manter? (S/n)'
  $trocar = $resposta -match '^[nN]'
}

if ($trocar) {
  Write-Host ''
  Write-Host '    No site do Supabase, abra o projeto "cuidar-mais", clique em "Connect"'
  Write-Host '    (no topo), escolha "Session pooler" e copie a URI (porta 5432).'
  Write-Host '    Se não souber a senha do banco: Project Settings > Database >'
  Write-Host '    "Reset database password" e crie uma nova.'
  Write-Host ''
  do {
    $uri = (Read-Host '    Cole aqui a URI do Session pooler').Trim()
    $valida = $uri -match '^postgres(ql)?://[^\s]+@[^\s]+:\d+/[^\s]+$'
    if (-not $valida) { Aviso 'isso não parece a URI. Ela começa com postgresql:// e tem :5432/postgres no final.' }
  } until ($valida)
  if ($uri -match ':6543/') { Aviso 'essa é a porta 6543 (Transaction pooler). Use a do "Session pooler" (5432) se der erro.' }

  if ($uri -match '\[YOUR-PASSWORD\]') {
    $senha = LerSegredo '    Digite a senha do banco (não aparece na tela)'
    if (-not $senha) { Parar 'senha vazia.' }
    $uri = $uri.Replace('[YOUR-PASSWORD]', [Uri]::EscapeDataString($senha))
    $senha = $null
  }
  $linhas = DefinirVariavel $linhas 'DATABASE_URL' $uri
  $uri = $null

  $chave = LerSegredo '    (Opcional) Chave secreta sb_secret_ do Supabase para envio de documentos. Enter para pular'
  if ($chave) {
    if ($chave -notmatch '^sb_secret_') { Aviso 'a chave normalmente começa com sb_secret_. Salvei mesmo assim.' }
    $linhas = DefinirVariavel $linhas 'SUPABASE_SECRET_KEY' $chave
  }
  $chave = $null
}
$linhas = DefinirVariavel $linhas 'MAIL_TRANSPORT' 'console'
[IO.File]::WriteAllLines($envBackend, $linhas, $utf8)
Ok 'backend\.env salvo (só no seu computador)'

Passo 'Atualizando o banco de dados'
npm run migrate
if ($LASTEXITCODE -ne 0) {
  Write-Host ''
  Write-Host '    Dicas: "password authentication failed" = senha errada.' -ForegroundColor Yellow
  Write-Host '           "ENOTFOUND" ou "timeout" = use a URI do Session pooler.' -ForegroundColor Yellow
  Write-Host '    Rode este script de novo e responda "n" para trocar a conexão.' -ForegroundColor Yellow
  Parar 'não consegui atualizar o banco.'
}
Ok 'banco atualizado'

# -----------------------------------------------------------------------------
Passo 'Instalando o aplicativo (pode levar alguns minutos)'
Set-Location -LiteralPath $app
Rodar 'npm install no app' { npm install --no-fund --no-audit }
Rodar 'bibliotecas do Expo (1/3)' { npx expo install expo-secure-store expo-document-picker expo-blur expo-linear-gradient }
Rodar 'bibliotecas do Expo (2/3)' { npx expo install @react-native-async-storage/async-storage @expo/vector-icons expo-speech }
Rodar 'bibliotecas do Expo (3/3)' { npx expo install @react-native-google-signin/google-signin }
Rodar 'zod' { npm install --save-exact --no-fund --no-audit zod@3.25.76 }
Ok 'dependências do app instaladas'

Passo 'Descobrindo o IP do computador na rede'
$ips = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and
                 $_.InterfaceAlias -notmatch 'vEthernet|VirtualBox|VMware|Loopback|WSL|Bluetooth' } |
  Select-Object -ExpandProperty IPAddress)
$ip = $ips | Where-Object { $_ -like '192.168.*' } | Select-Object -First 1
if (-not $ip) { $ip = $ips | Select-Object -First 1 }
if ($ip) {
  $outro = Read-Host "    Seu IP parece ser $ip. Enter para usar, ou digite outro"
  if ($outro) { $ip = $outro.Trim() }
} else {
  $ip = (Read-Host '    Não achei o IP. Digite o "Endereço IPv4" que aparece no comando ipconfig').Trim()
}

$envApp = Join-Path $app '.env'
$linhasApp = if (Test-Path $envApp) { Get-Content -LiteralPath $envApp } else { Get-Content -LiteralPath (Join-Path $app '.env.example') }
$linhasApp = DefinirVariavel $linhasApp 'EXPO_PUBLIC_APP_ENV' 'development'
$linhasApp = DefinirVariavel $linhasApp 'EXPO_PUBLIC_API_URL' "http://${ip}:3333"
[IO.File]::WriteAllLines($envApp, $linhasApp, $utf8)
Ok "app vai procurar o servidor em http://${ip}:3333"

# -----------------------------------------------------------------------------
Passo 'Abrindo o servidor numa janela nova'
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location -LiteralPath '$backend'; `$host.UI.RawUI.WindowTitle = 'CUIDAR+ servidor (deixe aberto)'; npm run dev"

$pronto = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try {
    $r = Invoke-RestMethod -Uri 'http://localhost:3333/v1/health' -TimeoutSec 2
    if ($r.status -eq 'ok') { $pronto = $true; break }
  } catch { }
}
if ($pronto) { Ok 'servidor rodando (http://localhost:3333)' }
else { Aviso 'o servidor não respondeu ainda. Veja a outra janela; se tiver erro, mande no chat.' }

Write-Host ''
Write-Host '    Se o Windows perguntar sobre o firewall do Node.js, marque "Redes privadas" e permita.' -ForegroundColor Yellow
Write-Host '    O celular precisa estar no MESMO Wi-Fi do computador.' -ForegroundColor Yellow

Passo 'Abrindo o app: leia o QR code com o Expo Go (Android) ou com a câmera (iPhone)'
npx expo start -c
