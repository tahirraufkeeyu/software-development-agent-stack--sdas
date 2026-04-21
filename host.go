package main

import (
	"fmt"
	"os"
	"path/filepath"
)

// hostTarget resolves a host name ("claude" | "cursor" | "codex" |
// "gemini") to an absolute filesystem path where skills should be
// installed. Mirrors the logic in install.sh so the CLI behaves
// identically to the legacy shell installer.
//
// Environment variable overrides let a user redirect the target
// without changing flags:
//
//	CLAUDE_SKILLS_DIR   overrides the claude target
//	CURSOR_RULES_DIR    overrides the cursor target
//	CODEX_SKILLS_DIR    overrides the codex target
//	GEMINI_SKILLS_DIR   overrides the gemini target
//
// If the host string is unknown, returns a clear error naming the
// supported values so the user can fix their flag.
func hostTarget(host string) (string, error) {
	switch host {
	case "", "claude":
		return envOr("CLAUDE_SKILLS_DIR", filepath.Join(userHome(), ".claude", "skills"))
	case "cursor":
		// Cursor stores rules per-project by convention, so the default
		// is relative to the current working directory — not the user's
		// home. This matches install.sh.
		return envOr("CURSOR_RULES_DIR", filepath.Join(cwd(), ".cursor", "rules"))
	case "codex":
		return envOr("CODEX_SKILLS_DIR", filepath.Join(cwd(), ".codex", "skills"))
	case "gemini":
		return envOr("GEMINI_SKILLS_DIR", filepath.Join(userHome(), ".gemini", "skills"))
	default:
		return "", fmt.Errorf(
			"unknown --host %q (supported: claude, cursor, codex, gemini)",
			host,
		)
	}
}

// envOr returns the env value when set, otherwise the fallback. Returned
// as (path, nil) so callers can chain into the switch above without
// special-casing.
func envOr(envVar, fallback string) (string, error) {
	if v := os.Getenv(envVar); v != "" {
		return v, nil
	}
	return fallback, nil
}

// userHome returns the user's home directory. Falls back to "." on
// error so an unusual environment (no HOME set, no getpwuid) at least
// produces a path that exists.
func userHome() string {
	h, err := os.UserHomeDir()
	if err != nil || h == "" {
		return "."
	}
	return h
}

// cwd returns the current working directory, falling back to "." on
// error. Only used by the cursor / codex hosts which are project-local.
func cwd() string {
	d, err := os.Getwd()
	if err != nil || d == "" {
		return "."
	}
	return d
}

// supportedHosts lists the host values accepted by --host. Used by list
// / docs output when we want to tell the user what's valid.
var supportedHosts = []string{"claude", "cursor", "codex", "gemini"}
