#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Tally — Runner Interativo Multi-Simulador (iOS & Android sem IDE)
# Compatível com Bash 3.2+ (macOS padrão) e Bash 5+ (Linux).
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="/tmp/tally-sim"
BUILD_CACHE_DIR="$PROJECT_ROOT/.sim-build"

mkdir -p "$LOG_DIR"

# --- Cores e estilo ANSI ------------------------------------------------------
if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_RED=$'\033[31m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_BLUE=$'\033[34m'
  C_MAGENTA=$'\033[35m'
  C_CYAN=$'\033[36m'
  C_WHITE=$'\033[97m'
  IS_TTY_OUT=1
else
  C_RESET=""
  C_BOLD=""
  C_DIM=""
  C_RED=""
  C_GREEN=""
  C_YELLOW=""
  C_BLUE=""
  C_MAGENTA=""
  C_CYAN=""
  C_WHITE=""
  IS_TTY_OUT=0
fi

# --- Estado global (arrays indexados para compatibilidade com Bash 3.2) -------
OS_RAW="$(uname -s)"
OS_NAME="$OS_RAW"
IS_MACOS=0
IS_LINUX=0

APP_ID="io.ionic.starter"
HAS_IOS_DIR=0
HAS_ANDROID_DIR=0

HAS_XCRUN=0
HAS_XCODEBUILD=0
HAS_SIMCTL=0
IOS_GUI_APP=""
IOS_PROJECT_FLAG=""
IOS_PROJECT_PATH=""

ANDROID_SDK_DIR=""
ADB_BIN=""
EMULATOR_BIN=""
AVDMANAGER_BIN=""
KVM_STATUS="n/a" # ok | missing | no-perm | n/a

# CLI / opções
OPT_DOCTOR=0
OPT_MODE=""       # debug | livereload | boot
OPT_NO_BUILD=0
OPT_PLATFORM="all" # ios | android | all
OPT_KEEP_OPEN=0
LIVERELOAD_PORT=8100

# Dispositivos descobertos
DEV_PLATFORM=()
DEV_ID=()
DEV_LABEL=()
DEV_STATUS=()
DEV_SELECTED=()

# Alvos ativos na sessão
ACTIVE_IOS_UDIDS=()
ACTIVE_IOS_NAMES=()
ACTIVE_ANDROID_SERIALS=()
ACTIVE_ANDROID_NAMES=()

# Recursos iniciados por esta sessão (para cleanup)
SPAWNED_IOS_UDIDS=()
SPAWNED_ANDROID_SERIALS=()
SPAWNED_ANDROID_PIDS=()
PATCHED_CAP_FILES=()
SERVE_PID=""
SIM_APPEARANCE="light"

CURSOR_HIDDEN=0

# --- Utilitários básicos ------------------------------------------------------
to_lower() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]'
}

hide_cursor() {
  if [[ "$IS_TTY_OUT" -eq 1 && "$CURSOR_HIDDEN" -eq 0 ]]; then
    printf '\033[?25l' >/dev/tty 2>/dev/null || true
    CURSOR_HIDDEN=1
  fi
}

show_cursor() {
  if [[ "$CURSOR_HIDDEN" -eq 1 ]]; then
    printf '\033[?25h' >/dev/tty 2>/dev/null || true
    CURSOR_HIDDEN=0
  fi
}

log_info() {
  printf '%s[i]%s %s\n' "$C_CYAN" "$C_RESET" "$1"
}

log_ok() {
  printf '%s[✓]%s %s\n' "$C_GREEN" "$C_RESET" "$1"
}

log_warn() {
  printf '%s[!]%s %s\n' "$C_YELLOW" "$C_RESET" "$1"
}

log_err() {
  printf '%s[✗]%s %s\n' "$C_RED" "$C_RESET" "$1" >&2
}

print_banner() {
  printf '\n%s╭──────────────────────────────────────────────────────────────╮%s\n' "$C_CYAN" "$C_RESET"
  printf '%s│%s  %sTally Mobile%s %s— Multi-Simulator Runner (iOS & Android)%s      %s│%s\n' \
    "$C_CYAN" "$C_RESET" "$C_BOLD$C_WHITE" "$C_RESET" "$C_DIM" "$C_RESET" "$C_CYAN" "$C_RESET"
  printf '%s╰──────────────────────────────────────────────────────────────╯%s\n' "$C_CYAN" "$C_RESET"
}

print_section() {
  printf '\n%s▸ %s%s\n' "$C_BOLD$C_BLUE" "$1" "$C_RESET"
}

