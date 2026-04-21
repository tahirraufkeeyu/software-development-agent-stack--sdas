package main

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"
)

var showCmd = &cobra.Command{
	Use:     "show <skill-slug>",
	Aliases: []string{"cat", "view"},
	Short:   "Print a skill's SKILL.md to stdout",
	Long: `Reads the embedded SKILL.md for the given skill and prints it as
Markdown to stdout. Useful for piping into ` + "`glow`" + `, ` + "`bat`" + `, or any
pager:

  skillskit show code-review | glow -
  skillskit show monitoring-setup | less

Or just copy it:

  skillskit show code-review > ~/my-code-review.md

By default, --frontmatter-only prints just the YAML frontmatter block
so you can inspect the skill's metadata without scrolling the body.

Examples:
  skillskit show code-review
  skillskit show monitoring-setup --frontmatter-only
  skillskit show full-security-audit | less`,
	Args: cobra.ExactArgs(1),
	RunE: runShow,
}

var showFrontmatterOnly bool

func init() {
	showCmd.Flags().BoolVar(&showFrontmatterOnly, "frontmatter-only", false,
		"print only the YAML frontmatter block (not the body)")
	rootCmd.AddCommand(showCmd)
}

func runShow(cmd *cobra.Command, args []string) error {
	slug := args[0]
	dept := findDepartmentOf(slug)
	if dept == "" {
		return errf(
			"no skill named %q in this binary.\n"+
				"  Departments: %s\n"+
				"  Try: skillskit search %q",
			slug, departmentsString(), slug,
		)
	}

	body, err := loadSkillBody(dept, slug)
	if err != nil {
		return errf("read %s: %w", slug, err)
	}

	if showFrontmatterOnly {
		// Emit just the frontmatter block, including the --- delimiters.
		fm, _, err := splitFrontmatter(body)
		if err != nil {
			return errf("parse %s frontmatter: %w", slug, err)
		}
		fmt.Fprintln(cmd.OutOrStdout(), "---")
		fmt.Fprint(cmd.OutOrStdout(), string(fm))
		if !strings.HasSuffix(string(fm), "\n") {
			fmt.Fprintln(cmd.OutOrStdout())
		}
		fmt.Fprintln(cmd.OutOrStdout(), "---")
		return nil
	}

	// Full document.
	fmt.Fprint(cmd.OutOrStdout(), string(body))
	if !strings.HasSuffix(string(body), "\n") {
		fmt.Fprintln(cmd.OutOrStdout())
	}
	return nil
}
