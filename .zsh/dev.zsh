typeset -gr BIZU_DEV_ROOT="${${(%):-%x}:A:h:h}"

unalias dev 2>/dev/null

dev() {
  "${BIZU_DEV_ROOT}/dev" "$@"
}
