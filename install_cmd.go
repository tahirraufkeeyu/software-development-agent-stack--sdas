package main

import (
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

var installCmd = &cobra.Command{
	Use:   "install <department|all|skill>",
	Short: "Install a department's skills, all departments, or a specific skill",
	Long: `Install one or more skills into the target tool's skills directory.

Positional argument:
  <department>   Install every skill under that department.
  all            Install every skill across every department.
  <skill-slug>   Install a single skill by name (looked up across departments).

Target directory is controlled by --host:
  claude   ~/.claude/skills/            (default)
  cursor   $PWD/.cursor/rules/
  codex    $PWD/.codex/skills/
  gemini   ~/.gemini/skills/

Set CLAUDE_SKILLS_DIR / CURSOR_RULES_DIR / CODEX_SKILLS_DIR /
GEMINI_SKILLS_DIR to override the target for that host.

Examples:
  skillskit install all
  skillskit install developers
  skillskit install --host cursor all
  skillskit install code-review
  skillskit install all --force                  # no prompts on overwrite
  skillskit install all --dry-run                # show what would happen`,
	Args: cobra.ExactArgs(1),
	RunE: runInstall,
}

var installForce bool

func init() {
	installCmd.Flags().BoolVarP(&installForce, "force", "f", false,
		"overwrite existing skills without prompting")
	rootCmd.AddCommand(installCmd)
}

func runInstall(cmd *cobra.Command, args []string) error {
	target, err := hostTarget(persistentHost)
	if err != nil {
		return err
	}
	stdout := cmd.OutOrStdout()
	stdin := cmd.InOrStdin()

	if !persistentDryRun {
		if err := os.MkdirAll(target, 0o755); err != nil {
			return errf("create target dir %s: %w", target, err)
		}
	}

	arg := args[0]

	// 1) "all" → every skill in every department.
	if arg == "all" {
		return installAllDepartments(target, stdin, stdout)
	}

	// 2) department name → every skill in that department.
	depts, err := listEmbeddedDepartments()
	if err != nil {
		return err
	}
	for _, d := range depts {
		if d == arg {
			fmt.Fprintf(stdout, "Installing %q into %s (host: %s)\n", d, target, persistentHost)
			inst, skip, err := installDepartmentInto(d, target, stdin, stdout)
			if err != nil {
				return err
			}
			printInstallSummary(stdout, inst, skip, 1)
			return nil
		}
	}

	// 3) skill slug → single skill lookup across departments.
	dept := findDepartmentOf(arg)
	if dept == "" {
		return errf(
			"nothing called %q in the embedded kit.\n"+
				"  Available departments: %s\n"+
				"  Run `skillskit list --available` to see all skills.",
			arg, strings.Join(depts, ", "),
		)
	}
	fmt.Fprintf(stdout, "Installing %s (from %s department) into %s\n", arg, dept, target)
	installed, skipped, err := installSkill(dept, arg, target, installForce, persistentDryRun, stdin, stdout)
	if err != nil {
		return err
	}
	i, s := 0, 0
	if installed {
		i = 1
	}
	if skipped {
		s = 1
	}
	printInstallSummary(stdout, i, s, 0)
	return nil
}

func installAllDepartments(target string, stdin io.Reader, stdout io.Writer) error {
	depts, err := listEmbeddedDepartments()
	if err != nil {
		return err
	}
	fmt.Fprintf(stdout, "Installing all departments into %s (host: %s)\n", target, persistentHost)
	var totalInstalled, totalSkipped int
	for _, d := range depts {
		fmt.Fprintf(stdout, "\n▸ %s\n", d)
		inst, skip, err := installDepartmentInto(d, target, stdin, stdout)
		if err != nil {
			return err
		}
		totalInstalled += inst
		totalSkipped += skip
	}
	fmt.Fprintln(stdout)
	printInstallSummary(stdout, totalInstalled, totalSkipped, len(depts))
	return nil
}

// installDepartmentInto walks a department's skills and installs each.
// Returns (installed, skipped) counts so the caller can aggregate.
func installDepartmentInto(department, target string, stdin io.Reader, stdout io.Writer) (int, int, error) {
	slugs, err := listEmbeddedSkills(department)
	if err != nil {
		return 0, 0, err
	}
	var installed, skipped int
	for _, slug := range slugs {
		i, s, err := installSkill(department, slug, target, installForce, persistentDryRun, stdin, stdout)
		if err != nil {
			return installed, skipped, err
		}
		if i {
			installed++
		}
		if s {
			skipped++
		}
	}
	return installed, skipped, nil
}

func printInstallSummary(out io.Writer, installed, skipped, depts int) {
	if depts > 0 {
		fmt.Fprintf(out, "\nDone. %d installed, %d skipped across %d department(s).\n",
			installed, skipped, depts)
	} else {
		fmt.Fprintf(out, "\nDone. %d installed, %d skipped.\n", installed, skipped)
	}
}