# Executa comando mostrando spinner em TTY e salvando saída em arquivo de log
run_with_spinner() {
  local label="$1"
  local logfile="$2"
  shift 2

  : >"$logfile"
  if [[ "$IS_TTY_OUT" -eq 0 ]]; then
    log_info "$label"
    if ! "$@" >"$logfile" 2>&1; then
      log_err "Falha: $label (log: $logfile)"
      tail -n 30 "$logfile" >&2 || true
      return 1
    fi
    log_ok "$label"
    return 0
  fi

  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0
  local pid rc=0

  "$@" >"$logfile" 2>&1 &
  pid=$!

  hide_cursor
  while kill -0 "$pid" 2>/dev/null; do
    printf '\r%s%s%s %s' "$C_CYAN" "${frames[$i]}" "$C_RESET" "$label"
    i=$(( (i + 1) % ${#frames[@]} ))
    sleep 0.1
  done

  wait "$pid" || rc=$?
  printf '\r\033[K'
  show_cursor

  if [[ "$rc" -ne 0 ]]; then
    log_err "Falha: $label (log: $logfile)"
    printf '%s--- últimas linhas do log ---%s\n' "$C_DIM" "$C_RESET" >&2
    tail -n 30 "$logfile" >&2 || true
    return "$rc"
  fi

  log_ok "$label"
  return 0
}

# --- Limpeza & Traps ----------------------------------------------------------
restore_patched_cap_configs() {
  if [[ ${#PATCHED_CAP_FILES[@]} -eq 0 ]]; then
    return 0
  fi

  local f bak
  for f in "${PATCHED_CAP_FILES[@]}"; do
    bak="${f}.sim.bak"
    if [[ -f "$bak" ]]; then
      mv "$bak" "$f" 2>/dev/null || true
    fi
  done
  PATCHED_CAP_FILES=()
}

stop_livereload_server() {
  if [[ -n "$SERVE_PID" ]] && kill -0 "$SERVE_PID" 2>/dev/null; then
    kill -TERM "$SERVE_PID" 2>/dev/null || true
    pkill -P "$SERVE_PID" 2>/dev/null || true
    wait "$SERVE_PID" 2>/dev/null || true
    SERVE_PID=""
  fi
}

clear_adb_reverses() {
  if [[ -z "$ADB_BIN" ]] || [[ ${#ACTIVE_ANDROID_SERIALS[@]} -eq 0 ]]; then
    return 0
  fi

  local serial
  for serial in "${ACTIVE_ANDROID_SERIALS[@]}"; do
    "$ADB_BIN" -s "$serial" reverse --remove "tcp:${LIVERELOAD_PORT}" >/dev/null 2>&1 || true
  done
}

cleanup() {
  local exit_rc=$?
  show_cursor
  stop_livereload_server
  restore_patched_cap_configs
  clear_adb_reverses
  return "$exit_rc"
}

on_signal_int() {
  printf '\n' >&2
  log_warn "Interrompido pelo usuário."
  exit 130
}

on_signal_term() {
  exit 143
}

trap cleanup EXIT
trap on_signal_int INT
trap on_signal_term TERM

# --- Ajuda e CLI --------------------------------------------------------------
show_help() {
  print_banner
  cat <<EOF

${C_BOLD}Uso:${C_RESET}
  ./scripts/sim.sh [OPÇÕES]
  npm run sim -- [OPÇÕES]

${C_BOLD}Opções:${C_RESET}
  -h, --help                     Mostra esta ajuda e sai
  --doctor                       Exibe diagnóstico do ambiente (OS, SDKs, simuladores) e sai
  --mode <debug|livereload|boot> Define o modo diretamente (pula o menu de modo)
  --no-build                     Pula 'ng build' e reutiliza www/ existente
  --platform <ios|android|all>   Filtra plataformas listadas (padrão: all)
  --port <porta>                 Porta do Live Reload (padrão: 8100)
  --keep-open                    Não pergunta se deve fechar emuladores ao sair

${C_BOLD}Atalhos no seletor de dispositivos:${C_RESET}
  ↑ / ↓ (ou j / k)               Mover cursor
  Espaço                         Marcar / desmarcar dispositivo
  a                              Marcar / desmarcar todos
  Enter                          Confirmar seleção
  q                              Sair

${C_BOLD}Atalhos durante a execução:${C_RESET}
  [r] Rebuild & Reinstall        [t] Alternar Light/Dark nos simuladores
  [l] Ver caminhos/tail dos logs [q] Sair

${C_BOLD}Exemplos:${C_RESET}
  ./scripts/sim.sh
  ./scripts/sim.sh --doctor
  ./scripts/sim.sh --mode livereload --platform ios
  ./scripts/sim.sh --mode debug --platform android --keep-open
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -h|--help)
        show_help
        exit 0
        ;;
      --doctor)
        OPT_DOCTOR=1
        shift
        ;;
      --mode)
        if [[ $# -lt 2 ]]; then
          log_err "Faltou argumento para --mode (debug | livereload | boot)."
          exit 1
        fi
        case "$2" in
          debug|livereload|boot)
            OPT_MODE="$2"
            ;;
          *)
            log_err "Modo inválido: '$2'. Use: debug, livereload ou boot."
            exit 1
            ;;
        esac
        shift 2
        ;;
      --no-build)
        OPT_NO_BUILD=1
        shift
        ;;
      --platform)
        if [[ $# -lt 2 ]]; then
          log_err "Faltou argumento para --platform (ios | android | all)."
          exit 1
        fi
        case "$2" in
          ios|android|all)
            OPT_PLATFORM="$2"
            ;;
          *)
            log_err "Plataforma inválida: '$2'. Use: ios, android ou all."
            exit 1
            ;;
        esac
        shift 2
        ;;
      --port)
        if [[ $# -lt 2 ]] || ! [[ "$2" =~ ^[0-9]+$ ]]; then
          log_err "Porta inválida para --port."
          exit 1
        fi
        LIVERELOAD_PORT="$2"
        shift 2
        ;;
      --keep-open)
        OPT_KEEP_OPEN=1
        shift
        ;;
      *)
        log_err "Opção desconhecida: '$1'. Use --help para ver as opções."
        exit 1
        ;;
    esac
  done
}

# --- Detecção de Ambiente -----------------------------------------------------
read_app_id() {
  local cfg="$PROJECT_ROOT/capacitor.config.ts"
  if [[ ! -f "$cfg" ]] || ! command -v node >/dev/null 2>&1; then
    return 0
  fi

  local parsed
  parsed="$(node -e "
    const fs = require('fs');
    const txt = fs.readFileSync(process.argv[1], 'utf8');
    const m = txt.match(/appId\s*:\s*['\"]([^'\"]+)['\"]/);
    if (m) console.log(m[1]);
  " "$cfg" 2>/dev/null || true)"

  if [[ -n "$parsed" ]]; then
    APP_ID="$parsed"
  fi
}

find_android_sdk() {
  local candidates=()
  if [[ -n "${ANDROID_HOME:-}" ]]; then
    candidates+=("$ANDROID_HOME")
  fi
  if [[ -n "${ANDROID_SDK_ROOT:-}" ]]; then
    candidates+=("$ANDROID_SDK_ROOT")
  fi
  if [[ "$IS_MACOS" -eq 1 ]]; then
    candidates+=("$HOME/Library/Android/sdk")
  else
    candidates+=("$HOME/Android/Sdk" "$HOME/Android/sdk" "/opt/android-sdk")
  fi

  local dir
  for dir in "${candidates[@]}"; do
    if [[ -d "$dir" ]]; then
      ANDROID_SDK_DIR="$dir"
      break
    fi
  done

  if [[ -n "$ANDROID_SDK_DIR" ]]; then
    [[ -x "$ANDROID_SDK_DIR/platform-tools/adb" ]] && ADB_BIN="$ANDROID_SDK_DIR/platform-tools/adb"
    [[ -x "$ANDROID_SDK_DIR/emulator/emulator" ]] && EMULATOR_BIN="$ANDROID_SDK_DIR/emulator/emulator"
    if [[ -x "$ANDROID_SDK_DIR/cmdline-tools/latest/bin/avdmanager" ]]; then
      AVDMANAGER_BIN="$ANDROID_SDK_DIR/cmdline-tools/latest/bin/avdmanager"
    elif [[ -x "$ANDROID_SDK_DIR/tools/bin/avdmanager" ]]; then
      AVDMANAGER_BIN="$ANDROID_SDK_DIR/tools/bin/avdmanager"
    fi
  fi

  if [[ -z "$ADB_BIN" ]] && command -v adb >/dev/null 2>&1; then
    ADB_BIN="$(command -v adb)"
  fi
  if [[ -z "$EMULATOR_BIN" ]] && command -v emulator >/dev/null 2>&1; then
    EMULATOR_BIN="$(command -v emulator)"
  fi
  if [[ -z "$AVDMANAGER_BIN" ]] && command -v avdmanager >/dev/null 2>&1; then
    AVDMANAGER_BIN="$(command -v avdmanager)"
  fi

  if [[ "$IS_LINUX" -eq 1 ]]; then
    if [[ -e /dev/kvm ]]; then
      if [[ -r /dev/kvm && -w /dev/kvm ]]; then
        KVM_STATUS="ok"
      else
        KVM_STATUS="no-perm"
      fi
    else
      KVM_STATUS="missing"
    fi
  fi
}

detect_environment() {
  case "$OS_RAW" in
    Darwin)
      OS_NAME="macOS"
      IS_MACOS=1
      ;;
    Linux)
      OS_NAME="Linux"
      IS_LINUX=1
      ;;
    *)
      log_err "SO não suportado: $OS_RAW (suporte: macOS e Linux)."
      exit 1
      ;;
  esac

  if ! command -v node >/dev/null 2>&1; then
    log_err "Node.js não encontrado no PATH."
    exit 1
  fi

  read_app_id

  [[ -d "$PROJECT_ROOT/ios" ]] && HAS_IOS_DIR=1
  [[ -d "$PROJECT_ROOT/android" ]] && HAS_ANDROID_DIR=1

  if [[ "$IS_MACOS" -eq 1 ]]; then
    command -v xcrun >/dev/null 2>&1 && HAS_XCRUN=1
    command -v xcodebuild >/dev/null 2>&1 && HAS_XCODEBUILD=1
    if [[ "$HAS_XCRUN" -eq 1 ]] && xcrun simctl list devices >/dev/null 2>&1; then
      HAS_SIMCTL=1
    fi

    if [[ -d "$PROJECT_ROOT/ios/App/App.xcworkspace" ]]; then
      IOS_PROJECT_FLAG="-workspace"
      IOS_PROJECT_PATH="$PROJECT_ROOT/ios/App/App.xcworkspace"
    elif [[ -d "$PROJECT_ROOT/ios/App/App.xcodeproj" ]]; then
      IOS_PROJECT_FLAG="-project"
      IOS_PROJECT_PATH="$PROJECT_ROOT/ios/App/App.xcodeproj"
    fi

    local dev_dir xcode_contents gui_cand
    dev_dir="$(xcode-select -p 2>/dev/null || true)"
    xcode_contents=""
    [[ -n "$dev_dir" ]] && xcode_contents="$(dirname "$dev_dir")"

    for gui_cand in \
      "${xcode_contents}/Applications/DeviceHub.app" \
      "${dev_dir}/Applications/Simulator.app" \
      "/Applications/Xcode.app/Contents/Applications/DeviceHub.app" \
      "/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app"
    do
      if [[ -n "$gui_cand" && -d "$gui_cand" ]]; then
        IOS_GUI_APP="$gui_cand"
        break
      fi
    done
  fi

  find_android_sdk
}

# --- Descoberta de Simuladores / Emuladores -----------------------------------
add_device_entry() {
  local platform="$1"
  local id="$2"
  local label="$3"
  local status="$4"

  DEV_PLATFORM+=("$platform")
  DEV_ID+=("$id")
  DEV_LABEL+=("$label")
  DEV_STATUS+=("$status")
  DEV_SELECTED+=(0)
}

discover_ios_devices() {
  if [[ "$IS_MACOS" -ne 1 || "$HAS_SIMCTL" -ne 1 ]]; then
    return 0
  fi

  local line udid label status
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    udid="$(printf '%s' "$line" | cut -f1)"
    label="$(printf '%s' "$line" | cut -f2)"
    status="$(printf '%s' "$line" | cut -f3)"
    add_device_entry "ios" "$udid" "$label" "$status"
  done < <(
    xcrun simctl list devices available -j 2>/dev/null | node -e "
      let raw = '';
      process.stdin.on('data', d => raw += d);
      process.stdin.on('end', () => {
        try {
          const data = JSON.parse(raw);
          const out = [];
          for (const [runtime, devs] of Object.entries(data.devices || {})) {
            if (!runtime.includes('SimRuntime.iOS-')) continue;
            const ver = runtime.replace(/^.*SimRuntime\.iOS-/, '').replace(/-/g, '.');
            for (const dev of devs) {
              if (!dev.isAvailable) continue;
              out.push({
                udid: dev.udid,
                name: dev.name,
                ver,
                state: dev.state === 'Booted' ? 'Booted' : 'Shutdown',
              });
            }
          }
          out.sort((a, b) => {
            if (a.state !== b.state) return a.state === 'Booted' ? -1 : 1;
            const vc = b.ver.localeCompare(a.ver, undefined, { numeric: true });
            return vc !== 0 ? vc : a.name.localeCompare(b.name);
          });
          for (const d of out) {
            console.log([d.udid, d.name + ' (iOS ' + d.ver + ')', d.state].join('\t'));
          }
        } catch (e) {}
      });
    "
  )
}

# Mapeia seriais "emulator-XXXX" atualmente rodando para nomes de AVD
get_running_android_avd_pairs() {
  if [[ -z "$ADB_BIN" ]]; then
    return 0
  fi

  local serial avd_name
  while IFS= read -r serial; do
    [[ -z "$serial" ]] && continue
    avd_name="$("$ADB_BIN" -s "$serial" emu avd name 2>/dev/null | tr -d '\r' | awk 'NF && $0 != "OK" { print; exit }' || true)"
    if [[ -n "$avd_name" ]]; then
      printf '%s\t%s\n' "$avd_name" "$serial"
    fi
  done < <("$ADB_BIN" devices 2>/dev/null | awk '/^emulator-[0-9]+[[:space:]]+device$/ { print $1 }' || true)
}

find_running_serial_for_avd() {
  local target_avd="$1"
  local pair avd serial
  while IFS= read -r pair; do
    [[ -z "$pair" ]] && continue
    avd="$(printf '%s' "$pair" | cut -f1)"
    serial="$(printf '%s' "$pair" | cut -f2)"
    if [[ "$avd" == "$target_avd" ]]; then
      printf '%s\n' "$serial"
      return 0
    fi
  done < <(get_running_android_avd_pairs)
  return 1
}

discover_android_devices() {
  if [[ -z "$EMULATOR_BIN" ]]; then
    return 0
  fi

  local running_pairs
  running_pairs="$(get_running_android_avd_pairs || true)"

  local avd status
  while IFS= read -r avd; do
    avd="$(printf '%s' "$avd" | tr -d '\r')"
    [[ -z "$avd" ]] && continue
    case "$avd" in
      INFO*|WARNING*|ERROR*) continue ;;
    esac

    status="Shutdown"
    if printf '%s\n' "$running_pairs" | grep -q "^${avd}	"; then
      status="Booted"
    fi
    add_device_entry "android" "$avd" "$avd" "$status"
  done < <("$EMULATOR_BIN" -list-avds 2>/dev/null || true)
}

discover_devices() {
  DEV_PLATFORM=()
  DEV_ID=()
  DEV_LABEL=()
  DEV_STATUS=()
  DEV_SELECTED=()

  if [[ "$OPT_PLATFORM" == "all" || "$OPT_PLATFORM" == "ios" ]]; then
    discover_ios_devices
  fi
  if [[ "$OPT_PLATFORM" == "all" || "$OPT_PLATFORM" == "android" ]]; then
    discover_android_devices
  fi
}

# --- Diagnóstico (--doctor e resumo inicial) ----------------------------------
print_doctor() {
  local compact="${1:-0}"

  print_section "Diagnóstico do Ambiente ($OS_NAME)"

  printf '  %-18s %s\n' "App ID:" "${C_BOLD}${APP_ID}${C_RESET}"

  if [[ "$IS_MACOS" -eq 1 ]]; then
    if [[ "$HAS_IOS_DIR" -eq 1 ]]; then
      printf '  %-18s %s✓ presente%s\n' "Pasta ios/:" "$C_GREEN" "$C_RESET"
    else
      printf '  %-18s %s○ ausente (pode gerar via Capacitor)%s\n' "Pasta ios/:" "$C_YELLOW" "$C_RESET"
    fi

    if [[ "$HAS_XCODEBUILD" -eq 1 && "$HAS_SIMCTL" -eq 1 ]]; then
      local gui_label=""
      [[ -n "$IOS_GUI_APP" ]] && gui_label=" ($(basename "$IOS_GUI_APP"))"
      printf '  %-18s %s✓ xcrun simctl + xcodebuild prontos%s%s\n' "iOS Toolchain:" "$C_GREEN" "$gui_label" "$C_RESET"
    else
      printf '  %-18s %s✗ Xcode / simctl indisponível%s\n' "iOS Toolchain:" "$C_RED" "$C_RESET"
      if [[ "$compact" -eq 0 ]]; then
        printf '    %s→ Instale o Xcode e rode: xcode-select --install%s\n' "$C_DIM" "$C_RESET"
      fi
    fi
  else
    printf '  %-18s %s○ iOS disponível apenas no macOS%s\n' "iOS Toolchain:" "$C_DIM" "$C_RESET"
  fi

  if [[ "$HAS_ANDROID_DIR" -eq 1 ]]; then
    printf '  %-18s %s✓ presente%s\n' "Pasta android/:" "$C_GREEN" "$C_RESET"
  else
    printf '  %-18s %s○ ausente (setup guiado disponível ao selecionar Android)%s\n' "Pasta android/:" "$C_YELLOW" "$C_RESET"
  fi

  if [[ -n "$ANDROID_SDK_DIR" ]]; then
    printf '  %-18s %s✓ %s%s\n' "Android SDK:" "$C_GREEN" "$ANDROID_SDK_DIR" "$C_RESET"
  else
    printf '  %-18s %s○ SDK não encontrado%s\n' "Android SDK:" "$C_YELLOW" "$C_RESET"
  fi

  if [[ -n "$ADB_BIN" && -n "$EMULATOR_BIN" ]]; then
    printf '  %-18s %s✓ adb + emulator prontos (sem IDE)%s\n' "Android Tools:" "$C_GREEN" "$C_RESET"
  else
    printf '  %-18s %s✗ adb ou emulator ausente%s\n' "Android Tools:" "$C_YELLOW" "$C_RESET"
    if [[ "$compact" -eq 0 ]]; then
      printf '    %s→ Defina ANDROID_HOME ou instale platform-tools + emulator do Android SDK%s\n' "$C_DIM" "$C_RESET"
    fi
  fi

  if [[ "$IS_LINUX" -eq 1 ]]; then
    case "$KVM_STATUS" in
      ok)
        printf '  %-18s %s✓ /dev/kvm acessível%s\n' "Linux KVM:" "$C_GREEN" "$C_RESET"
        ;;
      no-perm)
        printf '  %-18s %s! /dev/kvm sem permissão (rode: sudo usermod -aG kvm %s)%s\n' "Linux KVM:" "$C_YELLOW" "$USER" "$C_RESET"
        ;;
      missing)
        printf '  %-18s %s! /dev/kvm ausente (habilite virtualização na BIOS ou use acelerador disponível)%s\n' "Linux KVM:" "$C_YELLOW" "$C_RESET"
        ;;
    esac
  fi

  if [[ "$compact" -eq 0 ]]; then
    local ios_count=0 android_count=0 idx
    if [[ ${#DEV_PLATFORM[@]} -gt 0 ]]; then
      for idx in $(seq 0 $(( ${#DEV_PLATFORM[@]} - 1 ))); do
        if [[ "${DEV_PLATFORM[$idx]}" == "ios" ]]; then
          ios_count=$((ios_count + 1))
        else
          android_count=$((android_count + 1))
        fi
      done
    fi

    print_section "Dispositivos Disponíveis (iOS: $ios_count | Android: $android_count)"
    if [[ ${#DEV_PLATFORM[@]} -eq 0 ]]; then
      log_warn "Nenhum simulador/AVD encontrado."
    else
      local icon plat lbl st
      for idx in $(seq 0 $(( ${#DEV_PLATFORM[@]} - 1 ))); do
        plat="${DEV_PLATFORM[$idx]}"
        lbl="${DEV_LABEL[$idx]}"
        st="${DEV_STATUS[$idx]}"
        if [[ "$st" == "Booted" ]]; then
          icon="${C_GREEN}● Rodando${C_RESET}"
        else
          icon="${C_DIM}○ Desligado${C_RESET}"
        fi
        printf '  [%-7s] %-42s %s\n' "$plat" "$lbl" "$icon"
      done
    fi
  fi
}

# --- Leitura de Teclas (Bash 3.2+ compatível) ---------------------------------
read_key() {
  local key rest=""
  IFS= read -rsn1 key </dev/tty || return 1

  if [[ "$key" == $'\x1b' ]]; then
    IFS= read -rsn2 -t 1 rest </dev/tty || true
    case "$rest" in
      '[A'|'OA') printf 'UP' ;;
      '[B'|'OB') printf 'DOWN' ;;
      *)         printf 'ESC' ;;
    esac
    return 0
  fi

  case "$key" in
    "")     printf 'ENTER' ;;
    " ")    printf 'SPACE' ;;
    k|K)    printf 'UP' ;;
    j|J)    printf 'DOWN' ;;
    a|A)    printf 'ALL' ;;
    q|Q)    printf 'QUIT' ;;
    *)      printf 'CHAR:%s' "$key" ;;
  esac
}

# --- TUI: Seleção de Modo -----------------------------------------------------
select_mode_tui() {
  local modes=("debug" "livereload" "boot")
  local titles=(
    "Build Nativo (Debug)"
    "Live Reload (Hot Reload)"
    "Apenas abrir simuladores"
  )
  local descs=(
    "ng build (dev) + cap sync + compila 1x por plataforma e abre nos devices"
    "1 servidor ng serve (:${LIVERELOAD_PORT}) + adb reverse + hot reload em todos"
    "Inicia os simuladores selecionados sem compilar ou sincronizar"
  )

  local cursor=0
  local count=${#modes[@]}
  local lines_drawn=0
  local i key

  hide_cursor
  while true; do
    if [[ "$lines_drawn" -gt 0 ]]; then
      printf '\033[%dA' "$lines_drawn"
    fi

    print_section "Escolha o Modo de Execução"
    printf '  %s↑/↓ mover • Enter confirmar • q sair%s\n\n' "$C_DIM" "$C_RESET"

    for i in $(seq 0 $((count - 1))); do
      printf '\033[K'
      if [[ "$i" -eq "$cursor" ]]; then
        printf '  %s❯%s %s%s%s\n' "$C_CYAN$C_BOLD" "$C_RESET" "$C_BOLD$C_WHITE" "${titles[$i]}" "$C_RESET"
        printf '\033[K    %s%s%s\n' "$C_CYAN" "${descs[$i]}" "$C_RESET"
      else
        printf '    %s\n' "${titles[$i]}"
        printf '\033[K    %s%s%s\n' "$C_DIM" "${descs[$i]}" "$C_RESET"
      fi
    done

    lines_drawn=$(( 4 + count * 2 ))

    key="$(read_key || printf 'QUIT')"
    case "$key" in
      UP)
        cursor=$(( (cursor - 1 + count) % count ))
        ;;
      DOWN)
        cursor=$(( (cursor + 1) % count ))
        ;;
      ENTER)
        OPT_MODE="${modes[$cursor]}"
        show_cursor
        printf '\n'
        return 0
        ;;
      QUIT)
        show_cursor
        printf '\n'
        exit 0
        ;;
    esac
  done
}

