#!/usr/bin/env bash

# Enable job control so background jobs get their own process groups
set -m

IONIC_PID=""

kill_server() {
  if [[ -n "$IONIC_PID" ]] && kill -0 "$IONIC_PID" 2>/dev/null; then
    # Terminate child processes and the entire process group
    kill -TERM -"$IONIC_PID" 2>/dev/null || pkill -P "$IONIC_PID" 2>/dev/null
    wait "$IONIC_PID" 2>/dev/null
    IONIC_PID=""
  fi
}

start_server() {
  print_menu
  # Run in the background; stdout and stderr stream directly to the terminal
  npx ionic serve --no-livereload &
  IONIC_PID=$!
}

print_menu() {
  echo -e "\n\033[1;36m[r] Reload  [q] Quit  [d] Quit and delete cache\033[0m\n"
}

cleanup_and_exit() {
  kill_server
  echo -e "\n\033[1;31mApplication terminated.\033[0m"
  exit 0
}

# Trap Ctrl+C (SIGINT) and termination signals to ensure cleanup
trap cleanup_and_exit SIGINT SIGTERM

start_server

# Listen for single keystrokes without requiring Enter
while true; do
  read -rsn1 key < /dev/tty 2>/dev/null || break

  case "$key" in
    r|R)
      echo -e "\n\033[1;33m[Reloading application...]\033[0m"
      kill_server
      start_server
      ;;
    q|Q)
      cleanup_and_exit
      ;;
    d|D)
      echo -e "\n\033[1;33mStopping server and clearing Angular cache...\033[0m"
      kill_server
      rm -rf .angular/cache
      echo -e "\033[1;32mCache deleted (.angular/cache).\033[0m"
      echo -e "\033[1;31mApplication terminated.\033[0m"
      exit 0
      ;;
  esac
done
