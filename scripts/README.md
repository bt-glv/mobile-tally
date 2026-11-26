# Scripts — Simuladores iOS & Android (sem IDE)

Execute o runner interativo (`sim.sh`) para escolher modo (`Build Nativo`, `Live Reload` ou `Boot`) e selecionar um ou múltiplos simuladores simultaneamente sem abrir Xcode ou Android Studio:

```bash
npm run sim
# ou
./scripts/sim.sh
```

## Plataformas

- **macOS**: suporta **iOS Simulators** (`xcrun simctl` + `xcodebuild`, com suporte a `DeviceHub.app` no Xcode 27+ e `Simulator.app`) e **Android Emulators** (`emulator` + `adb`).
- **Linux**: suporta **Android Emulators** (requer Android SDK `platform-tools` + `emulator`, ao menos um AVD criado e `/dev/kvm` acessível).

## Flags úteis

```bash
./scripts/sim.sh --doctor                       # Diagnóstico de SDKs, KVM e simuladores
./scripts/sim.sh --mode livereload --platform ios
./scripts/sim.sh --mode debug --platform android --keep-open
./scripts/sim.sh --no-build                     # Reutiliza www/ existente
./scripts/sim.sh --port 8200                    # Porta custom para Live Reload
```

## Controles durante a execução

- `[r]` Rebuild & Reinstall em todos os simuladores selecionados
- `[t]` Alterna Light/Dark Mode do SO em todos os simuladores abertos
- `[l]` Exibe caminhos e últimas linhas dos logs (`/tmp/tally-sim`)
- `[q]` Encerra com limpeza automática (opcionalmente fechando simuladores iniciados na sessão)
