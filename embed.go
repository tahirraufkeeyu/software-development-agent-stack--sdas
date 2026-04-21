package main

import "embed"

// embeddedDepartments is a read-only snapshot of `departments/` at the
// commit the binary was built from. The goreleaser pipeline builds one
// binary per (os, arch) for each tagged release, so `skillskit install`
// always installs the exact skill tree that was in departments/ when the
// release was cut — deterministic, offline-capable, reproducible.
//
// The `all:` prefix makes embed include dotfiles (we don't have any today,
// but keeps the directive robust if a future skill needs a .something).
//
// Build-only knowledge (Version, Commit, Date) is injected by
// goreleaser via -ldflags "-X main.Version=... -X main.Commit=..." so
// `skillskit version` prints real release info instead of zero values.
//
//go:embed all:departments
var embeddedDepartments embed.FS

var (
	// Version is overridden at build time by goreleaser ldflags. Local
	// `go build` runs see "dev".
	Version = "dev"
	// Commit is the git SHA of the release (short form).
	Commit = "unknown"
	// Date is the RFC3339 build timestamp.
	Date = "unknown"
)
