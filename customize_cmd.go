package main

import (
	"fmt"
	"os/exec"
	"runtime"

	"github.com/spf13/cobra"
)

// customizeCmd opens the skill's customizer page on skillskit.dev in
// the user's default browser. The customizer itself is a browser-only
// tool (Phase B1 of the site) — the CLI can't usefully customize
// offline since customization needs an LLM call to OpenRouter.
//
// This is essentially a convenient shortcut for
// `open https://skillskit.dev/skills/<slug>/customize` but saves
// the user from remembering the URL shape.
var customizeCmd = &cobra.Command{
	Use:     "customize <skill-slug>",
	Aliases: []string{"customise"},
	Short:   "Open the LLM customizer for a skill in your browser",
	Long: `Opens skillskit.dev/skills/<slug>/customize in your default browser.
The customizer is a browser-based tool that rewrites a skill for your
environment (tech stack, scale, constraints) via an LLM. Your API key
and form inputs stay in your browser — nothing transits our servers.

Once you're done customizing, download the zip or copy the one-line
install command — then use `+"`skillskit install`"+` or drop the file
into ~/.claude/skills/<slug>/SKILL.md manually.

This command requires a working default browser and network access;
the customizer itself requires an OpenRouter API key (the customizer
page walks you through getting one).

Examples:
  skillskit customize code-review
  skillskit customize monitoring-setup`,
	Args: cobra.ExactArgs(1),
	RunE: runCustomize,
}

// customizeBaseURL is exported so a future --custom-site flag could
// point at a fork's deployment. Defaults to the canonical site.
const customizeBaseURL = "https://skillskit.dev"

func init() {
	rootCmd.AddCommand(customizeCmd)
}

func runCustomize(cmd *cobra.Command, args []string) error {
	slug := args[0]

	// Sanity-check the slug is something that exists in the kit so we
	// don't send the user to a broken URL.
	if findDepartmentOf(slug) == "" {
		return errf(
			"no skill named %q in this binary.\n"+
				"  Try: skillskit search %q",
			slug, slug,
		)
	}

	url := fmt.Sprintf("%s/skills/%s/customize", customizeBaseURL, slug)
	fmt.Fprintf(cmd.OutOrStdout(), "Opening %s\n", url)
	if err := openBrowser(url); err != nil {
		fmt.Fprintf(cmd.OutOrStdout(),
			"\nCould not launch browser automatically: %v\n"+
				"Copy and paste the URL above into your browser.\n",
			err,
		)
	}
	return nil
}

// openBrowser launches the user's default browser for the given URL.
// Per-OS behaviour:
//
//	macOS    open <url>
//	Linux    xdg-open <url>      (falls back to 'sensible-browser')
//	Windows  rundll32 url.dll,FileProtocolHandler <url>
//
// Errors are returned so runCustomize can fall back to printing the
// URL if launching fails (SSH sessions, headless boxes, etc.).
func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		// Linux + BSDs. xdg-open is the XDG standard; sensible-browser
		// is Debian's fallback. Try them in order.
		if _, err := exec.LookPath("xdg-open"); err == nil {
			cmd = exec.Command("xdg-open", url)
		} else if _, err := exec.LookPath("sensible-browser"); err == nil {
			cmd = exec.Command("sensible-browser", url)
		} else {
			return fmt.Errorf("no xdg-open or sensible-browser found; open the URL manually")
		}
	}
	return cmd.Start()
}
