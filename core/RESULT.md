# RESULT: what a worker reports to its Master, and a Master to the Chief (10 lines or fewer by SendMessage)

```
status:           done | blocked | needs-master   (a Master to the Chief: done | blocked | needs-chief)
commit:           <sha or none; list every sha if several>
gates:            tsc <pass|fail|not run> · unit <...> · own-flow <...>
files:            <paths touched>
callers checked:  <how, or n/a>   (required for bug fixes; missing = incomplete)
test-guard:       ok | violations | not run
dl-candidates:    <one line each, or none>
unresolved:       <or none; at a budget cap: items done, items remaining>
next:             <one line>
```

`own-flow: pass` means the flow ran live. A clean type check or build is a different, weaker claim: never report it as a live check.

A Master sends its Chief the same shape only when it is done, blocked or needs the Chief (`core/CHIEF.md` rule 2); the Master logs it with `route-log.cjs from-result`. Detail goes to `handoffs/W-M#-n.md` LAST, with a LAST block on top and earlier entries append-only. DL candidates are written there; Master folds them into ACTION_LOG. Do not paste code or logs into the message; give paths.