# --- TUI: Seletor Multi-Dispositivo -------------------------------------------
select_devices_tui() {
  local total=${#DEV_PLATFORM[@]}
  if [[ "$total" -eq 0 ]]; then
    print_section "Nenhum Dispositivo Disponível"
    if [[ "$IS_MACOS" -eq 1 && "$HAS_SIMCTL" -eq 0 ]]; then
      log_warn "Xcode / simctl não encontrado. Instale via App Store e rode: sudo xcode-select -s /Applications/Xcode.app"
    fi
    if [[ -z "$EMULATOR_BIN" ]]; then
      log_warn "Emulador Android não encontrado. Verifique ANDROID_HOME ou instale Android SDK Emulator + Platform-Tools."
    else
      log_warn "Nenhum AVD Android criado. Crie um com:"
      printf '  %s%s create avd -n Pixel_API_35 -k "system-images;android-35;google_apis;arm64-v8a"%s\n' \
        "$C_DIM" "${AVDMANAGER_BIN:-avdmanager}" "$C_RESET"
      printf '  %s(ou via Android Studio → Device Manager, depois rode este script sem abrir a IDE)%s\n' "$C_DIM" "$C_RESET"
    fi
    exit 1
  fi

  local cursor=0
  local err_msg=""
  local last_drawn=0
  local i key selected_count

  # Pré-seleciona dispositivos que já estejam rodando
  for i in $(seq 0 $((total - 1))); do
    if [[ "${DEV_STATUS[$i]}" == "Booted" ]]; then
      DEV_SELECTED[$i]=1
    fi
  done

  hide_cursor
  while true; do
    if [[ "$last_drawn" -gt 0 ]]; then
      printf '\033[%dA' "$last_drawn"
    fi

    local lines=0
    local printed_ios_hdr=0
    local printed_android_hdr=0

    printf '\033[K\n'
    printf '\033[K%s▸ Selecione um ou mais Simuladores / Emuladores%s\n' "$C_BOLD$C_BLUE" "$C_RESET"
    printf '\033[K  %s[↑/↓] Mover  [Espaço] Marcar  [a] Todos  [Enter] Confirmar  [q] Sair%s\n' "$C_DIM" "$C_RESET"
    lines=$((lines + 3))

    if [[ "$IS_LINUX" -eq 1 ]]; then
      printf '\033[K  %s(iOS disponível apenas no macOS — exibindo dispositivos Android)%s\n' "$C_DIM" "$C_RESET"
      lines=$((lines + 1))
    fi

    selected_count=0
    for i in $(seq 0 $((total - 1))); do
      if [[ "${DEV_SELECTED[$i]}" -eq 1 ]]; then
        selected_count=$((selected_count + 1))
      fi

      if [[ "${DEV_PLATFORM[$i]}" == "ios" && "$printed_ios_hdr" -eq 0 ]]; then
        printf '\033[K\n\033[K  %s── iOS Simulators ─────────────────────────────────────────%s\n' "$C_MAGENTA$C_BOLD" "$C_RESET"
        printed_ios_hdr=1
        lines=$((lines + 2))
      elif [[ "${DEV_PLATFORM[$i]}" == "android" && "$printed_android_hdr" -eq 0 ]]; then
        printf '\033[K\n\033[K  %s── Android Emulators ──────────────────────────────────────%s\n' "$C_GREEN$C_BOLD" "$C_RESET"
        printed_android_hdr=1
        lines=$((lines + 2))
      fi

      local pointer=" "
      local box="[ ]"
      local badge=""
      local row_color=""

      if [[ "$i" -eq "$cursor" ]]; then
        pointer="${C_CYAN}❯${C_RESET}"
        row_color="$C_BOLD$C_WHITE"
      fi
      if [[ "${DEV_SELECTED[$i]}" -eq 1 ]]; then
        box="${C_GREEN}[✓]${C_RESET}"
      fi
      if [[ "${DEV_STATUS[$i]}" == "Booted" ]]; then
        badge="${C_GREEN}● Rodando${C_RESET}"
      else
        badge="${C_DIM}○ Desligado${C_RESET}"
      fi

      printf '\033[K  %s %s %s%-42s%s %s\n' "$pointer" "$box" "$row_color" "${DEV_LABEL[$i]}" "$C_RESET" "$badge"
      lines=$((lines + 1))
    done

    printf '\033[K\n'
    printf '\033[K  %sSelecionados:%s %s%d%s' "$C_DIM" "$C_RESET" "$C_BOLD$C_CYAN" "$selected_count" "$C_RESET"
    if [[ -n "$err_msg" ]]; then
      printf '   %s%s%s' "$C_RED" "$err_msg" "$C_RESET"
    fi
    printf '\n'
    lines=$((lines + 2))
    last_drawn="$lines"
    err_msg=""

    key="$(read_key || printf 'QUIT')"
    case "$key" in
      UP)
        cursor=$(( (cursor - 1 + total) % total ))
        ;;
      DOWN)
        cursor=$(( (cursor + 1) % total ))
        ;;
      SPACE)
        if [[ "${DEV_SELECTED[$cursor]}" -eq 1 ]]; then
          DEV_SELECTED[$cursor]=0
        else
          DEV_SELECTED[$cursor]=1
        fi
        ;;
      ALL)
        local target_val=1
        if [[ "$selected_count" -eq "$total" ]]; then
          target_val=0
        fi
        for i in $(seq 0 $((total - 1))); do
          DEV_SELECTED[$i]=$target_val
        done
        ;;
      ENTER)
        if [[ "$selected_count" -eq 0 ]]; then
          err_msg="Selecione pelo menos 1 dispositivo com [Espaço]."
        else
          show_cursor
          printf '\n'
          return 0
        fi
        ;;
      QUIT)
        show_cursor
        printf '\n'
        exit 0
        ;;
    esac
  done
}

