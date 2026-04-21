package main

import (
	"fmt"
	"runtime"

	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version, commit, build date, and embedded skill count",
	Long: `Prints the release version of this skillskit binary along with the
git commit it was built from, the build date, the Go version and target
platform, and the total number of skills + departments baked into the
binary.

Use this when opening a bug report — paste the output so we can tell
exactly which build behaves the way you describe.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Count what's embedded. Done at runtime because it's cheap and
		// avoids baking another constant that must be kept in sync.
		depts, err := listEmbeddedDepartments()
		if err != nil {
			return errf("failed to inventory embedded skills: %w", err)
		}
		total := 0
		for _, d := range depts {
			skills, _ := listEmbeddedSkills(d)
			total += len(skills)
		}

		fmt.Fprintf(cmd.OutOrStdout(), "skillskit %s\n", Version)
		fmt.Fprintf(cmd.OutOrStdout(), "  commit:   %s\n", Commit)
		fmt.Fprintf(cmd.OutOrStdout(), "  built:    %s\n", Date)
		fmt.Fprintf(cmd.OutOrStdout(), "  go:       %s\n", runtime.Version())
		fmt.Fprintf(cmd.OutOrStdout(), "  platform: %s/%s\n", runtime.GOOS, runtime.GOARCH)
		fmt.Fprintf(cmd.OutOrStdout(), "  embedded: %d skills across %d departments\n", total, len(depts))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
