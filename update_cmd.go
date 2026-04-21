package main

import (
	"fmt"

	"github.com/spf13/cobra"
)

var updateCmd = &cobra.Command{
	Use:   "update",
	Short: "Re-sync installed skills from this binary's embedded versions",
	Long: `Re-installs every skill currently present at the target host's skills
directory from the versions embedded in this binary.

Use this when you've upgraded your skillskit binary (via brew upgrade,
scoop update, a new release tarball) and want the installed skills on
disk to match the upgraded binary's embedded snapshot.

This command DOES NOT fetch from the network — it only re-copies from
what's baked into this binary. To pick up upstream skill changes,
upgrade the binary first, then run ` + "`skillskit update`" + `.

Third-party skills — anything installed in the target dir that isn't
from this kit — are left untouched.

Examples:
  skillskit update                       # re-sync claude skills
  skillskit update --host cursor         # re-sync cursor rules
  skillskit update --dry-run             # preview the re-sync`,
	RunE: runUpdate,
}

func init() {
	// update reuses the persistent --host and --dry-run flags;
	// no additional flags beyond inheritance.
	rootCmd.AddCommand(updateCmd)
}

func runUpdate(cmd *cobra.Command, _ []string) error {
	target, err := hostTarget(persistentHost)
	if err != nil {
		return err
	}
	stdout := cmd.OutOrStdout()
	stdin := cmd.InOrStdin()

	installed, err := installedSkills(target)
	if err != nil {
		return errf("list installed skills at %s: %w", target, err)
	}
	if len(installed) == 0 {
		fmt.Fprintf(stdout,
			"Nothing installed at %s. Run `skillskit install all` first.\n",
			target,
		)
		return nil
	}

	fmt.Fprintf(stdout, "Re-syncing %d skill(s) at %s from embedded version %s\n",
		len(installed), target, Version)

	kitSet := embeddedSkillSet()
	var updated, skipped, untouched int
	for _, slug := range installed {
		if !kitSet[slug] {
			fmt.Fprintf(stdout, "    · %s (not from this kit, leaving alone)\n", slug)
			untouched++
			continue
		}
		dept := findDepartmentOf(slug)
		if dept == "" {
			// Shouldn't happen — kitSet[slug] is true only if the lookup
			// succeeded earlier. Belt-and-braces.
			untouched++
			continue
		}
		// Update semantics: force overwrite silently. The user chose
		// "update" explicitly; prompting on every file would be noise.
		inst, skip, err := installSkill(dept, slug, target, true /* force */, persistentDryRun, stdin, stdout)
		if err != nil {
			return err
		}
		if inst {
			updated++
		}
		if skip {
			skipped++
		}
	}

	fmt.Fprintf(stdout, "\nDone. %d updated, %d untouched (not from this kit).\n",
		updated, untouched)
	return nil
}