# --- Setup guiado de plataforma nativa ausente --------------------------------
read_capacitor_core_version() {
  local pkg="$PROJECT_ROOT/package.json"
  if [[ ! -f "$pkg" ]] || ! command -v node >/dev/null 2>&1; then
    return 0
  fi

  node -e "
    const fs = require('fs');
    const pkg = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    const raw = (pkg.dependencies && pkg.dependencies['@capacitor/core']) || '';
    const cleaned = String(raw).replace(/^[~^>=<\s]+/, '').trim();
    if (cleaned) console.log(cleaned);
  " "$pkg" 2>/dev/null || true
}

ensure_native_platform() {
  local plat="$1"
  local cap_ver pkg_spec
  cap_ver="$(read_capacitor_core_version)"

  if [[ "$plat" == "android" && "$HAS_ANDROID_DIR" -eq 0 ]]; then
    pkg_spec="@capacitor/android"
    [[ -n "$cap_ver" ]] && pkg_spec="@capacitor/android@${cap_ver}"

    print_section "Plataforma Android não configurada"
    log_warn "A pasta 'android/' ainda não existe neste projeto."
    printf '  Deseja instalar %s%s%s e gerar %sandroid/%s agora? [s/N] ' "$C_BOLD" "$pkg_spec" "$C_RESET" "$C_BOLD" "$C_RESET"
    local ans=""
    IFS= read -r ans </dev/tty || true
    case "$(to_lower "$ans")" in
      s|sim|y|yes)
        (
          cd "$PROJECT_ROOT"
          run_with_spinner "Instalando ${pkg_spec}..." "$LOG_DIR/cap-android-install.log" npm install "$pkg_spec"
          run_with_spinner "Criando projeto nativo android/..." "$LOG_DIR/cap-add-android.log" npx cap add android
        )
        HAS_ANDROID_DIR=1
        ;;
      *)
        log_info "Abortado. Para configurar manualmente:"
        printf '  npm install %s && npx cap add android\n' "$pkg_spec"
        exit 1
        ;;
    esac
  elif [[ "$plat" == "ios" && "$HAS_IOS_DIR" -eq 0 ]]; then
    pkg_spec="@capacitor/ios"
    [[ -n "$cap_ver" ]] && pkg_spec="@capacitor/ios@${cap_ver}"

    print_section "Plataforma iOS não configurada"
    log_warn "A pasta 'ios/' ainda não existe neste projeto."
    printf '  Deseja instalar %s%s%s e gerar %sios/%s agora? [s/N] ' "$C_BOLD" "$pkg_spec" "$C_RESET" "$C_BOLD" "$C_RESET"
    local ans=""
    IFS= read -r ans </dev/tty || true
    case "$(to_lower "$ans")" in
      s|sim|y|yes)
        (
          cd "$PROJECT_ROOT"
          run_with_spinner "Instalando ${pkg_spec}..." "$LOG_DIR/cap-ios-install.log" npm install "$pkg_spec"
          run_with_spinner "Criando projeto nativo ios/..." "$LOG_DIR/cap-add-ios.log" npx cap add ios
        )
        HAS_IOS_DIR=1
        detect_environment
        ;;
      *)
        log_info "Abortado. Para configurar manualmente:"
        printf '  npm install %s && npx cap add ios\n' "$pkg_spec"
        exit 1
        ;;
    esac
  fi
}

