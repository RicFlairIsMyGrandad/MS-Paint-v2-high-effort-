#!/usr/bin/env bash
set -euo pipefail
# Used only for desktop QA in the Linux cloud container, not by the Windows app.
task_native=/workspace/.cache/native
if command -v Xvfb >/dev/null; then
  exec Xvfb :99 -screen 0 1680x1000x24 -ac -nolisten tcp
fi
if [[ ! -x "$task_native/usr/bin/Xvfb" ]]; then
  task_apt=/workspace/.cache/apt
  mkdir -p "$task_apt/lists/partial" "$task_apt/archives/partial" "$task_apt/empty" "$task_apt/log"
  printf '%s\n' 'deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian trixie main' > "$task_apt/sources.list"
  cat > "$task_apt/apt.conf" <<'CONFIG'
Dir::Etc::Parts "/workspace/.cache/apt/empty";
Dir::Etc::Main "/workspace/.cache/apt/empty.conf";
Dir::Etc::sourcelist "/workspace/.cache/apt/sources.list";
Dir::Etc::sourceparts "/workspace/.cache/apt/empty";
Dir::State::lists "/workspace/.cache/apt/lists";
Dir::Cache::archives "/workspace/.cache/apt/archives";
Dir::Cache::pkgcache "/workspace/.cache/apt/pkgcache.bin";
Dir::Cache::srcpkgcache "/workspace/.cache/apt/srcpkgcache.bin";
Dir::Log "/workspace/.cache/apt/log";
APT::Sandbox::User "agent";
CONFIG
  APT_CONFIG="$task_apt/apt.conf" /usr/bin/apt-get -o Acquire::https::Proxy="${HTTPS_PROXY:-}" update
  (cd "$task_apt/archives"; APT_CONFIG="$task_apt/apt.conf" /usr/bin/apt-get -o Acquire::https::Proxy="${HTTPS_PROXY:-}" download xvfb xauth xserver-common libxfont2)
  mkdir -p "$task_native"
  for task_pkg in xvfb xauth xserver-common libxfont2; do
    for task_deb in "$task_apt/archives/${task_pkg}"_*.deb; do dpkg-deb -x "$task_deb" "$task_native"; done
  done
fi
mkdir -p /tmp/.X11-unix
LD_LIBRARY_PATH="$task_native/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}" exec "$task_native/usr/bin/Xvfb" :99 -screen 0 1680x1000x24 -ac -nolisten tcp
