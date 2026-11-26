# Tally
> 2026 - Fumec - Desenvolvimento Mobile: Projeto Integração
> FRONTEND

App gerenciador de cartões de fidelidade virtuais.

## Simuladores iOS & Android (sem IDE)

Execute o runner interativo para escolher modo (`Build Nativo`, `Live Reload` ou `Boot`) e selecionar um ou múltiplos simuladores simultaneamente sem abrir Xcode ou Android Studio:

```bash
npm run sim
```

- **macOS**: suporta **iOS Simulators** (`xcrun simctl` + `xcodebuild`) e **Android Emulators** (`emulator` + `adb`).
- **Linux**: suporta **Android Emulators** (requer Android SDK `platform-tools` + `emulator`, ao menos um AVD criado e `/dev/kvm` acessível).

### Flags úteis

```bash
./scripts/sim.sh --doctor                       # Diagnóstico de SDKs, KVM e simuladores
./scripts/sim.sh --mode livereload --platform ios
./scripts/sim.sh --mode debug --platform android --keep-open
./scripts/sim.sh --no-build                     # Reutiliza www/ existente
```

Durante a execução: `[r]` rebuild & reinstall, `[t]` alterna Light/Dark Mode do SO em todos os simuladores abertos, `[l]` exibe logs e `[q]` encerra com limpeza automática.



