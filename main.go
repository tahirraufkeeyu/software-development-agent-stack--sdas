// Package main is the entrypoint for the `skillskit` CLI.
//
// The CLI ships as a single cross-platform binary (macOS, Linux, Windows;
// amd64 + arm64). Skills are embedded at build time via go:embed, so a
// released binary is fully self-contained — no network access needed to
// install a skill.
//
// Sub-commands are defined in root_cmd.go and siblings (install_cmd.go,
// list_cmd.go, etc.). Shared helpers live in skills.go, installer.go, and
// host.go. Everything is one `package main` to keep refactoring cheap and
// the directory tree flat.
package main

import "os"

// main is deliberately minimal. All command wiring happens in init()
// blocks across the *_cmd.go files; this just runs Cobra and maps exit
// codes. A non-nil error from cobra means the user got a usage / error
// message on stderr already, so we just exit 1.
func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
