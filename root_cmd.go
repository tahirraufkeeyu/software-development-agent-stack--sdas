package main

import (
	"fmt"

	"github.com/spf13/cobra"
)

// rootCmd is the top-level Cobra command. Subcommands are registered via
// init() blocks in their own *_cmd.go files (Cobra's idiomatic pattern
// for multi-command CLIs without a sub-package explosion).
//
// The short description reads well in `skillskit --help`; the long
// description provides the fuller pitch visible on first run.
var rootCmd = &cobra.Command{
	Use:           "skillskit",
	Short:         "Install and manage Claude Code skills from SDAS",
	SilenceUsage:  true, // don't spam help text on user-input errors
	SilenceErrors: true, // Execute() returns the error; main.go sets exit code
	Long: `skillskit — the CLI for SDAS (Software Development Agent Stack).

Installs, updates, lists, searches, and removes Claude Code skills from
the SDAS kit. Skills are embedded in this binary at build time; no network
access is required for any operation except ` + "`skillskit customize`" + `
which opens the web customizer in your browser.

Quick start:
  skillskit install all                       # install everything
  skillskit install developers                # install one department
  skillskit install --host cursor all         # target Cursor instead
  skillskit list                              # show what's installed
  skillskit search "code review"              # find skills by keyword
  skillskit update                            # sync installed skills
  skillskit remove code-review                # uninstall one skill
  skillskit customize monitoring-setup        # open web customizer

Every command supports --host (claude|cursor|codex|gemini) and --dry-run.`,
}

// Global persistent flags live on rootCmd so every subcommand inherits
// them without re-declaring.
var (
	// persistentHost is the target AI tool directory. Lookup logic is in
	// host.go: resolveHostPath(host) → filesystem path.
	persistentHost string
	// persistentDryRun, when true, prints the intended actions without
	// touching the filesystem. Inherited by every subcommand that could
	// write.
	persistentDryRun bool
)

func init() {
	rootCmd.PersistentFlags().StringVarP(
		&persistentHost,
		"host", "H",
		"claude",
		"target AI tool (claude | cursor | codex | gemini)",
	)
	rootCmd.PersistentFlags().BoolVar(
		&persistentDryRun,
		"dry-run",
		false,
		"print intended actions without changing any files",
	)

	// Customize the default help so `skillskit` with no args prints the
	// long description (the pitch) instead of just the usage line.
	rootCmd.SetHelpTemplate(defaultHelpTemplate)
}

// defaultHelpTemplate is a lightly-customized Cobra help template that
// puts the Long description before the usage block.
const defaultHelpTemplate = `{{with .Long}}{{. | trimTrailingWhitespaces}}

{{end}}Usage:{{if .Runnable}}
  {{.UseLine}}{{end}}{{if .HasAvailableSubCommands}}
  {{.CommandPath}} [command]{{end}}{{if gt (len .Aliases) 0}}

Aliases:
  {{.NameAndAliases}}{{end}}{{if .HasExample}}

Examples:
{{.Example}}{{end}}{{if .HasAvailableSubCommands}}

Available Commands:{{range .Commands}}{{if (or .IsAvailableCommand (eq .Name "help"))}}
  {{rpad .Name .NamePadding }} {{.Short}}{{end}}{{end}}{{end}}{{if .HasAvailableLocalFlags}}

Flags:
{{.LocalFlags.FlagUsages | trimTrailingWhitespaces}}{{end}}{{if .HasAvailableInheritedFlags}}

Global Flags:
{{.InheritedFlags.FlagUsages | trimTrailingWhitespaces}}{{end}}{{if .HasAvailableSubCommands}}

Use "{{.CommandPath}} [command] --help" for more information about a command.{{end}}
`

// errf is a tiny helper so subcommand RunE funcs can return wrapped
// errors with a consistent prefix visible to the user.
func errf(format string, a ...any) error {
	return fmt.Errorf(format, a...)
}