# --- Boot de Simuladores e Emuladores -----------------------------------------
open_ios_simulator_gui() {
  if [[ -n "$IOS_GUI_APP" ]]; then
    if open "$IOS_GUI_APP" >/dev/null 2>&1; then
      return 0
    fi
  fi

  if open -b com.apple.dt.Devices >/dev/null 2>&1 || \
     open -a DeviceHub >/dev/null 2>&1 || \
     open -a Simulator >/dev/null 2>&1; then
    return 0
  fi

  log_warn "Não foi possível abrir a janela do Simulador iOS (DeviceHub/Simulator.app)."
}

boot_ios_targets() {
  local udids=("$@")
  local any_booted=0
  local udid state

  for udid in "${udids[@]}"; do
    state="$(xcrun simctl list devices -j 2>/dev/null | node -e "
      let raw = '';
      process.stdin.on('data', d => raw += d);
      process.stdin.on('end', () => {
        try {
          const data = JSON.parse(raw);
          for (const devs of Object.values(data.devices || {})) {
            for (const d of devs) {
              if (d.udid === process.argv[1]) {
                console.log(d.state || '');
                return;
              }
            }
          }
        } catch (e) {}
      });
    " "$udid" || true)"

    if [[ "$state" != "Booted" ]]; then
      log_info "Iniciando iOS Simulator ($udid)..."
      xcrun simctl boot "$udid" >/dev/null 2>&1 || true
      SPAWNED_IOS_UDIDS+=("$udid")
    else
      log_ok "iOS Simulator já rodando ($udid)"
    fi
    any_booted=1
  done

  if [[ "$any_booted" -eq 1 ]]; then
    open_ios_simulator_gui
    for udid in "${udids[@]}"; do
      xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true
    done
  fi
}

