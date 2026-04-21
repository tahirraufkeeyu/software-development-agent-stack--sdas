package main

import (
	"fmt"

	"github.com/spf13/cobra"
)

var removeCmd = &cobra.Command{
	Use:     "remove <skill|department|all>",
	Aliases: []string{"rm", "uninstall"},
	Short:   "Uninstall a skill, a department's skills, or everything",
	Long: `Remove skills from the target host's skills directory.

Positional argument:
  <skill-slug>    Uninstall a single skill.
  <department>    Uninstall every skill that belongs to that department.
  all             Uninstall every skill this skillskit binary shipped.

Third-party skills — anything installed at the target that isn't part
of this kit — are never touched. Use --force to skip the confirm
prompt; without --force, you'll be asked once before the deletion.

Examples:
  skillskit remove code-review
  skillskit remove developers
  skillskit remove all
  skillskit remove all --force       # no confirm prompt
  skillskit remove code-review --dry-run`,
	Args: cobra.ExactArgs(1),
	RunE: runRemove,
}

var removeForce bool

func init() {
	removeCmd.Flags().BoolVarP(&removeForce, "force", "f", false,
		"skip the confirmation prompt")
	rootCmd.AddCommand(removeCmd)
}

func runRemove(cmd *cobra.Command, args []string) error {
	target, err := hostTarget(persistentHost)
	if err != nil {
		return err
	}
	stdout := cmd.OutOrStdout()
	stdin := cmd.InOrStdin()
	arg := args[0]

	// Figure out the list of skills to remove.
	toRemove, summary, err := resolveRemoveTargets(arg, target)
	if err != nil {
		return err
	}
	if len(toRemove) == 0 {
		fmt.Fprintf(stdout, "Nothing matching %q is installed at %s.\n", arg, target)
		return nil
	}

	// Confirm once with a summary (unless --force or --dry-run).
	if !removeForce && !persistentDryRun {
		ok, err := promptYesNo(
			fmt.Sprintf("About to remove %d skill(s) from %s: %s. Continue?", len(toRemove), target, summary),
			stdin, stdout,
		)
		if err != nil {
			return err
		}
		if !ok {
			fmt.Fprintln(stdout, "Aborted.")
			return nil
		}
	}

	var removed int
	for _, slug := range toRemove {
		ok, err := removeInstalledSkill(slug, target, persistentDryRun, stdout)
		if err != nil {
			return err
		}
		if ok {
			removed++
		}
	}
	fmt.Fprintf(stdout, "\nDone. %d skill(s) removed.\n", removed)
	return nil
}

// resolveRemoveTargets turns the user's positional arg into a concrete
// list of skill slugs currently installed at target. Returns the slugs
// plus a human-readable summary for the confirm prompt.
func resolveRemoveTargets(arg, target string) ([]string, string, error) {
	installed, err := installedSkills(target)
	if err != nil {
		return nil, "", err
	}
	installedSet := make(map[string]bool, len(installed))
	for _, s := range installed {
		installedSet[s] = true
	}

	// "all" → every installed skill that belongs to this kit.
	if arg == "all" {
		kitSet := embeddedSkillSet()
		var out []string
		for _, s := range installed {
			if kitSet[s] {
				out = append(out, s)
			}
		}
		return out, fmt.Sprintf("all %d skill(s) from this kit", len(out)), nil
	}

	// Department name → every installed skill that belongs to that department.
	depts, err := listEmbeddedDepartments()
	if err != nil {
		return nil, "", err
	}
	for _, d := range depts {
		if d == arg {
			slugs, err := listEmbeddedSkills(d)
			if err != nil {
				return nil, "", err
			}
			var out []string
			for _, s := range slugs {
				if installedSet[s] {
					out = append(out, s)
				}
			}
			return out, fmt.Sprintf("%s department (%d installed)", d, len(out)), nil
		}
	}

	// Single skill slug.
	if !installedSet[arg] {
		return nil, "", nil // not installed; caller prints a friendly message
	}
	return []string{arg}, arg, nil
}

// embeddedSkillSet returns a set of every slug shipped by this binary.
// Used by `remove all` so we never touch third-party skills.
func embeddedSkillSet() map[string]bool {
	set := make(map[string]bool)
	depts, _ := listEmbeddedDepartments()
	for _, d := range depts {
		slugs, _ := listEmbeddedSkills(d)
		for _, s := range slugs {
			set[s] = true
		}
	}
	return set
}
