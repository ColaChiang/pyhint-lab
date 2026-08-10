# Execution threat model

PyHint accepts untrusted Python. Static blocking reduces obvious misuse but is not a security boundary. The included runner is appropriate for a controlled classroom demonstration with beginner-sized single functions; it is not a multi-tenant production sandbox.

## Defenses included

- AST node and code-size limits.
- Rejection of imports, dangerous calls, system-module attributes, globals, and nonlocals.
- A minimal builtin dictionary in the child process.
- Isolated interpreter flags (`-I -S`).
- Wall-clock, CPU, address-space, file-size, file-descriptor, process, and output limits.
- Fresh temporary working directory per execution.
- Non-root, read-only, capability-dropped container configuration.
- Hidden test inputs are removed from API responses.

## Residual risks

- Python object-model escape techniques can bypass simple AST blacklists.
- The API container still needs a network path to serve HTTP; code running in the same container is not protected by a separate network namespace.
- Platform-specific resource limits vary outside Linux.
- Algorithmic denial of service can occur before a limit is reached.

## Production upgrade

Move execution to an ephemeral worker service with its own network namespace (`none`), seccomp/AppArmor profile, read-only root filesystem, per-job cgroup, strict syscall allowlist, and one job per destroyed container or microVM. The API should communicate with it through a queue and never mount application secrets into the executor.