wait_for_android_boot() {
  local serial="$1"
  local avd="$2"
  local timeout=180
  local elapsed=0
  local boot_done=""

  "$ADB_BIN" -s "$serial" wait-for-device >/dev/null 2>&1 || true

  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0

  hide_cursor
  while [[ "$elapsed" -lt "$timeout" ]]; do
    boot_done="$("$ADB_BIN" -s "$serial" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n' || true)"
    if [[ "$boot_done" == "1" ]]; then
      printf '\r\033[K'
      show_cursor
      log_ok "Emulador Android pronto: $avd ($serial)"
      return 0
    fi
    if [[ "$IS_TTY_OUT" -eq 1 ]]; then
      printf '\r%s%s%s Aguardando boot do Android (%s - %s)... %ds' \
        "$C_CYAN" "${frames[$i]}" "$C_RESET" "$avd" "$serial" "$elapsed"
      i=$(( (i + 1) % ${#frames[@]} ))
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  printf '\r\033[K'
  show_cursor
  log_err "Timeout aguardando boot do emulador $avd ($serial)."
  return 1
}

boot_android_target() {
  local avd="$1"
  local existing_serial=""

  existing_serial="$(find_running_serial_for_avd "$avd" || true)"
  if [[ -n "$existing_serial" ]]; then
    log_ok "Emulador Android já rodando: $avd ($existing_serial)"
    ACTIVE_ANDROID_SERIALS+=("$existing_serial")
    ACTIVE_ANDROID_NAMES+=("$avd")
    return 0
  fi

  local before_serials after_serials serial="" emu_pid emu_log
  before_serials="$("$ADB_BIN" devices 2>/dev/null | awk '/^emulator-[0-9]+/ { print $1 }' || true)"
  emu_log="$LOG_DIR/emulator-${avd}.log"

  log_info "Iniciando emulador Android '$avd' (sem IDE)..."
  "$EMULATOR_BIN" -avd "$avd" -netdelay none -netspeed full >"$emu_log" 2>&1 &
  emu_pid=$!
  SPAWNED_ANDROID_PIDS+=("$emu_pid")

  local tries=0
  while [[ "$tries" -lt 45 ]]; do
    if ! kill -0 "$emu_pid" 2>/dev/null; then
      log_err "Emulador '$avd' fechou inesperadamente (log: $emu_log)"
      tail -n 20 "$emu_log" >&2 || true
      return 1
    fi

    serial="$(find_running_serial_for_avd "$avd" || true)"
    if [[ -n "$serial" ]]; then
      break
    fi

    after_serials="$("$ADB_BIN" devices 2>/dev/null | awk '/^emulator-[0-9]+/ { print $1 }' || true)"
    while IFS= read -r cand; do
      [[ -z "$cand" ]] && continue
      if ! printf '%s\n' "$before_serials" | grep -qx "$cand"; then
        serial="$cand"
        break
      fi
    done < <(printf '%s\n' "$after_serials")

    [[ -n "$serial" ]] && break
    sleep 1
    tries=$((tries + 1))
  done

  if [[ -z "$serial" ]]; then
    log_err "Não foi possível detectar o serial ADB do emulador '$avd' (log: $emu_log)."
    return 1
  fi

  SPAWNED_ANDROID_SERIALS+=("$serial")
  ACTIVE_ANDROID_SERIALS+=("$serial")
  ACTIVE_ANDROID_NAMES+=("$avd")

  wait_for_android_boot "$serial" "$avd"
}

# --- Build, Live Reload & Deploy ----------------------------------------------
patch_cap_config_for_livereload() {
  local cfg_path="$1"
  local url="http://localhost:${LIVERELOAD_PORT}"

  if [[ ! -f "$cfg_path" ]]; then
    log_warn "Arquivo não encontrado para live reload: $cfg_path"
    return 0
  fi

  local bak="${cfg_path}.sim.bak"
  if [[ ! -f "$bak" ]]; then
    cp "$cfg_path" "$bak"
    PATCHED_CAP_FILES+=("$cfg_path")
  fi

  node -e "
    const fs = require('fs');
    const file = process.argv[1];
    const url = process.argv[2];
    const cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
    cfg.server = { url, cleartext: true };
    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
  " "$cfg_path" "$url"
}

start_livereload_server() {
  if [[ -n "$SERVE_PID" ]] && kill -0 "$SERVE_PID" 2>/dev/null; then
    return 0
  fi

  local serve_log="$LOG_DIR/ng-serve.log"
  log_info "Subindo servidor Live Reload em http://localhost:${LIVERELOAD_PORT}..."
  (
    cd "$PROJECT_ROOT"
    exec npx ng serve --host 0.0.0.0 --port "$LIVERELOAD_PORT"
  ) >"$serve_log" 2>&1 &
  SERVE_PID=$!

  local elapsed=0 timeout=60 ready=0
  local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
  local i=0

  hide_cursor
  while [[ "$elapsed" -lt "$timeout" ]]; do
    if ! kill -0 "$SERVE_PID" 2>/dev/null; then
      printf '\r\033[K'
      show_cursor
      log_err "Servidor ng serve encerrou com erro (log: $serve_log)"
      tail -n 25 "$serve_log" >&2 || true
      return 1
    fi

    if node -e "
      const http = require('http');
      const req = http.get('http://127.0.0.1:' + process.argv[1], res => {
        res.resume();
        process.exit(res.statusCode < 500 ? 0 : 1);
      });
      req.on('error', () => process.exit(1));
      req.setTimeout(1000, () => { req.destroy(); process.exit(1); });
    " "$LIVERELOAD_PORT" >/dev/null 2>&1; then
      ready=1
      break
    fi

    if [[ "$IS_TTY_OUT" -eq 1 ]]; then
      printf '\r%s%s%s Aguardando ng serve responder na porta %s... %ds' \
        "$C_CYAN" "${frames[$i]}" "$C_RESET" "$LIVERELOAD_PORT" "$elapsed"
      i=$(( (i + 1) % ${#frames[@]} ))
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  printf '\r\033[K'
  show_cursor

  if [[ "$ready" -ne 1 ]]; then
    log_err "Timeout aguardando ng serve na porta ${LIVERELOAD_PORT} (log: $serve_log)"
    return 1
  fi

  log_ok "Live Reload ativo em http://localhost:${LIVERELOAD_PORT}"
}

apply_adb_reverse() {
  if [[ ${#ACTIVE_ANDROID_SERIALS[@]} -eq 0 ]]; then
    return 0
  fi

  local serial
  for serial in "${ACTIVE_ANDROID_SERIALS[@]}"; do
    "$ADB_BIN" -s "$serial" reverse "tcp:${LIVERELOAD_PORT}" "tcp:${LIVERELOAD_PORT}" >/dev/null
  done
  log_ok "adb reverse tcp:${LIVERELOAD_PORT} aplicado nos emuladores Android"
}

build_and_sync_web() {
  local want_ios="$1"
  local want_android="$2"

  if [[ "$OPT_NO_BUILD" -eq 0 ]]; then
    (
      cd "$PROJECT_ROOT"
      run_with_spinner "Compilando bundle web (development)..." "$LOG_DIR/web-build.log" \
        npx ng build --configuration development
    )
  else
    if [[ ! -d "$PROJECT_ROOT/www" ]]; then
      log_err "--no-build informado, mas pasta www/ não existe. Rode sem --no-build primeiro."
      return 1
    fi
    log_info "Pulando ng build (--no-build), reutilizando www/."
  fi

  if [[ "$want_ios" -eq 1 ]]; then
    (
      cd "$PROJECT_ROOT"
      run_with_spinner "Sincronizando Capacitor (iOS)..." "$LOG_DIR/cap-sync-ios.log" \
        npx cap sync ios
    )
  fi

  if [[ "$want_android" -eq 1 ]]; then
    (
      cd "$PROJECT_ROOT"
      run_with_spinner "Sincronizando Capacitor (Android)..." "$LOG_DIR/cap-sync-android.log" \
        npx cap sync android
    )
  fi
}

build_and_deploy_ios() {
  if [[ ${#ACTIVE_IOS_UDIDS[@]} -eq 0 ]]; then
    return 0
  fi

  if [[ -z "$IOS_PROJECT_FLAG" || -z "$IOS_PROJECT_PATH" ]]; then
    log_err "Projeto Xcode não encontrado em ios/App/."
    return 1
  fi

  mkdir -p "$BUILD_CACHE_DIR/ios"
  run_with_spinner "Compilando app iOS (Debug iphonesimulator)..." "$LOG_DIR/ios-build.log" \
    xcodebuild \
    "$IOS_PROJECT_FLAG" "$IOS_PROJECT_PATH" \
    -scheme App \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination "generic/platform=iOS Simulator" \
    -derivedDataPath "$BUILD_CACHE_DIR/ios"

  local app_path="$BUILD_CACHE_DIR/ios/Build/Products/Debug-iphonesimulator/App.app"
  if [[ ! -d "$app_path" ]]; then
    log_err "App.app não encontrado em: $app_path"
    return 1
  fi

  local idx udid name
  for idx in $(seq 0 $(( ${#ACTIVE_IOS_UDIDS[@]} - 1 ))); do
    udid="${ACTIVE_IOS_UDIDS[$idx]}"
    name="${ACTIVE_IOS_NAMES[$idx]}"
    run_with_spinner "Instalando e abrindo no iOS ($name)..." "$LOG_DIR/ios-install-${udid}.log" \
      bash -c 'xcrun simctl install "$1" "$2" && xcrun simctl launch "$1" "$3"' _ "$udid" "$app_path" "$APP_ID"
  done
  open_ios_simulator_gui
}

build_and_deploy_android() {
  if [[ ${#ACTIVE_ANDROID_SERIALS[@]} -eq 0 ]]; then
    return 0
  fi

  (
    cd "$PROJECT_ROOT/android"
    run_with_spinner "Compilando APK Android (assembleDebug)..." "$LOG_DIR/android-build.log" \
      ./gradlew assembleDebug
  )

  local apk_path="$PROJECT_ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
  if [[ ! -f "$apk_path" ]]; then
    log_err "APK debug não encontrado em: $apk_path"
    return 1
  fi

  local idx serial name
  for idx in $(seq 0 $(( ${#ACTIVE_ANDROID_SERIALS[@]} - 1 ))); do
    serial="${ACTIVE_ANDROID_SERIALS[$idx]}"
    name="${ACTIVE_ANDROID_NAMES[$idx]}"
    run_with_spinner "Instalando e abrindo no Android ($name)..." "$LOG_DIR/android-install-${serial}.log" \
      bash -c '"$1" -s "$2" install -r "$3" && "$1" -s "$2" shell am start -n "${4}/.MainActivity"' \
      _ "$ADB_BIN" "$serial" "$apk_path" "$APP_ID"
  done
}

deploy_pipeline() {
  local want_ios=0 want_android=0
  [[ ${#ACTIVE_IOS_UDIDS[@]} -gt 0 ]] && want_ios=1
  [[ ${#ACTIVE_ANDROID_SERIALS[@]} -gt 0 ]] && want_android=1

  restore_patched_cap_configs

  if [[ "$OPT_MODE" == "boot" ]]; then
    log_ok "Simuladores prontos (modo boot apenas)."
    return 0
  fi

  if [[ "$OPT_MODE" == "livereload" ]]; then
    build_and_sync_web "$want_ios" "$want_android"
    start_livereload_server
    if [[ "$want_ios" -eq 1 ]]; then
      patch_cap_config_for_livereload "$PROJECT_ROOT/ios/App/App/capacitor.config.json"
    fi
    if [[ "$want_android" -eq 1 ]]; then
      patch_cap_config_for_livereload "$PROJECT_ROOT/android/app/src/main/assets/capacitor.config.json"
      apply_adb_reverse
    fi
  else
    build_and_sync_web "$want_ios" "$want_android"
  fi

  [[ "$want_ios" -eq 1 ]] && build_and_deploy_ios
  [[ "$want_android" -eq 1 ]] && build_and_deploy_android

  return 0
}

# --- Painel de Controle Pós-Launch --------------------------------------------
toggle_sim_appearance() {
  if [[ "$SIM_APPEARANCE" == "light" ]]; then
    SIM_APPEARANCE="dark"
  else
    SIM_APPEARANCE="light"
  fi

  local udid serial
  if [[ ${#ACTIVE_IOS_UDIDS[@]} -gt 0 ]]; then
    for udid in "${ACTIVE_IOS_UDIDS[@]}"; do
      xcrun simctl ui "$udid" appearance "$SIM_APPEARANCE" >/dev/null 2>&1 || true
    done
  fi

  if [[ ${#ACTIVE_ANDROID_SERIALS[@]} -gt 0 ]]; then
    local night_val="no"
    [[ "$SIM_APPEARANCE" == "dark" ]] && night_val="yes"
    for serial in "${ACTIVE_ANDROID_SERIALS[@]}"; do
      "$ADB_BIN" -s "$serial" shell cmd uimode night "$night_val" >/dev/null 2>&1 || true
    done
  fi

  log_ok "Aparência do SO alternada para: ${C_BOLD}${SIM_APPEARANCE}${C_RESET}"
}

show_logs_summary() {
  print_section "Logs desta sessão ($LOG_DIR)"
  ls -lh "$LOG_DIR" 2>/dev/null | tail -n +2 || true
  local latest
  latest="$(ls -t "$LOG_DIR"/*.log 2>/dev/null | head -n 1 || true)"
  if [[ -n "$latest" ]]; then
    printf '\n%s--- Últimas 15 linhas (%s) ---%s\n' "$C_DIM" "$(basename "$latest")" "$C_RESET"
    tail -n 15 "$latest" || true
  fi
}

shutdown_spawned_simulators_if_requested() {
  local spawned_count=$(( ${#SPAWNED_IOS_UDIDS[@]} + ${#SPAWNED_ANDROID_SERIALS[@]} ))
  if [[ "$OPT_KEEP_OPEN" -eq 1 || "$spawned_count" -eq 0 ]]; then
    return 0
  fi

  printf '\nDeseja encerrar os %d simulador(es) iniciado(s) nesta sessão? [s/N] ' "$spawned_count"
  local ans=""
  IFS= read -r ans </dev/tty || true
  case "$(to_lower "$ans")" in
    s|sim|y|yes)
      local udid serial
      if [[ ${#SPAWNED_IOS_UDIDS[@]} -gt 0 ]]; then
        for udid in "${SPAWNED_IOS_UDIDS[@]}"; do
          xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true
        done
      fi
      if [[ ${#SPAWNED_ANDROID_SERIALS[@]} -gt 0 ]]; then
        for serial in "${SPAWNED_ANDROID_SERIALS[@]}"; do
          "$ADB_BIN" -s "$serial" emu kill >/dev/null 2>&1 || true
        done
      fi
      log_ok "Simuladores da sessão encerrados."
      ;;
    *)
      log_info "Simuladores mantidos abertos."
      ;;
  esac
}

print_control_bar() {
  local mode_pad=""
  local pad_len=$(( 38 - ${#OPT_MODE} ))
  [[ "$pad_len" -lt 1 ]] && pad_len=1
  mode_pad="$(printf '%*s' "$pad_len" '')"

  printf '\n%s╭──────────────────────────────────────────────────────────────╮%s\n' "$C_GREEN" "$C_RESET"
  printf '%s│%s  %sSessão Ativa%s  •  Modo: %s%s%s%s%s│%s\n' \
    "$C_GREEN" "$C_RESET" "$C_BOLD$C_WHITE" "$C_RESET" "$C_CYAN" "$OPT_MODE" "$C_RESET" "$mode_pad" "$C_GREEN" "$C_RESET"
  printf '%s├──────────────────────────────────────────────────────────────┤%s\n' "$C_GREEN" "$C_RESET"
  printf '%s│%s  %s[r]%s Rebuild & Reinstall   %s[t]%s Toggle Light/Dark            %s│%s\n' \
    "$C_GREEN" "$C_RESET" "$C_BOLD$C_CYAN" "$C_RESET" "$C_BOLD$C_CYAN" "$C_RESET" "$C_GREEN" "$C_RESET"
  printf '%s│%s  %s[l]%s Logs da sessão        %s[q]%s Sair                         %s│%s\n' \
    "$C_GREEN" "$C_RESET" "$C_BOLD$C_CYAN" "$C_RESET" "$C_BOLD$C_CYAN" "$C_RESET" "$C_GREEN" "$C_RESET"
  printf '%s╰──────────────────────────────────────────────────────────────╯%s\n' "$C_GREEN" "$C_RESET"
}

control_loop() {
  print_control_bar

  local key
  while true; do
    IFS= read -rsn1 key </dev/tty 2>/dev/null || break
    case "$key" in
      r|R)
        printf '\n'
        log_info "Executando Rebuild & Reinstall..."
        if [[ "$OPT_MODE" == "boot" ]]; then
          OPT_MODE="debug"
        fi
        [[ ${#ACTIVE_IOS_UDIDS[@]} -gt 0 ]] && ensure_native_platform "ios"
        [[ ${#ACTIVE_ANDROID_SERIALS[@]} -gt 0 ]] && ensure_native_platform "android"
        deploy_pipeline
        print_control_bar
        ;;
      t|T)
        printf '\n'
        toggle_sim_appearance
        ;;
      l|L)
        printf '\n'
        show_logs_summary
        print_control_bar
        ;;
      q|Q)
        printf '\n'
        shutdown_spawned_simulators_if_requested
        log_ok "Encerrado com sucesso."
        exit 0
        ;;
    esac
  done
}

# --- Fluxo Principal ----------------------------------------------------------
main() {
  parse_args "$@"
  detect_environment

  if [[ "$IS_LINUX" -eq 1 && "$OPT_PLATFORM" == "ios" ]]; then
    log_err "iOS disponível apenas no macOS. No Linux, use --platform android ou all."
    exit 1
  fi

  if [[ "$OPT_DOCTOR" -eq 1 ]]; then
    print_banner
    discover_devices
    print_doctor 0
    exit 0
  fi

  if [[ ! -t 0 || ! -t 1 ]]; then
    log_err "O modo interativo requer um terminal TTY. Use --doctor ou --help em pipes/CI."
    exit 1
  fi

  print_banner
  print_doctor 1

  if [[ -z "$OPT_MODE" ]]; then
    select_mode_tui
  fi

  discover_devices
  select_devices_tui

  # Separa selecionados por plataforma e valida pastas nativas
  local selected_ios_udids=()
  local selected_ios_names=()
  local selected_android_avds=()
  local i

  for i in $(seq 0 $(( ${#DEV_PLATFORM[@]} - 1 ))); do
    if [[ "${DEV_SELECTED[$i]}" -eq 1 ]]; then
      if [[ "${DEV_PLATFORM[$i]}" == "ios" ]]; then
        selected_ios_udids+=("${DEV_ID[$i]}")
        selected_ios_names+=("${DEV_LABEL[$i]}")
      else
        selected_android_avds+=("${DEV_ID[$i]}")
      fi
    fi
  done

  if [[ "$OPT_MODE" != "boot" ]]; then
    if [[ ${#selected_ios_udids[@]} -gt 0 ]]; then
      ensure_native_platform "ios"
    fi
    if [[ ${#selected_android_avds[@]} -gt 0 ]]; then
      ensure_native_platform "android"
    fi
  fi

  # Inicializa simuladores selecionados
  print_section "Preparando Simuladores"
  if [[ ${#selected_ios_udids[@]} -gt 0 ]]; then
    ACTIVE_IOS_UDIDS=("${selected_ios_udids[@]}")
    ACTIVE_IOS_NAMES=("${selected_ios_names[@]}")
    boot_ios_targets "${ACTIVE_IOS_UDIDS[@]}"
  fi

  if [[ ${#selected_android_avds[@]} -gt 0 ]]; then
    local avd
    for avd in "${selected_android_avds[@]}"; do
      boot_android_target "$avd"
    done
  fi

  # Build único + deploy em todos os alvos
  print_section "Build & Deploy ($OPT_MODE)"
  deploy_pipeline

  control_loop
}

main "$@"
