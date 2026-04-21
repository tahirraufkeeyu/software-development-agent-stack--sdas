package main

import (
	"fmt"
	"sort"
	"strings"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List installed skills (or every skill the kit ships)",
	Long: `List skills.

By default, lists the skills currently installed in the target host's
skills directory (controlled by --host). Use --available to instead
list every skill that's bundled with this skillskit binary.

Output is a table with columns: slug, department, safety level, and
description (truncated). Use --long to print the full description.

Examples:
  skillskit list                           # installed skills, claude host
  skillskit list --host cursor             # installed skills for cursor
  skillskit list --available               # every skill the kit ships
  skillskit list --available --long        # all skills, full descriptions
  skillskit list --available -d security   # only one department`,
	RunE: runList,
}

var (
	listAvailable  bool
	listLong       bool
	listDepartment string
)

func init() {
	listCmd.Flags().BoolVarP(&listAvailable, "available", "a", false,
		"list every skill shipped in this binary, not just installed ones")
	listCmd.Flags().BoolVarP(&listLong, "long", "l", false,
		"show full descriptions (default is truncated to 80 chars)")
	listCmd.Flags().StringVarP(&listDepartment, "department", "d", "",
		"filter by department slug (implies --available)")
	rootCmd.AddCommand(listCmd)
}

func runList(cmd *cobra.Command, _ []string) error {
	// If the user passed -d they clearly want to browse; imply --available.
	if listDepartment != "" {
		listAvailable = true
	}

	skills, err := collectSkillsForList()
	if err != nil {
		return err
	}
	if listDepartment != "" {
		filtered := skills[:0]
		for _, s := range skills {
			if s.Department == listDepartment {
				filtered = append(filtered, s)
			}
		}
		skills = filtered
	}

	if len(skills) == 0 {
		if listAvailable {
			fmt.Fprintln(cmd.OutOrStdout(), "No skills matched.")
		} else {
			target, _ := hostTarget(persistentHost)
			fmt.Fprintf(cmd.OutOrStdout(),
				"No skills installed at %s.\n"+
					"  Run `skillskit install all` to install the kit.\n",
				target)
		}
		return nil
	}

	// Table: SLUG DEPARTMENT SAFETY DESCRIPTION
	sort.Slice(skills, func(i, j int) bool {
		if skills[i].Department != skills[j].Department {
			return skills[i].Department < skills[j].Department
		}
		// Orchestrators sink to bottom of each department.
		if skills[i].IsOrchestrator() != skills[j].IsOrchestrator() {
			return !skills[i].IsOrchestrator()
		}
		return skills[i].Name < skills[j].Name
	})

	tw := tabwriter.NewWriter(cmd.OutOrStdout(), 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "SLUG\tDEPARTMENT\tSAFETY\tDESCRIPTION")
	fmt.Fprintln(tw, "----\t----------\t------\t-----------")
	for _, s := range skills {
		name := s.Name
		if s.IsOrchestrator() {
			name += "*" // marker for orchestrator
		}
		desc := s.Description
		if !listLong && len(desc) > 80 {
			desc = desc[:77] + "..."
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\t%s\n", name, s.Department, s.Safety, desc)
	}
	if err := tw.Flush(); err != nil {
		return err
	}

	// Footer
	hasOrchestrator := false
	for _, s := range skills {
		if s.IsOrchestrator() {
			hasOrchestrator = true
			break
		}
	}
	footer := fmt.Sprintf("\n%d skill(s)", len(skills))
	if hasOrchestrator {
		footer += " — * marks workflow orchestrators (chain other skills)"
	}
	fmt.Fprintln(cmd.OutOrStdout(), footer)
	return nil
}

// collectSkillsForList returns the skills to render — either all
// embedded (--available) or just those installed at the target host.
// In the installed case, we still look up the embedded metadata so
// we can show accurate department/safety/description columns.
func collectSkillsForList() ([]*Skill, error) {
	if listAvailable {
		return allSkills()
	}

	target, err := hostTarget(persistentHost)
	if err != nil {
		return nil, err
	}
	slugs, err := installedSkills(target)
	if err != nil {
		return nil, err
	}
	all, err := allSkills()
	if err != nil {
		return nil, err
	}
	// Index by slug for quick lookup.
	bySlug := make(map[string]*Skill, len(all))
	for _, s := range all {
		bySlug[s.Name] = s
	}
	out := make([]*Skill, 0, len(slugs))
	for _, slug := range slugs {
		if sk, ok := bySlug[slug]; ok {
			out = append(out, sk)
			continue
		}
		// Installed but not in the embedded kit — still show it, with
		// the metadata we can glean from the file on disk. Sparse Skill
		// so the row renders without panicking on nil fields.
		out = append(out, &Skill{
			Name:        slug,
			Department:  "(external)",
			Safety:      "?",
			Description: "installed on disk; not shipped by this skillskit binary",
		})
	}
	return out, nil
}

// departmentsString is a small helper used by other commands when
// reporting invalid input — e.g. "Available departments: a, b, c".
func departmentsString() string {
	depts, err := listEmbeddedDepartments()
	if err != nil {
		return ""
	}
	return strings.Join(depts, ", ")
}
